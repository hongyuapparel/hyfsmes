import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { SystemOptionsService } from '../system-options/system-options.service';
import { OrderStatusConfigService } from '../order-status-config/order-status-config.service';
import {
  PURCHASE_ORDER_STATUSES,
  type PurchaseItemRow,
  type PurchaseListQuery,
} from './production-purchase.types';

@Injectable()
export class ProductionPurchaseQueryService {
  private purchaseReconcileRunning = false;
  private purchaseReconcileLastRunAt = 0;
  private readonly purchaseReconcileIntervalMs = 5 * 60 * 1000;

  private materialSourceOptionsLoadedAt = 0;
  private materialSourceLabelById = new Map<number, string>();
  private materialTypeOptionsLoadedAt = 0;
  private materialTypeLabelById = new Map<number, string>();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(OrderStatus)
    private readonly orderStatusRepo: Repository<OrderStatus>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoryRepo: Repository<OrderStatusHistory>,
    private readonly orderWorkflowService: OrderWorkflowService,
    private readonly systemOptionsService: SystemOptionsService,
    private readonly orderStatusConfigService: OrderStatusConfigService,
  ) {}

  async getPurchaseItems(query: PurchaseListQuery, actorUserId?: number): Promise<{
    list: PurchaseItemRow[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      tab = 'all',
      orderNo,
      skuCode,
      supplier,
      orderTypeId,
      orderDateStart,
      orderDateEnd,
      page = 1,
      pageSize = 20,
    } = query;
    this.schedulePurchaseReconcile(actorUserId);
    await this.ensureMaterialSourceOptionCache();
    await this.ensureMaterialTypeOptionCache();

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.status IN (:...statuses)', { statuses: PURCHASE_ORDER_STATUSES });

    if (orderNo?.trim()) {
      qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    }
    if (skuCode?.trim()) {
      qb.andWhere('o.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    }
    if (typeof orderTypeId === 'number') {
      qb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId });
    }
    if (orderDateStart) {
      qb.andWhere('o.order_date >= :orderDateStart', { orderDateStart: `${orderDateStart} 00:00:00` });
    }
    if (orderDateEnd) {
      qb.andWhere('o.order_date <= :orderDateEnd', { orderDateEnd: `${orderDateEnd} 23:59:59` });
    }

    qb.orderBy('o.order_date', 'DESC').addOrderBy('o.id', 'DESC');

    const orders = await qb.getMany();
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) {
      return { list: [], total: 0, page, pageSize };
    }

    // 到采购时间：从状态历史表中取进入 pending_purchase 的时间（取最新一次进入时间）
    let pendingPurchaseEnteredAtMap = new Map<number, string>();
    try {
      const pendingStatus = await this.orderStatusRepo.findOne({ where: { code: 'pending_purchase' } });
      const statusId = pendingStatus?.id;
      if (statusId) {
        const historyRows = await this.orderStatusHistoryRepo
          .createQueryBuilder('h')
          .select('h.order_id', 'orderId')
          .addSelect('MAX(h.entered_at)', 'enteredAt')
          .where('h.status_id = :statusId', { statusId })
          .andWhere('h.order_id IN (:...orderIds)', { orderIds })
          .groupBy('h.order_id')
          .getRawMany<{ orderId: number; enteredAt: string }>();
        const map = new Map<number, string>();
        for (const r of historyRows) {
          const orderId = Number(r.orderId);
          const enteredAt = r.enteredAt;
          if (!Number.isFinite(orderId) || !enteredAt) continue;
          const formatted = this.toDateTimeLocalString(enteredAt);
          if (!formatted) continue;
          map.set(orderId, formatted);
        }
        pendingPurchaseEnteredAtMap = map;
      }
    } catch {
      pendingPurchaseEnteredAtMap = new Map<number, string>();
    }

    const extList = await this.orderExtRepo.find({
      where: orderIds.map((id) => ({ orderId: id })),
    });
    const extMap = new Map(extList.map((e) => [e.orderId, e]));
    const slaCtx = await this.orderStatusConfigService.loadProductionSlaJudgeContext();

    const rows: PurchaseItemRow[] = [];
    for (const order of orders) {
      const ext = extMap.get(order.id);
      const materials: OrderMaterialRow[] = ext?.materials ?? [];
      const orderDate = this.toDateOnlyLocalString(order.orderDate);
      const pendingPurchaseAt =
        pendingPurchaseEnteredAtMap.get(order.id) ||
        (order.status === 'pending_purchase' && order.statusTime
          ? this.toDateTimeLocalString(order.statusTime)
          : null);

      // 采购页仅展示“当前待采购”或“历史进入过待采购”的订单：
      // 若某条链路配置为不经过待采购（如部分成品链路），则不应出现在采购页。
      if (!pendingPurchaseAt) {
        continue;
      }

      for (let i = 0; i < materials.length; i++) {
        const m = materials[i];
        const supplierName = (m.supplierName ?? '').trim();
        if (supplier?.trim() && !supplierName.toLowerCase().includes(supplier.trim().toLowerCase())) {
          continue;
        }
        const materialSourceId = m.materialSourceId ?? null;
        const materialSource = this.getMaterialSourceLabelById(materialSourceId);
        const processRoute = this.resolveMaterialRouteBySourceLabel(materialSource);
        const purchaseStatus = (m.purchaseStatus ?? 'pending').toLowerCase();
        const pickStatus = (m.pickStatus ?? 'pending').toLowerCase();
        const routeStatus =
          processRoute === 'purchase'
            ? purchaseStatus === 'completed'
              ? 'completed'
              : 'pending'
            : pickStatus === 'completed'
              ? 'completed'
              : 'pending';
        if (tab === 'pending' && !(processRoute === 'purchase' && routeStatus === 'pending')) continue;
        if (tab === 'picking' && !(processRoute === 'picking' && routeStatus === 'pending')) continue;
        if (tab === 'completed' && routeStatus !== 'completed') continue;

        const phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(pendingPurchaseAt);
        const materialDone = routeStatus === 'completed';
        const endRaw = processRoute === 'purchase' ? m.purchaseCompletedAt : m.pickCompletedAt;
        const phaseEnd = materialDone ? this.orderStatusConfigService.parseProductionPhaseInstant(endRaw) : null;
        const timeRating = this.orderStatusConfigService.judgeProductionPhaseDuration(
          'pending_purchase',
          phaseStart,
          phaseEnd,
          order.status ?? '',
          slaCtx,
        );

        rows.push({
          orderId: order.id,
          materialIndex: i,
          orderNo: order.orderNo ?? '',
          orderDate,
          pendingPurchaseAt,
          imageUrl: order.imageUrl ?? '',
          skuCode: order.skuCode ?? '',
          orderTypeId: order.orderTypeId ?? null,
          supplierName: supplierName || '-',
          materialTypeId: m.materialTypeId ?? null,
          materialType: (m.materialType ?? '').trim() || this.getMaterialTypeLabelById(m.materialTypeId ?? null) || '',
          materialName: (m.materialName ?? '').trim() || '-',
          color: (m.color ?? '').trim() || '',
          planQuantity: m.purchaseQuantity ?? m.orderPieces ?? null,
          actualPurchaseQuantity: m.actualPurchaseQuantity ?? null,
          purchaseAmount: m.purchaseAmount ?? null,
          purchaseStatus: purchaseStatus === 'completed' ? 'completed' : 'pending',
          pickStatus: pickStatus === 'completed' ? 'completed' : 'pending',
          purchaseCompletedAt: m.purchaseCompletedAt ?? null,
          pickCompletedAt: m.pickCompletedAt ?? null,
          purchaseUnitPrice: m.purchaseUnitPrice ?? null,
          purchaseOtherCost: m.purchaseOtherCost ?? null,
          purchaseRemark: m.purchaseRemark ?? null,
          purchaseImageUrl: m.purchaseImageUrl ?? null,
          materialSourceId,
          materialSource,
          processRoute,
          timeRating,
          customerName: order.customerName ?? '',
          merchandiser: order.merchandiser ?? '',
          customerDueDate: this.toDateOnlyLocalString(order.customerDueDate),
          orderQuantity: order.quantity ?? 0,
        });
      }
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);

    return { list, total, page, pageSize };
  }

  private async appendStatusHistory(orderId: number, statusCode: string): Promise<void> {
    const code = (statusCode ?? '').trim();
    if (!code) return;
    const status = await this.orderStatusRepo.findOne({ where: { code } });
    if (!status) return;
    await this.orderStatusHistoryRepo.save(
      this.orderStatusHistoryRepo.create({ orderId, statusId: status.id }),
    );
  }

  private async reconcilePurchaseCompletedOrders(actorUserId?: number): Promise<void> {
    if (typeof actorUserId !== 'number') return;
    await this.ensureMaterialSourceOptionCache();
    const orders = await this.orderRepo.find({ where: { status: 'pending_purchase' } });
    if (!orders.length) return;
    const orderIds = orders.map((order) => order.id);
    const extList = await this.orderExtRepo.find({ where: { orderId: In(orderIds) } });
    if (!extList.length) return;
    const extMap = new Map(extList.map((ext) => [ext.orderId, ext]));
    for (const order of orders) {
      const ext = extMap.get(order.id);
      const materials: OrderMaterialRow[] = Array.isArray(ext?.materials) ? ext.materials : [];
      if (!materials.length) continue;
      const allCompleted = materials.every((material) => this.isMaterialFlowCompleted(material));
      if (!allCompleted) continue;
      const next = await this.orderWorkflowService.resolveNextStatus({
        order,
        triggerCode: 'purchase_all_completed',
        actorUserId,
      });
      if (!next || next === order.status) continue;
      order.status = next;
      order.statusTime = this.getLatestMaterialFlowCompletedAt(materials) ?? new Date();
      await this.orderRepo.save(order);
      await this.appendStatusHistory(order.id, next);
    }
  }

  private schedulePurchaseReconcile(actorUserId?: number): void {
    if (typeof actorUserId !== 'number') return;
    if (this.purchaseReconcileRunning) return;
    const now = Date.now();
    if (now - this.purchaseReconcileLastRunAt < this.purchaseReconcileIntervalMs) return;

    this.purchaseReconcileRunning = true;
    this.purchaseReconcileLastRunAt = now;
    void this.reconcilePurchaseCompletedOrders(actorUserId)
      .catch(() => {
        // 自愈失败不影响列表主链路；下个间隔继续尝试。
      })
      .finally(() => {
        this.purchaseReconcileRunning = false;
      });
  }

  private async ensureMaterialSourceOptionCache(): Promise<void> {
    const now = Date.now();
    if (now - this.materialSourceOptionsLoadedAt < 60_000 && this.materialSourceLabelById.size > 0) return;
    const list = await this.systemOptionsService.findAllByType('material_sources');
    this.materialSourceLabelById = new Map(list.map((item) => [item.id, item.value]));
    this.materialSourceOptionsLoadedAt = now;
  }

  private async ensureMaterialTypeOptionCache(): Promise<void> {
    const now = Date.now();
    if (now - this.materialTypeOptionsLoadedAt < 60_000 && this.materialTypeLabelById.size > 0) return;
    const list = await this.systemOptionsService.findAllByType('material_types');
    this.materialTypeLabelById = new Map(list.map((item) => [item.id, item.value]));
    this.materialTypeOptionsLoadedAt = now;
  }

  private getMaterialTypeLabelById(id: number | null | undefined): string {
    if (id == null) return '';
    return this.materialTypeLabelById.get(Number(id)) ?? '';
  }

  private getMaterialSourceLabelById(id: number | null | undefined): string {
    if (id == null) return '';
    return this.materialSourceLabelById.get(Number(id)) ?? '';
  }

  private resolveMaterialRouteBySourceLabel(sourceLabel: string): 'purchase' | 'picking' {
    const label = sourceLabel.trim();
    if (label === '公司库存' || label === '客供面料') return 'picking';
    // 兼容历史数据：未配置来源时仍走原等待采购流程，避免破坏既有逻辑。
    return 'purchase';
  }

  private isMaterialFlowCompleted(material: OrderMaterialRow): boolean {
    const sourceLabel = this.getMaterialSourceLabelById(material.materialSourceId ?? null);
    const route = this.resolveMaterialRouteBySourceLabel(sourceLabel);
    if (route === 'purchase') {
      return (material.purchaseStatus ?? 'pending').toLowerCase() === 'completed';
    }
    return (material.pickStatus ?? 'pending').toLowerCase() === 'completed';
  }

  private getMaterialFlowCompletedAt(material: OrderMaterialRow): Date | null {
    const sourceLabel = this.getMaterialSourceLabelById(material.materialSourceId ?? null);
    const route = this.resolveMaterialRouteBySourceLabel(sourceLabel);
    const raw = route === 'purchase' ? material.purchaseCompletedAt : material.pickCompletedAt;
    if (raw == null || String(raw).trim() === '') return null;
    const completedAt = new Date(raw);
    return Number.isNaN(completedAt.getTime()) ? null : completedAt;
  }

  private getLatestMaterialFlowCompletedAt(materials: OrderMaterialRow[]): Date | null {
    let latest: Date | null = null;
    for (const material of materials) {
      const completedAt = this.getMaterialFlowCompletedAt(material);
      if (!completedAt) continue;
      if (!latest || completedAt.getTime() > latest.getTime()) {
        latest = completedAt;
      }
    }
    return latest;
  }

  private toDateOnlyLocalString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (typeof v === 'string') return v.slice(0, 10) || null;
    if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private toDateTimeLocalString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (typeof v === 'string') return v.slice(0, 19).replace('T', ' ') || null;
    if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    const hh = String(v.getHours()).padStart(2, '0');
    const mm = String(v.getMinutes()).padStart(2, '0');
    const ss = String(v.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }
}
