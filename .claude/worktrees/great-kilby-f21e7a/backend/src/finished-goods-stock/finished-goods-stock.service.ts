import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository, SelectQueryBuilder } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { InboundPending } from '../entities/inbound-pending.entity';
import { Order } from '../entities/order.entity';
import { FinishedGoodsOutbound } from '../entities/finished-goods-outbound.entity';
import { Product } from '../entities/product.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import { FinishedGoodsStockAdjustLog } from '../entities/finished-goods-stock-adjust-log.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { User, UserStatus } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';

export interface FinishedStockRow {
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
  imageUrl: string;
  productImageUrl?: string;
  createdAt: string;
  type: 'pending' | 'stored';
  /** 无订单手动入库：来自 color_size_snapshot，与订单 color-size-breakdown 结构一致（rows 用 values） */
  sizeBreakdown?: {
    headers: string[];
    rows: Array<{ colorName: string; values: number[] }>;
  } | null;
  colorImages?: Array<{ colorName: string; imageUrl: string }>;
}

type FinishedOutboundItemInput = {
  id: number;
  quantity: number;
  sizeBreakdown?: any;
};

type ColorSizeSnapshot = {
  headers: string[];
  rows: Array<{ colorName: string; quantities: number[] }>;
};

@Injectable()
export class FinishedGoodsStockService {
  constructor(
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(FinishedGoodsOutbound)
    private readonly outboundRepo: Repository<FinishedGoodsOutbound>,
    @InjectRepository(FinishedGoodsStockColorImage)
    private readonly colorImageRepo: Repository<FinishedGoodsStockColorImage>,
    @InjectRepository(FinishedGoodsStockAdjustLog)
    private readonly adjustLogRepo: Repository<FinishedGoodsStockAdjustLog>,
    @InjectRepository(InboundPending)
    private readonly pendingRepo: Repository<InboundPending>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
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

  /** 库表 order_id 仍为 NOT NULL 时，无订单入库会触发此类错误 */
  private isOrderIdNullSchemaError(dbMessage: string): boolean {
    const msg = String(dbMessage);
    if (!msg.includes('order_id')) return false;
    return (
      msg.includes('cannot be null') ||
      msg.includes("doesn't have a default value") ||
      msg.includes('does not have a default value')
    );
  }

  private orderIdNullableMigrationHint(): string {
    return (
      '数据库表 finished_goods_stock 的 order_id 不允许为空，无法在「不填订单号」时保存。请在库中执行 backend/scripts/allow-finished-goods-stock-null-order-id.sql（执行前备份），将 order_id 改为可 NULL 后再试。'
    );
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
      const exactMatches = orderedColors.filter((colorName) => this.sameSnapshotQuantities(rowMap.get(colorName) ?? [], quantities));
      if (exactMatches.length === 1) {
        addRow(exactMatches[0], quantities);
      } else if (orderedColors.length === 1) {
        addRow(orderedColors[0], quantities);
      } else {
        addRow('', quantities);
      }
    });

    const rows = orderedColors
      .map((colorName) => ({
        colorName,
        quantities: [...(rowMap.get(colorName) ?? [])],
      }))
      .filter((row) => this.snapshotRowTotal(row) > 0);

