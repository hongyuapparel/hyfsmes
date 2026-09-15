import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { FabricStock } from '../entities/fabric-stock.entity';
import { FabricOutbound } from '../entities/fabric-outbound.entity';
import { FabricStockOperationLog } from '../entities/fabric-stock-operation-log.entity';
import { Supplier } from '../entities/supplier.entity';
import { User, UserStatus } from '../entities/user.entity';
import { SystemOptionsService } from '../system-options/system-options.service';
import {
  calculateFabricAmount,
  calculateFabricInboundUnitPrice,
  calculateFabricWeightedUnitPrice,
  normalizeFabricOtherCost,
  normalizeFabricUnitPrice,
} from './fabric-stock-valuation';
import { FabricStockQueryService, type FabricStockListRow } from './fabric-stock-query.service';

const FABRIC_SUPPLIER_TYPE_VALUE = '面料供应商';

@Injectable()
export class FabricStockService {
  private readonly logger = new Logger(FabricStockService.name);

  constructor(
    @InjectRepository(FabricStock)
    private readonly stockRepo: Repository<FabricStock>,
    @InjectRepository(FabricStockOperationLog)
    private readonly operationLogRepo: Repository<FabricStockOperationLog>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly systemOptionsService: SystemOptionsService,
    private readonly queryService: FabricStockQueryService,
    private readonly dataSource: DataSource,
  ) {}

  private toSnapshot(item: FabricStock): Record<string, unknown> {
    return {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      amount: calculateFabricAmount(item.quantity, item.unitPrice),
      unit: item.unit,
      customerName: item.customerName,
      supplierId: item.supplierId,
      warehouseId: item.warehouseId,
      inventoryTypeId: item.inventoryTypeId,
      storageLocation: item.storageLocation,
      imageUrl: item.imageUrl,
      remark: item.remark,
    };
  }


  /**
   * system_options 中「面料供应商」根节点 id（与供应商列表按 type 解析一致；value 按 trim 比对以兼容库内首尾空格）
   */
  private async resolveFabricSupplierTypeOptionIds(): Promise<number[]> {
    const all = await this.systemOptionsService.findAllByType('supplier_types');
    const target = FABRIC_SUPPLIER_TYPE_VALUE.trim();
    return all
      .filter(
        (o) =>
          o.parentId == null &&
          (typeof o.value === 'string' ? o.value.trim() : String(o.value ?? '').trim()) === target,
      )
      .map((o) => o.id);
  }

  /** 面料库存页：仅 supplier_type_id 属于「面料供应商」根类型的供应商（不用 JOIN+getMany，避免 ORM 组合下结果异常） */
  async listFabricSupplierOptions(): Promise<{ id: number; name: string }[]> {
    const typeIds = await this.resolveFabricSupplierTypeOptionIds();
    if (!typeIds.length) return [];
    const rows = await this.supplierRepo.find({
      where: { supplierTypeId: In(typeIds) },
      order: { id: 'ASC' },
    });
    return rows.map((r) => ({ id: r.id, name: r.name }));
  }

