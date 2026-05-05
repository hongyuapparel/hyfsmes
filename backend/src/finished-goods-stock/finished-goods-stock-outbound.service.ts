import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import { FinishedGoodsStockAdjustLog } from '../entities/finished-goods-stock-adjust-log.entity';
import { Order } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { User, UserStatus } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import type { ColorSizeSnapshot, FinishedOutboundItemInput } from './finished-goods-stock.types';
import { getSizeHeaderKey, normalizeSizeHeader, remapQuantitiesBySizeHeaders, sortSizeHeaders } from './size-header-order.util';

@Injectable()
export class FinishedGoodsStockOutboundService {
  constructor(
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(FinishedGoodsStockColorImage)
    private readonly colorImageRepo: Repository<FinishedGoodsStockColorImage>,
    @InjectRepository(FinishedGoodsStockAdjustLog)
    private readonly adjustLogRepo: Repository<FinishedGoodsStockAdjustLog>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
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
    const msg = String((e as { message?: unknown })?.message || '');
    return msg.includes('Table') && msg.includes(tableName) && msg.includes("doesn't exist");
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

  private getColorSizeSnapshotTotal(snapshot: ColorSizeSnapshot | null): number {
    if (!snapshot) return 0;
    return snapshot.rows.reduce(
      (sum, row) =>
        sum +
        row.quantities.reduce((rowSum, quantity) => rowSum + Math.max(0, Math.trunc(Number(quantity) || 0)), 0),
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

  private stockAdjustSnapshot(stock: FinishedGoodsStock): Record<string, unknown> {
    return {
      skuCode: stock.skuCode ?? '',
      department: stock.department ?? '',
      inventoryTypeId: stock.inventoryTypeId ?? null,
      warehouseId: stock.warehouseId ?? null,
      location: stock.location ?? '',
      quantity: stock.quantity ?? 0,
      unitPrice: stock.unitPrice != null ? String(stock.unitPrice) : '0',
      imageUrl: stock.imageUrl ?? '',
      colorSizeSnapshot: this.parseStoredColorSizeSnapshot(stock.colorSizeSnapshot),
    };
  }

  private async appendOutboundAdjustLog(
    manager: EntityManager,
    finishedStockId: number,
    operatorUsername: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    remark: string,
  ): Promise<void> {
    await manager.getRepository(FinishedGoodsStockAdjustLog).save(this.adjustLogRepo.create({
      finishedStockId,
      operatorUsername: (operatorUsername ?? '').trim(),
      before: { ...before, logAction: 'outbound' },
      after: { ...after, logAction: 'outbound' },
      remark: (remark ?? '').trim() || '成品出库',
    }));
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
    const headerIndex = new Map(headers.map((header, index) => [getSizeHeaderKey(header), index]));
    outgoing.rows.forEach((outRow) => {
      const colorName = String(outRow.colorName ?? '').trim();
      const targetRow = rowMap.get(colorName);
      if (!targetRow) throw new BadRequestException(`颜色「${colorName || '-'}」库存明细不足，无法出库`);
      outgoing.headers.forEach((header, outIndex) => {
        const qty = Math.max(0, Math.trunc(Number(outRow.quantities?.[outIndex]) || 0));
        if (qty <= 0) return;
        const targetIndex = headerIndex.get(getSizeHeaderKey(header));
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
    } catch (e: unknown) {
      const msg = String((e as { message?: unknown })?.message ?? '');
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
          const beforeAdjust = this.stockAdjustSnapshot(txStock);
          const currentSnapshot = this.parseStoredColorSizeSnapshot(txStock.colorSizeSnapshot);
          const outgoingSnapshot = this.parseStoredColorSizeSnapshot(item.sizeBreakdown);
          if (outgoingSnapshot) this.assertColorSizeSnapshotTotal(outgoingSnapshot, item.quantity, '出库尺码明细合计必须等于出库数量');
          if (currentSnapshot && !outgoingSnapshot) throw new BadRequestException(`库存 ${txStock.skuCode || txStock.id} 需要按颜色尺码明细出库`);
          if (currentSnapshot && outgoingSnapshot) {
            this.assertColorSizeSnapshotTotal(currentSnapshot, txStock.quantity, '当前库存尺码明细与总数量不一致，请先修正后再出库');
            txStock.colorSizeSnapshot = this.subtractColorSizeSnapshots(currentSnapshot, outgoingSnapshot);
          }
          txStock.quantity -= item.quantity;
          const afterAdjust = this.stockAdjustSnapshot(txStock);
          if (txStock.quantity === 0) await txStockRepo.remove(txStock);
          else await txStockRepo.save(txStock);
          await this.appendOutboundAdjustLog(manager, item.id, operatorUsername, beforeAdjust, afterAdjust, remark);

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
    } catch (e: unknown) {
      const msg = String((e as { message?: unknown })?.message ?? '');
      if (msg.includes('Table') && msg.includes('finished_goods_outbound') && msg.includes("doesn't exist")) {
        throw new InternalServerErrorException('出库记录表不存在，请先执行 backend/scripts/create-finished-goods-outbound.sql');
      }
      throw e;
    }
  }
}