    if (!rows.length) return null;
    return { headers, rows };
  }

  /** 解析新增库存传入的颜色尺码；返回落库快照（不含图）与待写入的颜色图片行 */
  private parseColorSizeInput(raw: unknown): {
    snapshot: { headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> } | null;
    imageRows: Array<{ colorName: string; imageUrl: string }>;
  } {
    if (!raw || typeof raw !== 'object') return { snapshot: null, imageRows: [] };
    const o = raw as Record<string, unknown>;
    const headersRaw = Array.isArray(o.headers) ? (o.headers as unknown[]) : [];
    const headers = headersRaw.map((h) => String(h ?? '').trim()).filter((h) => h.length > 0);
    const rowsRaw = Array.isArray(o.rows) ? (o.rows as unknown[]) : [];
    if (!headers.length || !rowsRaw.length) return { snapshot: null, imageRows: [] };
    const rows: Array<{ colorName: string; quantities: number[] }> = [];
    const imageRows: Array<{ colorName: string; imageUrl: string }> = [];
    for (const item of rowsRaw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const colorName = String(row.colorName ?? '').trim();
      const qa = Array.isArray(row.quantities) ? (row.quantities as unknown[]) : [];
      const quantities = headers.map((_, i) => {
        const n = Number(qa[i]);
        return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
      });
      rows.push({ colorName, quantities });
      const img = String(row.imageUrl ?? '').trim();
      if (colorName && img) imageRows.push({ colorName, imageUrl: img });
    }
    if (!rows.length) return { snapshot: null, imageRows: [] };
    return { snapshot: this.normalizeColorSizeSnapshot({ headers, rows }), imageRows };
  }

  private parseStoredColorSizeSnapshot(raw: unknown): {
    headers: string[];
    rows: Array<{ colorName: string; quantities: number[] }>;
  } | null {
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

  private pickColorImageForSnapshot(
    snapshot: { rows: Array<{ colorName: string }> } | null,
    colorImages: Map<string, string> | undefined,
  ): string {
    if (!colorImages?.size) return '';
    const colorNames = snapshot?.rows.map((row) => String(row.colorName ?? '').trim()).filter(Boolean) ?? [];
    for (const colorName of colorNames) {
      const imageUrl = colorImages.get(colorName);
      if (imageUrl) return imageUrl;
    }
    return Array.from(colorImages.values()).find((imageUrl) => !!imageUrl) ?? '';
  }

  private cloneColorSizeSnapshot(
    snapshot: { headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> } | null,
  ): { headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> } | null {
    if (!snapshot) return null;
    return {
      headers: [...snapshot.headers],
      rows: snapshot.rows.map((row) => ({
        colorName: row.colorName,
        quantities: [...row.quantities],
      })),
    };
  }

  private getColorSizeSnapshotTotal(
    snapshot: { headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> } | null,
  ): number {
    if (!snapshot) return 0;
    return snapshot.rows.reduce(
      (sum, row) =>
        sum
        + row.quantities.reduce((rowSum, quantity) => rowSum + Math.max(0, Math.trunc(Number(quantity) || 0)), 0),
      0,
    );
  }

  private assertColorSizeSnapshotTotal(
    snapshot: { headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> } | null,
    expectedQty: number,
    message: string,
  ): void {
    if (!snapshot) return;
    const safeExpectedQty = Math.max(0, Math.trunc(Number(expectedQty) || 0));
    const actual = this.getColorSizeSnapshotTotal(snapshot);
    if (actual !== safeExpectedQty) {
      throw new BadRequestException(`${message}（尺码合计 ${actual}，总数量 ${safeExpectedQty}）`);
    }
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
    const order = exact
      .map((value, index) => ({ index, frac: value - Math.floor(value) }))
      .sort((a, b) => b.frac - a.frac);
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
      return rows.map((row) => ({
        colorName: String(row.colorName ?? '').trim(),
        quantities: Array(headers.length).fill(0),
      }));
    }
    const allocated = weightSum === safeTarget ? [...weights] : this.allocateByWeight(weights, safeTarget);
    let cursor = 0;
    return rows.map((row) => {
      const quantities: number[] = [];
      for (let i = 0; i < headers.length; i += 1) {
        quantities.push(allocated[cursor] ?? 0);
        cursor += 1;
      }
      return {
        colorName: String(row.colorName ?? '').trim(),
        quantities,
      };
    });
  }

  private async buildCurrentStockSnapshot(
    stock: FinishedGoodsStock,
  ): Promise<{ headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> } | null> {
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

  private mergeColorSizeSnapshots(
    currentRaw: unknown,
    incoming: { headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> } | null,
  ): { headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> } | null {
    if (!incoming) return this.parseStoredColorSizeSnapshot(currentRaw);
    const current = this.parseStoredColorSizeSnapshot(currentRaw);
    if (!current) {
      return this.normalizeColorSizeSnapshot(this.cloneColorSizeSnapshot(incoming));
    }

    const headers = [...incoming.headers];
    current.headers.forEach((header) => {
      if (!headers.includes(header)) headers.push(header);
    });

    const rowOrder: string[] = [];
    const rowMap = new Map<string, { colorName: string; quantities: number[] }>();
    const ensureRow = (colorName: string) => {
      const key = String(colorName ?? '').trim();
      let row = rowMap.get(key);
      if (!row) {
        row = { colorName: key, quantities: Array(headers.length).fill(0) };
        rowMap.set(key, row);
        rowOrder.push(key);
      } else if (row.quantities.length < headers.length) {
        row.quantities.push(...Array(headers.length - row.quantities.length).fill(0));
      }
      return row;
    };

    incoming.rows.forEach((row) => {
      const colorName = String(row.colorName ?? '').trim();
      ensureRow(colorName);
    });
    current.rows.forEach((row) => {
      const colorName = String(row.colorName ?? '').trim();
      ensureRow(colorName);
    });

    const applySnapshot = (
      snapshot: { headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> },
      mode: 'set' | 'add',
    ) => {
      const headerIndex = new Map(snapshot.headers.map((header, index) => [header, index]));
      snapshot.rows.forEach((item) => {
        const row = ensureRow(item.colorName);
        headers.forEach((header, index) => {
          const sourceIndex = headerIndex.get(header);
          if (sourceIndex == null) return;
          const qty = Number(item.quantities[sourceIndex]);
          const safeQty = Number.isFinite(qty) && qty >= 0 ? Math.trunc(qty) : 0;
          if (mode === 'set') row.quantities[index] = safeQty;
          else row.quantities[index] += safeQty;
        });
      });
    };

    applySnapshot(current, 'set');
    applySnapshot(incoming, 'add');

    return this.normalizeColorSizeSnapshot({
      headers,
      rows: rowOrder.map((key) => {
        const row = rowMap.get(key)!;
        return {
          colorName: row.colorName,
          quantities: [...row.quantities],
        };
      }),
    });
  }

  private subtractColorSizeSnapshots(
    currentRaw: unknown,
    outgoing: { headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> } | null,
  ): { headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> } | null {
    const current = this.parseStoredColorSizeSnapshot(currentRaw);
    if (!current || !outgoing) return current;

    const headers = [...current.headers];
    const rows = current.rows.map((row) => ({
      colorName: String(row.colorName ?? '').trim(),
      quantities: headers.map((_, index) => Math.max(0, Math.trunc(Number(row.quantities[index]) || 0))),
    }));
    const rowMap = new Map(rows.map((row) => [row.colorName, row]));
    const headerIndex = new Map(headers.map((header, index) => [header, index]));

    outgoing.rows.forEach((outRow) => {
      const colorName = String(outRow.colorName ?? '').trim();
      const targetRow = rowMap.get(colorName);
      if (!targetRow) {
        throw new BadRequestException(`颜色「${colorName || '-'}」库存明细不足，无法出库`);
      }
      outgoing.headers.forEach((header, outIndex) => {
        const qty = Math.max(0, Math.trunc(Number(outRow.quantities?.[outIndex]) || 0));
        if (qty <= 0) return;
        const targetIndex = headerIndex.get(header);
        if (targetIndex == null) {
          throw new BadRequestException(`尺码「${header}」库存明细不足，无法出库`);
        }
        const remain = Math.max(0, Math.trunc(Number(targetRow.quantities[targetIndex]) || 0));
        if (remain < qty) {
          throw new BadRequestException(`颜色「${colorName || '-'}」尺码「${header}」库存不足`);
        }
        targetRow.quantities[targetIndex] = remain - qty;
      });
    });

    const activeRows = rows
      .map((row) => ({
        colorName: row.colorName,
        quantities: headers.map((_, index) => Math.max(0, Math.trunc(Number(row.quantities[index]) || 0))),
      }))
      .filter((row) => row.quantities.some((qty) => qty > 0));

    if (!activeRows.length) return { headers: [], rows: [] };
    return this.normalizeColorSizeSnapshot({
      headers,
      rows: activeRows,
    });
  }

  /**
   * 列表数量悬停：将 color_size_snapshot 转为与订单接口一致的 { headers, rows[{ colorName, values }] }
   */
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

  /** 待入库列表：与列表筛选一致的总件数 */
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

  /** 已入库列表：与列表筛选一致的总件数 */
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
      qb.andWhere('s.inventory_type_id = :inventoryTypeId', { inventoryTypeId: filters.inventoryTypeId });
    }
    this.applyInboundTimeRange(qb, 's.created_at', filters.startDate, filters.endDate);
    const row = await qb.getRawOne<{ qty: string | number }>();
    return Number(row?.qty ?? 0) || 0;
  }

  private async persistColorImagesForStock(
    stockId: number,
    imageRows: Array<{ colorName: string; imageUrl: string }>,
  ): Promise<void> {
    for (const { colorName, imageUrl } of imageRows) {
      if (!colorName) continue;
      try {
        if (!imageUrl) {
          const existing = await this.colorImageRepo.findOne({ where: { finishedStockId: stockId, colorName } });
          if (existing) await this.colorImageRepo.remove(existing);
          continue;
        }
        const existing = await this.colorImageRepo.findOne({ where: { finishedStockId: stockId, colorName } });
        if (existing) {
          existing.imageUrl = imageUrl;
          await this.colorImageRepo.save(existing);
        } else {
          await this.colorImageRepo.save(this.colorImageRepo.create({ finishedStockId: stockId, colorName, imageUrl }));
        }
      } catch (e) {
        if (!this.isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
      }
    }
  }

  private async resolvePickupUser(pickupUserId?: number | null): Promise<{ pickupId: number | null; pickupUserName: string }> {
    if (pickupUserId == null) {
      return { pickupId: null, pickupUserName: '' };
    }
    const salespersonRole = await this.roleRepo.findOne({ where: { code: 'salesperson' } });
    if (!salespersonRole) throw new NotFoundException('未配置业务员角色');
    const pickupUser = await this.userRepo.findOne({
      where: { id: Number(pickupUserId), status: UserStatus.ACTIVE },
      select: ['id', 'username', 'displayName', 'roleId', 'status'],
    });
    if (!pickupUser) throw new NotFoundException('领取人不存在或不是在职业务员');
    const link = await this.userRoleRepo.findOne({ where: { userId: pickupUser.id, roleId: salespersonRole.id } });
    if (!(pickupUser.roleId === salespersonRole.id || !!link)) {
      throw new NotFoundException('领取人不存在或不是在职业务员');
    }
    return {
      pickupId: pickupUser.id,
      pickupUserName: (pickupUser.displayName?.trim() || pickupUser.username || '').trim(),
    };
  }

  private async insertFinishedGoodsOutboundRecord(
    manager: EntityManager,
    payload: {
      finishedStockId: number;
      orderId: number | null;
      orderNo: string;
      skuCode: string;
      imageUrl: string;
      customerName: string;
      quantity: number;
      department: string;
      warehouseId: number | null;
      inventoryTypeId: number | null;
      pickupUserId: number | null;
      pickupUserName: string;
      sizeBreakdown: unknown;
      operatorUsername: string;
      remark: string;
    },
  ): Promise<void> {
    const sizeBreakdown = payload.sizeBreakdown != null ? JSON.stringify(payload.sizeBreakdown) : null;
    const sqlWithImage =
      'INSERT INTO finished_goods_outbound (finished_stock_id, order_id, order_no, sku_code, image_url, customer_name, quantity, department, warehouse_id, inventory_type_id, pickup_user_id, pickup_user_name, size_breakdown, operator_username, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const paramsWithImage = [
      payload.finishedStockId,
      payload.orderId,
      payload.orderNo,
      payload.skuCode,
      payload.imageUrl,
      payload.customerName,
      payload.quantity,
      payload.department,
      payload.warehouseId,
      payload.inventoryTypeId,
      payload.pickupUserId,
      payload.pickupUserName,
      sizeBreakdown,
      payload.operatorUsername,
      payload.remark,
    ];

    try {
      await manager.query(sqlWithImage, paramsWithImage);
      return;
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (!(msg.includes('Unknown column') && msg.includes('image_url'))) throw e;
    }

    const sqlWithoutImage =
      'INSERT INTO finished_goods_outbound (finished_stock_id, order_id, order_no, sku_code, customer_name, quantity, department, warehouse_id, inventory_type_id, pickup_user_id, pickup_user_name, size_breakdown, operator_username, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const paramsWithoutImage = [
      payload.finishedStockId,
      payload.orderId,
      payload.orderNo,
      payload.skuCode,
      payload.customerName,
      payload.quantity,
      payload.department,
      payload.warehouseId,
      payload.inventoryTypeId,
      payload.pickupUserId,
      payload.pickupUserName,
      sizeBreakdown,
      payload.operatorUsername,
      payload.remark,
    ];
    await manager.query(sqlWithoutImage, paramsWithoutImage);
  }

  /**
   * 与「新增库存」合并维度一致：同 SKU + 同订单关联 + 同仓库 + 同库存类型 + 同部门 → 累加数量并记操作日志。
   * 存放地址不参与合并键；不同仓或不同部门为不同行，同仓同部门合并为一条。
   */
  private async findMergeableFinishedStock(params: {
    skuCode: string;
    orderId: number | null;
    warehouseId: number | null;
    inventoryTypeId: number | null;
    department: string;
  }): Promise<FinishedGoodsStock | null> {
    const sku = params.skuCode.trim();
    const dep = params.department.trim();
    if (!sku) return null;
    const qb = this.stockRepo
      .createQueryBuilder('s')
      .where('s.skuCode = :sku', { sku })
      .andWhere('s.department = :dep', { dep });
    if (params.orderId != null) qb.andWhere('s.orderId = :oid', { oid: params.orderId });
    else qb.andWhere('s.orderId IS NULL');
    if (params.warehouseId != null) qb.andWhere('s.warehouseId = :wid', { wid: params.warehouseId });
    else qb.andWhere('s.warehouseId IS NULL');
    if (params.inventoryTypeId != null) qb.andWhere('s.inventoryTypeId = :iid', { iid: params.inventoryTypeId });
    else qb.andWhere('s.inventoryTypeId IS NULL');
    qb.orderBy('s.id', 'DESC');
    return (await qb.getOne()) ?? null;
  }

  private stockAdjustSnapshot(stock: FinishedGoodsStock) {
    return {
      department: stock.department ?? '',
      inventoryTypeId: stock.inventoryTypeId ?? null,
      warehouseId: stock.warehouseId ?? null,
      location: stock.location ?? '',
      quantity: stock.quantity ?? 0,
      unitPrice: stock.unitPrice != null ? String(stock.unitPrice) : '0',
      imageUrl: stock.imageUrl ?? '',
      colorSizeSnapshot: this.cloneColorSizeSnapshot(this.parseStoredColorSizeSnapshot(stock.colorSizeSnapshot)),
    };
  }

  private async appendFinishedStockAdjustLog(
    finishedStockId: number,
    operatorUsername: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    remark: string,
  ): Promise<void> {
    try {
      await this.adjustLogRepo.save(
        this.adjustLogRepo.create({
          finishedStockId,
          operatorUsername: (operatorUsername ?? '').trim(),
          before,
          after,
          remark: (remark ?? '').trim(),
        }),
      );
    } catch (e) {
      if (!this.isTableMissingError(e, 'finished_goods_stock_adjust_logs')) throw e;
    }
  }

  /** 手动新增成品库存（仓库直接入库）；仅填写订单号时才关联订单并从订单带出客户与出厂价；不按 SKU 自动匹配订单 */
  private combineColorSizeSnapshots(snapshots: ColorSizeSnapshot[]): ColorSizeSnapshot | null {
    const normalized = snapshots
      .map((snapshot) => this.normalizeColorSizeSnapshot(snapshot))
      .filter((snapshot): snapshot is ColorSizeSnapshot => !!snapshot);
    if (!normalized.length) return null;

    const headers: string[] = [];
    [...normalized].sort((a, b) => b.headers.length - a.headers.length).forEach((snapshot) => {
      snapshot.headers.forEach((header) => {
        if (!headers.includes(header)) headers.push(header);
      });
    });

    const rowOrder: string[] = [];
    const rowMap = new Map<string, number[]>();
    const ensureRow = (colorName: string) => {
      const key = String(colorName ?? '').trim();
      let quantities = rowMap.get(key);
      if (!quantities) {
        quantities = Array(headers.length).fill(0);
        rowMap.set(key, quantities);
        rowOrder.push(key);
      }
      return quantities;
    };

    normalized.forEach((snapshot) => {
      const sourceHeaderIndex = new Map(snapshot.headers.map((header, index) => [header, index]));
      snapshot.rows.forEach((row) => {
        const quantities = ensureRow(row.colorName);
        headers.forEach((header, targetIndex) => {
          const sourceIndex = sourceHeaderIndex.get(header);
          if (sourceIndex == null) return;
          quantities[targetIndex] += Math.max(0, Math.trunc(Number(row.quantities[sourceIndex]) || 0));
        });
      });
    });

    return this.normalizeColorSizeSnapshot({
      headers,
      rows: rowOrder.map((colorName) => ({
        colorName,
        quantities: [...(rowMap.get(colorName) ?? [])],
      })),
    });
  }

  private async findDuplicateStocksForMergeKey(seed: FinishedGoodsStock): Promise<FinishedGoodsStock[]> {
    const sku = String(seed.skuCode ?? '').trim();
    const dep = String(seed.department ?? '').trim();
    if (!sku) return [seed];

    const qb = this.stockRepo
      .createQueryBuilder('s')
      .where('s.skuCode = :sku', { sku })
      .andWhere('s.department = :dep', { dep });
    if (seed.orderId != null) qb.andWhere('s.orderId = :oid', { oid: seed.orderId });
    else qb.andWhere('s.orderId IS NULL');
    if (seed.warehouseId != null) qb.andWhere('s.warehouseId = :wid', { wid: seed.warehouseId });
    else qb.andWhere('s.warehouseId IS NULL');
    if (seed.inventoryTypeId != null) qb.andWhere('s.inventoryTypeId = :iid', { iid: seed.inventoryTypeId });
    else qb.andWhere('s.inventoryTypeId IS NULL');
    qb.orderBy('s.id', 'ASC');
    return qb.getMany();
  }

  private async mergeColorImagesIntoKeeper(keeperId: number, sourceIds: number[]): Promise<void> {
    if (!sourceIds.length) return;
    const allIds = [keeperId, ...sourceIds];
    try {
      const colorImages = await this.colorImageRepo.find({
        where: { finishedStockId: In(allIds) },
        order: { updatedAt: 'DESC' },
      });
      const keeperByColor = new Map<string, FinishedGoodsStockColorImage>();
      colorImages
        .filter((item) => item.finishedStockId === keeperId)
        .forEach((item) => {
          const colorName = String(item.colorName ?? '').trim();
          const imageUrl = String(item.imageUrl ?? '').trim();
          if (colorName && imageUrl && !keeperByColor.has(colorName)) keeperByColor.set(colorName, item);
        });

      for (const item of colorImages.filter((entry) => sourceIds.includes(entry.finishedStockId))) {
        const colorName = String(item.colorName ?? '').trim();
        const imageUrl = String(item.imageUrl ?? '').trim();
        if (!colorName || !imageUrl || keeperByColor.has(colorName)) continue;
        const created = await this.colorImageRepo.save(
          this.colorImageRepo.create({ finishedStockId: keeperId, colorName, imageUrl }),
        );
        keeperByColor.set(colorName, created);
      }

      await this.colorImageRepo.delete({ finishedStockId: In(sourceIds) });
    } catch (e) {
      if (!this.isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
    }
  }

  private async consolidateDuplicateFinishedStocks(
    seed: FinishedGoodsStock,
    operatorUsername: string,
    remark: string,
  ): Promise<FinishedGoodsStock> {
    const stocks = await this.findDuplicateStocksForMergeKey(seed);
    if (stocks.length <= 1) {
      const normalized = this.parseStoredColorSizeSnapshot(seed.colorSizeSnapshot);
      if (normalized && JSON.stringify(normalized) !== JSON.stringify(seed.colorSizeSnapshot)) {
        seed.colorSizeSnapshot = normalized;
        return this.stockRepo.save(seed);
      }
      return seed;
    }

    const keeper = stocks.find((stock) => stock.id === seed.id) ?? stocks[0];
    const sourceStocks = stocks.filter((stock) => stock.id !== keeper.id);
    const before = this.stockAdjustSnapshot(keeper);
    const snapshots: ColorSizeSnapshot[] = [];

    for (const stock of stocks) {
      const qty = Math.max(0, Math.trunc(Number(stock.quantity) || 0));
      const snapshot = await this.buildCurrentStockSnapshot(stock);
      if (!snapshot && qty > 0) return keeper;
      if (!snapshot) continue;
      if (this.getColorSizeSnapshotTotal(snapshot) !== qty) return keeper;
      snapshots.push(snapshot);
    }

    const totalQty = stocks.reduce((sum, stock) => sum + Math.max(0, Math.trunc(Number(stock.quantity) || 0)), 0);
    const weightedAmount = stocks.reduce((sum, stock) => {
      const qty = Math.max(0, Math.trunc(Number(stock.quantity) || 0));
      const price = Number(stock.unitPrice);
      return sum + qty * (Number.isFinite(price) ? price : 0);
    }, 0);
    const mergedSnapshot = this.combineColorSizeSnapshots(snapshots);
    if (mergedSnapshot) this.assertColorSizeSnapshotTotal(mergedSnapshot, totalQty, '合并后的尺码明细与总数量不一致');

    keeper.quantity = totalQty;
    keeper.unitPrice = totalQty > 0 ? this.normalizeOrderUnitPrice(weightedAmount / totalQty) : this.normalizeOrderUnitPrice(keeper.unitPrice);
    keeper.location = String(keeper.location ?? '').trim() || String(sourceStocks.find((stock) => stock.location?.trim())?.location ?? '').trim();
    keeper.customerId = keeper.customerId ?? sourceStocks.find((stock) => stock.customerId != null)?.customerId ?? null;
    keeper.customerName = String(keeper.customerName ?? '').trim() || String(sourceStocks.find((stock) => stock.customerName?.trim())?.customerName ?? '').trim();
    keeper.imageUrl = String(keeper.imageUrl ?? '').trim() || String(sourceStocks.find((stock) => stock.imageUrl?.trim())?.imageUrl ?? '').trim();
    keeper.colorSizeSnapshot = mergedSnapshot;

    const saved = await this.stockRepo.save(keeper);
    const sourceIds = sourceStocks.map((stock) => stock.id);
    await this.mergeColorImagesIntoKeeper(saved.id, sourceIds);
    try {
      await this.adjustLogRepo.update({ finishedStockId: In(sourceIds) }, { finishedStockId: saved.id });
    } catch (e) {
      if (!this.isTableMissingError(e, 'finished_goods_stock_adjust_logs')) throw e;
    }
    await this.stockRepo.remove(sourceStocks);
    await this.appendFinishedStockAdjustLog(saved.id, operatorUsername, before, this.stockAdjustSnapshot(saved), remark);
    return saved;
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

  async createManual(
    dto: {
      orderNo?: string;
      skuCode: string;
      quantity: number;
      unitPrice?: string | number;
      warehouseId?: number | null;
      inventoryTypeId?: number | null;
      department: string;
      location: string;
      imageUrl?: string;
      colorSize?: unknown;
    },
    operatorUsername = '',
  ): Promise<FinishedGoodsStock> {
    const orderNo = dto.orderNo?.trim();
    const { snapshot, imageRows } = this.parseColorSizeInput(dto.colorSize);
    const q = Number(dto.quantity);
    if (!Number.isInteger(q) || q <= 0) {
      throw new NotFoundException('数量必须为正整数');
    }
    if (snapshot) {
      this.assertColorSizeSnapshotTotal(snapshot, q, '新增库存的尺码明细合计必须等于新增数量');
    }
    let orderId: number | null = null;
    let customerId: number | null = null;
    let customerName = '';
    let orderExFactoryPrice: string | number | null = null;
    let linkedOrder: Order | null = null;
    if (orderNo) {
      linkedOrder = await this.orderRepo.findOne({ where: { orderNo } });
      if (!linkedOrder) {
        throw new NotFoundException('订单不存在');
      }
    }

    if (linkedOrder) {
      const order = linkedOrder;
      orderId = order.id;
      customerId = order.customerId ?? null;
      customerName = order.customerName?.trim() ?? '';
      orderExFactoryPrice = order.exFactoryPrice ?? '0';
    }
    const unitPriceStr =
      dto.unitPrice != null && dto.unitPrice !== ''
        ? this.normalizeOrderUnitPrice(dto.unitPrice)
        : linkedOrder
          ? this.normalizeOrderUnitPrice(orderExFactoryPrice)
          : this.normalizeOrderUnitPrice('0');
    const warehouseId = dto.warehouseId != null ? Number(dto.warehouseId) : null;
    const inventoryTypeId = dto.inventoryTypeId != null ? Number(dto.inventoryTypeId) : null;
    const department = dto.department?.trim() ?? '';
    const location = dto.location?.trim() ?? '';
    const imageUrl = dto.imageUrl?.trim() ?? '';
    const skuCode = dto.skuCode?.trim() ?? '';

    const existing = await this.findMergeableFinishedStock({
      skuCode,
      orderId,
      warehouseId,
      inventoryTypeId,
      department,
    });
    if (existing) {
      const before = this.stockAdjustSnapshot(existing);
      const oldQty = Math.max(0, Math.trunc(Number(existing.quantity) || 0));
      const newQty = q;
      const totalQty = oldQty + newQty;
      const currentSnapshot = snapshot ? await this.buildCurrentStockSnapshot(existing) : null;
      if (snapshot) {
        if (!currentSnapshot && oldQty > 0) {
          throw new BadRequestException('无法读取现有库存的完整尺码明细，请先在库存详情中修正后再新增库存');
        }
        this.assertColorSizeSnapshotTotal(currentSnapshot, oldQty, '现有库存尺码明细与总数量不一致，请先修正后再新增库存');
      }
      const oldP = Number(existing.unitPrice);
      const newP = Number(unitPriceStr);
      const safeOldP = Number.isFinite(oldP) ? oldP : 0;
      const safeNewP = Number.isFinite(newP) ? newP : 0;
      const mergedUnit =
        totalQty > 0 ? this.normalizeOrderUnitPrice((safeOldP * oldQty + safeNewP * newQty) / totalQty) : unitPriceStr;
      existing.quantity = totalQty;
      existing.unitPrice = mergedUnit;
      if (location) existing.location = location;
      if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
      if (snapshot) {
        const mergedSnapshot = this.mergeColorSizeSnapshots(currentSnapshot, snapshot);
        this.assertColorSizeSnapshotTotal(mergedSnapshot, totalQty, '合并后的尺码明细与总数量不一致');
        existing.colorSizeSnapshot = mergedSnapshot;
      }
      try {
        const saved = await this.stockRepo.save(existing);
        await this.persistColorImagesForStock(saved.id, imageRows);
        const after = this.stockAdjustSnapshot(saved);
        await this.appendFinishedStockAdjustLog(
          saved.id,
          operatorUsername,
          before,
          after,
          `合并入库 +${newQty} 件`,
        );
        return this.consolidateDuplicateFinishedStocks(saved, operatorUsername, '合并重复库存');
      } catch (e: any) {
        const msg = String(e?.message ?? '');
        if (this.isOrderIdNullSchemaError(msg)) {
          throw new BadRequestException(this.orderIdNullableMigrationHint());
        }
        throw e;
      }
    }

    const stock = this.stockRepo.create({
      orderId,
      skuCode,
      quantity: q,
      unitPrice: unitPriceStr,
      warehouseId,
      inventoryTypeId,
      department,
      location,
      customerId,
      customerName,
      imageUrl,
      colorSizeSnapshot: snapshot,
    });
    try {
      const saved = await this.stockRepo.save(stock);
      await this.persistColorImagesForStock(saved.id, imageRows);
      return this.consolidateDuplicateFinishedStocks(saved, operatorUsername, '合并重复库存');
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (this.isOrderIdNullSchemaError(msg)) {
        throw new BadRequestException(this.orderIdNullableMigrationHint());
      }
      throw e;
    }
  }

  async getList(params: {
    tab?: string;
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    inventoryTypeId?: number | null;
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
        ? this.sumStoredQuantitiesForList({
            orderNo,
            skuCode,
            customerName,
            inventoryTypeId,
            startDate,
            endDate,
          })
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
      if (orderNo?.trim()) {
        countQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      }
      if (skuCode?.trim()) {
        countQb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      }
      if (customerName?.trim()) {
        countQb.andWhere('o.customer_name LIKE :customerName', {
          customerName: `%${customerName.trim()}%`,
        });
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
      if (orderNo?.trim()) {
        pendingQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      }
      if (skuCode?.trim()) {
        pendingQb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      }
      if (customerName?.trim()) {
        pendingQb.andWhere('o.customer_name LIKE :customerName', {
          customerName: `%${customerName.trim()}%`,
        });
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
          'COALESCE(o.order_no, \'\') AS orderNo',
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
          'COALESCE(pr.image_url, \'\') AS productImageUrl',
          'COALESCE(s.image_url, \'\') AS imageUrl',
          's.created_at AS createdAt',
          's.color_size_snapshot AS colorSizeSnapshot',
        ]);
      if (orderNo?.trim()) {
        stockQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      }
      if (skuCode?.trim()) {
        stockQb.andWhere('s.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      }
      if (customerName?.trim()) {
        stockQb.andWhere('s.customer_name LIKE :customerName', {
          customerName: `%${customerName.trim()}%`,
        });
      }
      if (inventoryTypeId != null) {
        stockQb.andWhere('s.inventory_type_id = :inventoryTypeId', { inventoryTypeId });
      }
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
      list.sort((a, b) => {
        const da = a.createdAt || '';
        const db = b.createdAt || '';
        return db.localeCompare(da);
      });
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

  /** 出库：支持单条或同一客户多条库存批量出库 */
  async outbound(
    items: FinishedOutboundItemInput[],
    operatorUsername: string,
    remark: string,
    pickupUserId?: number | null,
  ): Promise<void> {
    const normalizedItems = Array.isArray(items)
      ? items
          .map((item) => ({
            id: Number(item?.id),
            quantity: Number(item?.quantity),
            sizeBreakdown: item?.sizeBreakdown ?? null,
          }))
          .filter((item) => Number.isInteger(item.id) && item.id > 0)
      : [];
    if (!normalizedItems.length) {
      throw new BadRequestException('请选择需要出库的库存记录');
    }
    const uniqueIds = Array.from(new Set(normalizedItems.map((item) => item.id)));
    if (uniqueIds.length !== normalizedItems.length) {
      throw new BadRequestException('同一条库存记录不能重复出库');
    }

    const stocks = await this.stockRepo.find({ where: { id: In(uniqueIds) } });
    if (stocks.length !== uniqueIds.length) {
      throw new NotFoundException('存在库存记录不存在或已失效');
    }
    const stockMap = new Map(stocks.map((stock) => [stock.id, stock]));
    for (const item of normalizedItems) {
      const stock = stockMap.get(item.id);
      if (!stock) throw new NotFoundException('库存记录不存在');
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException('出库数量必须为正整数');
      }
      if (item.quantity > stock.quantity) {
        throw new BadRequestException(`库存 ${stock.skuCode || stock.id} 的出库数量不能大于当前库存`);
      }
    }

    const customerNames = Array.from(
      new Set(
        stocks.map((stock) => (stock.customerName?.trim() || '__EMPTY__')),
      ),
    );
    if (customerNames.length > 1) {
      throw new BadRequestException('批量出库仅支持选择同一客户的记录');
    }

    const orderIds = Array.from(new Set(stocks.map((stock) => stock.orderId).filter((id): id is number => id != null)));
    const skuCodes = Array.from(new Set(stocks.map((stock) => stock.skuCode?.trim()).filter((code): code is string => !!code)));
    const [orders, products, pickupInfo, colorImageMaps] = await Promise.all([
      orderIds.length ? this.orderRepo.find({ where: { id: In(orderIds) } }) : Promise.resolve([]),
      skuCodes.length ? this.productRepo.find({ where: skuCodes.map((skuCode) => ({ skuCode })) }) : Promise.resolve([]),
      this.resolvePickupUser(pickupUserId),
      this.getColorImageMapsForStocks(uniqueIds),
    ]);
    const orderMap = new Map(orders.map((order) => [order.id, order]));
    const productMap = new Map(products.map((product) => [product.skuCode?.trim() ?? '', product]));

    try {
      await this.stockRepo.manager.transaction(async (manager) => {
        const txStockRepo = manager.getRepository(FinishedGoodsStock);

        for (const item of normalizedItems) {
          const txStock = await txStockRepo.findOne({ where: { id: item.id } });
          if (!txStock) throw new NotFoundException('库存记录不存在');
          if (item.quantity > txStock.quantity) {
            throw new BadRequestException(`库存 ${txStock.skuCode || txStock.id} 的出库数量不能大于当前库存`);
          }

          const currentSnapshot = this.parseStoredColorSizeSnapshot(txStock.colorSizeSnapshot);
          const outgoingSnapshot = this.parseStoredColorSizeSnapshot(item.sizeBreakdown);
          if (outgoingSnapshot) {
            this.assertColorSizeSnapshotTotal(outgoingSnapshot, item.quantity, '出库尺码明细合计必须等于出库数量');
          }
          if (currentSnapshot && !outgoingSnapshot) {
            throw new BadRequestException(`库存 ${txStock.skuCode || txStock.id} 需要按颜色尺码明细出库`);
          }
          if (currentSnapshot && outgoingSnapshot) {
            this.assertColorSizeSnapshotTotal(currentSnapshot, txStock.quantity, '当前库存尺码明细与总数量不一致，请先修正后再出库');
            txStock.colorSizeSnapshot = this.subtractColorSizeSnapshots(currentSnapshot, outgoingSnapshot);
          }
          txStock.quantity -= item.quantity;
          if (txStock.quantity === 0) {
            await txStockRepo.remove(txStock);
          } else {
            await txStockRepo.save(txStock);
          }

          const stock = stockMap.get(item.id) ?? txStock;
          const order = stock.orderId != null ? orderMap.get(stock.orderId) ?? null : null;
          const product = productMap.get(stock.skuCode?.trim() ?? '') ?? null;
          const colorImageUrl = this.pickColorImageForSnapshot(outgoingSnapshot, colorImageMaps.get(item.id));
          await this.insertFinishedGoodsOutboundRecord(manager, {
            finishedStockId: item.id,
            orderId: stock.orderId,
            orderNo: order?.orderNo ?? '',
            skuCode: stock.skuCode ?? '',
            imageUrl: stock.imageUrl?.trim() || colorImageUrl || product?.imageUrl?.trim() || '',
            customerName: stock.customerName ?? '',
            quantity: item.quantity,
            department: stock.department?.trim() ?? '',
            warehouseId: stock.warehouseId ?? null,
            inventoryTypeId: stock.inventoryTypeId ?? null,
            pickupUserId: pickupInfo.pickupId,
            pickupUserName: pickupInfo.pickupUserName,
            sizeBreakdown: item.sizeBreakdown ?? null,
            operatorUsername: (operatorUsername ?? '').trim(),
            remark: (remark ?? '').trim(),
          });
        }
      });
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes("Table") && msg.includes("finished_goods_outbound") && msg.includes("doesn't exist")) {
        throw new InternalServerErrorException(
          "出库记录表不存在，请先执行 backend/scripts/create-finished-goods-outbound.sql",
        );
      }
      throw e;
    }
  }

  async getOutboundRecords(params: {
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    list: Array<
      Omit<FinishedGoodsOutbound, 'createdAt'> & {
        createdAt: string;
        imageUrl?: string;
      }
    >;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { orderNo, skuCode, customerName, startDate, endDate, page = 1, pageSize = 20 } = params;
    const buildQb = (withSnapshotImage: boolean) => {
      const qb = this.outboundRepo
        .createQueryBuilder('o')
        // 兼容历史表排序规则不一致，避免 Illegal mix of collations
        .leftJoin(Product, 'p', 'p.sku_code COLLATE utf8mb4_general_ci = o.sku_code COLLATE utf8mb4_general_ci')
        .select([
          'o.id AS id',
          'o.finished_stock_id AS finishedStockId',
          'o.order_id AS orderId',
          'o.order_no AS orderNo',
          'o.sku_code AS skuCode',
          ...(withSnapshotImage ? ['o.image_url AS imageUrlSnapshot'] : []),
          'o.customer_name AS customerName',
          'o.quantity AS quantity',
          'o.department AS department',
          'o.warehouse_id AS warehouseId',
          'o.inventory_type_id AS inventoryTypeId',
          'o.pickup_user_id AS pickupUserId',
          'o.pickup_user_name AS pickupUserName',
          'o.size_breakdown AS sizeBreakdown',
          'o.operator_username AS operatorUsername',
          'o.remark AS remark',
          'o.created_at AS createdAt',
          withSnapshotImage
            ? "COALESCE(NULLIF(o.image_url, ''), p.image_url, '') AS imageUrl"
            : "COALESCE(p.image_url, '') AS imageUrl",
        ]);
      if (orderNo?.trim()) qb.andWhere('o.order_no COLLATE utf8mb4_general_ci LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      if (skuCode?.trim()) qb.andWhere('o.sku_code COLLATE utf8mb4_general_ci LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      if (customerName?.trim()) {
        qb.andWhere('o.customer_name COLLATE utf8mb4_general_ci LIKE :customerName', { customerName: `%${customerName.trim()}%` });
      }
      if (startDate?.trim()) qb.andWhere('o.created_at >= :start', { start: `${startDate.trim()} 00:00:00` });
      if (endDate?.trim()) qb.andWhere('o.created_at <= :end', { end: `${endDate.trim()} 23:59:59` });
      qb.orderBy('o.created_at', 'DESC');
      return qb;
    };
    let total = 0;
    let list: any[] = [];
    try {
      const qb = buildQb(true);
      total = await qb.getCount();
      list = await qb
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getRawMany<any>();
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!(msg.includes("Unknown column") && msg.includes('o.image_url'))) throw e;
      const qb = buildQb(false);
      total = await qb.getCount();
      list = await qb
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getRawMany<any>();
    }
    const rows = list.map((r: any) => ({
      id: Number(r.id),
      finishedStockId: Number(r.finishedStockId),
      orderId: r.orderId != null ? Number(r.orderId) : null,
      orderNo: r.orderNo ?? '',
      skuCode: r.skuCode ?? '',
      imageUrl: String(r.imageUrlSnapshot ?? '').trim(),
      productImageUrl: String(r.imageUrl ?? '').trim(),
      customerName: r.customerName ?? '',
      quantity: Number(r.quantity) || 0,
      department: r.department ?? '',
      warehouseId: r.warehouseId != null ? Number(r.warehouseId) : null,
      inventoryTypeId: r.inventoryTypeId != null ? Number(r.inventoryTypeId) : null,
      pickupUserId: r.pickupUserId != null ? Number(r.pickupUserId) : null,
      pickupUserName: r.pickupUserName ?? '',
      sizeBreakdown: r.sizeBreakdown ?? null,
      operatorUsername: r.operatorUsername ?? '',
      remark: r.remark ?? '',
      createdAt: this.formatDateTimeForResponse(r.createdAt),
    }));
    const rowsMissingImage = rows.filter((row) => !String(row.imageUrl ?? '').trim());
    if (rowsMissingImage.length) {
      const colorImageMaps = await this.getColorImageMapsForStocks(rowsMissingImage.map((row) => row.finishedStockId));
      rowsMissingImage.forEach((row) => {
        row.imageUrl = this.pickColorImageForSnapshot(
          this.parseStoredColorSizeSnapshot(row.sizeBreakdown),
          colorImageMaps.get(row.finishedStockId),
        ) || row.productImageUrl || '';
      });
    }
    rows.forEach((row) => {
      if (!String(row.imageUrl ?? '').trim()) row.imageUrl = row.productImageUrl || '';
      delete (row as any).productImageUrl;
    });
    return { list: rows, total, page, pageSize };
  }

  async getDetail(id: number): Promise<{
    stock: FinishedGoodsStock;
    orderNo: string;
    productImageUrl: string;
    colorImages: Array<{ colorName: string; imageUrl: string; updatedAt: string }>;
    adjustLogs: Array<{ id: number; operatorUsername: string; before: any; after: any; remark: string; createdAt: string }>;
    colorSize: { headers: string[]; colors: string[]; rows: Array<{ colorName: string; quantities: number[] }> };
    groupSizeHeaders: string[];
  }> {
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
      headers = Array.isArray(ext?.colorSizeHeaders) ? ext!.colorSizeHeaders! : [];
      const rows = Array.isArray(ext?.colorSizeRows) ? ext!.colorSizeRows! : [];
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

  async updateMeta(
    id: number,
    dto: {
      department?: string;
      inventoryTypeId?: number | null;
      warehouseId?: number | null;
      location?: string;
      unitPrice?: string | number;
      imageUrl?: string;
      remark?: string;
    },
    operatorUsername: string,
  ): Promise<FinishedGoodsStock> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) throw new NotFoundException('库存记录不存在');

    const before = {
      department: stock.department ?? '',
      inventoryTypeId: stock.inventoryTypeId ?? null,
      warehouseId: stock.warehouseId ?? null,
      location: stock.location ?? '',
      unitPrice: stock.unitPrice != null ? String(stock.unitPrice) : '0',
      imageUrl: stock.imageUrl ?? '',
    };

    if (dto.department !== undefined) stock.department = (dto.department ?? '').trim();
    if (dto.inventoryTypeId !== undefined) stock.inventoryTypeId = dto.inventoryTypeId != null ? Number(dto.inventoryTypeId) : null;
    if (dto.warehouseId !== undefined) stock.warehouseId = dto.warehouseId != null ? Number(dto.warehouseId) : null;
    if (dto.location !== undefined) stock.location = (dto.location ?? '').trim();
    if (dto.unitPrice !== undefined) stock.unitPrice = this.normalizeOrderUnitPrice(dto.unitPrice);
    if (dto.imageUrl !== undefined) stock.imageUrl = (dto.imageUrl ?? '').trim();

    const saved = await this.stockRepo.save(stock);

    const after = {
      department: saved.department ?? '',
      inventoryTypeId: saved.inventoryTypeId ?? null,
      warehouseId: saved.warehouseId ?? null,
      location: saved.location ?? '',
      unitPrice: saved.unitPrice != null ? String(saved.unitPrice) : '0',
      imageUrl: saved.imageUrl ?? '',
    };

    const changed =
      before.department !== after.department ||
      before.inventoryTypeId !== after.inventoryTypeId ||
      before.warehouseId !== after.warehouseId ||
      before.location !== after.location ||
      before.unitPrice !== after.unitPrice ||
      before.imageUrl !== after.imageUrl;

    if (changed) {
      try {
        await this.adjustLogRepo.save(
          this.adjustLogRepo.create({
            finishedStockId: id,
            operatorUsername: (operatorUsername ?? '').trim(),
            before,
            after,
            remark: (dto.remark ?? '').trim(),
          }),
        );
      } catch (e) {
        if (!this.isTableMissingError(e, 'finished_goods_stock_adjust_logs')) throw e;
      }
    }

    return this.consolidateDuplicateFinishedStocks(saved, operatorUsername, '合并重复库存');
  }

  async upsertColorImage(
    id: number,
    dto: { colorName: string; imageUrl: string },
    operatorUsername = '',
  ): Promise<void> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) throw new NotFoundException('库存记录不存在');
    const colorName = (dto.colorName ?? '').trim();
    if (!colorName) throw new NotFoundException('颜色不能为空');
    const imageUrl = (dto.imageUrl ?? '').trim();

    try {
      const existing = await this.colorImageRepo.findOne({ where: { finishedStockId: id, colorName } });
      if (!imageUrl) {
        if (existing) {
          await this.colorImageRepo.remove(existing);
        }
        await this.consolidateDuplicateFinishedStocks(stock, operatorUsername, '合并重复库存');
        return;
      }
      if (existing) {
        existing.imageUrl = imageUrl;
        await this.colorImageRepo.save(existing);
        await this.consolidateDuplicateFinishedStocks(stock, operatorUsername, '合并重复库存');
        return;
      }
      await this.colorImageRepo.save(this.colorImageRepo.create({ finishedStockId: id, colorName, imageUrl }));
      await this.consolidateDuplicateFinishedStocks(stock, operatorUsername, '合并重复库存');
    } catch (e) {
      if (this.isTableMissingError(e, 'finished_goods_stock_color_images')) {
        throw new InternalServerErrorException(
          '库存详情图片表不存在，请先执行 backend/scripts/create-finished-goods-stock-detail-tables.sql',
        );
      }
      throw e;
    }
  }

  /** 出库「领取人」下拉：仅业务员角色的在职账号 */
  async getPickupUserOptions(): Promise<Array<{ id: number; username: string; displayName: string }>> {
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
