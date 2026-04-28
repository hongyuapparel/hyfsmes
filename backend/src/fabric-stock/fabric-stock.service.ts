import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FabricStock } from '../entities/fabric-stock.entity';
import { FabricOutbound } from '../entities/fabric-outbound.entity';
import { FabricStockOperationLog } from '../entities/fabric-stock-operation-log.entity';
import { Supplier } from '../entities/supplier.entity';
import { User, UserStatus } from '../entities/user.entity';
import { SystemOption } from '../entities/system-option.entity';
import { SystemOptionsService } from '../system-options/system-options.service';

const FABRIC_SUPPLIER_TYPE_VALUE = '面料供应商';

export type FabricStockListRow = FabricStock & {
  supplierName: string;
  warehouseLabel: string;
};

@Injectable()
export class FabricStockService {
  private readonly logger = new Logger(FabricStockService.name);

  constructor(
    @InjectRepository(FabricStock)
    private readonly stockRepo: Repository<FabricStock>,
    @InjectRepository(FabricOutbound)
    private readonly outboundRepo: Repository<FabricOutbound>,
    @InjectRepository(FabricStockOperationLog)
    private readonly operationLogRepo: Repository<FabricStockOperationLog>,
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly systemOptionsService: SystemOptionsService,
  ) {}

  private toSnapshot(item: FabricStock): Record<string, unknown> {
    return {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      customerName: item.customerName,
      supplierId: item.supplierId,
      warehouseId: item.warehouseId,
      storageLocation: item.storageLocation,
      imageUrl: item.imageUrl,
      remark: item.remark,
    };
  }

  private buildWarehouseIdToLabelMap(options: SystemOption[]): Map<number, string> {
    const byId = new Map(options.map((o) => [o.id, o]));
    const map = new Map<number, string>();
    for (const o of options) {
      const path: string[] = [];
      let cur: SystemOption | undefined = o;
      while (cur) {
        path.unshift(cur.value);
        cur = cur.parentId != null ? byId.get(cur.parentId) : undefined;
      }
      map.set(o.id, path.join(' > '));
    }
    return map;
  }

