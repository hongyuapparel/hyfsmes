import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type ActualCutRow } from '../entities/order-cutting.entity';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { OrderStatusConfigService } from '../order-status-config/order-status-config.service';
import type { CuttingListItem, CuttingListQuery } from './production-cutting.types';

@Injectable()
export class ProductionCuttingListService {
  private cuttingReconcileRunning = false;
  private cuttingReconcileLastRunAt = 0;
  private readonly cuttingReconcileIntervalMs = 5 * 60 * 1000;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderCutting)
    private readonly cuttingRepo: Repository<OrderCutting>,
    @InjectRepository(OrderStatus)
    private readonly orderStatusRepo: Repository<OrderStatus>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoryRepo: Repository<OrderStatusHistory>,
    private readonly orderWorkflowService: OrderWorkflowService,
    private readonly orderStatusConfigService: OrderStatusConfigService,
  ) {}

  private async appendStatusHistory(orderId: number, statusCode: string): Promise<void> {
    const code = (statusCode ?? '').trim();
    if (!code) return;
    const status = await this.orderStatusRepo.findOne({ where: { code } });
    if (!status) return;
    await this.orderStatusHistoryRepo.save(this.orderStatusHistoryRepo.create({ orderId, statusId: status.id }));
  }

  private async reconcileCuttingCompletedOrders(actorUserId?: number): Promise<void> {
    if (typeof actorUserId !== 'number') return;
    const cuttings = await this.cuttingRepo.find({ where: { status: 'completed' } });
    if (!cuttings.length) return;
    const orderIds = cuttings.map((c) => c.orderId);
    const orders = await this.orderRepo.find({ where: { id: In(orderIds), status: 'pending_cutting' } });
    if (!orders.length) return;
    const cuttingMap = new Map(cuttings.map((c) => [c.orderId, c]));
    for (const order of orders) {
      const next = await this.orderWorkflowService.resolveNextStatus({
        order,
        triggerCode: 'cutting_completed',
        actorUserId,
      });
      if (!next || next === order.status) continue;
      const cutting = cuttingMap.get(order.id);
      order.status = next;
      order.statusTime = cutting?.completedAt ?? new Date();
      await this.orderRepo.save(order);
      await this.appendStatusHistory(order.id, next);
    }
  }

  private scheduleCuttingReconcile(actorUserId?: number): void {
    if (typeof actorUserId !== 'number') return;
    if (this.cuttingReconcileRunning) return;
    const now = Date.now();
    if (now - this.cuttingReconcileLastRunAt < this.cuttingReconcileIntervalMs) return;
    this.cuttingReconcileRunning = true;
    this.cuttingReconcileLastRunAt = now;
    void this.reconcileCuttingCompletedOrders(actorUserId)
      .catch(() => {})
      .finally(() => {
        this.cuttingReconcileRunning = false;
      });
  }

  private async hasActualFabricMeters(): Promise<boolean> {
    try {
      const rows = await this.cuttingRepo.query("SHOW COLUMNS FROM `order_cutting` LIKE 'actual_fabric_meters'");
      return Array.isArray(rows) && rows.length > 0;
    } catch {
      return false;
    }
  }

  private async hasCuttingRegisterV2Columns(): Promise<boolean> {
    try {
      const rows = await this.cuttingRepo.query("SHOW COLUMNS FROM `order_cutting` LIKE 'cutting_unit_price'");
      return Array.isArray(rows) && rows.length > 0;
    } catch {
      return false;
    }
  }

  private async fetchActualFabricMetersMap(orderIds: number[]): Promise<Map<number, string>> {
    const ids = Array.isArray(orderIds) ? orderIds.filter((v) => typeof v === 'number' && v > 0) : [];
    const map = new Map<number, string>();
    if (!ids.length) return map;
    if (!(await this.hasActualFabricMeters())) return map;
    try {
      const rows = await this.cuttingRepo.query(
        `SELECT order_id AS orderId, actual_fabric_meters AS actualFabricMeters
         FROM \`order_cutting\`
         WHERE order_id IN (?)`,
        [ids],
      );
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const orderId = Number((r as { orderId: unknown }).orderId);
          const v = (r as { actualFabricMeters: unknown }).actualFabricMeters;
          if (!Number.isNaN(orderId) && v != null && String(v).trim() !== '') map.set(orderId, String(v));
        }
      }
    } catch {}
    return map;
  }

  private async fetchCuttingV2Map(orderIds: number[]): Promise<Map<number, { unit: string | null; total: string | null }>> {
    const map = new Map<number, { unit: string | null; total: string | null }>();
    const ids = Array.isArray(orderIds) ? orderIds.filter((v) => typeof v === 'number' && v > 0) : [];
    if (!ids.length) return map;
    if (!(await this.hasCuttingRegisterV2Columns())) return map;
    try {
      const rows = await this.cuttingRepo.query(
        `SELECT order_id AS orderId, cutting_unit_price AS cuttingUnitPrice, cutting_total_cost AS cuttingTotalCost
         FROM \`order_cutting\`
         WHERE order_id IN (?)`,
        [ids],
      );
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const orderId = Number((r as { orderId: unknown }).orderId);
          if (Number.isNaN(orderId)) continue;
          const u = (r as { cuttingUnitPrice: unknown }).cuttingUnitPrice;
          const t = (r as { cuttingTotalCost: unknown }).cuttingTotalCost;
          map.set(orderId, {
            unit: u != null && String(u).trim() !== '' ? String(u) : null,
            total: t != null && String(t).trim() !== '' ? String(t) : null,
          });
        }
      }
    } catch {}
    return map;
  }

  private toDateTimeLocalString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (typeof v === 'string') {
      const s = v.slice(0, 19).replace('T', ' ');
      return s || null;
    }
    if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    const hh = String(v.getHours()).padStart(2, '0');
    const mm = String(v.getMinutes()).padStart(2, '0');
    const ss = String(v.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  private isDateTimeInRange(
    v: Date | string | null | undefined,
    start?: string,
    end?: string,
  ): boolean {
    const text = this.toDateTimeLocalString(v);
    if (!text) return false;
    if (start && text < `${start} 00:00:00`) return false;
    if (end && text > `${end} 23:59:59`) return false;
    return true;
  }

  private toDateOnlyLocalString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (typeof v === 'string') {
      const s = v.slice(0, 10);
      return s || null;
    }
    if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private sumActualCut(rows: ActualCutRow[] | null): number | null {
    if (!rows || rows.length === 0) return null;
    let sum = 0;
    for (const row of rows) {
      if (!Array.isArray(row.quantities)) continue;
      for (const q of row.quantities) {
        if (typeof q === 'number' && Number.isFinite(q)) sum += q;
      }
    }
    return sum;
  }

  private async buildCuttingRows(baseQuery: CuttingListQuery): Promise<CuttingListItem[]> {
    const { tab = 'all', orderNo, skuCode, completedStart, completedEnd } = baseQuery;
    const completedCutting = await this.cuttingRepo.find({ where: { status: 'completed' }, select: ['orderId'] });
    const completedOrderIds = completedCutting.map((c) => c.orderId);
    const completedIds = completedOrderIds.length > 0 ? completedOrderIds : [0];
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('(o.status = :pendingCutting OR o.id IN (:...completedIds))', {
        pendingCutting: 'pending_cutting',
        completedIds,
      });
    if (orderNo?.trim()) qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    if (skuCode?.trim()) qb.andWhere('o.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    qb.orderBy('o.order_date', 'DESC').addOrderBy('o.id', 'DESC');
    const orders = await qb.getMany();
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) return [];
    const [cuttings, actualFabricMap, v2Map] = await Promise.all([
      this.cuttingRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.fetchActualFabricMetersMap(orderIds),
      this.fetchCuttingV2Map(orderIds),
    ]);
    const cuttingMap = new Map(cuttings.map((c) => [c.orderId, c]));
    const slaCtx = await this.orderStatusConfigService.loadProductionSlaJudgeContext();
    const rows: CuttingListItem[] = [];
    for (const order of orders) {
      const cutting = cuttingMap.get(order.id);
      const cuttingStatus = (cutting?.status ?? 'pending').toLowerCase();
      if (tab === 'pending' && cuttingStatus === 'completed') continue;
      if (tab === 'completed' && cuttingStatus !== 'completed') continue;
      if ((completedStart || completedEnd) && !this.isDateTimeInRange(cutting?.completedAt, completedStart, completedEnd)) {
        continue;
      }
      const arrivedAt =
        this.toDateTimeLocalString(cutting?.arrivedAt) ??
        this.toDateTimeLocalString(cutting?.completedAt) ??
        (order.status === 'pending_cutting' ? this.toDateTimeLocalString(order.statusTime) : null);
      const completedAt = this.toDateTimeLocalString(cutting?.completedAt);
      let phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(cutting?.arrivedAt ?? null);
      if (!phaseStart && order.status === 'pending_cutting') phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(order.statusTime);
      const phaseEnd =
        cuttingStatus === 'completed' && cutting?.completedAt
          ? this.orderStatusConfigService.parseProductionPhaseInstant(cutting.completedAt)
          : null;
      const timeRating = this.orderStatusConfigService.judgeProductionPhaseDuration(
        'pending_cutting',
        phaseStart,
        phaseEnd,
        order.status ?? '',
        slaCtx,
      );
      const v2 = v2Map.get(order.id);
      const totalDisplay = v2?.total != null ? v2.total : cutting?.cuttingCost != null ? String(cutting.cuttingCost) : null;
      rows.push({
        orderId: order.id,
        orderNo: order.orderNo ?? '',
        customerName: order.customerName ?? '',
        salesperson: order.salesperson ?? '',
        merchandiser: order.merchandiser ?? '',
        customerDueDate: order.customerDueDate ? this.toDateOnlyLocalString(order.customerDueDate) : null,
        skuCode: order.skuCode ?? '',
        quantity: order.quantity ?? 0,
        imageUrl: order.imageUrl ?? '',
        arrivedAt,
        completedAt,
        cuttingStatus: cuttingStatus === 'completed' ? 'completed' : 'pending',
        actualCutTotal: this.sumActualCut(cutting?.actualCutRows ?? null),
        cuttingCost: totalDisplay,
        cuttingUnitPrice: v2?.unit ?? null,
        actualFabricMeters: actualFabricMap.get(order.id) ?? null,
        timeRating,
      });
    }
    return rows;
  }

  async getCuttingList(query: CuttingListQuery, actorUserId?: number): Promise<{
    list: CuttingListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    this.scheduleCuttingReconcile(actorUserId);
    const { page = 1, pageSize = 20 } = query;
    const rows = await this.buildCuttingRows(query);
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);
    return { list, total, page, pageSize };
  }

  async getCuttingExportRows(query: CuttingListQuery, actorUserId?: number): Promise<CuttingListItem[]> {
    this.scheduleCuttingReconcile(actorUserId);
    return this.buildCuttingRows(query);
  }
}
