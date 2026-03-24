import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { In, IsNull, Like, Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 下拉用简易搜索接口（订单编辑等调用）
   */
  async search(keyword: string | undefined, page = 1, pageSize = 20) {
    const where = keyword?.trim()
      ? [
          { name: Like(`%${keyword.trim()}%`) },
          { contactPerson: Like(`%${keyword.trim()}%`) },
        ]
      : {};

    const [list, total] = await this.supplierRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { list, total, page, pageSize };
  }

  /**
   * 供应商管理页：列表（支持名称、类型筛选）
   */
  async getList(params: {
    name?: string;
    supplierTypeId?: number | null;
    page?: number;
    pageSize?: number;
  }) {
    // 兜底：历史订单已引用但 lastActiveAt 为空时，自动回填
    await this.backfillLastActiveAtForMissingSuppliers();

    const { name, supplierTypeId, page = 1, pageSize = 20 } = params;
    const qb = this.supplierRepo.createQueryBuilder('s');
    if (name?.trim()) {
      qb.andWhere('s.name LIKE :name', { name: `%${name.trim()}%` });
    }
    if (supplierTypeId != null) {
      qb.andWhere('s.supplier_type_id = :supplierTypeId', { supplierTypeId });
    }
    // 最近活跃时间优先，再按最新 id 倒序
    qb.orderBy('s.last_active_at', 'DESC')
      .addOrderBy('s.id', 'DESC');
    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    return { list, total, page, pageSize };
  }

  async getOne(id: number): Promise<Supplier> {
    const item = await this.supplierRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('供应商不存在');
    return item;
  }

  async create(dto: {
    name: string;
    supplierTypeId?: number | null;
    businessScopeId?: number | null;
    businessScopeIds?: number[] | null;
    contactPerson?: string;
    contactInfo?: string;
    factoryAddress?: string;
    settlementTime?: string;
  }): Promise<Supplier> {
    const normalizedScopeIds = Array.isArray(dto.businessScopeIds)
      ? dto.businessScopeIds
          .map((v) => Number(v))
          .filter((v) => Number.isInteger(v) && v > 0)
      : [];
    const primaryScopeId =
      normalizedScopeIds[0] ??
      (dto.businessScopeId != null ? Number(dto.businessScopeId) : null);
    const entity = this.supplierRepo.create({
      name: dto.name?.trim() ?? '',
      supplierTypeId:
        dto.supplierTypeId != null ? Number(dto.supplierTypeId) : null,
      businessScopeId: primaryScopeId,
      businessScopeIds: normalizedScopeIds.length ? normalizedScopeIds : null,
      contactPerson: dto.contactPerson?.trim() ?? '',
      contactInfo: dto.contactInfo?.trim() ?? '',
      factoryAddress: dto.factoryAddress?.trim() ?? '',
      settlementTime: dto.settlementTime?.trim() ?? '',
    });
    return this.supplierRepo.save(entity);
  }

  async update(
    id: number,
    dto: {
      name?: string;
      supplierTypeId?: number | null;
      businessScopeId?: number | null;
      businessScopeIds?: number[] | null;
      contactPerson?: string;
      contactInfo?: string;
      factoryAddress?: string;
      settlementTime?: string;
    },
  ): Promise<Supplier> {
    const item = await this.supplierRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('供应商不存在');
    const oldName = (item.name ?? '').trim();
    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.supplierTypeId !== undefined) {
      item.supplierTypeId =
        dto.supplierTypeId != null ? Number(dto.supplierTypeId) : null;
    }
    if (dto.businessScopeId !== undefined) {
      item.businessScopeId =
        dto.businessScopeId != null ? Number(dto.businessScopeId) : null;
    }
    if (dto.businessScopeIds !== undefined) {
      const normalizedScopeIds = Array.isArray(dto.businessScopeIds)
        ? dto.businessScopeIds
            .map((v) => Number(v))
            .filter((v) => Number.isInteger(v) && v > 0)
        : [];
      item.businessScopeIds = normalizedScopeIds.length ? normalizedScopeIds : null;
      item.businessScopeId = normalizedScopeIds[0] ?? null;
    }
    if (dto.contactPerson !== undefined) item.contactPerson = dto.contactPerson?.trim() ?? '';
    if (dto.contactInfo !== undefined) item.contactInfo = dto.contactInfo?.trim() ?? '';
    if (dto.factoryAddress !== undefined) item.factoryAddress = dto.factoryAddress?.trim() ?? '';
    if (dto.settlementTime !== undefined) item.settlementTime = dto.settlementTime?.trim() ?? '';
    const saved = await this.supplierRepo.save(item);
    const newName = (saved.name ?? '').trim();
    if (oldName && newName && oldName !== newName) {
      await this.syncSupplierNameInOrderHistory(oldName, newName);
    }
    return saved;
  }

  async remove(id: number): Promise<void> {
    const item = await this.supplierRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('供应商不存在');
    await this.supplierRepo.remove(item);
  }

  /** 按供应商名称批量刷新最近活跃时间（系统自动触发） */
  async touchLastActiveByNames(names: string[]): Promise<void> {
    const normalized = [...new Set((names ?? []).map((n) => (n ?? '').trim()).filter(Boolean))];
    if (!normalized.length) return;
    const now = new Date();
    await this.supplierRepo
      .createQueryBuilder()
      .update(Supplier)
      .set({ lastActiveAt: now })
      .where('name IN (:...names)', { names: normalized })
      .execute();
  }

  /** 供应商改名后，同步历史订单中的供应商名称快照 */
  private async syncSupplierNameInOrderHistory(oldName: string, newName: string): Promise<void> {
    const extList = await this.orderExtRepo.find();
    const changed: OrderExt[] = [];
    for (const ext of extList) {
      let dirty = false;
      const materials = Array.isArray(ext.materials) ? ext.materials : [];
      for (const row of materials) {
        if ((row?.supplierName ?? '').trim() === oldName) {
          row.supplierName = newName;
          dirty = true;
        }
      }
      const processItems = Array.isArray(ext.processItems) ? ext.processItems : [];
      for (const row of processItems) {
        if ((row?.supplierName ?? '').trim() === oldName) {
          row.supplierName = newName;
          dirty = true;
        }
      }
      if (dirty) changed.push(ext);
    }
    if (changed.length) {
      await this.orderExtRepo.save(changed);
    }
    // 财务支出：对象类型为 supplier 时，收款方名称同步改名
    await this.dataSource.query(
      "UPDATE finance_expense_records SET payee_name = ? WHERE object_type = 'supplier' AND payee_name = ?",
      [newName, oldName],
    );
  }

  /** 最近合作记录：按订单引用该供应商名称的记录倒序返回 */
  async getRecentOrderRecords(id: number, limit = 10): Promise<Array<{
    orderId: number;
    orderNo: string;
    skuCode: string;
    status: string;
    orderDate: Date | null;
    refType: 'material' | 'process';
    refName: string;
  }>> {
    const supplier = await this.getOne(id);
    const name = (supplier.name ?? '').trim();
    if (!name) return [];

    const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(50, Math.trunc(limit))) : 10;
    const extList = await this.orderExtRepo.find();
    const matched = new Map<number, { refType: 'material' | 'process'; refName: string }>();

    for (const ext of extList) {
      const materials = Array.isArray(ext.materials) ? ext.materials : [];
      const m = materials.find((row) => (row?.supplierName ?? '').trim() === name);
      if (m) {
        matched.set(ext.orderId, { refType: 'material', refName: (m.materialName ?? '').trim() || '物料' });
        continue;
      }
      const processItems = Array.isArray(ext.processItems) ? ext.processItems : [];
      const p = processItems.find((row) => (row?.supplierName ?? '').trim() === name);
      if (p) {
        matched.set(ext.orderId, { refType: 'process', refName: (p.processName ?? '').trim() || '工艺' });
      }
    }

    const orderIds = [...matched.keys()];
    if (!orderIds.length) return [];
    const orders = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.id IN (:...ids)', { ids: orderIds })
      .orderBy('o.order_date', 'DESC')
      .addOrderBy('o.id', 'DESC')
      .take(safeLimit)
      .getMany();

    let latestActiveAt: Date | null = null;
    const rows = orders.map((o) => {
      const ref = matched.get(o.id)!;
      const activeAt = o.orderDate ?? o.createdAt ?? null;
      if (activeAt && (!latestActiveAt || activeAt > latestActiveAt)) latestActiveAt = activeAt;
      return {
        orderId: o.id,
        orderNo: o.orderNo ?? '',
        skuCode: o.skuCode ?? '',
        status: o.status ?? '',
        orderDate: o.orderDate ?? null,
        refType: ref.refType,
        refName: ref.refName,
      };
    });
    if (!supplier.lastActiveAt && latestActiveAt) {
      await this.supplierRepo.update({ id: supplier.id }, { lastActiveAt: latestActiveAt });
    }
    return rows;
  }

  /** 为 lastActiveAt 为空且已有历史引用的供应商补齐活跃时间 */
  private async backfillLastActiveAtForMissingSuppliers(): Promise<void> {
    const suppliers = await this.supplierRepo.find({
      where: { lastActiveAt: IsNull() },
      select: ['id', 'name'],
      take: 300,
    });
    if (!suppliers.length) return;
    const nameSet = new Set(
      suppliers.map((s) => (s.name ?? '').trim()).filter(Boolean),
    );
    if (!nameSet.size) return;

    const extList = await this.orderExtRepo.find();
    const orderIdsByName = new Map<string, Set<number>>();
    for (const ext of extList) {
      const matchedNames = new Set<string>();
      const materials = Array.isArray(ext.materials) ? ext.materials : [];
      for (const row of materials) {
        const n = (row?.supplierName ?? '').trim();
        if (nameSet.has(n)) matchedNames.add(n);
      }
      const processItems = Array.isArray(ext.processItems) ? ext.processItems : [];
      for (const row of processItems) {
        const n = (row?.supplierName ?? '').trim();
        if (nameSet.has(n)) matchedNames.add(n);
      }
      if (!matchedNames.size) continue;
      for (const n of matchedNames) {
        if (!orderIdsByName.has(n)) orderIdsByName.set(n, new Set<number>());
        orderIdsByName.get(n)!.add(ext.orderId);
      }
    }

    const allOrderIds = [...new Set(
      [...orderIdsByName.values()].flatMap((set) => [...set]),
    )];
    if (!allOrderIds.length) return;

    const orders = await this.orderRepo.find({
      where: { id: In(allOrderIds) },
      select: ['id', 'orderDate', 'createdAt'],
    });
    const orderTimeById = new Map<number, Date>();
    for (const o of orders) {
      const t = o.orderDate ?? o.createdAt ?? null;
      if (t) orderTimeById.set(o.id, t);
    }

    for (const s of suppliers) {
      const name = (s.name ?? '').trim();
      if (!name) continue;
      const ids = orderIdsByName.get(name);
      if (!ids || !ids.size) continue;
      let latest: Date | null = null;
      for (const oid of ids) {
        const t = orderTimeById.get(oid);
        if (t && (!latest || t > latest)) latest = t;
      }
      if (latest) {
        await this.supplierRepo.update({ id: s.id }, { lastActiveAt: latest });
      }
    }
  }
}

