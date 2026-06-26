import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InboundPending } from '../entities/inbound-pending.entity';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { InventoryPendingService } from '../inventory-pending/inventory-pending.service';
import { FinishedGoodsStockOutboundService } from '../finished-goods-stock/finished-goods-stock-outbound.service';
import { FinishedGoodsStockInboundQueryService } from '../finished-goods-stock/finished-goods-stock-inbound-query.service';
import { getSizeHeaderKey } from '../common/size-headers.util';
import { PackingListsService, PackingListDetail } from './packing-lists.service';

interface ColorSizeSnapshot {
  headers: string[];
  rows: Array<{ colorName: string; quantities: number[] }>;
}

interface SourceGroup {
  totalQty: number;
  /** 颜色 → (码名 → 件数)，同 source 同色多箱行已合并相加 */
  colorRows: Map<string, Record<string, number>>;
}

interface OutboundItem {
  id: number;
  quantity: number;
  sizeBreakdown: ColorSizeSnapshot | null;
}

@Injectable()
export class PackingListsShipService {
  constructor(
    @InjectRepository(InboundPending) private readonly pendingRepo: Repository<InboundPending>,
    @InjectRepository(FinishedGoodsStock) private readonly stockRepo: Repository<FinishedGoodsStock>,
    private readonly listsService: PackingListsService,
    private readonly inventoryPendingService: InventoryPendingService,
    private readonly finishedOutboundService: FinishedGoodsStockOutboundService,
    private readonly inboundQueryService: FinishedGoodsStockInboundQueryService,
  ) {}

  async ship(id: number, operatorUsername: string): Promise<void> {
    const detail = await this.listsService.getDetail(id);
    if (detail.status !== 'draft') throw new BadRequestException('该装箱单已发货');

    // 混合发货：只要单子里有明细行就放行。库存来源行(pending/finished)照常扣减出库；
    // 手填行(manual)无库存来源，只作单据记录、不扣库存。整单仅手填时也允许发货（仅改状态、不动库存）。
    const hasAnyItem = detail.boxes.some((box) => box.items.length > 0);
    if (!hasAnyItem) {
      throw new BadRequestException('装箱单没有任何明细行，无法发货');
    }

    const pendingGroups = this.groupBySource(detail, 'pending');
    const finishedGroups = this.groupBySource(detail, 'finished');

    const pendingItems = this.buildOutboundItems(pendingGroups, detail.sizeHeaders);
    const finishedItems = this.buildOutboundItems(finishedGroups, detail.sizeHeaders);

    const errors: string[] = [];
    errors.push(...(await this.validatePending(pendingItems)));
    errors.push(...(await this.validateFinished(finishedItems)));
    if (errors.length) throw new BadRequestException(`发货校验未通过：${errors.join('；')}`);

    if (pendingItems.length) {
      await this.inventoryPendingService.doOutbound(pendingItems, operatorUsername, null);
    }
    if (finishedItems.length) {
      try {
        await this.finishedOutboundService.outbound(finishedItems, operatorUsername, `装箱单发货 ${detail.code}`, null);
      } catch (e: unknown) {
        if (pendingItems.length) {
          const msg = (e as { message?: unknown })?.message;
          throw new BadRequestException(
            `成品出库失败：${String(msg ?? '未知错误')}。待仓部分已发出，请勿重复发货，需人工核对装箱单 ${detail.code}`,
          );
        }
        throw e;
      }
    }
    await this.listsService.markShipped([id]);
    await this.listsService.recordLog(id, 'ship', operatorUsername, `发货 ${detail.code}`);
  }

  private groupBySource(detail: PackingListDetail, sourceType: 'pending' | 'finished'): Map<number, SourceGroup> {
    const groups = new Map<number, SourceGroup>();
    for (const box of detail.boxes) {
      for (const item of box.items) {
        if (item.sourceType !== sourceType) continue;
        if (item.sourceId == null) {
          throw new BadRequestException(`明细行「${item.styleNo || item.colorName || '-'}」缺少来源记录，无法发货`);
        }
        const group = groups.get(item.sourceId) ?? { totalQty: 0, colorRows: new Map<string, Record<string, number>>() };
        group.totalQty += item.totalQty;
        const colorName = (item.colorName ?? '').trim();
        const merged = group.colorRows.get(colorName) ?? {};
        for (const [size, qty] of Object.entries(item.sizeQuantities)) {
          merged[size] = (merged[size] ?? 0) + qty;
        }
        group.colorRows.set(colorName, merged);
        groups.set(item.sourceId, group);
      }
    }
    return groups;
  }

  private buildOutboundItems(groups: Map<number, SourceGroup>, listSizeHeaders: string[]): OutboundItem[] {
    const items: OutboundItem[] = [];
    for (const [sourceId, group] of groups) {
      items.push({
        id: sourceId,
        quantity: group.totalQty,
        sizeBreakdown: this.buildSnapshot(group, listSizeHeaders),
      });
    }
    return items;
  }

