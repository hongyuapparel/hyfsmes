import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderCutting } from '../entities/order-cutting.entity';
import type { ColorSizeSnapshot } from './finished-goods-stock.types';
import { getSizeHeaderKey, normalizeSizeHeader, remapQuantitiesBySizeHeaders, sortSizeHeaders } from './size-header-order.util';

@Injectable()
export class FinishedGoodsStockInboundQueryService {
  constructor(
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(OrderCutting)
    private readonly orderCuttingRepo: Repository<OrderCutting>,
  ) {}

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
      const normalized = normalizeSizeHeader(header);
      if (!normalized || normalized === '__UNASSIGNED__') return;
      let targetIndex = headers.findIndex((item) => getSizeHeaderKey(item) === getSizeHeaderKey(normalized));
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
    const sortedHeaders = sortSizeHeaders(headers);
    const rows = orderedColors
      .map((colorName) => ({ colorName, quantities: [...(rowMap.get(colorName) ?? [])] }))
      .filter((row) => this.snapshotRowTotal(row) > 0);
    if (!rows.length) return null;
    return {
      headers: sortedHeaders,
      rows: rows.map((row) => ({
        colorName: row.colorName,
        quantities: remapQuantitiesBySizeHeaders(headers, row.quantities, sortedHeaders),
      })),
    };
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
      return { colorName: String(row.colorName ?? '').trim(), quantities };
    });
  }

  parseColorSizeInput(raw: unknown): {
    snapshot: { headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> } | null;
    imageRows: Array<{ colorName: string; imageUrl: string }>;
  } {
    if (!raw || typeof raw !== 'object') return { snapshot: null, imageRows: [] };
    const o = raw as Record<string, unknown>;
    const headersRaw = Array.isArray(o.headers) ? (o.headers as unknown[]) : [];
    const headers = headersRaw.map(normalizeSizeHeader).filter((h) => h.length > 0);
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

  parseStoredColorSizeSnapshot(raw: unknown): ColorSizeSnapshot | null {
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
    const headers = headersRaw.map(normalizeSizeHeader).filter((h) => h.length > 0);
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

  cloneColorSizeSnapshot(snapshot: ColorSizeSnapshot | null): ColorSizeSnapshot | null {
    if (!snapshot) return null;
    return {
      headers: [...snapshot.headers],
      rows: snapshot.rows.map((row) => ({ colorName: row.colorName, quantities: [...row.quantities] })),
    };
  }

  getColorSizeSnapshotTotal(snapshot: ColorSizeSnapshot | null): number {
    if (!snapshot) return 0;
    return snapshot.rows.reduce(
      (sum, row) =>
        sum +
        row.quantities.reduce((rowSum, quantity) => rowSum + Math.max(0, Math.trunc(Number(quantity) || 0)), 0),
      0,
    );
  }

  assertColorSizeSnapshotTotal(snapshot: ColorSizeSnapshot | null, expectedQty: number, message: string): void {
    if (!snapshot) return;
    const safeExpectedQty = Math.max(0, Math.trunc(Number(expectedQty) || 0));
    const actual = this.getColorSizeSnapshotTotal(snapshot);
    if (actual !== safeExpectedQty) {
      throw new BadRequestException(`${message}（尺码合计 ${actual}，总数量 ${safeExpectedQty}）`);
    }
  }

  async findOrderByOrderNo(orderNo: string): Promise<Order | null> {
    return this.orderRepo.findOne({ where: { orderNo } });
  }

  /**
   * 根据订单生成颜色尺码快照（用于 createManual 缺 colorSize 时的兜底）。
   *
   * 来源优先级：
   * 1) **裁床实际数量** OrderCutting.actualCutRows（真实生产数据，与实际入库尺码一致）
   * 2) **订单计划数量** OrderExt.colorSizeRows（订单原始下单尺码）
   *
   * 历史 bug：原实现仅读取 OrderExt（计划），导致裁床数量 ≠ 计划数量时
   * 入库的尺码明细按计划比例分配，与实际入库尺码不符。例如：
   * - 订单计划 XXL=25，裁床实际 XXL=55，尾部入库 247 件
   * - 旧逻辑按 1:2:3:2:1 计划比例 → XXL = 247×25/225 ≈ 27（错误）
   * - 新逻辑按裁床 27:55:55:55:55 比例 → XXL = 247×55/247 = 55（正确）
   */
  async buildOrderColorSizeSnapshot(orderId: number | null, quantity: number): Promise<ColorSizeSnapshot | null> {
    if (orderId == null) return null;

    // 1) 优先：裁床实际数量
    const cutting = await this.orderCuttingRepo.findOne({ where: { orderId } });
    const cuttingRows = Array.isArray(cutting?.actualCutRows) ? cutting!.actualCutRows : [];
    if (cuttingRows.length) {
      // 裁床的 headers 复用订单 OrderExt 的 headers（同一订单同一表头体系）
      const ext = await this.orderExtRepo.findOne({ where: { orderId } });
      const headers = Array.isArray(ext?.colorSizeHeaders)
        ? ext!.colorSizeHeaders.map(normalizeSizeHeader).filter((header) => header.length > 0)
        : [];
      // 检查裁床数据是否有非零项；全 0 / 缺失视为未登记
      const hasCuttingQty = cuttingRows.some((row) =>
        Array.isArray(row?.quantities) &&
        row.quantities.some((q) => Math.max(0, Math.trunc(Number(q) || 0)) > 0),
      );
      if (headers.length && hasCuttingQty) {
        return {
          headers,
          rows: this.scaleColorSizeRowsToQuantity(
            headers,
            cuttingRows.map((row) => ({
              colorName: row?.colorName,
              quantities: Array.isArray(row?.quantities) ? row.quantities : [],
            })),
            quantity,
          ),
        };
      }
    }

    // 2) 兜底：订单计划数量（保持向后兼容）
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const headers = Array.isArray(ext?.colorSizeHeaders)
      ? ext.colorSizeHeaders.map(normalizeSizeHeader).filter((header) => header.length > 0)
      : [];
    const baseRows = Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : [];
    if (!headers.length || !baseRows.length) return null;
    return {
      headers,
      rows: this.scaleColorSizeRowsToQuantity(
        headers,
        baseRows.map((row: { colorName?: string; quantities?: number[] }) => ({
          colorName: row?.colorName,
          quantities: Array.isArray(row?.quantities) ? row.quantities : [],
        })),
        quantity,
      ),
    };
  }

  async findMergeableFinishedStock(params: {
    skuCode: string;
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
    if (params.warehouseId != null) qb.andWhere('s.warehouseId = :wid', { wid: params.warehouseId });
    else qb.andWhere('s.warehouseId IS NULL');
    if (params.inventoryTypeId != null) qb.andWhere('s.inventoryTypeId = :iid', { iid: params.inventoryTypeId });
    else qb.andWhere('s.inventoryTypeId IS NULL');
    qb.orderBy('s.id', 'DESC');
    return (await qb.getOne()) ?? null;
  }

  stockAdjustSnapshot(stock: FinishedGoodsStock): Record<string, unknown> {
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

  async buildCurrentStockSnapshot(stock: FinishedGoodsStock): Promise<ColorSizeSnapshot | null> {
    const snapshot = this.parseStoredColorSizeSnapshot(stock.colorSizeSnapshot);
    if (snapshot) return snapshot;
    if (stock.orderId == null) return null;
    const ext = await this.orderExtRepo.findOne({ where: { orderId: stock.orderId } });
    const headers = Array.isArray(ext?.colorSizeHeaders)
      ? ext.colorSizeHeaders.map(normalizeSizeHeader).filter((header) => header.length > 0)
      : [];
    const baseRows = Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : [];
    if (!headers.length || !baseRows.length) return null;
    return {
      headers,
      rows: this.scaleColorSizeRowsToQuantity(
        headers,
        baseRows.map((row: { colorName?: string; quantities?: number[] }) => ({
          colorName: row?.colorName,
          quantities: Array.isArray(row?.quantities) ? row.quantities : [],
        })),
        stock.quantity,
      ),
    };
  }

  mergeColorSizeSnapshots(currentRaw: unknown, incoming: ColorSizeSnapshot | null): ColorSizeSnapshot | null {
    if (!incoming) return this.parseStoredColorSizeSnapshot(currentRaw);
    const current = this.parseStoredColorSizeSnapshot(currentRaw);
    if (!current) return this.normalizeColorSizeSnapshot(this.cloneColorSizeSnapshot(incoming));
    const headers = sortSizeHeaders(incoming.headers);
    current.headers.forEach((header) => {
      if (!headers.some((item) => getSizeHeaderKey(item) === getSizeHeaderKey(header))) headers.push(header);
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
    incoming.rows.forEach((row) => ensureRow(String(row.colorName ?? '').trim()));
    current.rows.forEach((row) => ensureRow(String(row.colorName ?? '').trim()));
    const applySnapshot = (snapshot: ColorSizeSnapshot, mode: 'set' | 'add') => {
      const headerIndex = new Map(snapshot.headers.map((header, index) => [getSizeHeaderKey(header), index]));
      snapshot.rows.forEach((item) => {
        const row = ensureRow(item.colorName);
        headers.forEach((header, index) => {
          const sourceIndex = headerIndex.get(getSizeHeaderKey(header));
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
      rows: rowOrder.map((key) => ({
        colorName: rowMap.get(key)!.colorName,
        quantities: [...rowMap.get(key)!.quantities],
      })),
    });
  }

  combineColorSizeSnapshots(snapshots: ColorSizeSnapshot[]): ColorSizeSnapshot | null {
    const normalized = snapshots
      .map((snapshot) => this.normalizeColorSizeSnapshot(snapshot))
      .filter((snapshot): snapshot is ColorSizeSnapshot => !!snapshot);
    if (!normalized.length) return null;
    const headers: string[] = [];
    [...normalized].sort((a, b) => b.headers.length - a.headers.length).forEach((snapshot) => {
      snapshot.headers.forEach((header) => {
          if (!headers.some((item) => getSizeHeaderKey(item) === getSizeHeaderKey(header))) headers.push(header);
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
      const sourceHeaderIndex = new Map(snapshot.headers.map((header, index) => [getSizeHeaderKey(header), index]));
      snapshot.rows.forEach((row) => {
        const quantities = ensureRow(row.colorName);
        headers.forEach((header, targetIndex) => {
          const sourceIndex = sourceHeaderIndex.get(getSizeHeaderKey(header));
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

  async findDuplicateStocksForMergeKey(seed: FinishedGoodsStock): Promise<FinishedGoodsStock[]> {
    const sku = String(seed.skuCode ?? '').trim();
    const dep = String(seed.department ?? '').trim();
    if (!sku) return [seed];
    const qb = this.stockRepo
      .createQueryBuilder('s')
      .where('s.skuCode = :sku', { sku })
      .andWhere('s.department = :dep', { dep });
    if (seed.warehouseId != null) qb.andWhere('s.warehouseId = :wid', { wid: seed.warehouseId });
    else qb.andWhere('s.warehouseId IS NULL');
    if (seed.inventoryTypeId != null) qb.andWhere('s.inventoryTypeId = :iid', { iid: seed.inventoryTypeId });
    else qb.andWhere('s.inventoryTypeId IS NULL');
    qb.orderBy('s.id', 'ASC');
    return qb.getMany();
  }
}
