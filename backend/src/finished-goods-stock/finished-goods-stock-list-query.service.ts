import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { InboundPending } from '../entities/inbound-pending.entity';
import { Order } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import type { FinishedStockRow } from './finished-goods-stock.types';
import {
  formatDateTimeForResponse,
  isTableMissingError,
  parseListSizeBreakdownFromSnapshot,
} from './finished-goods-stock-query.utils';
import { FinishedGoodsStockInboundQueryService } from './finished-goods-stock-inbound-query.service';
import { snapshotToListSizeBreakdown, type StoredStockRawRow } from './finished-goods-stock-list-query.helpers';

@Injectable()
export class FinishedGoodsStockListQueryService {
  constructor(
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(InboundPending)
    private readonly pendingRepo: Repository<InboundPending>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(FinishedGoodsStockColorImage)
    private readonly colorImageRepo: Repository<FinishedGoodsStockColorImage>,
    private readonly inboundQueryService: FinishedGoodsStockInboundQueryService,
  ) {}

  private applyInboundTimeRange<Entity extends ObjectLiteral>(
    qb: SelectQueryBuilder<Entity>,
    columnSql: string,
    startDate?: string,
    endDate?: string,
  ) {
    if (startDate?.trim()) {
      qb.andWhere(`${columnSql} >= :inboundStart`, { inboundStart: `${startDate.trim()} 00:00:00` });
    }
    if (endDate?.trim()) {
      qb.andWhere(`${columnSql} <= :inboundEnd`, { inboundEnd: `${endDate.trim()} 23:59:59` });
    }
  }