  /** 按 list.size_headers 顺序组装 {headers, rows}；无任何分码数据（hasSnapshot=false 链路）返回 null */
  private buildSnapshot(group: SourceGroup, listSizeHeaders: string[]): ColorSizeSnapshot | null {
    const usedSizes = new Set<string>();
    for (const sizeQuantities of group.colorRows.values()) {
      for (const [size, qty] of Object.entries(sizeQuantities)) {
        if (qty > 0) usedSizes.add(size);
      }
    }
    if (!usedSizes.size) return null;
    const headers = [
      ...listSizeHeaders.filter((h) => usedSizes.has(h)),
      ...Array.from(usedSizes).filter((h) => !listSizeHeaders.includes(h)),
    ];
    const rows: ColorSizeSnapshot['rows'] = [];
    for (const [colorName, sizeQuantities] of group.colorRows) {
      const quantities = headers.map((h) => sizeQuantities[h] ?? 0);
      if (quantities.some((q) => q > 0)) rows.push({ colorName, quantities });
    }
    return { headers, rows };
  }

  private async validatePending(items: OutboundItem[]): Promise<string[]> {
    if (!items.length) return [];
    const errors: string[] = [];
    const pendings = await this.pendingRepo.find({ where: { id: In(items.map((i) => i.id)) } });
    const pendingById = new Map(pendings.map((p) => [p.id, p]));
    for (const item of items) {
      const pending = pendingById.get(item.id);
      if (!pending || pending.status !== 'pending') {
        errors.push(`待仓记录 ${item.id} 不存在或已处理`);
        continue;
      }
      if ((pending.sourceType ?? 'normal') === 'defect') {
        errors.push(`待仓记录 ${pending.skuCode || pending.id} 为次品，不支持发货`);
        continue;
      }
      if (item.quantity <= 0) {
        errors.push(`待仓记录 ${pending.skuCode || pending.id} 发货数量必须大于 0`);
        continue;
      }
      if (item.quantity > (pending.quantity ?? 0)) {
        errors.push(`待仓记录 ${pending.skuCode || pending.id} 发货 ${item.quantity} 件超过当前待处理 ${pending.quantity} 件`);
      }
    }
    return errors;
  }

  private async validateFinished(items: OutboundItem[]): Promise<string[]> {
    if (!items.length) return [];
    const errors: string[] = [];
    const stocks = await this.stockRepo.find({ where: { id: In(items.map((i) => i.id)) } });
    const stockById = new Map(stocks.map((s) => [s.id, s]));
    for (const item of items) {
      const stock = stockById.get(item.id);
      if (!stock) {
        errors.push(`成品库存记录 ${item.id} 不存在或已出库`);
        continue;
      }
      const label = stock.skuCode || String(stock.id);
      if (item.quantity <= 0) {
        errors.push(`成品库存 ${label} 出库数量必须大于 0`);
        continue;
      }
      if (item.quantity > stock.quantity) {
        errors.push(`成品库存 ${label} 出库 ${item.quantity} 件超过当前库存 ${stock.quantity} 件`);
        continue;
      }
      const currentSnapshot = await this.inboundQueryService.buildCurrentStockSnapshot(stock);
      if (currentSnapshot && !item.sizeBreakdown) {
        errors.push(`成品库存 ${label} 需要按颜色尺码明细出库，请在装箱单中填写分码数量`);
        continue;
      }
      if (!currentSnapshot && item.sizeBreakdown) {
        errors.push(`成品库存 ${label} 无法读取当前颜色尺码明细，请先在成品库存页修正后再发货`);
        continue;
      }
      if (currentSnapshot && item.sizeBreakdown) {
        errors.push(...this.checkSnapshotCoverage(label, currentSnapshot, item.sizeBreakdown));
      }
    }
    return errors;
  }

  private checkSnapshotCoverage(label: string, current: ColorSizeSnapshot, outgoing: ColorSizeSnapshot): string[] {
    const errors: string[] = [];
    const currentByColor = new Map(current.rows.map((row) => [row.colorName.trim(), row]));
    const headerIndex = new Map(current.headers.map((header, index) => [getSizeHeaderKey(header), index]));
    for (const outRow of outgoing.rows) {
      const colorName = outRow.colorName.trim();
      const currentRow = currentByColor.get(colorName);
      if (!currentRow) {
        errors.push(`成品库存 ${label} 颜色「${colorName || '-'}」当前无库存明细`);
        continue;
      }
      for (let i = 0; i < outgoing.headers.length; i++) {
        const qty = outRow.quantities[i] ?? 0;
        if (qty <= 0) continue;
        const header = outgoing.headers[i];
        const targetIndex = headerIndex.get(getSizeHeaderKey(header));
        const available = targetIndex != null ? currentRow.quantities[targetIndex] ?? 0 : 0;
        if (qty > available) {
          errors.push(`成品库存 ${label} 颜色「${colorName || '-'}」尺码「${header}」出库 ${qty} 件超过当前 ${available} 件`);
        }
      }
    }
    return errors;
  }
}
