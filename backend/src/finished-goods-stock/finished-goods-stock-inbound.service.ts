import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import { FinishedGoodsStockAdjustLog } from '../entities/finished-goods-stock-adjust-log.entity';
import type { ColorSizeSnapshot } from './finished-goods-stock.types';
import { FinishedGoodsStockInboundQueryService } from './finished-goods-stock-inbound-query.service';

type ManualInboundDto = {
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
};

type UpdateMetaDto = {
  skuCode?: string;
  department?: string;
  inventoryTypeId?: number | null;
  warehouseId?: number | null;
  location?: string;
  unitPrice?: string | number;
  imageUrl?: string;
  remark?: string;
  colorSize?: unknown;
  colorImages?: Array<{ colorName?: string; imageUrl?: string }>;
};
@Injectable()
export class FinishedGoodsStockInboundService {
  constructor(
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(FinishedGoodsStockColorImage)
    private readonly colorImageRepo: Repository<FinishedGoodsStockColorImage>,
    @InjectRepository(FinishedGoodsStockAdjustLog)
    private readonly adjustLogRepo: Repository<FinishedGoodsStockAdjustLog>,
    private readonly inboundQueryService: FinishedGoodsStockInboundQueryService,
  ) {}

  private isTableMissingError(e: unknown, tableName: string): boolean {
    const msg = String((e as { message?: unknown })?.message || '');
    return msg.includes('Table') && msg.includes(tableName) && msg.includes("doesn't exist");
  }

  private isOrderIdNullSchemaError(dbMessage: string): boolean {
    const msg = String(dbMessage);
    if (!msg.includes('order_id')) return false;
    return msg.includes('cannot be null') || msg.includes("doesn't have a default value") || msg.includes('does not have a default value');
  }

  private orderIdNullableMigrationHint(): string {
    return '数据库表 finished_goods_stock 的 order_id 不允许为空，无法在「不填订单号」时保存。请在库中执行 backend/scripts/allow-finished-goods-stock-null-order-id.sql（执行前备份），将 order_id 改为可 NULL 后再试。';
  }

