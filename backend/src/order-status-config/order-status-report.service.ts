import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusSla } from '../entities/order-status-sla.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Order } from '../entities/order.entity';
import { OrderCostSnapshot } from '../entities/order-cost-snapshot.entity';
import { SystemOptionsService } from '../system-options/system-options.service';

export type ProductionSlaJudgeContext = {
  slaMap: Map<number, number>;
  statusByCode: Map<string, OrderStatus>;
};

@Injectable()
export class OrderStatusReportService {
  constructor(
    @InjectRepository(OrderStatus)
    private readonly statusRepo: Repository<OrderStatus>,
    @InjectRepository(OrderStatusSla)
    private readonly slaRepo: Repository<OrderStatusSla>,
    @InjectRepository(OrderStatusHistory)
    private readonly historyRepo: Repository<OrderStatusHistory>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderCostSnapshot)
    private readonly orderCostSnapshotRepo: Repository<OrderCostSnapshot>,
    private readonly systemOptionsService: SystemOptionsService,
  ) {}

  async getSlaReport(params: {
    startDate?: string;
    endDate?: string;
    statusId?: number;
    orderDateFrom?: string;
    orderDateTo?: string;
    completedFrom?: string;
    completedTo?: string;
    collaborationTypeId?: number;
    orderTypeId?: number;
    page?: number;
    pageSize?: number;
  }): Promise<{
    list: Array<{
      orderId: number;
      orderNo: string;
      skuCode: string;
      collaborationTypeId: number | null;
      collaborationTypeLabel: string;
      orderTypeId: number | null;
      orderTypeLabel: string;
      quantity: number;
      merchandiser: string;
      salesperson: string;
      customerName: string;
      orderDate: string | null;
      customerDueDate: string | null;
      reviewAt: string | null;
      reviewDurationHours: number | null;
      reviewJudge: string;
      purchaseArrivedAt: string | null;
      purchaseCompletedAt: string | null;
      purchaseJudge: string;
      patternArrivedAt: string | null;
      patternCompletedAt: string | null;
      patternJudge: string;
      cuttingArrivedAt: string | null;
      cuttingCompletedAt: string | null;
      cuttingJudge: string;
      craftArrivedAt: string | null;
      craftCompletedAt: string | null;
      craftJudge: string;
      sewingArrivedAt: string | null;
      sewingCompletedAt: string | null;
      sewingJudge: string;
      finishingArrivedAt: string | null;
      finishingCompletedAt: string | null;
      finishingJudge: string;
      completedAt: string | null;
      statusId: number;
      statusLabel: string;
      enteredAt: string;
      leftAt: string | null;
      durationHours: number;
      limitHours: number | null;
      isOverdue: boolean;
    }>;
    summary: { total: number; overdue: number };
  }> {
    const orderQb = this.orderRepo.createQueryBuilder('o');
    if (params.orderDateFrom) {
      orderQb.andWhere('o.order_date >= :orderDateFrom', { orderDateFrom: params.orderDateFrom });
    }
    if (params.orderDateTo) {
      orderQb.andWhere('o.order_date <= :orderDateTo', { orderDateTo: `${params.orderDateTo} 23:59:59` });
    }
    if (params.completedFrom) {
      orderQb.andWhere("o.status = 'completed' AND o.status_time >= :completedFrom", {
        completedFrom: params.completedFrom,
      });
    }
    if (params.completedTo) {
      orderQb.andWhere("o.status = 'completed' AND o.status_time <= :completedTo", {
        completedTo: `${params.completedTo} 23:59:59`,
      });
    }
    if (params.collaborationTypeId != null) {
      orderQb.andWhere('o.collaboration_type_id = :collaborationTypeId', {
        collaborationTypeId: params.collaborationTypeId,
      });
    }
    if (params.orderTypeId != null) {
      orderQb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId: params.orderTypeId });
    }
    const filteredOrders = await orderQb.getMany();
    const orderIds = filteredOrders.map((o) => o.id);
    const rows =
      orderIds.length > 0
        ? await this.historyRepo
            .createQueryBuilder('h')
            .innerJoinAndSelect('h.order', 'o')
            .innerJoinAndSelect('h.status', 's')
            .where('h.order_id IN (:...orderIds)', { orderIds })
            .orderBy('h.order_id', 'ASC')
            .addOrderBy('h.entered_at', 'ASC')
            .getMany()
        : [];
    const slaMap = new Map<number, number>();
    const slaRows = await this.slaRepo.find({ where: { enabled: true } });
    for (const r of slaRows) slaMap.set(r.orderStatusId, parseFloat(r.limitHours));

    const byOrder = new Map<number, OrderStatusHistory[]>();
    for (const r of rows) {
      const id = r.orderId;
      if (!byOrder.has(id)) byOrder.set(id, []);
      byOrder.get(id)!.push(r);
    }

    const list: Array<{
      orderId: number;
      orderNo: string;
      skuCode: string;
      collaborationTypeId: number | null;
      collaborationTypeLabel: string;
      orderTypeId: number | null;
      orderTypeLabel: string;
      quantity: number;
      merchandiser: string;
      salesperson: string;
      customerName: string;
      orderDate: string | null;
      customerDueDate: string | null;
      reviewAt: string | null;
      reviewDurationHours: number | null;
      reviewJudge: string;
      purchaseArrivedAt: string | null;
      purchaseCompletedAt: string | null;
      purchaseJudge: string;
      patternArrivedAt: string | null;
      patternCompletedAt: string | null;
      patternJudge: string;
      cuttingArrivedAt: string | null;
      cuttingCompletedAt: string | null;
      cuttingJudge: string;
      craftArrivedAt: string | null;
      craftCompletedAt: string | null;
      craftJudge: string;
      sewingArrivedAt: string | null;
      sewingCompletedAt: string | null;
      sewingJudge: string;
      finishingArrivedAt: string | null;
      finishingCompletedAt: string | null;
      finishingJudge: string;
      completedAt: string | null;
      statusId: number;
      statusLabel: string;
      enteredAt: string;
      leftAt: string | null;
      durationHours: number;
      limitHours: number | null;
      isOverdue: boolean;
    }> = [];
    const now = new Date();

    const collaborationIds = Array.from(
      new Set(filteredOrders.map((o) => o.collaborationTypeId).filter((v) => v != null) as number[]),
    );
    const orderTypeIds = Array.from(
      new Set(filteredOrders.map((o) => o.orderTypeId).filter((v) => v != null) as number[]),
    );
    const [collaborationLabels, orderTypeLabels] = await Promise.all([
      this.systemOptionsService.getOptionLabelsByIds('collaboration', collaborationIds),
      this.systemOptionsService.getOptionLabelsByIds('order_types', orderTypeIds),
    ]);
    const allStatuses = await this.statusRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
    const statusByCode = new Map(allStatuses.map((s) => [s.code, s]));
    for (const order of filteredOrders) {
      if (byOrder.has(order.id)) continue;
      const code = String(order.status ?? '').trim();
      const status = code ? statusByCode.get(code) : undefined;
      const enteredAt = order.statusTime ?? order.orderDate ?? order.createdAt;
      const synthetic = {
        orderId: order.id,
        statusId: status?.id ?? 0,
        enteredAt,
        order,
        status: status ?? null,
      } as unknown as OrderStatusHistory;
      byOrder.set(order.id, [synthetic]);
    }

    const getPhaseWindow = (
      histSorted: OrderStatusHistory[],
      phaseCode: string,
      orderCompletedAt: Date | null,
    ): { start: Date | null; end: Date | null } => {
      const timeline = histSorted
        .map((h) => ({
          code: String((h as { status?: { code?: string } })?.status?.code ?? '').trim(),
          enteredAt: h.enteredAt,
        }))
        .filter((x) => x.code.length > 0);
      const idx = timeline.findIndex((t) => t.code === phaseCode);
      if (idx < 0) return { start: null, end: null };
      const start = timeline[idx].enteredAt;
      if (idx + 1 < timeline.length) return { start, end: timeline[idx + 1].enteredAt };
      if (phaseCode === 'pending_finishing' && orderCompletedAt) return { start, end: orderCompletedAt };
      return { start, end: null };
    };

    for (const [, hist] of byOrder) {
      hist.sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());
      const latest = hist[hist.length - 1];
      if (!latest) continue;
      const order = (latest as { order?: Order }).order;
      const orderStatusCode = (order?.status ?? '').trim();
      const matchedByOrderStatus =
        orderStatusCode.length > 0
          ? [...hist]
              .reverse()
              .find((h) => String((h as { status?: { code?: string } })?.status?.code ?? '').trim() === orderStatusCode)
          : undefined;
      const currentSeg = matchedByOrderStatus ?? latest;
      const leftAt = now;
      const durationHours = (leftAt.getTime() - currentSeg.enteredAt.getTime()) / (1000 * 60 * 60);
      const statusFromOrder = orderStatusCode ? statusByCode.get(orderStatusCode) : undefined;
      const resolvedStatusId = statusFromOrder?.id ?? currentSeg.statusId;
      const resolvedStatusLabel = statusFromOrder?.label ?? String((currentSeg as { status?: { label?: string } })?.status?.label ?? '');
      const limitHours = slaMap.get(resolvedStatusId) ?? null;
      const isOverdue = limitHours != null && durationHours > limitHours;
      const collaborationTypeId = order?.collaborationTypeId ?? null;
      const orderTypeId = order?.orderTypeId ?? null;
      const completedAt = order?.status === 'completed' && order.statusTime ? order.statusTime.toISOString() : null;
      const orderCompletedAtDate = order?.status === 'completed' && order.statusTime ? order.statusTime : null;
      const toIso = (d: Date | null): string | null => (d ? d.toISOString() : null);
      const getJudge = (phaseCode: string, startAt: Date | null, endAt: Date | null): string => {
        if (!startAt) return '-';
        const phaseStatus = statusByCode.get(phaseCode);
        const limit = phaseStatus ? slaMap.get(phaseStatus.id) ?? null : null;
        if (endAt) {
          if (limit == null) return '未配置时限';
          const hours = (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60);
          return hours > limit ? '超期' : '未超期';
        }
        return orderStatusCode === phaseCode ? '进行中' : '-';
      };
      const reviewW = getPhaseWindow(hist, 'pending_review', orderCompletedAtDate);
      const reviewAtDate = reviewW.start;
      const reviewCompletedAtDate = reviewW.end;
      const reviewDurationHours =
        reviewAtDate && reviewCompletedAtDate
          ? Math.round(((reviewCompletedAtDate.getTime() - reviewAtDate.getTime()) / (1000 * 60 * 60)) * 100) / 100
          : null;
      const purchaseW = getPhaseWindow(hist, 'pending_purchase', orderCompletedAtDate);
      const patternW = getPhaseWindow(hist, 'pending_pattern', orderCompletedAtDate);
      const cuttingW = getPhaseWindow(hist, 'pending_cutting', orderCompletedAtDate);
      const craftW = getPhaseWindow(hist, 'pending_craft', orderCompletedAtDate);
      const sewingW = getPhaseWindow(hist, 'pending_sewing', orderCompletedAtDate);
      const finishingW = getPhaseWindow(hist, 'pending_finishing', orderCompletedAtDate);

      if (params.statusId != null && resolvedStatusId !== params.statusId) continue;
      if (params.startDate && currentSeg.enteredAt < new Date(params.startDate)) continue;
      if (params.endDate && currentSeg.enteredAt > new Date(`${params.endDate} 23:59:59`)) continue;

      list.push({
        orderId: currentSeg.orderId,
        orderNo: order?.orderNo ?? '',
        skuCode: order?.skuCode ?? '',
        collaborationTypeId,
        collaborationTypeLabel: collaborationTypeId != null ? collaborationLabels[collaborationTypeId] ?? '' : '',
        orderTypeId,
        orderTypeLabel: orderTypeId != null ? orderTypeLabels[orderTypeId] ?? '' : '',
        quantity: order?.quantity ?? 0,
        merchandiser: order?.merchandiser ?? '',
        salesperson: order?.salesperson ?? '',
        customerName: order?.customerName ?? '',
        orderDate: order?.orderDate ? order.orderDate.toISOString() : null,
        customerDueDate: order?.customerDueDate ? order.customerDueDate.toISOString() : null,
        reviewAt: toIso(reviewAtDate),
        reviewDurationHours,
        reviewJudge: getJudge('pending_review', reviewAtDate, reviewCompletedAtDate),
        purchaseArrivedAt: toIso(purchaseW.start),
        purchaseCompletedAt: toIso(purchaseW.end),
        purchaseJudge: getJudge('pending_purchase', purchaseW.start, purchaseW.end),
        patternArrivedAt: toIso(patternW.start),
        patternCompletedAt: toIso(patternW.end),
        patternJudge: getJudge('pending_pattern', patternW.start, patternW.end),
        cuttingArrivedAt: toIso(cuttingW.start),
        cuttingCompletedAt: toIso(cuttingW.end),
        cuttingJudge: getJudge('pending_cutting', cuttingW.start, cuttingW.end),
        craftArrivedAt: toIso(craftW.start),
        craftCompletedAt: toIso(craftW.end),
        craftJudge: getJudge('pending_craft', craftW.start, craftW.end),
        sewingArrivedAt: toIso(sewingW.start),
        sewingCompletedAt: toIso(sewingW.end),
        sewingJudge: getJudge('pending_sewing', sewingW.start, sewingW.end),
        finishingArrivedAt: toIso(finishingW.start),
        finishingCompletedAt: toIso(finishingW.end),
        finishingJudge: getJudge('pending_finishing', finishingW.start, finishingW.end),
        completedAt,
        statusId: resolvedStatusId,
        statusLabel: resolvedStatusLabel,
        enteredAt: currentSeg.enteredAt.toISOString(),
        leftAt: null,
        durationHours: Math.round(durationHours * 100) / 100,
        limitHours,
        isOverdue,
      });
    }

    list.sort((a, b) => (a.enteredAt < b.enteredAt ? 1 : -1));
    const summary = { total: list.length, overdue: list.filter((x) => x.isOverdue).length };
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const page = Math.max(1, params.page ?? 1);
    const start = (page - 1) * pageSize;
    return { list: list.slice(start, start + pageSize), summary };
  }

  async getProfitReport(params: {
    statusId?: number;
    orderDateFrom?: string;
    orderDateTo?: string;
    completedFrom?: string;
    completedTo?: string;
    collaborationTypeId?: number;
    orderTypeId?: number;
    page?: number;
    pageSize?: number;
  }): Promise<{
    list: Array<{
      orderId: number;
      orderNo: string;
      skuCode: string;
      collaborationTypeId: number | null;
      collaborationTypeLabel: string;
      orderTypeId: number | null;
      orderTypeLabel: string;
      shipmentQty: number;
      merchandiser: string;
      salesperson: string;
      customerName: string;
      salePrice: number;
      factoryPrice: number;
      materialCost: number;
      processCost: number;
      productionCost: number;
      unitProfit: number;
      factoryTotalProfit: number;
    }>;
    summary: { total: number };
  }> {
    const qb = this.orderRepo.createQueryBuilder('o');
    if (params.statusId != null) {
      const status = await this.statusRepo.findOne({ where: { id: params.statusId } });
      if (status?.code) qb.andWhere('o.status = :statusCode', { statusCode: status.code });
    }
    if (params.orderDateFrom) qb.andWhere('o.order_date >= :orderDateFrom', { orderDateFrom: params.orderDateFrom });
    if (params.orderDateTo) qb.andWhere('o.order_date <= :orderDateTo', { orderDateTo: `${params.orderDateTo} 23:59:59` });
    if (params.completedFrom) {
      qb.andWhere("o.status = 'completed' AND o.status_time >= :completedFrom", { completedFrom: params.completedFrom });
    }
    if (params.completedTo) {
      qb.andWhere("o.status = 'completed' AND o.status_time <= :completedTo", { completedTo: `${params.completedTo} 23:59:59` });
    }
    if (params.collaborationTypeId != null) {
      qb.andWhere('o.collaboration_type_id = :collaborationTypeId', { collaborationTypeId: params.collaborationTypeId });
    }
    if (params.orderTypeId != null) qb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId: params.orderTypeId });
    const orders = await qb.orderBy('o.order_date', 'DESC').addOrderBy('o.id', 'DESC').getMany();
    const orderIds = orders.map((o) => o.id);
    const snapshots =
      orderIds.length > 0 ? await this.orderCostSnapshotRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }) : [];
    const snapshotMap = new Map<number, Record<string, unknown> | null>();
    for (const row of snapshots) snapshotMap.set(row.orderId, (row.snapshot as Record<string, unknown> | null) ?? null);

    const collaborationIds = Array.from(
      new Set(orders.map((o) => o.collaborationTypeId).filter((v) => v != null) as number[]),
    );
    const orderTypeIds = Array.from(new Set(orders.map((o) => o.orderTypeId).filter((v) => v != null) as number[]));
    const [collaborationLabels, orderTypeLabels] = await Promise.all([
      this.systemOptionsService.getOptionLabelsByIds('collaboration', collaborationIds),
      this.systemOptionsService.getOptionLabelsByIds('order_types', orderTypeIds),
    ]);

    const toNum = (v: unknown): number => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const round2 = (n: number): number => Math.round(n * 100) / 100;
    const calcCosts = (
      snapshot: Record<string, unknown> | null,
    ): { material: number; process: number; production: number } => {
      if (!snapshot || typeof snapshot !== 'object') return { material: 0, process: 0, production: 0 };
      const materialRows = Array.isArray(snapshot.materialRows)
        ? (snapshot.materialRows as Array<Record<string, unknown>>)
        : [];
      const processRows = Array.isArray(snapshot.processItemRows)
        ? (snapshot.processItemRows as Array<Record<string, unknown>>)
        : [];
      const productionRows = Array.isArray(snapshot.productionRows)
        ? (snapshot.productionRows as Array<Record<string, unknown>>)
        : [];
      const material = materialRows.reduce((sum, row) => {
        const includeInCost = row?.includeInCost !== false;
        if (!includeInCost) return sum;
        const usage = toNum(row?.usagePerPiece);
        const loss = toNum(row?.lossPercent);
        const unitPrice = toNum(row?.unitPrice);
        return sum + usage * (1 + loss / 100) * unitPrice;
      }, 0);
      const process = processRows.reduce((sum, row) => sum + toNum(row?.quantity) * toNum(row?.unitPrice), 0);
      const production = productionRows.reduce((sum, row) => {
        const unit = toNum(row?.unitPrice);
        const rawQty = row?.quantity;
        const q = rawQty === undefined || rawQty === null ? 1 : toNum(rawQty);
        const qty = Number.isFinite(q) && q >= 0 ? q : 1;
        return sum + unit * qty;
      }, 0);
      return { material: round2(material), process: round2(process), production: round2(production) };
    };

    const list = orders.map((o) => {
      const shipmentQty = o.quantity ?? 0;
      const salePrice = toNum(o.salePrice);
      const factoryPrice = toNum(o.exFactoryPrice);
      const costs = calcCosts(snapshotMap.get(o.id) ?? null);
      const totalCost = costs.material + costs.process + costs.production;
      const unitProfit = round2(factoryPrice - totalCost);
      const factoryTotalProfit = round2(unitProfit * shipmentQty);
      const collaborationTypeId = o.collaborationTypeId ?? null;
      const orderTypeId = o.orderTypeId ?? null;
      return {
        orderId: o.id,
        orderNo: o.orderNo ?? '',
        skuCode: o.skuCode ?? '',
        collaborationTypeId,
        collaborationTypeLabel: collaborationTypeId != null ? collaborationLabels[collaborationTypeId] ?? '' : '',
        orderTypeId,
        orderTypeLabel: orderTypeId != null ? orderTypeLabels[orderTypeId] ?? '' : '',
        shipmentQty,
        merchandiser: o.merchandiser ?? '',
        salesperson: o.salesperson ?? '',
        customerName: o.customerName ?? '',
        salePrice: round2(salePrice),
        factoryPrice: round2(factoryPrice),
        materialCost: costs.material,
        processCost: costs.process,
        productionCost: costs.production,
        unitProfit,
        factoryTotalProfit,
      };
    });

    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const page = Math.max(1, params.page ?? 1);
    const start = (page - 1) * pageSize;
    return { list: list.slice(start, start + pageSize), summary: { total: list.length } };
  }

  async loadProductionSlaJudgeContext(): Promise<ProductionSlaJudgeContext> {
    const slaRows = await this.slaRepo.find({ where: { enabled: true } });
    const slaMap = new Map<number, number>();
    for (const r of slaRows) {
      const n = parseFloat(String(r.limitHours));
      if (Number.isFinite(n)) slaMap.set(r.orderStatusId, n);
    }
    const allStatuses = await this.statusRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
    const statusByCode = new Map(allStatuses.map((s) => [s.code, s]));
    return { slaMap, statusByCode };
  }

  parseProductionPhaseInstant(value: Date | string | null | undefined): Date | null {
    if (value == null) return null;
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    const s = String(value).trim();
    if (!s || s === '-') return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const d = new Date(`${s}T00:00:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const normalized = s.includes('T') ? s : s.replace(' ', 'T');
    const d = new Date(normalized);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  judgeProductionPhaseDuration(
    phaseCode: string,
    startAt: Date | null,
    endAt: Date | null,
    orderStatusCode: string,
    ctx: ProductionSlaJudgeContext,
  ): string {
    if (!startAt) return '-';
    const code = (phaseCode ?? '').trim();
    const phaseStatus = ctx.statusByCode.get(code);
    const limit = phaseStatus != null ? ctx.slaMap.get(phaseStatus.id) ?? null : null;
    if (endAt) {
      if (limit == null) return '未配置时限';
      const hours = (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60);
      return hours > limit ? '超期' : '未超期';
    }
    const cur = (orderStatusCode ?? '').trim();
    return cur === code ? '进行中' : '-';
  }
}
