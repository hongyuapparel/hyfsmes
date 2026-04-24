import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { InboundPending } from '../entities/inbound-pending.entity';
import { Order } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import { FinishedGoodsStockAdjustLog } from '../entities/finished-goods-stock-adjust-log.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { User, UserStatus } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import type {
  ColorSizeSnapshot,
  FinishedGoodsStockDetailResult,
  FinishedStockRow,
} from './finished-goods-stock.types';

@Injectable()
export class FinishedGoodsStockQueryService {
  constructor(
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(InboundPending)
    private readonly pendingRepo: Repository<InboundPending>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(FinishedGoodsStockColorImage)
    private readonly colorImageRepo: Repository<FinishedGoodsStockColorImage>,
    @InjectRepository(FinishedGoodsStockAdjustLog)
    private readonly adjustLogRepo: Repository<FinishedGoodsStockAdjustLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
  ) {}

  private formatDateTimeForResponse(value: unknown): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value as any);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private isTableMissingError(e: unknown, tableName: string): boolean {
    const msg = String((e as any)?.message || '');
    return msg.includes('Table') && msg.includes(tableName) && msg.includes("doesn't exist");
  }

  private normalizeOrderUnitPrice(v: unknown): string {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0';
    return n.toFixed(2);
  }

  private snapshotRowTotal(row: { quantities: unknown[] }): number {
    return row.quantities.reduce<number>(
      (sum, quantity) => sum + Math.max(0, Math.trunc(Number(quantity) || 0)),
      0,
    );
  }

  private sameSnapshotQuantities(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  }

  private normalizeColorSizeSnapshot(snapshot: ColorSizeSnapshot | null): ColorSizeSnapshot | null {
    if (!snapshot?.headers?.length || !snapshot.rows?.length) return null;

    const headers: string[] = [];
    const sourceHeaderToTarget: number[] = [];
    snapshot.headers.forEach((header, sourceIndex) => {
      const normalized = String(header ?? '').trim();
      if (!normalized || normalized === '__UNASSIGNED__') return;
      let targetIndex = headers.indexOf(normalized);
      if (targetIndex < 0) {
        targetIndex = headers.length;
        headers.push(normalized);
      }
      sourceHeaderToTarget[sourceIndex] = targetIndex;
    });
    if (!headers.length) return null;

    const orderedColors: string[] = [];
    const rowMap = new Map<string, number[]>();
    const blankRows: number[][] = [];

    const addRow = (colorName: string, quantities: number[]) => {
      let existing = rowMap.get(colorName);
      if (!existing) {
        existing = Array(headers.length).fill(0);
        rowMap.set(colorName, existing);
        orderedColors.push(colorName);
      }
      quantities.forEach((quantity, index) => {
        existing![index] += quantity;
      });
    };

    snapshot.rows.forEach((rawRow) => {
      const quantities = Array(headers.length).fill(0);
      const sourceValues = Array.isArray(rawRow.quantities) ? rawRow.quantities : [];
      sourceValues.forEach((value, sourceIndex) => {
        const targetIndex = sourceHeaderToTarget[sourceIndex];
        if (targetIndex == null) return;
        const n = Number(value);
        quantities[targetIndex] += Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
      });
      if (this.snapshotRowTotal({ quantities }) <= 0) return;
      const colorName = String(rawRow.colorName ?? '').trim();
      if (!colorName || colorName === '__UNASSIGNED__') {
        blankRows.push(quantities);
        return;
      }
      addRow(colorName, quantities);
    });

    blankRows.forEach((quantities) => {
      const exactMatches = orderedColors.filter((colorName) =>
        this.sameSnapshotQuantities(rowMap.get(colorName) ?? [], quantities),
      );
      if (exactMatches.length === 1) addRow(exactMatches[0], quantities);
      else if (orderedColors.length === 1) addRow(orderedColors[0], quantities);
      else addRow('', quantities);
    });

    const rows = orderedColors
      .map((colorName) => ({ colorName, quantities: [...(rowMap.get(colorName) ?? [])] }))
      .filter((row) => this.snapshotRowTotal(row) > 0);
    if (!rows.length) return null;
    return { headers, rows };
  }

  private parseStoredColorSizeSnapshot(raw: unknown): ColorSizeSnapshot | null {
    if (raw == null || raw === '') return null;
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const rec = parsed as Record<string, unknown>;
    const headersRaw = Array.isArray(rec.headers) ? rec.headers : [];
    const headers = headersRaw.map((h) => String(h ?? '').trim()).filter((h) => h.length > 0);
    const rowsRaw = Array.isArray(rec.rows) ? rec.rows : [];
    if (!headers.length || !rowsRaw.length) return null;
    const rows: Array<{ colorName: string; quantities: number[] }> = [];
    for (const item of rowsRaw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const colorName = String(row.colorName ?? '').trim();
      const sourceValues = Array.isArray(row.quantities)
        ? row.quantities
        : Array.isArray(row.values)
          ? row.values
          : [];
      const quantities = headers.map((_, i) => {
        const n = Number(sourceValues[i]);
        return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
      });
      rows.push({ colorName, quantities });
    }
    if (!rows.length) return null;
    return this.normalizeColorSizeSnapshot({ headers, rows });
  }

  private parseListSizeBreakdownFromSnapshot(raw: unknown): {
    headers: string[];
    rows: Array<{ colorName: string; values: number[] }>;
  } | null {
    const snapshot = this.parseStoredColorSizeSnapshot(raw);
    if (!snapshot) return null;
    return {
      headers: [...snapshot.headers],
      rows: snapshot.rows.map((row) => ({
        colorName: row.colorName,
        values: [...row.quantities],
      })),
    };
  }

  private applyInboundTimeRange(
    qb: SelectQueryBuilder<any>,
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

  private async getColorImageMapsForStocks(stockIds: number[]): Promise<Map<number, Map<string, string>>> {
    const result = new Map<number, Map<string, string>>();
    const ids = Array.from(new Set(stockIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (!ids.length) return result;
    try {
      const rows = await this.colorImageRepo.find({ where: { finishedStockId: In(ids) } });
      rows.forEach((row) => {
        const stockId = Number(row.finishedStockId);
        const colorName = String(row.colorName ?? '').trim();
        const imageUrl = String(row.imageUrl ?? '').trim();
        if (!stockId || !colorName || !imageUrl) return;
        let map = result.get(stockId);
        if (!map) {
          map = new Map<string, string>();
          result.set(stockId, map);
        }
        if (!map.has(colorName)) map.set(colorName, imageUrl);
      });
    } catch (e) {
      if (!this.isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
    }
    return result;
  }

  private allocateByWeight(weights: number[], total: number): number[] {
    const safeTotal = Math.max(0, Math.trunc(Number(total) || 0));
    if (!weights.length) return [];
    const normalized = weights.map((weight) => Math.max(0, Number(weight) || 0));
    const sumWeight = normalized.reduce((sum, weight) => sum + weight, 0);
    if (safeTotal <= 0) return normalized.map(() => 0);
    if (sumWeight <= 0) {
      const allocated = normalized.map(() => 0);
      allocated[0] = safeTotal;
      return allocated;
    }
    const exact = normalized.map((weight) => (weight * safeTotal) / sumWeight);
    const base = exact.map((value) => Math.floor(value));
    let remain = safeTotal - base.reduce((sum, value) => sum + value, 0);
    const order = exact.map((value, index) => ({ index, frac: value - Math.floor(value) })).sort((a, b) => b.frac - a.frac);
    let cursor = 0;
    while (remain > 0 && order.length > 0) {
      base[order[cursor % order.length].index] += 1;
      remain -= 1;
      cursor += 1;
    }
    return base;
  }

  private scaleColorSizeRowsToQuantity(
    headers: string[],
    rows: Array<{ colorName?: string; quantities?: number[] }>,
    targetQty: number,
  ): Array<{ colorName: string; quantities: number[] }> {
    if (!headers.length || !rows.length) return [];
    const safeTarget = Math.max(0, Math.trunc(Number(targetQty) || 0));
    const weights: number[] = [];
    rows.forEach((row) => {
      for (let i = 0; i < headers.length; i += 1) {
        weights.push(Math.max(0, Number(row.quantities?.[i]) || 0));
      }
    });
    const weightSum = weights.reduce((sum, value) => sum + value, 0);
    if (weightSum <= 0) {
      return rows.map((row) => ({ colorName: String(row.colorName ?? '').trim(), quantities: Array(headers.length).fill(0) }));
    }
    const allocated = weightSum === safeTarget ? [...weights] : this.allocateByWeight(weights, safeTarget);
    let cursor = 0;
    return rows.map((row) => {
      const quantities: number[] = [];
      for (let i = 0; i < headers.length; i += 1) {
        quantities.push(allocated[cursor] ?? 0);
        cursor += 1;
      }
      return { colorName: String(row.colorName ?? '').trim(), quantities };
    });
  }

  private async buildCurrentStockSnapshot(stock: FinishedGoodsStock): Promise<ColorSizeSnapshot | null> {
    const snapshot = this.parseStoredColorSizeSnapshot(stock.colorSizeSnapshot);
    if (snapshot) return snapshot;
    if (stock.orderId == null) return null;
    const ext = await this.orderExtRepo.findOne({ where: { orderId: stock.orderId } });
    const headers = Array.isArray(ext?.colorSizeHeaders)
      ? ext.colorSizeHeaders.map((header) => String(header ?? '').trim()).filter((header) => header.length > 0)
      : [];
    const baseRows = Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : [];
    if (!headers.length || !baseRows.length) return null;
    return {
      headers,
      rows: this.scaleColorSizeRowsToQuantity(
        headers,
        baseRows.map((row: any) => ({
          colorName: row?.colorName,
          quantities: Array.isArray(row?.quantities) ? row.quantities : [],
        })),
        stock.quantity,
      ),
    };
  }

  private async getSkuGroupSizeHeaders(stock: FinishedGoodsStock): Promise<string[]> {
    const sku = String(stock.skuCode ?? '').trim();
    if (!sku) return [];
    const customerName = String(stock.customerName ?? '').trim();
    const groupStocks = await this.stockRepo
      .createQueryBuilder('s')
      .where('s.skuCode = :sku', { sku })
      .andWhere('s.customerName = :customerName', { customerName })
      .orderBy('s.id', 'DESC')
      .getMany();
    const headers: string[] = [];
    for (const item of groupStocks) {
      const snapshot = await this.buildCurrentStockSnapshot(item);
      snapshot?.headers.forEach((header) => {
        const normalized = String(header ?? '').trim();
        if (normalized && !headers.includes(normalized)) headers.push(normalized);
      });
    }
    return headers;
  }

  getList(params: {
    tab?: string;
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    inventoryTypeId?: number;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    list: FinishedStockRow[];
    total: number;
    page: number;
    pageSize: number;
    totalQuantity: number;
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
    } = params;

    const [pendingQtyTotal, storedQtyTotal] = await Promise.all([
      tab === 'pending' || tab === 'all'
        ? this.sumPendingQuantitiesForList({ orderNo, skuCode, customerName, startDate, endDate })
        : Promise.resolve(0),
      tab === 'stored' || tab === 'all'
        ? this.sumStoredQuantitiesForList({ orderNo, skuCode, customerName, inventoryTypeId, startDate, endDate })
        : Promise.resolve(0),
    ]);
    const listTotalQuantity = pendingQtyTotal + storedQtyTotal;

    const list: FinishedStockRow[] = [];
    let total = 0;

    if (tab === 'pending' || tab === 'all') {
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
      pendingQb.orderBy('p.created_at', 'DESC');
      const pendingRows = await pendingQb.getRawMany<{
        id: number;
        orderId: number;
        orderNo: string;
        customerName: string;
        skuCode: string;
        quantity: number;
        createdAt: Date;
      }>();
      const pendingList: FinishedStockRow[] = pendingRows.map((r) => ({
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
        createdAt: this.formatDateTimeForResponse(r.createdAt),
        type: 'pending',
      }));
      if (tab === 'pending') {
        total = pendingTotal;
        const start = (page - 1) * pageSize;
        return {
          list: pendingList.slice(start, start + pageSize),
          total,
          page,
          pageSize,
          totalQuantity: pendingQtyTotal,
        };
      }
      list.push(...pendingList);
      total += pendingTotal;
    }

    if (tab === 'stored' || tab === 'all') {
      const stockQb = this.stockRepo
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
          `CASE
            WHEN s.unit_price IS NOT NULL AND s.unit_price > 0 THEN s.unit_price
            WHEN o.ex_factory_price IS NOT NULL AND o.ex_factory_price > 0 THEN o.ex_factory_price
            ELSE 0
          END AS unitPrice`,
          's.warehouse_id AS warehouseId',
          's.inventory_type_id AS inventoryTypeId',
          's.department AS department',
          's.location AS location',
          "COALESCE(pr.image_url, '') AS productImageUrl",
          "COALESCE(s.image_url, '') AS imageUrl",
          's.created_at AS createdAt',
          's.color_size_snapshot AS colorSizeSnapshot',
        ]);
      if (orderNo?.trim()) stockQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      if (skuCode?.trim()) stockQb.andWhere('s.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      if (customerName?.trim()) {
        stockQb.andWhere('s.customer_name LIKE :customerName', { customerName: `%${customerName.trim()}%` });
      }
      if (inventoryTypeId != null) stockQb.andWhere('s.inventory_type_id = :inventoryTypeId', { inventoryTypeId });
      this.applyInboundTimeRange(stockQb, 's.created_at', startDate, endDate);
      stockQb.orderBy('s.created_at', 'DESC');
      const storedCount = await stockQb.getCount();
      const storedRows = await stockQb
        .offset(tab === 'stored' ? (page - 1) * pageSize : 0)
        .limit(tab === 'stored' ? pageSize : 10000)
        .getRawMany<{
          id: number;
          orderId: number | null;
          orderNo: string;
          customerName: string;
          skuCode: string;
          quantity: number;
          unitPrice: string;
          warehouseId: number | null;
          inventoryTypeId: number | null;
          department: string;
          location: string;
          productImageUrl: string;
          imageUrl: string;
          createdAt: Date;
          colorSizeSnapshot?: unknown;
        }>();
      const storedList: FinishedStockRow[] = storedRows.map((r) => ({
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
        createdAt: this.formatDateTimeForResponse(r.createdAt),
        type: 'stored',
        sizeBreakdown: this.parseListSizeBreakdownFromSnapshot(r.colorSizeSnapshot),
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
        } catch (e) {
          if (!this.isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
        }
      }
      if (tab === 'stored') {
        return {
          list: storedList,
          total: storedCount,
          page,
          pageSize,
          totalQuantity: storedQtyTotal,
        };
      }
      list.push(...storedList);
      total += storedCount;
    }

    if (tab === 'all') {
      list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      const start = (page - 1) * pageSize;
      return {
        list: list.slice(start, start + pageSize),
        total,
        page,
        pageSize,
        totalQuantity: listTotalQuantity,
      };
    }

    return { list: [], total: 0, page, pageSize, totalQuantity: 0 };
  }

  getDetail(id: number) {
    return this.getDetailInternal(id);
  }

  getPickupUserOptions() {
    return this.getPickupUserOptionsInternal();
  }

  private async getDetailInternal(id: number): Promise<FinishedGoodsStockDetailResult> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) throw new NotFoundException('库存记录不存在');

    const [order, product, ext] = await Promise.all([
      stock.orderId != null ? this.orderRepo.findOne({ where: { id: stock.orderId } }) : Promise.resolve(null),
      stock.skuCode?.trim()
        ? this.productRepo.findOne({ where: { skuCode: stock.skuCode.trim() } })
        : Promise.resolve(null),
      stock.orderId != null ? this.orderExtRepo.findOne({ where: { orderId: stock.orderId } }) : Promise.resolve(null),
    ]);
    let colorImages: FinishedGoodsStockColorImage[] = [];
    let logs: FinishedGoodsStockAdjustLog[] = [];
    try {
      colorImages = await this.colorImageRepo.find({ where: { finishedStockId: id }, order: { updatedAt: 'DESC' } });
    } catch (e) {
      if (!this.isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
    }
    try {
      logs = await this.adjustLogRepo.find({ where: { finishedStockId: id }, order: { createdAt: 'DESC' }, take: 50 });
    } catch (e) {
      if (!this.isTableMissingError(e, 'finished_goods_stock_adjust_logs')) throw e;
    }

    const snap = this.parseStoredColorSizeSnapshot(stock.colorSizeSnapshot);
    let headers: string[] = [];
    let mappedRows: Array<{ colorName: string; quantities: number[] }> = [];
    if (snap) {
      stock.colorSizeSnapshot = snap;
      headers = snap.headers.map((h: unknown) => String(h ?? '').trim()).filter((h) => h.length > 0);
      mappedRows = snap.rows.map((r: any) => ({
        colorName: String(r?.colorName ?? ''),
        quantities: Array.isArray(r?.quantities)
          ? r.quantities.map((q: unknown) => {
              const n = Number(q);
              return Number.isFinite(n) ? n : 0;
            })
          : [],
      }));
    } else {
      headers = Array.isArray(ext?.colorSizeHeaders) ? ext.colorSizeHeaders : [];
      const rows = Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : [];
      mappedRows = rows.map((r: any) => ({
        colorName: String(r?.colorName ?? ''),
        quantities: Array.isArray(r?.quantities)
          ? r.quantities.map((q: unknown) => {
              const n = Number(q);
              return Number.isFinite(n) ? n : 0;
            })
          : [],
      }));
    }
    const colors = mappedRows.map((r) => r.colorName).filter((v) => v);
    const groupSizeHeaders = await this.getSkuGroupSizeHeaders(stock);

    const stockUnitPrice = Number(stock.unitPrice);
    const orderUnitPrice = Number(order?.exFactoryPrice);
    const resolvedUnitPrice =
      Number.isFinite(stockUnitPrice) && stockUnitPrice > 0
        ? stockUnitPrice
        : Number.isFinite(orderUnitPrice)
          ? orderUnitPrice
          : 0;
    stock.unitPrice = this.normalizeOrderUnitPrice(resolvedUnitPrice);

    return {
      stock,
      orderNo: order?.orderNo ?? '',
      productImageUrl: product?.imageUrl?.trim() || stock.imageUrl?.trim() || '',
      colorImages: colorImages.map((r) => ({
        colorName: r.colorName ?? '',
        imageUrl: r.imageUrl ?? '',
        updatedAt: this.formatDateTimeForResponse(r.updatedAt),
      })),
      adjustLogs: logs.map((l) => ({
        id: l.id,
        operatorUsername: l.operatorUsername ?? '',
        before: l.before ?? null,
        after: l.after ?? null,
        remark: l.remark ?? '',
        createdAt: this.formatDateTimeForResponse(l.createdAt),
      })),
      colorSize: { headers, colors, rows: mappedRows },
      groupSizeHeaders,
    };
  }

  private async getPickupUserOptionsInternal(): Promise<Array<{ id: number; username: string; displayName: string }>> {
    const role = await this.roleRepo.findOne({ where: { code: 'salesperson' } });
    if (!role) return [];
    const links = await this.userRoleRepo.find({ where: { roleId: role.id }, select: ['userId'] });
    const userIds = Array.from(new Set(links.map((x) => x.userId)));
    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('(u.role_id = :rid OR u.id IN (:...ids))', { rid: role.id, ids: userIds.length ? userIds : [0] })
      .orderBy('u.display_name', 'ASC')
      .getMany();
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName ?? '',
    }));
  }
}