  private normalizeOrderUnitPrice(v: unknown): string {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0';
    return n.toFixed(2);
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
        if (existing) { existing.imageUrl = imageUrl; await this.colorImageRepo.save(existing); }
        else await this.colorImageRepo.save(this.colorImageRepo.create({ finishedStockId: stockId, colorName, imageUrl }));
      } catch (e) {
        if (!this.isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
      }
    }
  }

  private async replaceColorImagesForStock(
    stockId: number,
    imageRows: Array<{ colorName?: string; imageUrl?: string }>,
  ): Promise<void> {
    try {
      await this.colorImageRepo.delete({ finishedStockId: stockId });
      const rows = imageRows
        .map((row) => ({
          colorName: String(row.colorName ?? '').trim(),
          imageUrl: String(row.imageUrl ?? '').trim(),
        }))
        .filter((row) => row.colorName && row.imageUrl);
      if (!rows.length) return;
      await this.colorImageRepo.save(
        rows.map((row) => this.colorImageRepo.create({ finishedStockId: stockId, ...row })),
      );
    } catch (e) {
      if (!this.isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
    }
  }

  private async getColorImagesSnapshot(stockId: number): Promise<Array<{ colorName: string; imageUrl: string }>> {
    try {
      const rows = await this.colorImageRepo.find({ where: { finishedStockId: stockId }, order: { colorName: 'ASC' } });
      return rows.map((row) => ({
        colorName: String(row.colorName ?? '').trim(),
        imageUrl: String(row.imageUrl ?? '').trim(),
      }));
    } catch (e) {
      if (!this.isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
      return [];
    }
  }

  private sameJson(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private async appendFinishedStockAdjustLog(
    finishedStockId: number,
    operatorUsername: string,
    before: Record<string, unknown>,
    after: Record<string, unknown>,
    remark: string,
    meta: { sourceOrderNo?: string; action?: string } = {},
  ): Promise<void> {
    try {
      const logMeta: Record<string, unknown> = {};
      const sourceOrderNo = String(meta.sourceOrderNo ?? '').trim();
      const action = String(meta.action ?? '').trim();
      if (sourceOrderNo) logMeta.sourceOrderNo = sourceOrderNo;
      if (action) logMeta.logAction = action;
      await this.adjustLogRepo.save(this.adjustLogRepo.create({
        finishedStockId,
        operatorUsername: (operatorUsername ?? '').trim(),
        before: { ...before, ...logMeta },
        after: { ...after, ...logMeta },
        remark: (remark ?? '').trim(),
      }));
    } catch (e) {
      if (!this.isTableMissingError(e, 'finished_goods_stock_adjust_logs')) throw e;
    }
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
        const created = await this.colorImageRepo.save(this.colorImageRepo.create({ finishedStockId: keeperId, colorName, imageUrl }));
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
    const stocks = await this.inboundQueryService.findDuplicateStocksForMergeKey(seed);
    if (stocks.length <= 1) {
      const normalized = this.inboundQueryService.parseStoredColorSizeSnapshot(seed.colorSizeSnapshot);
      if (normalized && JSON.stringify(normalized) !== JSON.stringify(seed.colorSizeSnapshot)) {
        seed.colorSizeSnapshot = normalized;
        return this.stockRepo.save(seed);
      }
      return seed;
    }

    const keeper = stocks.find((stock) => stock.id === seed.id) ?? stocks[0];
    const sourceStocks = stocks.filter((stock) => stock.id !== keeper.id);
    const before = this.inboundQueryService.stockAdjustSnapshot(keeper);
    const snapshots: ColorSizeSnapshot[] = [];
    for (const stock of stocks) {
      const qty = Math.max(0, Math.trunc(Number(stock.quantity) || 0));
      const snapshot = await this.inboundQueryService.buildCurrentStockSnapshot(stock);
      if (!snapshot && qty > 0) return keeper;
      if (!snapshot) continue;
      if (this.inboundQueryService.getColorSizeSnapshotTotal(snapshot) !== qty) return keeper;
      snapshots.push(snapshot);
    }

    const totalQty = stocks.reduce((sum, stock) => sum + Math.max(0, Math.trunc(Number(stock.quantity) || 0)), 0);
    const weightedAmount = stocks.reduce((sum, stock) => {
      const qty = Math.max(0, Math.trunc(Number(stock.quantity) || 0));
      const price = Number(stock.unitPrice);
      return sum + qty * (Number.isFinite(price) ? price : 0);
    }, 0);
    const mergedSnapshot = this.inboundQueryService.combineColorSizeSnapshots(snapshots);
    if (mergedSnapshot) {
      this.inboundQueryService.assertColorSizeSnapshotTotal(mergedSnapshot, totalQty, '合并后的尺码明细与总数量不一致');
    }
    keeper.quantity = totalQty;
    keeper.unitPrice =
      totalQty > 0
        ? this.normalizeOrderUnitPrice(weightedAmount / totalQty)
        : this.normalizeOrderUnitPrice(keeper.unitPrice);
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
    await this.appendFinishedStockAdjustLog(saved.id, operatorUsername, before, this.inboundQueryService.stockAdjustSnapshot(saved), remark);
    return saved;
  }

  async createManual(dto: ManualInboundDto, operatorUsername = ''): Promise<FinishedGoodsStock> {
    const orderNo = dto.orderNo?.trim();
    const parsedColorSize = this.inboundQueryService.parseColorSizeInput(dto.colorSize);
    let snapshot = parsedColorSize.snapshot;
    const { imageRows } = parsedColorSize;
    const q = Number(dto.quantity);
    if (!Number.isInteger(q) || q <= 0) throw new NotFoundException('数量必须为正整数');
    let orderId: number | null = null, customerId: number | null = null;
    let customerName = '', orderExFactoryPrice: string | number | null = null;
    if (orderNo) {
      const linkedOrder = await this.inboundQueryService.findOrderByOrderNo(orderNo);
      if (!linkedOrder) throw new NotFoundException('订单不存在');
      orderId = linkedOrder.id;
      customerId = linkedOrder.customerId ?? null;
      customerName = linkedOrder.customerName?.trim() ?? '';
      orderExFactoryPrice = linkedOrder.exFactoryPrice ?? '0';
    }
    if (!snapshot && orderId != null) {
      snapshot = await this.inboundQueryService.buildOrderColorSizeSnapshot(orderId, q);
    }
    if (snapshot) this.inboundQueryService.assertColorSizeSnapshotTotal(snapshot, q, '新增库存的尺码明细合计必须等于新增数量');

    const unitPriceStr =
      dto.unitPrice != null && dto.unitPrice !== ''
        ? this.normalizeOrderUnitPrice(dto.unitPrice)
        : orderId != null
          ? this.normalizeOrderUnitPrice(orderExFactoryPrice)
          : this.normalizeOrderUnitPrice('0');
    const warehouseId = dto.warehouseId != null ? Number(dto.warehouseId) : null;
    const inventoryTypeId = dto.inventoryTypeId != null ? Number(dto.inventoryTypeId) : null;
    const imageUrl = dto.imageUrl?.trim() ?? '', skuCode = dto.skuCode?.trim() ?? '';
    if (!skuCode) throw new BadRequestException('SKU不能为空');
    const department = dto.department?.trim() ?? '', location = dto.location?.trim() ?? '';

    const existing = await this.inboundQueryService.findMergeableFinishedStock({
      skuCode,
      warehouseId,
      inventoryTypeId,
      department,
    });
    const inboundRemark = orderNo ? `从订单 ${orderNo} 新增库存` : '手工新增库存';
    if (existing) {
      const before = this.inboundQueryService.stockAdjustSnapshot(existing);
      const oldQty = Math.max(0, Math.trunc(Number(existing.quantity) || 0));
      const totalQty = oldQty + q;
      const currentSnapshot = snapshot ? await this.inboundQueryService.buildCurrentStockSnapshot(existing) : null;
      if (snapshot) {
        if (!currentSnapshot && oldQty > 0) {
          throw new BadRequestException('无法读取现有库存的完整尺码明细，请先在库存详情中修正后再新增库存');
        }
        this.inboundQueryService.assertColorSizeSnapshotTotal(currentSnapshot, oldQty, '现有库存尺码明细与总数量不一致，请先修正后再新增库存');
      }
      const oldP = Number(existing.unitPrice);
      const newP = Number(unitPriceStr);
      const safeOldP = Number.isFinite(oldP) ? oldP : 0;
      const safeNewP = Number.isFinite(newP) ? newP : 0;
      const mergedUnit =
        totalQty > 0 ? this.normalizeOrderUnitPrice((safeOldP * oldQty + safeNewP * q) / totalQty) : unitPriceStr;
      existing.quantity = totalQty;
      existing.unitPrice = mergedUnit;
      if (location) existing.location = location;
      if (!existing.imageUrl && imageUrl) existing.imageUrl = imageUrl;
      if (snapshot) {
        const mergedSnapshot = this.inboundQueryService.mergeColorSizeSnapshots(currentSnapshot, snapshot);
        this.inboundQueryService.assertColorSizeSnapshotTotal(mergedSnapshot, totalQty, '合并后的尺码明细与总数量不一致');
        existing.colorSizeSnapshot = mergedSnapshot;
      }
      try {
        const saved = await this.stockRepo.save(existing);
        await this.persistColorImagesForStock(saved.id, imageRows);
        await this.appendFinishedStockAdjustLog(
          saved.id,
          operatorUsername,
          before,
          this.inboundQueryService.stockAdjustSnapshot(saved),
          inboundRemark,
          { sourceOrderNo: orderNo, action: 'inbound' },
        );
        return this.consolidateDuplicateFinishedStocks(saved, operatorUsername, '合并重复库存');
      } catch (e: unknown) {
        const msg = String((e as { message?: unknown })?.message ?? '');
        if (this.isOrderIdNullSchemaError(msg)) throw new BadRequestException(this.orderIdNullableMigrationHint());
        throw e;
      }
    }

    const stock = this.stockRepo.create({ orderId, skuCode, quantity: q, unitPrice: unitPriceStr, warehouseId, inventoryTypeId, department, location, customerId, customerName, imageUrl, colorSizeSnapshot: snapshot });
    try {
      const saved = await this.stockRepo.save(stock);
      await this.persistColorImagesForStock(saved.id, imageRows);
      await this.appendFinishedStockAdjustLog(
        saved.id,
        operatorUsername,
        { quantity: 0, colorSizeSnapshot: null },
        this.inboundQueryService.stockAdjustSnapshot(saved),
        inboundRemark,
        { sourceOrderNo: orderNo, action: 'inbound' },
      );
      return this.consolidateDuplicateFinishedStocks(saved, operatorUsername, '合并重复库存');
    } catch (e: unknown) {
      const msg = String((e as { message?: unknown })?.message ?? '');
      if (this.isOrderIdNullSchemaError(msg)) throw new BadRequestException(this.orderIdNullableMigrationHint());
      throw e;
    }
  }

  async updateMeta(id: number, dto: UpdateMetaDto, operatorUsername: string): Promise<FinishedGoodsStock> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) throw new NotFoundException('库存记录不存在');
    const before = {
      ...this.inboundQueryService.stockAdjustSnapshot(stock),
      colorImages: await this.getColorImagesSnapshot(id),
    };
    if (dto.skuCode !== undefined) {
      const skuCode = (dto.skuCode ?? '').trim();
      if (!skuCode) throw new BadRequestException('SKU不能为空');
      stock.skuCode = skuCode;
    }
    if (dto.department !== undefined) stock.department = (dto.department ?? '').trim();
    if (dto.inventoryTypeId !== undefined) stock.inventoryTypeId = dto.inventoryTypeId != null ? Number(dto.inventoryTypeId) : null;
    if (dto.warehouseId !== undefined) stock.warehouseId = dto.warehouseId != null ? Number(dto.warehouseId) : null;
    if (dto.location !== undefined) stock.location = (dto.location ?? '').trim();
    if (dto.unitPrice !== undefined) stock.unitPrice = this.normalizeOrderUnitPrice(dto.unitPrice);
    if (dto.imageUrl !== undefined) stock.imageUrl = (dto.imageUrl ?? '').trim();
    if (dto.colorSize !== undefined) {
      const parsed = this.inboundQueryService.parseColorSizeInput(dto.colorSize).snapshot;
      this.inboundQueryService.assertColorSizeSnapshotTotal(parsed, stock.quantity, '库存详情的码数明细合计必须等于当前库存数量');
      stock.colorSizeSnapshot = parsed;
    }
    const saved = await this.stockRepo.save(stock);
    if (dto.colorImages !== undefined) {
      await this.replaceColorImagesForStock(saved.id, dto.colorImages);
    }
    const after = {
      ...this.inboundQueryService.stockAdjustSnapshot(saved),
      colorImages: await this.getColorImagesSnapshot(saved.id),
    };
    const remarkText = (dto.remark ?? '').trim();
    if (!this.sameJson(before, after) || remarkText) {
      await this.appendFinishedStockAdjustLog(id, operatorUsername, before, after, remarkText || '修改库存信息', {
        action: 'meta',
      });
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
      const before = { colorImages: await this.getColorImagesSnapshot(id) };
      const existing = await this.colorImageRepo.findOne({ where: { finishedStockId: id, colorName } });
      if (!imageUrl) {
        if (existing) await this.colorImageRepo.remove(existing);
        const after = { colorImages: await this.getColorImagesSnapshot(id) };
        if (!this.sameJson(before, after)) {
          await this.appendFinishedStockAdjustLog(id, operatorUsername, before, after, `更新颜色图片：${colorName}`, {
            action: 'image',
          });
        }
        await this.consolidateDuplicateFinishedStocks(stock, operatorUsername, '合并重复库存');
        return;
      }
      if (existing) {
        existing.imageUrl = imageUrl;
        await this.colorImageRepo.save(existing);
        const after = { colorImages: await this.getColorImagesSnapshot(id) };
        if (!this.sameJson(before, after)) {
          await this.appendFinishedStockAdjustLog(id, operatorUsername, before, after, `更新颜色图片：${colorName}`, {
            action: 'image',
          });
        }
        await this.consolidateDuplicateFinishedStocks(stock, operatorUsername, '合并重复库存');
        return;
      }
      await this.colorImageRepo.save(this.colorImageRepo.create({ finishedStockId: id, colorName, imageUrl }));
      const after = { colorImages: await this.getColorImagesSnapshot(id) };
      await this.appendFinishedStockAdjustLog(id, operatorUsername, before, after, `更新颜色图片：${colorName}`, {
        action: 'image',
      });
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
}
