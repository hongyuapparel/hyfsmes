import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import { FinishedGoodsStockAdjustLog } from '../entities/finished-goods-stock-adjust-log.entity';
import type { ColorSizeSnapshot } from './finished-goods-stock.types';
import { FinishedGoodsStockInboundQueryService } from './finished-goods-stock-inbound-query.service';
import { isTableMissingError, normalizeOrderUnitPrice } from './finished-goods-stock-query.utils';

export type ColorMetaInput = {
  stockId: number;
  colorName: string;
  department: string;
  inventoryTypeId: number | null;
  warehouseId: number | null;
  location: string;
  unitPrice: string | number;
  /** 管理员在详情里填的该颜色各尺码数量（对应 RepartitionDto.headers 顺序）；缺省则沿用库里现有数量 */
  quantities?: number[];
};

export type RepartitionDto = {
  skuCode?: string;
  imageUrl?: string;
  remark?: string;
  /** colorMeta.quantities 对应的尺码表头 */
  headers?: string[];
  colorMeta: ColorMetaInput[];
};

type ColorUnit = {
  originId: number;
  customerId: number | null;
  customerName: string;
  colorName: string;
  headers: string[];
  quantities: number[];
  price: string;
  department: string;
  inventoryTypeId: number | null;
  warehouseId: number | null;
  location: string;
  imageUrl: string;
};

/** 一次「修改已有库存」前，整组每条记录的完整快照，用于一键回滚（精确还原，可重建被删记录） */
type UndoRecord = {
  id: number;
  orderId: number | null;
  customerId: number | null;
  customerName: string;
  skuCode: string;
  quantity: number;
  unitPrice: string;
  warehouseId: number | null;
  inventoryTypeId: number | null;
  department: string;
  location: string;
  imageUrl: string;
  colorSizeSnapshot: unknown;
  colorImages: Array<{ colorName: string; imageUrl: string }>;
};

type ColorImageRow = { finishedStockId: number; colorName: string; imageUrl: string };

/**
 * 成品库存「按颜色重分配」：库存详情抽屉是按 SKU 整组聚合显示的，但底层是多条
 * finished_goods_stock 记录（一条记录一套 部门/库存类型/仓库/单价，快照里含多个颜色）。
 * 本服务把整组的每个颜色按 客户 + 部门 + 库存类型 + 仓库 + 出厂价 + 存放地址 重新归并：
 * 同色且这些信息全相同 → 并入同一记录（对应码数整数相加）；任一不同 → 拆成不同记录；
 * 被搬空的记录删除；颜色图片随颜色迁移。整体在一个事务内完成，保证「快照合计 = 数量」守恒。
 */
@Injectable()
export class FinishedGoodsStockRepartitionService {
  constructor(
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(FinishedGoodsStockColorImage)
    private readonly colorImageRepo: Repository<FinishedGoodsStockColorImage>,
    @InjectRepository(FinishedGoodsStockAdjustLog)
    private readonly adjustLogRepo: Repository<FinishedGoodsStockAdjustLog>,
    private readonly inboundQueryService: FinishedGoodsStockInboundQueryService,
  ) {}

  private norm(value: unknown): string {
    return String(value ?? '').trim();
  }

  private nullableId(value: unknown): number | null {
    if (value == null) return null;
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
  }

  /** 出厂价规范化：非法或负数归零，统一两位小数，用于分桶键比较与落库 */
  private normalizePrice(value: unknown): string {
    const n = Number(value);
    return normalizeOrderUnitPrice(Number.isFinite(n) && n > 0 ? n : 0);
  }

  private bucketKey(unit: ColorUnit): string {
    return JSON.stringify([
      unit.customerName,
      unit.department,
      unit.inventoryTypeId ?? null,
      unit.warehouseId ?? null,
      unit.price,
      unit.location,
    ]);
  }

  private rowQty(quantities: number[]): number {
    return quantities.reduce((sum, q) => sum + Math.max(0, Math.trunc(Number(q) || 0)), 0);
  }