  private async decorateFabricStocks(items: FabricStock[]): Promise<FabricStockListRow[]> {
    if (!items.length) return [];
    const supplierIds = [
      ...new Set(
        items.map((r) => r.supplierId).filter((x): x is number => x != null && x > 0),
      ),
    ];
    const warehouseOpts = await this.systemOptionsService.findAllByType('warehouses');
    const whMap = this.buildWarehouseIdToLabelMap(warehouseOpts);
    const whIdSet = new Set(warehouseOpts.map((o) => o.id));
    const suppliers =
      supplierIds.length > 0
        ? await this.supplierRepo.find({ where: { id: In(supplierIds) } })
        : [];
    const supMap = new Map(suppliers.map((s) => [s.id, s.name]));
    return items.map((item) => ({
      ...item,
      supplierName:
        item.supplierId != null && item.supplierId > 0
          ? (supMap.get(item.supplierId) ?? '')
          : '',
      warehouseLabel:
        item.warehouseId != null && item.warehouseId > 0 && whIdSet.has(item.warehouseId)
          ? (whMap.get(item.warehouseId) ?? '')
          : '',
    }));
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

  async getList(params: {
    name?: string;
    customerName?: string;
    startDate?: string;
    endDate?: string;
    skipTotal?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: FabricStockListRow[]; total: number; page: number; pageSize: number }> {
    const { name, customerName, startDate, endDate, skipTotal = false, page = 1, pageSize = 20 } = params;
    const qb = this.stockRepo.createQueryBuilder('s');
    if (name?.trim()) {
      qb.andWhere('s.name LIKE :name', { name: `%${name.trim()}%` });
    }
    if (customerName?.trim()) {
      qb.andWhere('s.customer_name LIKE :customerName', {
        customerName: `%${customerName.trim()}%`,
      });
    }
    if (startDate?.trim()) {
      qb.andWhere('s.created_at >= :inboundStart', { inboundStart: `${startDate.trim()} 00:00:00` });
    }
    if (endDate?.trim()) {
      qb.andWhere('s.created_at <= :inboundEnd', { inboundEnd: `${endDate.trim()} 23:59:59` });
    }
    qb.orderBy('s.created_at', 'DESC');
    const total = skipTotal ? 0 : await qb.getCount();
    const rawList = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    const list = await this.decorateFabricStocks(rawList);
    return { list, total, page, pageSize };
  }

  async getOne(id: number): Promise<FabricStockListRow> {
    const item = await this.stockRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('面料记录不存在');
    const [decorated] = await this.decorateFabricStocks([item]);
    return decorated;
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
    storageLocation?: string;
    operatorUsername?: string;
  }): Promise<FabricStockListRow> {
    const supplierId = this.normalizeOptionalPositiveInt(dto.supplierId);
    const warehouseId = this.normalizeOptionalPositiveInt(dto.warehouseId);
    if (supplierId != null) await this.assertFabricSupplierId(supplierId);
    if (warehouseId != null) await this.assertWarehouseId(warehouseId);
    const entity = this.stockRepo.create({
      name: dto.name?.trim() ?? '',
      quantity: String(dto.quantity ?? 0),
      unit: dto.unit?.trim() ?? '米',
      customerName: dto.customerName?.trim() ?? '',
      supplierId,
      warehouseId,
      storageLocation: (dto.storageLocation ?? '').trim(),
      remark: dto.remark?.trim() ?? '',
      imageUrl: dto.imageUrl?.trim() ?? '',
    });
    const saved = await this.stockRepo.save(entity);
    await this.addOperationLog({
      fabricStockId: saved.id,
      action: 'create',
      operatorUsername: dto.operatorUsername ?? '',
      beforeSnapshot: null,
      afterSnapshot: this.toSnapshot(saved),
    });
    const [row] = await this.decorateFabricStocks([saved]);
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
      storageLocation?: string;
      operatorUsername?: string;
    },
  ): Promise<FabricStockListRow> {
    const item = await this.stockRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('面料记录不存在');
    const before = this.toSnapshot(item);
    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.quantity !== undefined) item.quantity = String(dto.quantity);
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
    if (dto.storageLocation !== undefined) item.storageLocation = (dto.storageLocation ?? '').trim();
    const saved = await this.stockRepo.save(item);
    await this.addOperationLog({
      fabricStockId: saved.id,
      action: 'update',
      operatorUsername: dto.operatorUsername ?? '',
      beforeSnapshot: before,
      afterSnapshot: this.toSnapshot(saved),
    });
    const [row] = await this.decorateFabricStocks([saved]);
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
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) throw new NotFoundException('面料记录不存在');
    const qty = Number(quantity);
    const current = parseFloat(stock.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new NotFoundException('出库数量必须大于 0');
    }
    if (qty > current) {
      throw new NotFoundException('出库数量不能大于当前库存');
    }
    if (pickupUserId != null && pickupUserId > 0) {
      const u = await this.userRepo.findOne({
        where: { id: pickupUserId, status: UserStatus.ACTIVE },
      });
      if (!u) throw new BadRequestException('领取人无效或已停用');
    }
    const before = this.toSnapshot(stock);
    stock.quantity = String(current - qty);
    const saved = await this.stockRepo.save(stock);
    const out = this.outboundRepo.create({
      fabricStockId: id,
      quantity: String(qty),
      photoUrl: photoUrl?.trim() ?? '',
      remark: remark?.trim() ?? '',
      pickupUserId: pickupUserId != null && pickupUserId > 0 ? pickupUserId : null,
    });
    await this.outboundRepo.save(out);
    await this.addOperationLog({
      fabricStockId: id,
      action: 'outbound',
      operatorUsername,
      beforeSnapshot: before,
      afterSnapshot: this.toSnapshot(saved),
      remark: remark?.trim() ?? '',
    });
  }

  async getOutboundRecords(params: {
    name?: string;
    customerName?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    list: Array<{
      id: number;
      fabricStockId: number;
      name: string;
      customerName: string;
      unit: string;
      quantity: string;
      photoUrl: string;
      remark: string;
      pickupUserId: number | null;
      pickupUserName: string;
      createdAt: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { name, customerName, startDate, endDate, page = 1, pageSize = 20 } = params;
    const qb = this.outboundRepo
      .createQueryBuilder('o')
      .innerJoin(FabricStock, 's', 's.id = o.fabric_stock_id')
      .select([
        'o.id AS id',
        'o.fabric_stock_id AS fabricStockId',
        's.name AS name',
        's.customer_name AS customerName',
        's.unit AS unit',
        'o.quantity AS quantity',
        'o.photo_url AS photoUrl',
        'o.remark AS remark',
        'o.pickup_user_id AS pickupUserId',
        'o.created_at AS createdAt',
      ]);

    if (name?.trim()) qb.andWhere('s.name LIKE :name', { name: `%${name.trim()}%` });
    if (customerName?.trim()) qb.andWhere('s.customer_name LIKE :customerName', { customerName: `%${customerName.trim()}%` });
    if (startDate?.trim()) qb.andWhere('o.created_at >= :start', { start: `${startDate.trim()} 00:00:00` });
    if (endDate?.trim()) qb.andWhere('o.created_at <= :end', { end: `${endDate.trim()} 23:59:59` });

    qb.orderBy('o.created_at', 'DESC');
    const total = await qb.getCount();
    const rows = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getRawMany<{
        id: number;
        fabricStockId: number;
        name: string;
        customerName: string;
        unit: string;
        quantity: string;
        photoUrl: string;
        remark: string;
        pickupUserId: number | null;
        createdAt: Date;
      }>();

    const pickupIds = [
      ...new Set(
        rows
          .map((r) => r.pickupUserId)
          .filter((x): x is number => x != null && Number(x) > 0)
          .map((x) => Number(x)),
      ),
    ];
    const pickupUsers =
      pickupIds.length > 0
        ? await this.userRepo.find({ where: { id: In(pickupIds) } })
        : [];
    const pickupMap = new Map(
      pickupUsers.map((u) => [
        u.id,
        ((u.displayName ?? '').trim() || (u.username ?? '').trim() || '').trim(),
      ]),
    );

    const list = rows.map((r) => {
      const pid =
        r.pickupUserId != null && Number(r.pickupUserId) > 0 ? Number(r.pickupUserId) : null;
      return {
        id: r.id,
        fabricStockId: r.fabricStockId,
        name: r.name ?? '',
        customerName: r.customerName ?? '',
        unit: r.unit ?? '',
        quantity: r.quantity ?? '0',
        photoUrl: r.photoUrl ?? '',
        remark: r.remark ?? '',
        pickupUserId: pid,
        pickupUserName: pid != null ? (pickupMap.get(pid) ?? '') : '',
        createdAt: r.createdAt
          ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ')
          : '',
      };
    });
    return { list, total, page, pageSize };
  }

  async getOperationLogs(fabricStockId: number): Promise<FabricStockOperationLog[]> {
    await this.getOne(fabricStockId);
    return this.operationLogRepo.find({
      where: { fabricStockId },
      order: { createdAt: 'DESC' },
    });
  }
}
