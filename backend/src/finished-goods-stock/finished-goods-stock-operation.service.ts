import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { FinishedGoodsOutbound } from '../entities/finished-goods-outbound.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import { FinishedGoodsStockAdjustLog } from '../entities/finished-goods-stock-adjust-log.entity';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { Product } from '../entities/product.entity';
import { User, UserStatus } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import type { ColorSizeSnapshot, FinishedOutboundItemInput } from './finished-goods-stock.types';

@Injectable()
export class FinishedGoodsStockOperationService {
  constructor(
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(FinishedGoodsOutbound)
    private readonly outboundRepo: Repository<FinishedGoodsOutbound>,
    @InjectRepository(FinishedGoodsStockColorImage)
    private readonly colorImageRepo: Repository<FinishedGoodsStockColorImage>,
    @InjectRepository(FinishedGoodsStockAdjustLog)
    private readonly adjustLogRepo: Repository<FinishedGoodsStockAdjustLog>,
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

  private isTableMissingError(e: unknown, tableName: string): boolean {
    const msg = String((e as any)?.message || '');
    return msg.includes('Table') && msg.includes(tableName) && msg.includes("doesn't exist");
  }

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
    return '数据库表 finished_goods_stock 的 order_id 不允许为空，无法在「不填订单号」时保存。请在库中执行 backend/scripts/allow-finished-goods-stock-null-order-id.sql（执行前备份），将 order_id 改为可 NULL 后再试。';
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

  private cloneColorSizeSnapshot(snapshot: ColorSizeSnapshot | null): ColorSizeSnapshot | null {
    if (!snapshot) return null;
    return {
      headers: [...snapshot.headers],
      rows: snapshot.rows.map((row) => ({
        colorName: row.colorName,
        quantities: [...row.quantities],
      })),
    };
  }

  private getColorSizeSnapshotTotal(snapshot: ColorSizeSnapshot | null): number {
    if (!snapshot) return 0;
    return snapshot.rows.reduce(
      (sum, row) =>
        sum + row.quantities.reduce((rowSum, quantity) => rowSum + Math.max(0, Math.trunc(Number(quantity) || 0)), 0),
      0,
    );
  }

  private assertColorSizeSnapshotTotal(snapshot: ColorSizeSnapshot | null, expectedQty: number, message: string): void {
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
        baseRows.map((row: any) => ({ colorName: row?.colorName, quantities: Array.isArray(row?.quantities) ? row.quantities : [] })),
        stock.quantity,
      ),
    };
  }

  private mergeColorSizeSnapshots(currentRaw: unknown, incoming: ColorSizeSnapshot | null): ColorSizeSnapshot | null {
    if (!incoming) return this.parseStoredColorSizeSnapshot(currentRaw);
    const current = this.parseStoredColorSizeSnapshot(currentRaw);
    if (!current) return this.normalizeColorSizeSnapshot(this.cloneColorSizeSnapshot(incoming));
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
    incoming.rows.forEach((row) => ensureRow(String(row.colorName ?? '').trim()));
    current.rows.forEach((row) => ensureRow(String(row.colorName ?? '').trim()));
    const applySnapshot = (snapshot: ColorSizeSnapshot, mode: 'set' | 'add') => {
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
      rows: rowOrder.map((key) => ({ colorName: rowMap.get(key)!.colorName, quantities: [...rowMap.get(key)!.quantities] })),
    });
  }

  private subtractColorSizeSnapshots(currentRaw: unknown, outgoing: ColorSizeSnapshot | null): ColorSizeSnapshot | null {
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
      if (!targetRow) throw new BadRequestException(`颜色「${colorName || '-'}」库存明细不足，无法出库`);
      outgoing.headers.forEach((header, outIndex) => {
        const qty = Math.max(0, Math.trunc(Number(outRow.quantities?.[outIndex]) || 0));
        if (qty <= 0) return;
        const targetIndex = headerIndex.get(header);
        if (targetIndex == null) throw new BadRequestException(`尺码「${header}」库存明细不足，无法出库`);
        const remain = Math.max(0, Math.trunc(Number(targetRow.quantities[targetIndex]) || 0));
        if (remain < qty) throw new BadRequestException(`颜色「${colorName || '-'}」尺码「${header}」库存不足`);
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
    return this.normalizeColorSizeSnapshot({ headers, rows: activeRows });
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

  private pickColorImageForSnapshot(snapshot: { rows: Array<{ colorName: string }> } | null, colorImages: Map<string, string> | undefined): string {
    if (!colorImages?.size) return '';
    const colorNames = snapshot?.rows.map((row) => String(row.colorName ?? '').trim()).filter(Boolean) ?? [];
    for (const colorName of colorNames) {
      const imageUrl = colorImages.get(colorName);
      if (imageUrl) return imageUrl;
    }
    return Array.from(colorImages.values()).find((imageUrl) => !!imageUrl) ?? '';
  }

  private async persistColorImagesForStock(stockId: number, imageRows: Array<{ colorName: string; imageUrl: string }>): Promise<void> {
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
    if (pickupUserId == null) return { pickupId: null, pickupUserName: '' };
    const salespersonRole = await this.roleRepo.findOne({ where: { code: 'salesperson' } });
    if (!salespersonRole) throw new NotFoundException('未配置业务员角色');
    const pickupUser = await this.userRepo.findOne({
      where: { id: Number(pickupUserId), status: UserStatus.ACTIVE },
      select: ['id', 'username', 'displayName', 'roleId', 'status'],
    });
    if (!pickupUser) throw new NotFoundException('领取人不存在或不是在职业务员');
    const link = await this.userRoleRepo.findOne({ where: { userId: pickupUser.id, roleId: salespersonRole.id } });
    if (!(pickupUser.roleId === salespersonRole.id || !!link)) throw new NotFoundException('领取人不存在或不是在职业务员');
    return { pickupId: pickupUser.id, pickupUserName: (pickupUser.displayName?.trim() || pickupUser.username || '').trim() };
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
    if (!Number.isInteger(q) || q <= 0) throw new NotFoundException('数量必须为正整数');
    if (snapshot) this.assertColorSizeSnapshotTotal(snapshot, q, '新增库存的尺码明细合计必须等于新增数量');

    let orderId: number | null = null;
    let customerId: number | null = null;
    let customerName = '';
    let orderExFactoryPrice: string | number | null = null;
    let linkedOrder: Order | null = null;
    if (orderNo) {
      linkedOrder = await this.orderRepo.findOne({ where: { orderNo } });
      if (!linkedOrder) throw new NotFoundException('订单不存在');
    }
    if (linkedOrder) {
      orderId = linkedOrder.id;
      customerId = linkedOrder.customerId ?? null;
      customerName = linkedOrder.customerName?.trim() ?? '';
      orderExFactoryPrice = linkedOrder.exFactoryPrice ?? '0';
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
      const mergedUnit = totalQty > 0 ? this.normalizeOrderUnitPrice((safeOldP * oldQty + safeNewP * newQty) / totalQty) : unitPriceStr;
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
        await this.appendFinishedStockAdjustLog(saved.id, operatorUsername, before, after, `合并入库 +${newQty} 件`);
        return this.consolidateDuplicateFinishedStocks(saved, operatorUsername, '合并重复库存');
      } catch (e: any) {
        const msg = String(e?.message ?? '');
        if (this.isOrderIdNullSchemaError(msg)) throw new BadRequestException(this.orderIdNullableMigrationHint());
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
      if (this.isOrderIdNullSchemaError(msg)) throw new BadRequestException(this.orderIdNullableMigrationHint());
      throw e;
    }
  }

  async outbound(
    items: FinishedOutboundItemInput[],
    operatorUsername: string,
    remark: string,
    pickupUserId?: number | null,
  ): Promise<void> {
    const normalizedItems = Array.isArray(items)
      ? items
          .map((item) => ({ id: Number(item?.id), quantity: Number(item?.quantity), sizeBreakdown: item?.sizeBreakdown ?? null }))
          .filter((item) => Number.isInteger(item.id) && item.id > 0)
      : [];
    if (!normalizedItems.length) throw new BadRequestException('请选择需要出库的库存记录');
    const uniqueIds = Array.from(new Set(normalizedItems.map((item) => item.id)));
    if (uniqueIds.length !== normalizedItems.length) throw new BadRequestException('同一条库存记录不能重复出库');

    const stocks = await this.stockRepo.find({ where: { id: In(uniqueIds) } });
    if (stocks.length !== uniqueIds.length) throw new NotFoundException('存在库存记录不存在或已失效');
    const stockMap = new Map(stocks.map((stock) => [stock.id, stock]));
    for (const item of normalizedItems) {
      const stock = stockMap.get(item.id);
      if (!stock) throw new NotFoundException('库存记录不存在');
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) throw new BadRequestException('出库数量必须为正整数');
      if (item.quantity > stock.quantity) throw new BadRequestException(`库存 ${stock.skuCode || stock.id} 的出库数量不能大于当前库存`);
    }

    const customerNames = Array.from(new Set(stocks.map((stock) => stock.customerName?.trim() || '__EMPTY__')));
    if (customerNames.length > 1) throw new BadRequestException('批量出库仅支持选择同一客户的记录');

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
          if (item.quantity > txStock.quantity) throw new BadRequestException(`库存 ${txStock.skuCode || txStock.id} 的出库数量不能大于当前库存`);
          const currentSnapshot = this.parseStoredColorSizeSnapshot(txStock.colorSizeSnapshot);
          const outgoingSnapshot = this.parseStoredColorSizeSnapshot(item.sizeBreakdown);
          if (outgoingSnapshot) this.assertColorSizeSnapshotTotal(outgoingSnapshot, item.quantity, '出库尺码明细合计必须等于出库数量');
          if (currentSnapshot && !outgoingSnapshot) throw new BadRequestException(`库存 ${txStock.skuCode || txStock.id} 需要按颜色尺码明细出库`);
          if (currentSnapshot && outgoingSnapshot) {
            this.assertColorSizeSnapshotTotal(currentSnapshot, txStock.quantity, '当前库存尺码明细与总数量不一致，请先修正后再出库');
            txStock.colorSizeSnapshot = this.subtractColorSizeSnapshots(currentSnapshot, outgoingSnapshot);
          }
          txStock.quantity -= item.quantity;
          if (txStock.quantity === 0) await txStockRepo.remove(txStock);
          else await txStockRepo.save(txStock);

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
      if (msg.includes('Table') && msg.includes('finished_goods_outbound') && msg.includes("doesn't exist")) {
        throw new InternalServerErrorException('出库记录表不存在，请先执行 backend/scripts/create-finished-goods-outbound.sql');
      }
      throw e;
    }
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

  async upsertColorImage(id: number, dto: { colorName: string; imageUrl: string }, operatorUsername = ''): Promise<void> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) throw new NotFoundException('库存记录不存在');
    const colorName = (dto.colorName ?? '').trim();
    if (!colorName) throw new NotFoundException('颜色不能为空');
    const imageUrl = (dto.imageUrl ?? '').trim();
    try {
      const existing = await this.colorImageRepo.findOne({ where: { finishedStockId: id, colorName } });
      if (!imageUrl) {
        if (existing) await this.colorImageRepo.remove(existing);
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
        throw new InternalServerErrorException('库存详情图片表不存在，请先执行 backend/scripts/create-finished-goods-stock-detail-tables.sql');
      }
      throw e;
    }
  }
}
