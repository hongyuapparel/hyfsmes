import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { InventoryAccessory } from '../entities/inventory-accessory.entity';
import { InventoryAccessoryOutbound } from '../entities/inventory-accessory-outbound.entity';
import { InventoryAccessoryOperationLog } from '../entities/inventory-accessory-operation-log.entity';
import { User, UserStatus } from '../entities/user.entity';
import { normalizeSizeMatrix } from '../common/size-headers.util';
import {
  applySizedOutbound,
  distributeProportional,
  mapOutboundRawRow,
  toAccessorySnapshot,
  type AccessoryOutboundNegative,
  type AccessoryOutboundRawRow,
  type InventoryAccessoryOutboundParams,
  type InventoryAccessoryOutboundResult,
} from './inventory-accessory.helpers';

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

  private normalizeName(value: unknown): string {
    return String(value ?? '').trim();
  }

  private normalizeImageUrls(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((url) => String(url ?? '').trim())
      .filter((url) => !!url);
  }

  private async findByName(name: string): Promise<InventoryAccessory | null> {
    const normalized = this.normalizeName(name);
    if (!normalized) return null;
    return this.repo
      .createQueryBuilder('a')
      .where('a.name = :name', { name: normalized })
      .orderBy('a.id', 'ASC')
      .getOne();
  }

  private async addOperationLog(params: {
    accessoryId: number;
    action: string;
    operatorUsername: string;
    beforeSnapshot?: Record<string, unknown> | null;
    afterSnapshot?: Record<string, unknown> | null;
    remark?: string;
  }) {
    try {
      const row = this.operationLogRepo.create({
        accessoryId: params.accessoryId,
        action: params.action,
        operatorUsername: (params.operatorUsername ?? '').trim(),
        beforeSnapshot: params.beforeSnapshot ?? null,
        afterSnapshot: params.afterSnapshot ?? null,
        remark: (params.remark ?? '').trim(),
      });
      await this.operationLogRepo.save(row);
    } catch (error) {
      if (this.isMissingTableError(error)) {
        this.logger.warn('操作记录表不存在，已跳过本次辅料操作日志写入');
        return;
      }
      throw error;
    }
  }

  async getList(params: {
    name?: string;
    category?: string;
    customerName?: string;
    salesperson?: string;
    startDate?: string;
    endDate?: string;
    skipTotal?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: InventoryAccessory[]; total: number; page: number; pageSize: number }> {
    const { name, category, customerName, salesperson, startDate, endDate, skipTotal = false, page = 1, pageSize = 20 } = params;
    const qb = this.repo.createQueryBuilder('a');

    if (name?.trim()) {
      qb.andWhere('a.name LIKE :name', { name: `%${name.trim()}%` });
    }
    if (category?.trim()) {
      qb.andWhere('a.category = :category', { category: category.trim() });
    }
    if (customerName?.trim()) {
      qb.andWhere('a.customer_name LIKE :customerName', {
        customerName: `%${customerName.trim()}%`,
      });
    }
    if (salesperson?.trim()) {
      qb.andWhere('a.salesperson = :salesperson', { salesperson: salesperson.trim() });
    }
    if (startDate?.trim()) {
      qb.andWhere('a.created_at >= :inboundStart', { inboundStart: `${startDate.trim()} 00:00:00` });
    }
    if (endDate?.trim()) {
      qb.andWhere('a.created_at <= :inboundEnd', { inboundEnd: `${endDate.trim()} 23:59:59` });
    }
    qb.orderBy('a.created_at', 'DESC');

    const total = skipTotal ? 0 : await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { list, total, page, pageSize };
  }

  async getOne(id: number): Promise<InventoryAccessory> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('辅料记录不存在');
    return item;
  }

  async create(dto: {
    name: string;
    category?: string;
    quantity?: number;
    isSized?: boolean;
    sizeHeaders?: string[];
    sizeQuantities?: number[];
    unit?: string;
    warehouseId?: number | null;
    location?: string;
    remark?: string;
    imageUrl?: string;
    imageUrls?: string[];
    customerName?: string;
    salesperson?: string;
    operatorUsername?: string;
  }): Promise<InventoryAccessory> {
    const name = this.normalizeName(dto.name);
    if (!name) throw new BadRequestException('辅料名称不能为空');
    const isSized = !!dto.isSized;
    const matrix = isSized ? normalizeSizeMatrix(dto.sizeHeaders, dto.sizeQuantities) : null;
    if (isSized && (!matrix || !matrix.headers.length)) {
      throw new BadRequestException('请填写分码尺码明细');
    }
    const qty = isSized ? matrix!.total : Number(dto.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException(isSized ? '分码新增数量合计必须大于 0' : '新增数量必须大于 0');
    }
    const salesperson = (dto.salesperson ?? '').trim();
    if (!salesperson) throw new BadRequestException('业务员不能为空');
    const imageUrls = this.normalizeImageUrls(dto.imageUrls);
    const mainImageUrl = imageUrls[0] ?? this.normalizeName(dto.imageUrl);
    const existing = await this.findByName(name);
    if (existing) {
      const before = toAccessorySnapshot(existing);
      if (existing.isSized) {
        if (!matrix) {
          throw new BadRequestException('该辅料为分码辅料，请按尺码录入入库数量');
        }
        const merged = normalizeSizeMatrix(
          [...(existing.sizeHeaders ?? []), ...matrix.headers],
          [...(existing.sizeQuantities ?? []), ...matrix.quantities],
        );
        existing.sizeHeaders = merged.headers;
        existing.sizeQuantities = merged.quantities;
        existing.quantity = merged.total;
      } else {
        if (isSized) {
          throw new BadRequestException(
            '已存在同名「非分码」辅料，无法按分码新增；请在该辅料「编辑」里开启分码，或换一个名称',
          );
        }
        existing.quantity = (Number(existing.quantity) || 0) + qty;
      }
      if (!existing.category && dto.category) existing.category = dto.category.trim();
      if (!existing.unit && dto.unit) existing.unit = dto.unit.trim();
      if (existing.warehouseId == null && dto.warehouseId != null) existing.warehouseId = dto.warehouseId;
      if (!existing.location && dto.location) existing.location = dto.location.trim();
      if (!existing.customerName && dto.customerName) existing.customerName = dto.customerName.trim();
      if (!existing.salesperson && salesperson) existing.salesperson = salesperson;
      if (!existing.imageUrl && mainImageUrl) existing.imageUrl = mainImageUrl;
      if ((!existing.imageUrls || !existing.imageUrls.length) && imageUrls.length) existing.imageUrls = imageUrls;
      const savedExisting = await this.repo.save(existing);
      await this.addOperationLog({
        accessoryId: savedExisting.id,
        action: 'inbound',
        operatorUsername: dto.operatorUsername ?? '',
        beforeSnapshot: before,
        afterSnapshot: toAccessorySnapshot(savedExisting),
        remark: dto.remark ?? '',
      });
      return savedExisting;
    }
    const entity = this.repo.create({
      name,
      category: dto.category?.trim() ?? '',
      quantity: qty,
      isSized,
      sizeHeaders: isSized ? matrix!.headers : null,
      sizeQuantities: isSized ? matrix!.quantities : null,
      unit: dto.unit?.trim() ?? '个',
      warehouseId: dto.warehouseId ?? null,
      location: dto.location?.trim() ?? '',
      remark: dto.remark?.trim() ?? '',
      imageUrl: mainImageUrl || '',
      imageUrls: imageUrls.length ? imageUrls : null,
      customerName: dto.customerName?.trim() ?? '',
      salesperson,
    });
    const saved = await this.repo.save(entity);
    await this.addOperationLog({
      accessoryId: saved.id,
      action: 'create',
      operatorUsername: dto.operatorUsername ?? '',
      beforeSnapshot: null,
      afterSnapshot: toAccessorySnapshot(saved),
    });
    return saved;
  }

  async update(
    id: number,
    dto: {
      name?: string;
      category?: string;
      quantity?: number;
      isSized?: boolean;
      sizeHeaders?: string[];
      sizeQuantities?: number[];
      unit?: string;
      warehouseId?: number | null;
      location?: string;
      remark?: string;
      imageUrl?: string;
      imageUrls?: string[];
      customerName?: string;
      salesperson?: string;
      operatorUsername?: string;
    },
  ): Promise<InventoryAccessory> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('辅料记录不存在');
    const before = toAccessorySnapshot(item);
    if (dto.isSized !== undefined) {
      if (dto.isSized) {
        const matrix = normalizeSizeMatrix(dto.sizeHeaders, dto.sizeQuantities);
        if (!matrix || !matrix.headers.length) {
          throw new BadRequestException('请填写分码尺码明细');
        }
        item.isSized = true;
        item.sizeHeaders = matrix.headers;
        item.sizeQuantities = matrix.quantities;
        item.quantity = matrix.total;
      } else {
        item.isSized = false;
        item.sizeHeaders = null;
        item.sizeQuantities = null;
      }
    }
    if (dto.name !== undefined) {
      const nextName = this.normalizeName(dto.name);
      if (!nextName) throw new BadRequestException('辅料名称不能为空');
      const existing = await this.findByName(nextName);
      if (existing && existing.id !== id) {
        throw new BadRequestException('辅料名称已存在，不能改成重复名称');
      }
      item.name = nextName;
    }
    if (dto.category !== undefined) item.category = dto.category?.trim() ?? '';
    if (dto.unit !== undefined) item.unit = dto.unit?.trim() ?? '个';
    if (dto.warehouseId !== undefined) item.warehouseId = dto.warehouseId ?? null;
    if (dto.location !== undefined) item.location = dto.location?.trim() ?? '';
    if (dto.remark !== undefined) item.remark = dto.remark?.trim() ?? '';
    if (dto.imageUrls !== undefined) {
      const imageUrls = this.normalizeImageUrls(dto.imageUrls);
      item.imageUrls = imageUrls.length ? imageUrls : null;
      item.imageUrl = imageUrls[0] ?? '';
    } else if (dto.imageUrl !== undefined) {
      const imageUrl = dto.imageUrl?.trim() ?? '';
      item.imageUrl = imageUrl;
      item.imageUrls = imageUrl ? [imageUrl] : null;
    }
    if (dto.customerName !== undefined) item.customerName = dto.customerName?.trim() ?? '';
    if (dto.salesperson !== undefined) {
      const salesperson = dto.salesperson?.trim() ?? '';
      if (!salesperson) throw new BadRequestException('业务员不能为空');
      item.salesperson = salesperson;
    }
    const saved = await this.repo.save(item);
    await this.addOperationLog({
      accessoryId: saved.id,
      action: 'update',
      operatorUsername: dto.operatorUsername ?? '',
      beforeSnapshot: before,
      afterSnapshot: toAccessorySnapshot(saved),
    });
    return saved;
  }

  async remove(id: number, operatorUsername = ''): Promise<void> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('辅料记录不存在');
    const before = toAccessorySnapshot(item);
    await this.repo.remove(item);
    await this.addOperationLog({
      accessoryId: id,
      action: 'delete',
      operatorUsername,
      beforeSnapshot: before,
      afterSnapshot: null,
    });
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

    const before = Number(accessory.quantity) || 0;
    const beforeSnapshot = toAccessorySnapshot(accessory);

    // 允许负库存：库存不足不再报错，扣成负数作为「待订购」信号，入库后自然抵消。
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
    try {
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
    } catch (error) {
      if (!this.isMissingTableError(error)) throw error;
      this.logger.warn('操作记录表不存在，已跳过本次辅料出库日志写入');
    }

    return { accessory: savedAccessory, record: savedRecord, negatives };
  }

  async getOutboundRecords(params: {
    accessoryId?: number;
    orderNo?: string;
    outboundType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    list: Array<
      Omit<InventoryAccessoryOutbound, 'createdAt'> & {
        createdAt: string;
        imageUrl?: string;
        customerName?: string;
        category?: string;
      }
    >;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { accessoryId, orderNo, outboundType, page = 1, pageSize = 20 } = params;
    const qb = this.outboundRepo
      .createQueryBuilder('r')
      .leftJoin(InventoryAccessory, 'a', 'a.id = r.accessory_id')
      .select([
        'r.id AS id',
        'r.accessory_id AS accessoryId',
        'r.order_id AS orderId',
        'r.order_no AS orderNo',
        'r.outbound_type AS outboundType',
        'r.quantity AS quantity',
        'r.before_quantity AS beforeQuantity',
        'r.after_quantity AS afterQuantity',
        'r.operator_username AS operatorUsername',
        'r.remark AS remark',
        'r.created_at AS createdAt',
        'r.size_outbound AS sizeOutbound',
        "COALESCE(a.image_url, '') AS imageUrl",
        "COALESCE(a.customer_name, '') AS customerName",
        "COALESCE(a.category, '') AS category",
      ]);
    if (accessoryId) qb.andWhere('r.accessory_id = :accessoryId', { accessoryId });
    if (orderNo?.trim()) qb.andWhere('r.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    if (outboundType?.trim()) qb.andWhere('r.outbound_type = :outboundType', { outboundType: outboundType.trim() });
    qb.orderBy('r.created_at', 'DESC');

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getRawMany<AccessoryOutboundRawRow>();
    const rows = list.map(mapOutboundRawRow);
    return { list: rows, total, page, pageSize };
  }

  async getOperationLogs(accessoryId: number): Promise<InventoryAccessoryOperationLog[]> {
    await this.getOne(accessoryId);
    try {
      return await this.operationLogRepo.find({
        where: { accessoryId },
        order: { createdAt: 'DESC' },
      });
    } catch (error) {
      if (!this.isMissingTableError(error)) throw error;
      this.logger.warn('inventory_accessory_operation_log 表不存在，已返回空操作日志');
      return [];
    }
  }
}