  private applyStoredListFilters<Entity extends ObjectLiteral>(
    qb: SelectQueryBuilder<Entity>,
    filters: {
      orderNo?: string;
      skuCode?: string;
      customerName?: string;
      inventoryTypeId?: number | null;
      startDate?: string;
      endDate?: string;
    },
  ) {
    if (filters.orderNo?.trim()) {
      qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${filters.orderNo.trim()}%` });
    }
    if (filters.skuCode?.trim()) {
      qb.andWhere('s.sku_code LIKE :skuCode', { skuCode: `%${filters.skuCode.trim()}%` });
    }
    if (filters.customerName?.trim()) {
      qb.andWhere('s.customer_name LIKE :customerName', {
        customerName: `%${filters.customerName.trim()}%`,
      });
    }
    if (filters.inventoryTypeId != null) {
      qb.andWhere('s.inventory_type_id = :inventoryTypeId', {
        inventoryTypeId: filters.inventoryTypeId,
      });
    }
    this.applyInboundTimeRange(qb, 's.created_at', filters.startDate, filters.endDate);
  }

  private getStoredSkuGroupSql() {
    return "LOWER(TRIM(COALESCE(s.sku_code, '')))";
  }

  private getStoredUnitPriceSql() {
    return `CASE
      WHEN s.unit_price IS NOT NULL AND s.unit_price > 0 THEN s.unit_price
      WHEN o.ex_factory_price IS NOT NULL AND o.ex_factory_price > 0 THEN o.ex_factory_price
      ELSE 0
    END`;
  }

  private createStoredListQueryBuilder() {
    return this.stockRepo
      .createQueryBuilder('s')
      .leftJoin(Order, 'o', 'o.id = s.order_id')
      .leftJoin(
        Product,
        'pr',
        'TRIM(pr.sku_code) COLLATE utf8mb4_general_ci = TRIM(s.sku_code) COLLATE utf8mb4_general_ci',
      )
      .select([
        's.id AS id',
        's.order_id AS orderId',
        "COALESCE(o.order_no, '') AS orderNo",
        's.customer_name AS customerName',
        's.sku_code AS skuCode',
        's.quantity AS quantity',
        `${this.getStoredUnitPriceSql()} AS unitPrice`,
        's.warehouse_id AS warehouseId',
        's.inventory_type_id AS inventoryTypeId',
        's.department AS department',
        's.location AS location',
        "COALESCE(pr.image_url, '') AS productImageUrl",
        "COALESCE(s.image_url, '') AS imageUrl",
        's.created_at AS createdAt',
        's.color_size_snapshot AS colorSizeSnapshot',
      ]);
  }

  private async sumPendingQuantitiesForList(filters: {
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<number> {
    const qb = this.pendingRepo
      .createQueryBuilder('p')
      .innerJoin(Order, 'o', 'o.id = p.order_id')
      .where('p.status = :status', { status: 'pending' })
      .select('COALESCE(SUM(p.quantity), 0)', 'qty');
    if (filters.orderNo?.trim()) {
      qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${filters.orderNo.trim()}%` });
    }
    if (filters.skuCode?.trim()) {
      qb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${filters.skuCode.trim()}%` });
    }
    if (filters.customerName?.trim()) {
      qb.andWhere('o.customer_name LIKE :customerName', {
        customerName: `%${filters.customerName.trim()}%`,
      });
    }
    this.applyInboundTimeRange(qb, 'p.created_at', filters.startDate, filters.endDate);
    const row = await qb.getRawOne<{ qty: string | number }>();
    return Number(row?.qty ?? 0) || 0;
  }

  private async sumStoredQuantitiesForList(filters: {
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    inventoryTypeId?: number | null;
    startDate?: string;
    endDate?: string;
  }): Promise<number> {
    const qb = this.stockRepo
      .createQueryBuilder('s')
      .leftJoin(Order, 'o', 'o.id = s.order_id')
      .select('COALESCE(SUM(s.quantity), 0)', 'qty');
    if (filters.orderNo?.trim()) qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${filters.orderNo.trim()}%` });
    if (filters.skuCode?.trim()) qb.andWhere('s.sku_code LIKE :skuCode', { skuCode: `%${filters.skuCode.trim()}%` });
    if (filters.customerName?.trim()) {
      qb.andWhere('s.customer_name LIKE :customerName', { customerName: `%${filters.customerName.trim()}%` });
    }
    if (filters.inventoryTypeId != null) qb.andWhere('s.inventory_type_id = :inventoryTypeId', { inventoryTypeId: filters.inventoryTypeId });
    this.applyInboundTimeRange(qb, 's.created_at', filters.startDate, filters.endDate);
    const row = await qb.getRawOne<{ qty: string | number }>();
    return Number(row?.qty ?? 0) || 0;
  }

  private async sumStoredAmountForList(filters: {
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    inventoryTypeId?: number | null;
    startDate?: string;
    endDate?: string;
  }): Promise<number> {
    const qb = this.stockRepo
      .createQueryBuilder('s')
      .leftJoin(Order, 'o', 'o.id = s.order_id')
      .select(`COALESCE(SUM(s.quantity * ${this.getStoredUnitPriceSql()}), 0)`, 'amount');
    this.applyStoredListFilters(qb, filters);
    const row = await qb.getRawOne<{ amount: string | number }>();
    return Number(row?.amount ?? 0) || 0;
  }

  getList(params: {
    tab?: string;
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    inventoryTypeId?: number | null;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
    paginateByVisibleGroup?: boolean;
  }): Promise<{
    list: FinishedStockRow[];
    total: number;
    page: number;
    pageSize: number;
    totalQuantity: number;
    totalAmount: number;
  }> {
    return this.getListInternal(params);
  }

  private async buildStoredRowsWithDetails(storedRows: StoredStockRawRow[]): Promise<FinishedStockRow[]> {
    const storedList: FinishedStockRow[] = await Promise.all(storedRows.map(async (r) => {
      const storedBreakdown = parseListSizeBreakdownFromSnapshot(r.colorSizeSnapshot);
      let sizeBreakdown = storedBreakdown;
      if (!sizeBreakdown && r.orderId != null) {
        const stock = this.stockRepo.create({
          id: r.id,
          orderId: r.orderId,
          skuCode: r.skuCode ?? '',
          customerName: r.customerName ?? '',
          quantity: r.quantity ?? 0,
          colorSizeSnapshot: null,
        });
        sizeBreakdown = snapshotToListSizeBreakdown(await this.inboundQueryService.buildCurrentStockSnapshot(stock));
      }
      return {
        id: r.id,
        orderId: r.orderId ?? null,
        orderNo: r.orderNo ?? '',
        customerName: r.customerName ?? '',
        skuCode: r.skuCode ?? '',
        quantity: r.quantity ?? 0,
        unitPrice: r.unitPrice ?? '0',
        warehouseId: r.warehouseId ?? null,
        inventoryTypeId: r.inventoryTypeId ?? null,
        department: r.department ?? '',
        location: r.location ?? '',
        productImageUrl: r.productImageUrl ?? '',
        imageUrl: r.imageUrl ?? '',
        createdAt: formatDateTimeForResponse(r.createdAt),
        type: 'stored' as const,
        sizeBreakdown,
      };
    }));
    if (storedList.length) {
      try {
        const colorImageRows = await this.colorImageRepo.find({
          where: { finishedStockId: In(storedList.map((item) => item.id)) },
          order: { updatedAt: 'DESC' },
        });
        const colorImageMap = new Map<number, Map<string, string>>();
        colorImageRows.forEach((item) => {
          const stockId = Number(item.finishedStockId);
          if (!Number.isInteger(stockId) || stockId <= 0) return;
          const colorName = String(item.colorName ?? '').trim();
          const imageUrl = String(item.imageUrl ?? '').trim();
          if (!colorName || !imageUrl) return;
          let stockMap = colorImageMap.get(stockId);
          if (!stockMap) {
            stockMap = new Map<string, string>();
            colorImageMap.set(stockId, stockMap);
          }
          if (!stockMap.has(colorName)) stockMap.set(colorName, imageUrl);
        });
        storedList.forEach((item) => {
          const stockMap = colorImageMap.get(item.id);
          item.colorImages = stockMap
            ? Array.from(stockMap.entries()).map(([colorName, imageUrl]) => ({ colorName, imageUrl }))
            : [];
        });
      } catch (error) {
        if (!isTableMissingError(error, 'finished_goods_stock_color_images')) throw error;
      }
    }
    return storedList;
  }

  private async getListInternal(params: {
    tab?: string;
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    inventoryTypeId?: number | null;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
    paginateByVisibleGroup?: boolean;
  }): Promise<{
    list: FinishedStockRow[];
    total: number;
    page: number;
    pageSize: number;
    totalQuantity: number;
    totalAmount: number;
  }> {
    const {
      tab = 'all',
      orderNo,
      skuCode,
      customerName,
      inventoryTypeId,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      paginateByVisibleGroup = false,
    } = params;

    const [pendingQtyTotal, storedQtyTotal, storedAmountTotal] = await Promise.all([
      tab === 'pending' || tab === 'all'
        ? this.sumPendingQuantitiesForList({ orderNo, skuCode, customerName, startDate, endDate })
        : Promise.resolve(0),
      tab === 'stored' || tab === 'all'
        ? this.sumStoredQuantitiesForList({ orderNo, skuCode, customerName, inventoryTypeId, startDate, endDate })
        : Promise.resolve(0),
      tab === 'stored' || tab === 'all'
        ? this.sumStoredAmountForList({ orderNo, skuCode, customerName, inventoryTypeId, startDate, endDate })
        : Promise.resolve(0),
    ]);
    const listTotalQuantity = pendingQtyTotal + storedQtyTotal;
    const listTotalAmount = storedAmountTotal;

    // tab=all: 只取 id+createdAt 合并排序，再按页取完整详情，避免全表加载
    if (tab === 'all') {
      const buildPendingIdQb = () => {
        const qb = this.pendingRepo
          .createQueryBuilder('p')
          .innerJoin(Order, 'o', 'o.id = p.order_id')
          .where('p.status = :allPStatus', { allPStatus: 'pending' })
          .select(['p.id AS id', 'p.created_at AS createdAt']);
        if (orderNo?.trim()) qb.andWhere('o.order_no LIKE :allPOrderNo', { allPOrderNo: `%${orderNo.trim()}%` });
        if (skuCode?.trim()) qb.andWhere('p.sku_code LIKE :allPSkuCode', { allPSkuCode: `%${skuCode.trim()}%` });
        if (customerName?.trim()) qb.andWhere('o.customer_name LIKE :allPCustomer', { allPCustomer: `%${customerName.trim()}%` });
        this.applyInboundTimeRange(qb, 'p.created_at', startDate, endDate);
        return qb;
      };
      const buildStoredIdQb = () => {
        const qb = this.stockRepo
          .createQueryBuilder('s')
          .leftJoin(Order, 'o', 'o.id = s.order_id')
          .select(['s.id AS id', 's.created_at AS createdAt']);
        if (orderNo?.trim()) qb.andWhere('o.order_no LIKE :allSOrderNo', { allSOrderNo: `%${orderNo.trim()}%` });
        if (skuCode?.trim()) qb.andWhere('s.sku_code LIKE :allSSkuCode', { allSSkuCode: `%${skuCode.trim()}%` });
        if (customerName?.trim()) qb.andWhere('s.customer_name LIKE :allSCustomer', { allSCustomer: `%${customerName.trim()}%` });
        if (inventoryTypeId != null) qb.andWhere('s.inventory_type_id = :allSInvType', { allSInvType: inventoryTypeId });
        this.applyInboundTimeRange(qb, 's.created_at', startDate, endDate);
        return qb;
      };

      const [pendingIdRows, storedIdRows] = await Promise.all([
        buildPendingIdQb().getRawMany<{ id: number; createdAt: Date | string }>(),
        buildStoredIdQb().getRawMany<{ id: number; createdAt: Date | string }>(),
      ]);

      type AllItem = { id: number; itemType: 'pending' | 'stored'; ts: number };
      const toTs = (v: Date | string) => (v instanceof Date ? v : new Date(v)).getTime();
      const allItems: AllItem[] = [
        ...pendingIdRows.map((r) => ({ id: Number(r.id), itemType: 'pending' as const, ts: toTs(r.createdAt) })),
        ...storedIdRows.map((r) => ({ id: Number(r.id), itemType: 'stored' as const, ts: toTs(r.createdAt) })),
      ].sort((a, b) => b.ts - a.ts || b.id - a.id);

      const total = allItems.length;
      const pageItems = allItems.slice((page - 1) * pageSize, page * pageSize);

      const pendingIdsForPage = pageItems.filter((r) => r.itemType === 'pending').map((r) => r.id);
      const storedIdsForPage = pageItems.filter((r) => r.itemType === 'stored').map((r) => r.id);

      const pendingMap = new Map<number, FinishedStockRow>();
      if (pendingIdsForPage.length > 0) {
        const rows = await this.pendingRepo
          .createQueryBuilder('p')
          .innerJoin(Order, 'o', 'o.id = p.order_id')
          .where('p.id IN (:...allPIds)', { allPIds: pendingIdsForPage })
          .select(['p.id AS id', 'p.order_id AS orderId', 'o.order_no AS orderNo', 'o.customer_name AS customerName', 'p.sku_code AS skuCode', 'p.quantity AS quantity', 'p.created_at AS createdAt'])
          .getRawMany<{ id: number; orderId: number; orderNo: string; customerName: string; skuCode: string; quantity: number; createdAt: Date }>();
        for (const r of rows) {
          pendingMap.set(Number(r.id), {
            id: Number(r.id), orderId: r.orderId, orderNo: r.orderNo ?? '', customerName: r.customerName ?? '',
            skuCode: r.skuCode ?? '', quantity: r.quantity ?? 0, unitPrice: '0', warehouseId: null,
            inventoryTypeId: null, department: '', location: '', imageUrl: '',
            createdAt: formatDateTimeForResponse(r.createdAt), type: 'pending',
          });
        }
      }

      const storedMap = new Map<number, FinishedStockRow>();
      if (storedIdsForPage.length > 0) {
        const storedRawRows = await this.createStoredListQueryBuilder()
          .where('s.id IN (:...allSIds)', { allSIds: storedIdsForPage })
          .getRawMany<StoredStockRawRow>();
        const storedDetails = await this.buildStoredRowsWithDetails(storedRawRows);
        for (const r of storedDetails) storedMap.set(r.id, r);
      }

      const list = pageItems
        .map((r) => (r.itemType === 'pending' ? pendingMap.get(r.id) : storedMap.get(r.id)))
        .filter((r): r is FinishedStockRow => r != null);

      return { list, total, page, pageSize, totalQuantity: listTotalQuantity, totalAmount: listTotalAmount };
    }

    if (tab === 'pending') {
      const countQb = this.pendingRepo
        .createQueryBuilder('p')
        .innerJoin(Order, 'o', 'o.id = p.order_id')
        .where('p.status = :status', { status: 'pending' });
      if (orderNo?.trim()) countQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      if (skuCode?.trim()) countQb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      if (customerName?.trim()) {
        countQb.andWhere('o.customer_name LIKE :customerName', { customerName: `%${customerName.trim()}%` });
      }
      this.applyInboundTimeRange(countQb, 'p.created_at', startDate, endDate);
      const pendingTotal = await countQb.getCount();

      const pendingQb = this.pendingRepo
        .createQueryBuilder('p')
        .innerJoin(Order, 'o', 'o.id = p.order_id')
        .where('p.status = :status', { status: 'pending' })
        .select([
          'p.id AS id',
          'p.order_id AS orderId',
          'o.order_no AS orderNo',
          'o.customer_name AS customerName',
          'p.sku_code AS skuCode',
          'p.quantity AS quantity',
          'p.created_at AS createdAt',
        ]);
      if (orderNo?.trim()) pendingQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      if (skuCode?.trim()) pendingQb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      if (customerName?.trim()) {
        pendingQb.andWhere('o.customer_name LIKE :customerName', { customerName: `%${customerName.trim()}%` });
      }
      this.applyInboundTimeRange(pendingQb, 'p.created_at', startDate, endDate);
      pendingQb.orderBy('p.created_at', 'DESC').limit(pageSize).offset((page - 1) * pageSize);
      const pendingRows = await pendingQb.getRawMany<{
        id: number;
        orderId: number;
        orderNo: string;
        customerName: string;
        skuCode: string;
        quantity: number;
        createdAt: Date;
      }>();
      return {
        list: pendingRows.map((r) => ({
          id: r.id,
          orderId: r.orderId,
          orderNo: r.orderNo ?? '',
          customerName: r.customerName ?? '',
          skuCode: r.skuCode ?? '',
          quantity: r.quantity ?? 0,
          unitPrice: '0',
          warehouseId: null,
          inventoryTypeId: null,
          department: '',
          location: '',
          imageUrl: '',
          createdAt: formatDateTimeForResponse(r.createdAt),
          type: 'pending' as const,
        })),
        total: pendingTotal,
        page,
        pageSize,
        totalQuantity: pendingQtyTotal,
        totalAmount: 0,
      };
    }

    if (tab === 'stored') {
      const stockQb = this.createStoredListQueryBuilder();
      this.applyStoredListFilters(stockQb, {
        orderNo,
        skuCode,
        customerName,
        inventoryTypeId,
        startDate,
        endDate,
      });

      let storedCount = 0;
      let storedRows: StoredStockRawRow[] = [];

      if (paginateByVisibleGroup) {
        const skuGroupSql = this.getStoredSkuGroupSql();
        const groupedQb = this.stockRepo
          .createQueryBuilder('s')
          .leftJoin(Order, 'o', 'o.id = s.order_id')
          .select(`${skuGroupSql}`, 'skuGroupKey')
          .addSelect('MAX(s.created_at)', 'latestCreatedAt')
          .groupBy(skuGroupSql)
          .orderBy('latestCreatedAt', 'DESC')
          .addOrderBy('skuGroupKey', 'ASC');
        this.applyStoredListFilters(groupedQb, {
          orderNo,
          skuCode,
          customerName,
          inventoryTypeId,
          startDate,
          endDate,
        });
        const visibleGroups = await groupedQb.getRawMany<{
          skuGroupKey: string;
          latestCreatedAt: string | Date;
        }>();
        storedCount = visibleGroups.length;
        const pageGroups = visibleGroups.slice((page - 1) * pageSize, page * pageSize);
        if (pageGroups.length > 0) {
          stockQb.andWhere(
            new Brackets((whereQb) => {
              pageGroups.forEach((group, index) => {
                whereQb.orWhere(
                  `${skuGroupSql} = :skuGroupKey${index}`,
                  { [`skuGroupKey${index}`]: group.skuGroupKey ?? '' },
                );
              });
            }),
          );
          const groupOrderSql = pageGroups
            .map((_, index) => `WHEN ${skuGroupSql} = :skuGroupKey${index} THEN ${index}`)
            .join(' ');
          storedRows = await stockQb
            .orderBy(`CASE ${groupOrderSql} ELSE ${pageGroups.length} END`, 'ASC')
            .addOrderBy('s.created_at', 'DESC')
            .addOrderBy('s.id', 'DESC')
            .getRawMany();
        }
      } else {
        stockQb.orderBy('s.created_at', 'DESC');
        storedCount = await stockQb.getCount();
        storedRows = await stockQb
          .offset((page - 1) * pageSize)
          .limit(pageSize)
          .getRawMany();
      }

      const storedList = await this.buildStoredRowsWithDetails(storedRows);
      return {
        list: storedList,
        total: storedCount,
        page,
        pageSize,
        totalQuantity: storedQtyTotal,
        totalAmount: storedAmountTotal,
      };
    }

    return { list: [], total: 0, page, pageSize, totalQuantity: 0, totalAmount: 0 };
  }
}