  async getPickupUserOptions(): Promise<{ id: number; username: string; displayName: string }[]> {
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

  private async assertFabricSupplierId(supplierId: number): Promise<void> {
    const typeIds = await this.resolveFabricSupplierTypeOptionIds();
    if (!typeIds.length) {
      throw new BadRequestException('系统未配置「面料供应商」供应商类型');
    }
    const s = await this.supplierRepo.findOne({
      where: { id: supplierId },
      select: ['id', 'supplierTypeId'],
    });
    if (s == null) throw new BadRequestException('供应商不存在');
    if (s.supplierTypeId == null || !typeIds.includes(s.supplierTypeId)) {
      throw new BadRequestException('供应商不存在或类型不是面料供应商');
    }
  }

  private async assertWarehouseId(warehouseId: number): Promise<void> {
    const opts = await this.systemOptionsService.findAllByType('warehouses');
    if (!opts.some((o) => o.id === warehouseId)) {
      throw new BadRequestException('仓库选项无效');
    }
  }

  private normalizeOptionalPositiveInt(v: unknown): number | null {
    if (v === undefined || v === null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.floor(n);
  }

  private normalizeName(value: unknown): string {
    return String(value ?? '').trim();
  }

  private async findByName(name: string): Promise<FabricStock | null> {
    const normalized = this.normalizeName(name);
    if (!normalized) return null;
    return this.stockRepo
      .createQueryBuilder('s')
      .where('s.name = :name', { name: normalized })
      .orderBy('s.id', 'ASC')
      .getOne();
  }

  private async addOperationLog(params: {
    fabricStockId: number;
    action: string;
    operatorUsername: string;
    beforeSnapshot?: Record<string, unknown> | null;
    afterSnapshot?: Record<string, unknown> | null;
    remark?: string;
  }) {
    try {
      const row = this.operationLogRepo.create({
        fabricStockId: params.fabricStockId,
        action: params.action,
        operatorUsername: (params.operatorUsername ?? '').trim(),
        beforeSnapshot: params.beforeSnapshot ?? null,
        afterSnapshot: params.afterSnapshot ?? null,
        remark: (params.remark ?? '').trim(),
      });
      await this.operationLogRepo.save(row);
    } catch (e: unknown) {
      if (this.isTableMissingError(e, 'fabric_stock_operation_log')) {
        // 领料/出入库主流程不依赖该日志表，缺表时降级为仅记录告警日志。
        this.logger.warn('fabric_stock_operation_log 表不存在，已跳过操作日志写入');
        return;
      }
      throw e;
    }
  }

  private isTableMissingError(error: unknown, tableName: string): boolean {
    const msg = String((error as { message?: unknown })?.message ?? error ?? '').toLowerCase();
    return msg.includes("doesn't exist") && msg.includes(tableName.toLowerCase());
  }

  async getList(params: Parameters<FabricStockQueryService['getList']>[0]) {
    return this.queryService.getList(params);
  }

  async getRowsForExport(params: Parameters<FabricStockQueryService['getRowsForExport']>[0]): Promise<FabricStockListRow[]> {
    return this.queryService.getRowsForExport(params);
  }

  async getOne(id: number): Promise<FabricStockListRow> {
    return this.queryService.getOne(id);
  }

  async create(dto: {
    name: string;
    quantity?: number;
    unit?: string;
    customerName?: string;
    remark?: string;
    imageUrl?: string;
    supplierId?: unknown;
    warehouseId?: unknown;
    inventoryTypeId?: unknown;
    storageLocation?: string;
    unitPrice?: unknown;
    otherCost?: unknown;
    operatorUsername?: string;
  }): Promise<FabricStockListRow> {
    const name = this.normalizeName(dto.name);
    if (!name) throw new BadRequestException('面料名称不能为空');
    const qty = Number(dto.quantity ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException('新增数量必须大于 0');
    }
    const supplierId = this.normalizeOptionalPositiveInt(dto.supplierId);
    const warehouseId = this.normalizeOptionalPositiveInt(dto.warehouseId);
    const inventoryTypeId = this.normalizeOptionalPositiveInt(dto.inventoryTypeId);
    const inboundUnitPrice = calculateFabricInboundUnitPrice(qty, dto.unitPrice, dto.otherCost);
    const otherCost = normalizeFabricOtherCost(dto.otherCost);
    if (supplierId != null) await this.assertFabricSupplierId(supplierId);
    if (warehouseId != null) await this.assertWarehouseId(warehouseId);
    const existing = await this.findByName(name);
    if (existing) {
      const incomingUnit = dto.unit === undefined ? String(existing.unit ?? '').trim() : dto.unit.trim();
      if (incomingUnit !== String(existing.unit ?? '').trim()) {
        throw new BadRequestException(`同名面料单位不一致（库存：${existing.unit || '未记录'}，本次：${incomingUnit || '未填写'}），不能合并入库，请核对单位`);
      }
      const before = this.toSnapshot(existing);
      const currentQuantity = Number(existing.quantity) || 0;
      existing.quantity = String(currentQuantity + qty);
      existing.unitPrice = calculateFabricWeightedUnitPrice(
        currentQuantity,
        existing.unitPrice,
        qty,
        inboundUnitPrice,
      );
      if (!existing.unit && dto.unit) existing.unit = dto.unit.trim();
      if (!existing.customerName && dto.customerName) existing.customerName = dto.customerName.trim();
      if (existing.supplierId == null) existing.supplierId = supplierId;
      if (existing.warehouseId == null) existing.warehouseId = warehouseId;
      if (existing.inventoryTypeId == null) existing.inventoryTypeId = inventoryTypeId;
      if (!existing.storageLocation && dto.storageLocation) existing.storageLocation = dto.storageLocation.trim();
      if (!existing.imageUrl && dto.imageUrl) existing.imageUrl = dto.imageUrl.trim();
      const savedExisting = await this.stockRepo.save(existing);
      await this.addOperationLog({
        fabricStockId: savedExisting.id,
        action: 'inbound',
        operatorUsername: dto.operatorUsername ?? '',
        beforeSnapshot: before,
        afterSnapshot: this.toSnapshot(savedExisting),
        remark: [
          inboundUnitPrice == null
            ? '本次暂未计价，合并后整条库存暂不统计金额'
            : `本批采购单价：${normalizeFabricUnitPrice(dto.unitPrice)}；本批其他费用：${otherCost}；本批实际成本单价：${inboundUnitPrice}`,
          dto.remark ?? '',
        ].filter(Boolean).join('；'),
      });
      const [row] = await this.queryService.decorate([savedExisting]);
      return row;
    }
    const entity = this.stockRepo.create({
      name,
      quantity: String(qty),
      unitPrice: inboundUnitPrice,
      unit: dto.unit?.trim() ?? '米',
      customerName: dto.customerName?.trim() ?? '',
      supplierId,
      warehouseId,
      inventoryTypeId,
      storageLocation: (dto.storageLocation ?? '').trim(),
      remark: dto.remark?.trim() ?? '',
      imageUrl: dto.imageUrl?.trim() ?? '',
    });
    const saved = await this.stockRepo.save(entity);
    const beforeSnapshot = this.toSnapshot(saved);
    beforeSnapshot.quantity = '0';
    await this.addOperationLog({
      fabricStockId: saved.id,
      action: 'create',
      operatorUsername: dto.operatorUsername ?? '',
      beforeSnapshot,
      afterSnapshot: this.toSnapshot(saved),
      remark: [
        inboundUnitPrice == null
          ? '本次暂未计价'
          : `本批采购单价：${normalizeFabricUnitPrice(dto.unitPrice)}；本批其他费用：${otherCost}；本批实际成本单价：${inboundUnitPrice}`,
        dto.remark ?? '',
      ].filter(Boolean).join('；'),
    });
    const [row] = await this.queryService.decorate([saved]);
    return row;
  }

  async update(
    id: number,
    dto: {
      name?: string;
      quantity?: number;
      unit?: string;
      customerName?: string;
      remark?: string;
      imageUrl?: string;
      supplierId?: unknown;
      warehouseId?: unknown;
      inventoryTypeId?: unknown;
      storageLocation?: string;
      unitPrice?: unknown;
      operatorUsername?: string;
    },
  ): Promise<FabricStockListRow> {
    const item = await this.stockRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('面料记录不存在');
    const before = this.toSnapshot(item);
    if (dto.name !== undefined) {
      const nextName = this.normalizeName(dto.name);
      if (!nextName) throw new BadRequestException('面料名称不能为空');
      const existing = await this.findByName(nextName);
      if (existing && existing.id !== id) {
        throw new BadRequestException('面料名称已存在，不能改成重复名称');
      }
      item.name = nextName;
    }
    if (dto.unit !== undefined) item.unit = dto.unit?.trim() ?? '米';
    if (dto.customerName !== undefined) item.customerName = dto.customerName?.trim() ?? '';
    if (dto.remark !== undefined) item.remark = dto.remark?.trim() ?? '';
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl?.trim() ?? '';
    if (dto.supplierId !== undefined) {
      const sid = this.normalizeOptionalPositiveInt(dto.supplierId);
      if (sid != null) await this.assertFabricSupplierId(sid);
      item.supplierId = sid;
    }
    if (dto.warehouseId !== undefined) {
      const wid = this.normalizeOptionalPositiveInt(dto.warehouseId);
      if (wid != null) await this.assertWarehouseId(wid);
      item.warehouseId = wid;
    }
    if (dto.inventoryTypeId !== undefined) {
      item.inventoryTypeId = this.normalizeOptionalPositiveInt(dto.inventoryTypeId);
    }
    if (dto.storageLocation !== undefined) item.storageLocation = (dto.storageLocation ?? '').trim();
    if (dto.unitPrice !== undefined) item.unitPrice = normalizeFabricUnitPrice(dto.unitPrice);
    const saved = await this.stockRepo.save(item);
    await this.addOperationLog({
      fabricStockId: saved.id,
      action: 'update',
      operatorUsername: dto.operatorUsername ?? '',
      beforeSnapshot: before,
      afterSnapshot: this.toSnapshot(saved),
    });
    const [row] = await this.queryService.decorate([saved]);
    return row;
  }

  async remove(id: number, operatorUsername = ''): Promise<void> {
    const item = await this.stockRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('面料记录不存在');
    const before = this.toSnapshot(item);
    await this.stockRepo.remove(item);
    await this.addOperationLog({
      fabricStockId: id,
      action: 'delete',
      operatorUsername,
      beforeSnapshot: before,
      afterSnapshot: null,
    });
  }

  /** 出库：减少数量，并记录照片与备注（谁领走、用途） */
  async outbound(
    id: number,
    quantity: number,
    photoUrl: string,
    remark: string,
    operatorUsername = '',
    pickupUserId: number | null = null,
  ): Promise<void> {
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new BadRequestException('出库数量必须大于 0');
    }
    let pickupUserName = '';
    if (pickupUserId != null && pickupUserId > 0) {
      const u = await this.userRepo.findOne({
        where: { id: pickupUserId, status: UserStatus.ACTIVE },
      });
      if (!u) throw new BadRequestException('领取人无效或已停用');
      pickupUserName = String(u.displayName ?? '').trim() || String(u.username ?? '').trim();
    }
    const outboundRemark = [
      pickupUserName ? `领取人：${pickupUserName}` : '',
      remark?.trim() ?? '',
    ].filter(Boolean).join('；');
    const transactionResult = await this.dataSource.transaction(async (manager) => {
      const stockRepo = manager.getRepository(FabricStock);
      const stock = await stockRepo
        .createQueryBuilder('stock')
        .setLock('pessimistic_write')
        .where('stock.id = :id', { id })
        .getOne();
      if (!stock) throw new NotFoundException('面料记录不存在');
      const current = Number(stock.quantity);
      if (!Number.isFinite(current) || qty > current) {
        throw new BadRequestException('出库数量不能大于当前库存');
      }
      const before = this.toSnapshot(stock);
      const [decoratedStock] = await this.queryService.decorate([stock]);
      const outboundAmount = calculateFabricAmount(qty, stock.unitPrice);
      stock.quantity = String(current - qty);
      const saved = await stockRepo.save(stock);
      const inventoryTypeLabel = decoratedStock.inventoryTypeLabel
        || (stock.inventoryTypeId == null ? '未设置' : '库存类型已失效');
      const out = manager.getRepository(FabricOutbound).create({
        fabricStockId: id,
        nameSnapshot: stock.name,
        customerNameSnapshot: stock.customerName,
        unitSnapshot: stock.unit,
        inventoryTypeId: stock.inventoryTypeId,
        inventoryTypeLabel,
        quantity: String(qty),
        unitPrice: stock.unitPrice,
        amount: outboundAmount,
        photoUrl: photoUrl?.trim() ?? '',
        remark: outboundRemark,
        pickupUserId: pickupUserId != null && pickupUserId > 0 ? pickupUserId : null,
      });
      await manager.getRepository(FabricOutbound).save(out);
      return { before, saved };
    });
    await this.addOperationLog({
      fabricStockId: id,
      action: 'outbound',
      operatorUsername,
      beforeSnapshot: transactionResult.before,
      afterSnapshot: this.toSnapshot(transactionResult.saved),
      remark: outboundRemark,
    });
  }

  async getOperationLogs(fabricStockId: number): Promise<FabricStockOperationLog[]> {
    await this.getOne(fabricStockId);
    try {
      const logs = await this.operationLogRepo.find({
        where: { fabricStockId },
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
      if (!this.isTableMissingError(error, 'fabric_stock_operation_log')) throw error;
      this.logger.warn('fabric_stock_operation_log 表不存在，已返回空操作日志');
      return [];
    }
  }
}
