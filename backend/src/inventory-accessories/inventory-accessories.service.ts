import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { InventoryAccessory } from '../entities/inventory-accessory.entity';
import { InventoryAccessoryOutbound } from '../entities/inventory-accessory-outbound.entity';
import { InventoryAccessoryOperationLog } from '../entities/inventory-accessory-operation-log.entity';
import { User, UserStatus } from '../entities/user.entity';
import { InventoryStockExportMode } from '../common/inventory-stock-export.dto';
import {
  applySizedOutbound,
  distributeProportional,
  assertManualAccessoryOutbound,
  toAccessorySnapshot,
  type AccessoryOutboundNegative,
  type InventoryAccessoryOutboundParams,
  type InventoryAccessoryOutboundResult,
} from './inventory-accessory.helpers';
import {
  applyInventoryAccessoryListFilters,
  type InventoryAccessoryListFilters,
} from './inventory-accessories-list-query';
import { getAccessoryOutboundRecords } from './inventory-accessories-outbound-query';
import { AccessoryStockWriter, runAccessoryWrite } from './inventory-accessory-write';

@Injectable()
export class InventoryAccessoriesService {
  private readonly logger = new Logger(InventoryAccessoriesService.name);

  constructor(
    @InjectRepository(InventoryAccessory)
    private readonly repo: Repository<InventoryAccessory>,
    @InjectRepository(InventoryAccessoryOutbound)
    private readonly outboundRepo: Repository<InventoryAccessoryOutbound>,
    @InjectRepository(InventoryAccessoryOperationLog)
    private readonly operationLogRepo: Repository<InventoryAccessoryOperationLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private isMissingTableError(error: unknown): boolean {
    const e = error as { code?: string; errno?: number; message?: string } | undefined;
    const msg = String(e?.message ?? '').toLowerCase();
    return e?.code === 'ER_NO_SUCH_TABLE' || e?.errno === 1146 || msg.includes("doesn't exist");
  }

  async getList(params: InventoryAccessoryListFilters & {
    skipTotal?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: InventoryAccessory[]; total: number; totalQuantity: number; page: number; pageSize: number }> {
    const { skipTotal = false, page = 1, pageSize = 20 } = params;
    const qb = applyInventoryAccessoryListFilters(this.repo.createQueryBuilder('a'), params);
    const totalQuantityRow = skipTotal
      ? null
      : await qb
          .clone()
          .select('COALESCE(SUM(a.quantity), 0)', 'sum')
          .getRawOne<{ sum: string | number | null }>();
    const totalQuantity = Number(totalQuantityRow?.sum ?? 0) || 0;
    qb.orderBy('a.created_at', 'DESC');

    const total = skipTotal ? 0 : await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { list, total, totalQuantity, page, pageSize };
  }

  async getRowsForExport(
    params: InventoryAccessoryListFilters & { mode: InventoryStockExportMode; selectedIds?: number[] },
  ): Promise<InventoryAccessory[]> {
    const selectedIds = Array.from(new Set(params.selectedIds ?? []));
    const qb = this.repo.createQueryBuilder('a');
    if (params.mode === InventoryStockExportMode.Selected) {
      qb.andWhere('a.id IN (:...selectedIds)', { selectedIds });
    } else {
      applyInventoryAccessoryListFilters(qb, params);
    }
    return qb.orderBy('a.created_at', 'DESC').addOrderBy('a.id', 'DESC').getMany();
  }

  async getOne(id: number): Promise<InventoryAccessory> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('辅料记录不存在');
    return item;
  }

  async create(dto: Parameters<AccessoryStockWriter['create']>[0]): Promise<InventoryAccessory> {
    return runAccessoryWrite(this.repo.manager, (writer) => writer.create(dto));
  }

  async restock(id: number, dto: Parameters<AccessoryStockWriter['restock']>[1]): Promise<InventoryAccessory> {
    return runAccessoryWrite(this.repo.manager, (writer) => writer.restock(id, dto));
  }

  async update(id: number, dto: Parameters<AccessoryStockWriter['update']>[1]): Promise<InventoryAccessory> {
    return runAccessoryWrite(this.repo.manager, (writer) => writer.update(id, dto));
  }

  async remove(id: number, operatorUsername = ''): Promise<void> {
    return runAccessoryWrite(this.repo.manager, (writer) => writer.remove(id, operatorUsername));
  }

  /** 出库弹窗「领取人」下拉：返回全公司可用用户 */
  async getUserOptions(): Promise<{ id: number; username: string; displayName: string }[]> {
    const list = await this.userRepo.find({
      where: { status: UserStatus.ACTIVE },
      order: { id: 'ASC' },
    });
    return list.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName ?? '',
    }));
  }

  async resolveOperatorLabel(userId: number, fallbackUsername: string): Promise<string> {
    const fallback = (fallbackUsername ?? '').trim();
    try {
      const u = await this.userRepo.findOne({ where: { id: userId } });
      const label = (u?.displayName ?? '').trim() || (u?.username ?? '').trim() || fallback;
      return label || fallback;
    } catch {
      return fallback;
    }
  }

  async outbound(params: InventoryAccessoryOutboundParams): Promise<InventoryAccessoryOutboundResult> {
    return this.repo.manager.transaction((manager) => this.outboundInTransaction(manager, params));
  }

  async outboundInTransaction(
    manager: EntityManager,
    params: InventoryAccessoryOutboundParams,
  ): Promise<InventoryAccessoryOutboundResult> {
    const qty = Number(params.quantity) || 0;
    if (!params.accessoryId || qty <= 0) {
      throw new BadRequestException('出库参数不合法');
    }

    const accessoryRepo = manager.getRepository(InventoryAccessory);
    const recordRepo = manager.getRepository(InventoryAccessoryOutbound);
    const operationLogRepo = manager.getRepository(InventoryAccessoryOperationLog);

    const accessory = await accessoryRepo
      .createQueryBuilder('a')
      .setLock('pessimistic_write')
      .where('a.id = :id', { id: params.accessoryId })
      .getOne();

    if (!accessory) throw new NotFoundException('辅料记录不存在');
    if (params.enforceAvailableStock) assertManualAccessoryOutbound(accessory, params);

    const before = Number(accessory.quantity) || 0;
    const beforeSnapshot = toAccessorySnapshot(accessory);

    // 订单自动扣料及采购领料保留原规则；库存页手动出库已在行锁内逐码校验。
    const negatives: AccessoryOutboundNegative[] = [];
    let recordSizeOutbound: { headers: string[]; quantities: number[] } | null = null;
    let recordQty = qty;

    if (accessory.isSized) {
      let deductHeaders: string[];
      let deductQuantities: number[];
      if (params.sizeOutbound && params.sizeOutbound.headers.length) {
        deductHeaders = params.sizeOutbound.headers;
        deductQuantities = params.sizeOutbound.quantities.map((q) => Number(q) || 0);
      } else {
        // R4 兜底：无按码明细时按现有各码比例（最大余数）拆分 qty，保持「总量=各码和」
        deductHeaders = [...(accessory.sizeHeaders ?? [])];
        deductQuantities = distributeProportional(
          (accessory.sizeQuantities ?? []).map((q) => Number(q) || 0),
          qty,
        );
      }

      const outcome = applySizedOutbound(
        accessory.sizeHeaders,
        accessory.sizeQuantities,
        deductHeaders,
        deductQuantities,
      );
      accessory.sizeHeaders = outcome.headers;
      accessory.sizeQuantities = outcome.quantities;
      accessory.quantity = outcome.total;
      negatives.push(...outcome.negatives);
      recordSizeOutbound = outcome.deduct;
      recordQty = outcome.deduct.quantities.reduce((sum, q) => sum + q, 0);
    } else {
      accessory.quantity = before - qty;
      if (accessory.quantity < 0) negatives.push({ size: null, after: accessory.quantity });
    }

    const savedAccessory = await accessoryRepo.save(accessory);

    const record = recordRepo.create({
      accessoryId: params.accessoryId,
      orderId: params.orderId ?? null,
      orderNo: params.orderNo ?? '',
      outboundType: params.outboundType,
      quantity: recordQty,
      sizeOutbound: recordSizeOutbound,
      beforeQuantity: before,
      afterQuantity: savedAccessory.quantity,
      operatorUsername: (params.operatorUsername ?? '').trim(),
      remark: (params.remark ?? '').trim(),
    });
    const savedRecord = await recordRepo.save(record);
    await operationLogRepo.save(
      operationLogRepo.create({
        accessoryId: params.accessoryId,
        action: 'outbound',
        operatorUsername: (params.operatorUsername ?? '').trim(),
        beforeSnapshot,
        afterSnapshot: toAccessorySnapshot(savedAccessory),
        remark: (params.remark ?? '').trim(),
      }),
    );

    return { accessory: savedAccessory, record: savedRecord, negatives };
  }

  async getOutboundRecords(params: Parameters<typeof getAccessoryOutboundRecords>[1]) {
    return getAccessoryOutboundRecords(this.outboundRepo, params);
  }

  async getOperationLogs(accessoryId: number): Promise<InventoryAccessoryOperationLog[]> {
    await this.getOne(accessoryId);
    try {
      const logs = await this.operationLogRepo.find({
        where: { accessoryId },
        order: { createdAt: 'DESC' },
      });
      const usernames = Array.from(new Set(logs.map((log) => String(log.operatorUsername ?? '').trim()).filter(Boolean)));
      const users = usernames.length
        ? await this.userRepo.find({ where: [{ username: In(usernames) }, { displayName: In(usernames) }] })
        : [];
      const displayNameByStoredValue = new Map<string, string>();
      users.forEach((user) => {
        const displayName = String(user.displayName ?? '').trim();
        if (!displayName) return;
        displayNameByStoredValue.set(String(user.username ?? '').trim(), displayName);
        displayNameByStoredValue.set(displayName, displayName);
      });
      return logs.map((log) => {
        const storedValue = String(log.operatorUsername ?? '').trim();
        return {
          ...log,
          operatorUsername: storedValue ? (displayNameByStoredValue.get(storedValue) ?? '未知用户') : '',
        };
      });
    } catch (error) {
      if (!this.isMissingTableError(error)) throw error;
      this.logger.warn('inventory_accessory_operation_log 表不存在，已返回空操作日志');
      return [];
    }
  }
}
