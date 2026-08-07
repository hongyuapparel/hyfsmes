import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { OrderCostSnapshot } from '../entities/order-cost-snapshot.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { Order } from '../entities/order.entity';
import { User } from '../entities/user.entity';
import { OrderStatusService } from './order-status.service';
import { type OrderActor } from './order.types';
import { resolveOperatorDisplayName } from '../common/operator.util';
import { buildCostDraftLogDetail } from './order-operation-log-summary';

@Injectable()
export class OrderCostSnapshotService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(OrderCostSnapshot)
    private readonly orderCostSnapshotRepo: Repository<OrderCostSnapshot>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly orderStatusService: OrderStatusService,
    private readonly dataSource: DataSource,
  ) {}

  normalizeProfitMargin(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n < 0) return 0.1;
    if (Math.abs(n - 0.15) < 1e-9) return 0.1;
    return n;
  }

  private normalizeProductionCostMultiplier(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n < 0) return 2;
    return n;
  }

  private normalizeProductionLineQuantity(v: unknown): number {
    if (v == null) return 1;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return 1;
    return n;
  }

  private calculateExFactoryPriceFromSnapshot(snapshot: Record<string, unknown> | null | undefined): number {
    if (!snapshot || typeof snapshot !== 'object') return 0;
    const materialRows = Array.isArray(snapshot.materialRows) ? (snapshot.materialRows as Record<string, unknown>[]) : [];
    const processItemRows = Array.isArray(snapshot.processItemRows) ? (snapshot.processItemRows as Record<string, unknown>[]) : [];
    const productionRows = Array.isArray(snapshot.productionRows) ? (snapshot.productionRows as Record<string, unknown>[]) : [];
    const materialTotal = materialRows.reduce((sum, row) => {
      const includeInCost = row?.includeInCost !== false;
      if (!includeInCost) return sum;
      const usage = Number(row?.usagePerPiece) || 0;
      const lossPercent = Number(row?.lossPercent) || 0;
      const unitPrice = Number(row?.unitPrice) || 0;
      return sum + usage * (1 + lossPercent / 100) * unitPrice;
    }, 0);
    const processItemTotal = processItemRows.reduce((sum, row) => sum + (Number(row?.quantity) || 0) * (Number(row?.unitPrice) || 0), 0);
    const productionBaseTotal = productionRows.reduce(
      (sum, row) => sum + (Number(row?.unitPrice) || 0) * this.normalizeProductionLineQuantity(row?.quantity),
      0,
    );
    const productionTotal = productionBaseTotal * this.normalizeProductionCostMultiplier(snapshot.productionCostMultiplier);
    const totalCost = materialTotal + processItemTotal + productionTotal;
    const margin = this.normalizeProfitMargin(snapshot.profitMargin);
    const exFactory = margin >= 1 ? totalCost : totalCost / (1 - margin);
    return Number.isFinite(exFactory) ? Number(exFactory.toFixed(2)) : 0;
  }

  private normalizeComparableSnapshotValue(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((item) => this.normalizeComparableSnapshotValue(item));
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, this.normalizeComparableSnapshotValue(item)]),
    );
  }

  private snapshotContentChanged(
    previousSnapshot: Record<string, unknown>,
    nextSnapshot: Record<string, unknown>,
  ): boolean {
    const previousContent = this.stripQuoteMetadataFromSnapshot(previousSnapshot);
    const nextContent = this.stripQuoteMetadataFromSnapshot(nextSnapshot);
    return JSON.stringify(this.normalizeComparableSnapshotValue(previousContent))
      !== JSON.stringify(this.normalizeComparableSnapshotValue(nextContent));
  }

  // 报价元数据里的"操作人"一律写显示名(displayName)，保证订单成本页上「确认报价人」前后一致。
  // 保存草稿不得抹掉历史确认记录；只有成本内容确实变化时，才进入“待重新确认”。
  private withDraftMetadata(
    snapshot: Record<string, unknown>,
    operatorName: string,
    previousSnapshot?: Record<string, unknown>,
  ): Record<string, unknown> {
    const previous = previousSnapshot ?? {};
    const confirmedAt = typeof previous.quoteConfirmedAt === 'string' ? previous.quoteConfirmedAt.trim() : '';
    const confirmedMetadata = confirmedAt
      ? {
          quoteConfirmedAt: confirmedAt,
          quoteConfirmedBy: previous.quoteConfirmedBy,
          quoteConfirmedExFactoryPrice: previous.quoteConfirmedExFactoryPrice,
        }
      : {};
    const quoteNeedsReconfirm = confirmedAt
      ? Boolean(previous.quoteNeedsReconfirm) || this.snapshotContentChanged(previous, snapshot)
      : true;
    return {
      ...snapshot,
      ...confirmedMetadata,
      quoteNeedsReconfirm,
      quoteDraftUpdatedAt: new Date().toISOString(),
      quoteDraftUpdatedBy: operatorName,
    };
  }

  private withConfirmedMetadata(snapshot: Record<string, unknown>, operatorName: string, exFactoryPrice: string): Record<string, unknown> {
    return {
      ...snapshot,
      quoteNeedsReconfirm: false,
      quoteConfirmedAt: new Date().toISOString(),
      quoteConfirmedBy: operatorName,
      quoteConfirmedExFactoryPrice: exFactoryPrice,
      quoteDraftUpdatedAt: new Date().toISOString(),
      quoteDraftUpdatedBy: operatorName,
    };
  }

  // 复制订单为新草稿时，剥离报价确认/草稿元数据：新订单从未确认过报价，
  // 不能继承源订单的「最近一次确认报价」，否则成本页会显示从未发生过的确认记录。
  stripQuoteMetadataFromSnapshot(snapshot: Record<string, unknown>): Record<string, unknown> {
    const {
      quoteNeedsReconfirm: _quoteNeedsReconfirm,
      quoteConfirmedAt: _quoteConfirmedAt,
      quoteConfirmedBy: _quoteConfirmedBy,
      quoteConfirmedExFactoryPrice: _quoteConfirmedExFactoryPrice,
      quoteDraftUpdatedAt: _quoteDraftUpdatedAt,
      quoteDraftUpdatedBy: _quoteDraftUpdatedBy,
      ...rest
    } = snapshot;
    return rest;
  }

  // 仅在订单尚无成本快照时，用订单的物料/工艺项目初始化一份零单价的快照。
  // 已存在的快照绝不在此覆盖：成本快照是单价的唯一数据源，订单编辑不得回写它。
  async syncCostSnapshotFromOrder(orderId: number): Promise<void> {
    const existing = await this.orderCostSnapshotRepo.findOne({ where: { orderId } });
    if (existing?.snapshot && typeof existing.snapshot === 'object') return;
    const [order, ext] = await Promise.all([
      this.orderRepo.findOne({ where: { id: orderId } }),
      this.orderExtRepo.findOne({ where: { orderId } }),
    ]);
    if (!order) return;
    const sourceMaterials = Array.isArray(ext?.materials) ? ext.materials : [];
    const sourceProcessItems = Array.isArray(ext?.processItems) ? ext.processItems : [];
    const defaultProcessItemQty = 1;
    const materialRows = sourceMaterials.map((m) => ({
      materialTypeId: m?.materialTypeId ?? null,
      supplierName: m?.supplierName ?? '',
      materialName: m?.materialName ?? '',
      color: m?.color ?? '',
      fabricWidth: m?.fabricWidth ?? '',
      usagePerPiece: m?.usagePerPiece ?? null,
      lossPercent: m?.lossPercent ?? null,
      orderPieces: m?.orderPieces ?? null,
      purchaseQuantity: m?.purchaseQuantity ?? null,
      cuttingQuantity: m?.cuttingQuantity ?? null,
      remark: m?.remark ?? '',
      unitPrice: 0,
    }));
    const processItemRows = sourceProcessItems.map((p) => ({
      processName: p?.processName ?? '',
      supplierName: p?.supplierName ?? '',
      part: p?.part ?? '',
      remark: p?.remark ?? '',
      unitPrice: 0,
      quantity: defaultProcessItemQty,
    }));
    const nextSnapshot: Record<string, unknown> = {
      materialRows: materialRows.length ? materialRows : [{ unitPrice: 0 }],
      processItemRows: processItemRows.length ? processItemRows : [{ unitPrice: 0, quantity: defaultProcessItemQty }],
      productionRows: [],
      productionCostMultiplier: this.normalizeProductionCostMultiplier(undefined),
      profitMargin: this.normalizeProfitMargin(undefined),
    };
    if (existing) {
      existing.snapshot = nextSnapshot;
      await this.orderCostSnapshotRepo.save(existing);
    } else {
      await this.orderCostSnapshotRepo.save(this.orderCostSnapshotRepo.create({ orderId, snapshot: nextSnapshot }));
    }
  }

  async saveCostSnapshot(orderId: number, payload: { snapshot: Record<string, unknown> }, actor?: OrderActor): Promise<OrderCostSnapshot> {
    const operatorName = actor ? await resolveOperatorDisplayName(this.userRepo, actor) : '系统';
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const snapshotRepo = manager.getRepository(OrderCostSnapshot);
      const order = await orderRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('订单不存在');

      let row = await snapshotRepo.findOne({ where: { orderId } });
      const previousSnapshot = row?.snapshot && typeof row.snapshot === 'object'
        ? row.snapshot as Record<string, unknown>
        : undefined;
      const snapshot = this.withDraftMetadata(payload.snapshot ?? {}, operatorName, previousSnapshot);
      if (row) row.snapshot = snapshot;
      else row = snapshotRepo.create({ orderId, snapshot });
      const saved = await snapshotRepo.save(row);
      if (actor) {
        const previousPrice = this.calculateExFactoryPriceFromSnapshot(previousSnapshot);
        const nextPrice = this.calculateExFactoryPriceFromSnapshot(snapshot);
        await this.orderStatusService.addLog(
          order,
          actor,
          'cost_draft',
          buildCostDraftLogDetail(previousSnapshot, snapshot, previousPrice, nextPrice),
          manager,
        );
      }
      return saved;
    });
  }

  async confirmCostQuote(orderId: number, payload: { snapshot: Record<string, unknown> }, actor: OrderActor): Promise<OrderCostSnapshot> {
    const normalizeDecimalInput = (v: unknown): string => {
      if (v === null || v === undefined) return '0';
      if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
      if (typeof v === 'string') {
        const t = v.trim();
        return t ? t : '0';
      }
      return '0';
    };
    const computed = this.calculateExFactoryPriceFromSnapshot(payload.snapshot ?? {});
    const nextExFactory = normalizeDecimalInput(computed.toFixed(2));
    const operatorName = await resolveOperatorDisplayName(this.userRepo, actor);
    const snapshot = this.withConfirmedMetadata(payload.snapshot ?? {}, operatorName, nextExFactory);
    return this.dataSource.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const snapshotRepo = manager.getRepository(OrderCostSnapshot);
      const order = await orderRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('订单不存在');

      const oldExFactory = normalizeDecimalInput(order.exFactoryPrice);
      let row = await snapshotRepo.findOne({ where: { orderId } });
      if (row) row.snapshot = snapshot;
      else row = snapshotRepo.create({ orderId, snapshot });
      const saved = await snapshotRepo.save(row);
      order.exFactoryPrice = nextExFactory;
      await orderRepo.save(order);
      await this.orderStatusService.addLog(
        order,
        actor,
        'cost_confirm',
        `确认报价并同步出厂价: ${oldExFactory} -> ${nextExFactory}`,
        manager,
      );
      return saved;
    });
  }
}