  private async loadGroupColorImageRows(stockIds: number[]): Promise<ColorImageRow[]> {
    if (!stockIds.length) return [];
    try {
      const rows = await this.colorImageRepo.find({ where: { finishedStockId: In(stockIds) } });
      return rows.map((row) => ({
        finishedStockId: row.finishedStockId,
        colorName: this.norm(row.colorName),
        imageUrl: this.norm(row.imageUrl),
      }));
    } catch (e) {
      if (!isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
      return [];
    }
  }

  private buildImageMap(rows: ColorImageRow[]): Map<string, string> {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      if (!row.imageUrl) return;
      const key = `${row.finishedStockId}::${row.colorName}`;
      if (!map.has(key)) map.set(key, row.imageUrl);
    });
    return map;
  }

  /** 把整组每条记录连同其颜色图片打成完整快照（回滚用） */
  private captureGroupUndo(group: FinishedGoodsStock[], imageRows: ColorImageRow[]): UndoRecord[] {
    return group.map((record) => ({
      id: record.id,
      orderId: record.orderId ?? null,
      customerId: record.customerId ?? null,
      customerName: this.norm(record.customerName),
      skuCode: this.norm(record.skuCode),
      quantity: Math.max(0, Math.trunc(Number(record.quantity) || 0)),
      unitPrice: this.normalizePrice(record.unitPrice),
      warehouseId: record.warehouseId ?? null,
      inventoryTypeId: record.inventoryTypeId ?? null,
      department: this.norm(record.department),
      location: this.norm(record.location),
      imageUrl: this.norm(record.imageUrl),
      colorSizeSnapshot: this.inboundQueryService.cloneColorSizeSnapshot(
        this.inboundQueryService.parseStoredColorSizeSnapshot(record.colorSizeSnapshot),
      ),
      colorImages: imageRows
        .filter((row) => row.finishedStockId === record.id && row.colorName && row.imageUrl)
        .map((row) => ({ colorName: row.colorName, imageUrl: row.imageUrl })),
    }));
  }

  /** 把整组每个颜色拆成「颜色单元」，目标元数据来自 colorMeta（缺省则沿用原记录） */
  private async buildColorUnits(
    group: FinishedGoodsStock[],
    metaMap: Map<string, ColorMetaInput>,
    imageMap: Map<string, string>,
    requestHeaders: string[],
  ): Promise<ColorUnit[]> {
    const units: ColorUnit[] = [];
    for (const record of group) {
      const snapshot = await this.inboundQueryService.buildCurrentStockSnapshot(record);
      const qty = Math.max(0, Math.trunc(Number(record.quantity) || 0));
      if (!snapshot) {
        if (qty > 0) {
          throw new BadRequestException(
            `库存记录 #${record.id} 的尺码明细无法解析，请先在该记录详情中修正后再保存`,
          );
        }
        continue;
      }
      for (const row of snapshot.rows) {
        const colorName = this.norm(row.colorName);
        const cm = metaMap.get(`${record.id}::${colorName}`);
        // 管理员填了该颜色的数量则原样采用（按 requestHeaders 对齐）；否则沿用库里现有数量
        const useEnteredQty = !!cm && Array.isArray(cm.quantities) && requestHeaders.length > 0;
        units.push({
          originId: record.id,
          customerId: record.customerId ?? null,
          customerName: this.norm(record.customerName),
          colorName,
          headers: useEnteredQty ? [...requestHeaders] : [...snapshot.headers],
          quantities: useEnteredQty
            ? requestHeaders.map((_, i) => Math.max(0, Math.trunc(Number(cm!.quantities![i]) || 0)))
            : [...row.quantities],
          price: cm ? this.normalizePrice(cm.unitPrice) : this.normalizePrice(record.unitPrice),
          department: cm ? this.norm(cm.department) : this.norm(record.department),
          inventoryTypeId: cm ? this.nullableId(cm.inventoryTypeId) : (record.inventoryTypeId ?? null),
          warehouseId: cm ? this.nullableId(cm.warehouseId) : (record.warehouseId ?? null),
          location: cm ? this.norm(cm.location) : this.norm(record.location),
          imageUrl: imageMap.get(`${record.id}::${colorName}`) ?? '',
        });
      }
    }
    return units;
  }

  async repartition(seedId: number, dto: RepartitionDto, operatorUsername: string): Promise<void> {
    if (!Array.isArray(dto.colorMeta)) throw new BadRequestException('缺少颜色明细');
    const seed = await this.stockRepo.findOne({ where: { id: seedId } });
    if (!seed) throw new NotFoundException('库存记录不存在');
    const sku = this.norm(dto.skuCode) || this.norm(seed.skuCode);
    if (!sku) throw new BadRequestException('SKU不能为空');

    const group = await this.stockRepo.find({ where: { skuCode: seed.skuCode } });
    if (!group.length) throw new NotFoundException('库存记录不存在');
    const groupIds = group.map((item) => item.id);

    const metaMap = new Map<string, ColorMetaInput>();
    dto.colorMeta.forEach((cm) => {
      const stockId = Number(cm?.stockId);
      const colorName = this.norm(cm?.colorName);
      if (!Number.isInteger(stockId) || stockId <= 0 || !colorName) return;
      metaMap.set(`${stockId}::${colorName}`, cm);
    });

    const imageRows = await this.loadGroupColorImageRows(groupIds);
    const imageMap = this.buildImageMap(imageRows);
    // 改动前整组完整快照：写进日志 JSON，供管理员一键回滚（精确还原、可重建被删记录）
    const groupUndo = this.captureGroupUndo(group, imageRows);

    const requestHeaders = Array.isArray(dto.headers) ? dto.headers.map((h) => this.norm(h)).filter(Boolean) : [];
    const units = await this.buildColorUnits(group, metaMap, imageMap, requestHeaders);

    // 按 客户 + 部门 + 库存类型 + 仓库 + 出厂价 + 存放地址 分桶：
    // 同色且这些信息全相同 → 落入同一桶（码数相加合并）；任一不同 → 不同桶（存为两行）
    const buckets = new Map<string, ColorUnit[]>();
    units.forEach((unit) => {
      const key = this.bucketKey(unit);
      const list = buckets.get(key);
      if (list) list.push(unit);
      else buckets.set(key, [unit]);
    });

    const usedRecordIds = new Set<number>();
    const keepers: Array<{ record: FinishedGoodsStock; isNew: boolean; imageColors: Map<string, string> }> = [];

    buckets.forEach((bucketUnits) => {
      const sample = bucketUnits[0];
      const candidate = group
        .filter(
          (record) =>
            !usedRecordIds.has(record.id) &&
            this.norm(record.customerName) === sample.customerName &&
            this.norm(record.department) === sample.department &&
            (record.inventoryTypeId ?? null) === (sample.inventoryTypeId ?? null) &&
            (record.warehouseId ?? null) === (sample.warehouseId ?? null) &&
            this.normalizePrice(record.unitPrice) === sample.price &&
            this.norm(record.location) === sample.location,
        )
        .sort((a, b) => a.id - b.id)[0];

      const combined = this.inboundQueryService.combineColorSizeSnapshots(
        bucketUnits.map((unit) => ({ headers: unit.headers, rows: [{ colorName: unit.colorName, quantities: unit.quantities }] })),
      );
      const totalQty = this.inboundQueryService.getColorSizeSnapshotTotal(combined);
      // 该桶被管理员清零（数量全 0）：不保留也不新建；候选记录留给后续按「被搬空」删除
      if (totalQty <= 0) return;

      const record =
        candidate ??
        this.stockRepo.create({
          orderId: null,
          skuCode: sku,
          customerId: sample.customerId,
          customerName: sample.customerName,
          department: sample.department,
          inventoryTypeId: sample.inventoryTypeId,
          warehouseId: sample.warehouseId,
          location: sample.location,
          imageUrl: '',
          unitPrice: sample.price,
        });
      const isNew = !candidate;
      if (candidate) usedRecordIds.add(candidate.id);

      const imageColors = new Map<string, string>();
      bucketUnits.forEach((unit) => {
        if (unit.imageUrl && !imageColors.has(unit.colorName)) imageColors.set(unit.colorName, unit.imageUrl);
      });

      // 同桶内 部门/类型/仓库/单价/存放地址 全相同，直接取样本值即可（不做加权，单价精确）
      record.skuCode = sku;
      record.customerName = sample.customerName;
      record.customerId = sample.customerId ?? record.customerId ?? null;
      record.department = sample.department;
      record.inventoryTypeId = sample.inventoryTypeId;
      record.warehouseId = sample.warehouseId;
      record.location = sample.location;
      record.quantity = totalQty;
      record.unitPrice = sample.price;
      record.colorSizeSnapshot = combined;
      if (record.id === seedId && dto.imageUrl != null) record.imageUrl = this.norm(dto.imageUrl);

      keepers.push({ record, isNew, imageColors });
    });

    const survivingIds = new Set(keepers.map((k) => k.record).filter((r) => r.id != null).map((r) => r.id));
    // 仅删除「原本有颜色、现已被搬空」的记录；没有任何颜色单元的记录（如 0 数量）保持不动
    const originIdsWithUnits = new Set(units.map((unit) => unit.originId));
    const toDelete = group.filter((record) => originIdsWithUnits.has(record.id) && !survivingIds.has(record.id));

    await this.stockRepo.manager.transaction(async (manager) => {
      const stockRepo = manager.getRepository(FinishedGoodsStock);
      const colorImageRepo = manager.getRepository(FinishedGoodsStockColorImage);
      const adjustLogRepo = manager.getRepository(FinishedGoodsStockAdjustLog);

      for (const keeper of keepers) {
        await stockRepo.save(keeper.record);
      }

      // 颜色图片：只清理「被重建的 keeper + 被删除的记录」的旧图片，再按最终归属重建；
      // 未参与重分配（无颜色单元）的记录图片保持不动
      try {
        const reusedKeeperIds = keepers.filter((k) => !k.isNew).map((k) => k.record.id);
        const affectedImageIds = Array.from(new Set([...reusedKeeperIds, ...toDelete.map((r) => r.id)]));
        if (affectedImageIds.length) await colorImageRepo.delete({ finishedStockId: In(affectedImageIds) });
        const imageEntities: FinishedGoodsStockColorImage[] = [];
        keepers.forEach((keeper) => {
          keeper.imageColors.forEach((imageUrl, colorName) => {
            if (!colorName || !imageUrl) return;
            imageEntities.push(colorImageRepo.create({ finishedStockId: keeper.record.id, colorName, imageUrl }));
          });
        });
        if (imageEntities.length) await colorImageRepo.save(imageEntities);
      } catch (e) {
        if (!isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
      }

      if (toDelete.length) {
        const deleteIds = toDelete.map((record) => record.id);
        const reassignTo = survivingIds.has(seedId) ? seedId : keepers.find((k) => k.record.id != null)?.record.id ?? null;
        if (reassignTo != null) {
          try {
            await adjustLogRepo.update({ finishedStockId: In(deleteIds) }, { finishedStockId: reassignTo });
          } catch (e) {
            if (!isTableMissingError(e, 'finished_goods_stock_adjust_logs')) throw e;
          }
        }
        await stockRepo.remove(toDelete);
      }

      // 调整日志：每次保存写一条「可回滚点」，before 里带整组改动前快照
      const remark = this.norm(dto.remark) || '修改成品库存（可回滚）';
      const anchorId = survivingIds.has(seedId)
        ? seedId
        : keepers.find((k) => k.record.id != null)?.record.id ?? seedId;
      try {
        await adjustLogRepo.save(
          adjustLogRepo.create({
            finishedStockId: anchorId,
            operatorUsername: this.norm(operatorUsername),
            before: { _groupUndo: groupUndo, logAction: 'edit-save' },
            after: { logAction: 'edit-save' },
            remark,
          }),
        );
      } catch (e) {
        if (!isTableMissingError(e, 'finished_goods_stock_adjust_logs')) throw e;
      }
    });
  }

  /** 管理员一键回滚：把某次「可回滚点」对应的 SKU 整组还原到改动前（精确还原，被删记录按原样重建） */
  async rollback(logId: number, operatorUsername: string): Promise<void> {
    const log = await this.adjustLogRepo.findOne({ where: { id: logId } });
    if (!log) throw new NotFoundException('操作记录不存在');
    const before = (log.before ?? {}) as Record<string, unknown>;
    const blob = Array.isArray(before._groupUndo) ? (before._groupUndo as UndoRecord[]) : null;
    if (!blob || !blob.length) throw new BadRequestException('该操作记录不支持回滚');
    const sku = this.norm(blob[0].skuCode);
    if (!sku) throw new BadRequestException('回滚数据异常：缺少 SKU');

    await this.stockRepo.manager.transaction(async (manager) => {
      const stockRepo = manager.getRepository(FinishedGoodsStock);
      const colorImageRepo = manager.getRepository(FinishedGoodsStockColorImage);
      const adjustLogRepo = manager.getRepository(FinishedGoodsStockAdjustLog);

      const current = await stockRepo.find({ where: { skuCode: sku } });
      // 回滚本身也可再回滚：先存当前整组快照
      const currentImageRows = await this.loadGroupColorImageRows(current.map((r) => r.id));
      const currentUndo = this.captureGroupUndo(current, currentImageRows);

      const blobIds = new Set(blob.map((b) => Number(b.id)));
      const toRemove = current.filter((r) => !blobIds.has(r.id));

      for (const b of blob) {
        const fields = {
          orderId: b.orderId ?? null,
          customerId: b.customerId ?? null,
          customerName: this.norm(b.customerName),
          skuCode: this.norm(b.skuCode),
          quantity: Math.max(0, Math.trunc(Number(b.quantity) || 0)),
          unitPrice: this.normalizePrice(b.unitPrice),
          warehouseId: b.warehouseId ?? null,
          inventoryTypeId: b.inventoryTypeId ?? null,
          department: this.norm(b.department),
          location: this.norm(b.location),
          imageUrl: this.norm(b.imageUrl),
          colorSizeSnapshot: (b.colorSizeSnapshot ?? null) as FinishedGoodsStock['colorSizeSnapshot'],
        };
        const existing = current.find((r) => r.id === Number(b.id));
        if (existing) {
          Object.assign(existing, fields);
          await stockRepo.save(existing);
        } else {
          await stockRepo.insert({ id: Number(b.id), ...fields });
        }
        // 还原该记录的颜色图片
        try {
          await colorImageRepo.delete({ finishedStockId: Number(b.id) });
          const imgs = Array.isArray(b.colorImages) ? b.colorImages : [];
          const entities = imgs
            .map((img) => ({ colorName: this.norm(img.colorName), imageUrl: this.norm(img.imageUrl) }))
            .filter((img) => img.colorName && img.imageUrl)
            .map((img) => colorImageRepo.create({ finishedStockId: Number(b.id), ...img }));
          if (entities.length) await colorImageRepo.save(entities);
        } catch (e) {
          if (!isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
        }
      }

      if (toRemove.length) {
        try {
          await colorImageRepo.delete({ finishedStockId: In(toRemove.map((r) => r.id)) });
        } catch (e) {
          if (!isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
        }
        await stockRepo.remove(toRemove);
      }

      try {
        await adjustLogRepo.save(
          adjustLogRepo.create({
            finishedStockId: Number(blob[0].id),
            operatorUsername: this.norm(operatorUsername),
            before: { _groupUndo: currentUndo, logAction: 'edit-save' },
            after: { logAction: 'rollback' },
            remark: `回滚「${this.norm(log.remark) || '修改成品库存'}」`,
          }),
        );
      } catch (e) {
        if (!isTableMissingError(e, 'finished_goods_stock_adjust_logs')) throw e;
      }
    });
  }
}
