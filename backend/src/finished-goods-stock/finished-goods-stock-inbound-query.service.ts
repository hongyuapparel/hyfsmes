import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { Order } from '../entities/order.entity';
import type { ColorSizeSnapshot } from './finished-goods-stock.types';
import { getSizeHeaderKey, normalizeSizeHeader, remapQuantitiesBySizeHeaders, sortSizeHeaders } from './size-header-order.util';

@Injectable()
export class FinishedGoodsStockInboundQueryService {
  constructor(
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
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

  async orderRequiresColorSizeDetail(
    orderId: number | null,
    manager: EntityManager = this.stockRepo.manager,
  ): Promise<boolean> {
    if (orderId == null) return false;
    const rows = (await manager.query(
      'SELECT color_size_headers AS headers FROM order_ext WHERE order_id = ? LIMIT 1',
      [orderId],
    )) as Array<{ headers?: unknown }>;
    let headers = rows[0]?.headers;
    if (typeof headers === 'string') {
      try {
        headers = JSON.parse(headers) as unknown;
      } catch {
        headers = null;
      }
    }
    return Array.isArray(headers) && headers.some((header) => String(header ?? '').trim());
  }

  async findMergeableFinishedStock(params: {
    skuCode: string;
    customerId: number | null;
    customerName: string;
    warehouseId: number | null;
    inventoryTypeId: number | null;
    department: string;
  }): Promise<FinishedGoodsStock | null> {
    const sku = params.skuCode.trim();
    const dep = params.department.trim();
    if (!sku) return null;
    const qb = this.stockRepo
      .createQueryBuilder('s')
      .addSelect('s.color_size_snapshot')
      .where('s.skuCode = :sku', { sku })
      .andWhere('s.department = :dep', { dep });
    if (params.customerId != null) qb.andWhere('s.customerId = :customerId', { customerId: params.customerId });
    else qb.andWhere('s.customerId IS NULL').andWhere('s.customerName = :customerName', { customerName: params.customerName.trim() });
    if (params.warehouseId != null) qb.andWhere('s.warehouseId = :wid', { wid: params.warehouseId });
    else qb.andWhere('s.warehouseId IS NULL');
    if (params.inventoryTypeId != null) qb.andWhere('s.inventoryTypeId = :iid', { iid: params.inventoryTypeId });
    else qb.andWhere('s.inventoryTypeId IS NULL');
    qb.orderBy('s.id', 'DESC');
    return (await qb.getOne()) ?? null;
  }

  stockAdjustSnapshot(stock: FinishedGoodsStock): Record<string, unknown> {
    return {
      skuCode: stock.skuCode ?? '',
      customerName: stock.customerName ?? '',
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
    const safeQuantity = Math.max(0, Math.trunc(Number(stock.quantity) || 0));
    if (snapshot && this.getColorSizeSnapshotTotal(snapshot) === safeQuantity) return snapshot;
    // 缺失或合计不一致都视为数据质量问题；读取时不得从其他工序或订单计划推算。
    return null;
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
      .addSelect('s.color_size_snapshot')
      .where('s.skuCode = :sku', { sku })
      .andWhere('s.department = :dep', { dep });
    if (seed.customerId != null) qb.andWhere('s.customerId = :customerId', { customerId: seed.customerId });
    else qb.andWhere('s.customerId IS NULL').andWhere('s.customerName = :customerName', { customerName: String(seed.customerName ?? '').trim() });
    if (seed.warehouseId != null) qb.andWhere('s.warehouseId = :wid', { wid: seed.warehouseId });
    else qb.andWhere('s.warehouseId IS NULL');
    if (seed.inventoryTypeId != null) qb.andWhere('s.inventoryTypeId = :iid', { iid: seed.inventoryTypeId });
    else qb.andWhere('s.inventoryTypeId IS NULL');
    qb.orderBy('s.id', 'ASC');
    return qb.getMany();
  }
}
