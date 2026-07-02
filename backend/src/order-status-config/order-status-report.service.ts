import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusSla } from '../entities/order-status-sla.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { OrderStatusTransition } from '../entities/order-status-transition.entity';
import { Order } from '../entities/order.entity';
import { OrderCostSnapshot } from '../entities/order-cost-snapshot.entity';
import { OrderCutting } from '../entities/order-cutting.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { OrderFinishing } from '../entities/order-finishing.entity';
import { OrderCraft } from '../entities/order-craft.entity';
import { OrderPattern } from '../entities/order-pattern.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';
import { OrderOperationLog } from '../entities/order-operation-log.entity';
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
    @InjectRepository(OrderStatusTransition)
    private readonly transitionRepo: Repository<OrderStatusTransition>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderCostSnapshot)
    private readonly orderCostSnapshotRepo: Repository<OrderCostSnapshot>,
    @InjectRepository(OrderCutting)
    private readonly orderCuttingRepo: Repository<OrderCutting>,
    @InjectRepository(OrderSewing)
    private readonly orderSewingRepo: Repository<OrderSewing>,
    @InjectRepository(OrderFinishing)
    private readonly orderFinishingRepo: Repository<OrderFinishing>,
    @InjectRepository(OrderCraft)
    private readonly orderCraftRepo: Repository<OrderCraft>,
    @InjectRepository(OrderPattern)
    private readonly orderPatternRepo: Repository<OrderPattern>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(OrderOperationLog)
    private readonly orderOperationLogRepo: Repository<OrderOperationLog>,
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
    orderNo?: string;
    skuCode?: string;
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
      durationDays: number | null;
      isOverdue: boolean;
    }>;
    summary: { total: number; overdue: number };
  }> {
    const orderQb = this.orderRepo.createQueryBuilder('o').where('o.deleted_at IS NULL');
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
    const orderNoKw = params.orderNo?.trim();
    if (orderNoKw) {
      orderQb.andWhere('o.order_no LIKE :orderNoKw', { orderNoKw: `%${orderNoKw}%` });
    }
    const skuCodeKw = params.skuCode?.trim();
    if (skuCodeKw) {
      orderQb.andWhere('o.sku_code LIKE :skuCodeKw', { skuCodeKw: `%${skuCodeKw}%` });
    }
    const filteredOrders = await orderQb.getMany();
    const orderIds = filteredOrders.map((o) => o.id);

    // ===== 数据加载：与各生产页面保持同源 =====
    // - 审单：order_operation_logs（action='submit'/'review'） + orders.createdAt 兜底
    // - 采购：order_status_history (pending_purchase) + orders.statusTime 兜底（同 production-purchase-query.service.ts:94-117）
    //   + order_ext.materials[].purchaseCompletedAt 取 max（同生产采购页第 170 行）
    // - 纸样/裁床/工艺/车缝/尾部：直接读 order_pattern / order_cutting / order_craft / order_sewing / order_finishing 实体表
    //   （与 production-pattern/cutting-list/craft/sewing/finishing-query.service.ts 同源）
    const slaRows = await this.slaRepo.find({ where: { enabled: true } });
    const slaMap = new Map<number, number>();
    for (const r of slaRows) slaMap.set(r.orderStatusId, parseFloat(r.limitHours));
    const allStatuses = await this.statusRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
    const statusByCode = new Map(allStatuses.map((s) => [s.code, s]));

    const collaborationIds = Array.from(
      new Set(filteredOrders.map((o) => o.collaborationTypeId).filter((v) => v != null) as number[]),
    );
    const orderTypeIds = Array.from(
      new Set(filteredOrders.map((o) => o.orderTypeId).filter((v) => v != null) as number[]),
    );

    type EntityMap<T> = Map<number, T>;
    const emptyMap = <T>(): EntityMap<T> => new Map<number, T>();

    const [
      collaborationLabels,
      orderTypeLabels,
      cuttings,
      sewings,
      finishings,
      crafts,
      patterns,
      exts,
      opLogs,
      historyRowsForReviewAndPurchase,
      craftTransitions,
    ] = await Promise.all([
      this.systemOptionsService.getOptionLabelsByIds('collaboration', collaborationIds),
      this.systemOptionsService.getOptionLabelsByIds('order_types', orderTypeIds),
      orderIds.length > 0 ? this.orderCuttingRepo.find({ where: { orderId: In(orderIds) } }) : Promise.resolve([] as OrderCutting[]),
      orderIds.length > 0 ? this.orderSewingRepo.find({ where: { orderId: In(orderIds) } }) : Promise.resolve([] as OrderSewing[]),
      orderIds.length > 0 ? this.orderFinishingRepo.find({ where: { orderId: In(orderIds) } }) : Promise.resolve([] as OrderFinishing[]),
      orderIds.length > 0 ? this.orderCraftRepo.find({ where: { orderId: In(orderIds) } }) : Promise.resolve([] as OrderCraft[]),
      orderIds.length > 0 ? this.orderPatternRepo.find({ where: { orderId: In(orderIds) } }) : Promise.resolve([] as OrderPattern[]),
      orderIds.length > 0 ? this.orderExtRepo.find({ where: { orderId: In(orderIds) } }) : Promise.resolve([] as OrderExt[]),
      orderIds.length > 0
        ? this.orderOperationLogRepo.find({
            where: { orderId: In(orderIds), action: In(['submit', 'review', 'create']) },
            order: { createdAt: 'ASC' },
          })
        : Promise.resolve([] as OrderOperationLog[]),
      orderIds.length > 0
        ? this.historyRepo
            .createQueryBuilder('h')
            .innerJoinAndSelect('h.status', 's')
            .where('h.order_id IN (:...orderIds)', { orderIds })
            .orderBy('h.order_id', 'ASC')
            .addOrderBy('h.entered_at', 'ASC')
            .getMany()
        : Promise.resolve([] as OrderStatusHistory[]),
      this.transitionRepo.find({ where: { triggerCode: 'craft_completed', enabled: true } }),
    ]);

    const cuttingByOrder: EntityMap<OrderCutting> = emptyMap();
    for (const r of cuttings) cuttingByOrder.set(r.orderId, r);
    const sewingByOrder: EntityMap<OrderSewing> = emptyMap();
    for (const r of sewings) sewingByOrder.set(r.orderId, r);
    const finishingByOrder: EntityMap<OrderFinishing> = emptyMap();
    for (const r of finishings) finishingByOrder.set(r.orderId, r);
    const craftByOrder: EntityMap<OrderCraft> = emptyMap();
    for (const r of crafts) craftByOrder.set(r.orderId, r);
    const patternByOrder: EntityMap<OrderPattern> = emptyMap();
    for (const r of patterns) patternByOrder.set(r.orderId, r);
    const extByOrder: EntityMap<OrderExt> = emptyMap();
    for (const r of exts) extByOrder.set(r.orderId, r);

    const submitFirstByOrder = new Map<number, Date>();
    const reviewLastByOrder = new Map<number, Date>();
    for (const log of opLogs) {
      if (log.action === 'submit' && !submitFirstByOrder.has(log.orderId)) {
        submitFirstByOrder.set(log.orderId, log.createdAt);
      } else if (log.action === 'review') {
        reviewLastByOrder.set(log.orderId, log.createdAt); // 顺序按 createdAt ASC，覆盖式保留最后一条
      }
    }

    // 工艺阶段状态码集合：标准 pending_craft + 工作流链路里所有 trigger='craft_completed' 的 fromStatus
    const craftPhaseCodes = new Set<string>(['pending_craft']);
    for (const t of craftTransitions) {
      if (t.fromStatus) craftPhaseCodes.add(t.fromStatus);
    }

    // 状态历史按订单分组：用于审单/采购阶段的进入时间查询
    const historyByOrder = new Map<number, OrderStatusHistory[]>();
    for (const r of historyRowsForReviewAndPurchase) {
      if (!historyByOrder.has(r.orderId)) historyByOrder.set(r.orderId, []);
      historyByOrder.get(r.orderId)!.push(r);
    }
    const findFirstHistoryEnteredAt = (orderId: number, phaseCode: string): Date | null => {
      const list = historyByOrder.get(orderId);
      if (!list) return null;
      for (const h of list) {
        const code = String((h as { status?: { code?: string } })?.status?.code ?? '').trim();
        if (code === phaseCode) return h.enteredAt;
      }
      return null;
    };
    const findEnteredAtAfterPhase = (orderId: number, phaseCode: string): Date | null => {
      const list = historyByOrder.get(orderId);
      if (!list) return null;
      let foundPhase = false;
      for (const h of list) {
        const code = String((h as { status?: { code?: string } })?.status?.code ?? '').trim();
        if (foundPhase) return h.enteredAt;
        if (code === phaseCode) foundPhase = true;
      }
      return null;
    };

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
      durationDays: number | null;
      isOverdue: boolean;
    }> = [];
    const now = new Date();
    const toIso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);
    const limitByPhaseCode = (phaseCode: string): number | null => {
      const phaseStatus = statusByCode.get(phaseCode);
      return phaseStatus ? slaMap.get(phaseStatus.id) ?? null : null;
    };
    const judge = (limit: number | null, startAt: Date | null, endAt: Date | null, isCurrent: boolean): string => {
      if (!startAt) return '-';
      if (endAt) {
        if (limit == null) return '未配置时限';
        const hours = (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60);
        return hours > limit ? '超期' : '未超期';
      }
      return isCurrent ? '进行中' : '-';
    };

    for (const order of filteredOrders) {
      const orderStatusCode = (order.status ?? '').trim();
      const enteredAt = order.statusTime ?? order.orderDate ?? order.createdAt;
      const statusFromOrder = orderStatusCode ? statusByCode.get(orderStatusCode) : undefined;
      const resolvedStatusId = statusFromOrder?.id ?? 0;
      const resolvedStatusLabel = statusFromOrder?.label ?? '';
      const collaborationTypeId = order.collaborationTypeId ?? null;
      const orderTypeId = order.orderTypeId ?? null;
      const isCompleted = order.status === 'completed' && !!order.statusTime;
      const completedAt = isCompleted ? order.statusTime : null;
      const completedAtIso = completedAt ? completedAt.toISOString() : null;
      const orderStart = order.orderDate ?? order.createdAt;
      const durationDays =
        isCompleted && orderStart && completedAt
          ? Math.round(((completedAt.getTime() - orderStart.getTime()) / (1000 * 60 * 60 * 24)) * 10) / 10
          : null;
      const dueDate = order.customerDueDate;
      let isOverdue = false;
      if (dueDate) {
        if (isCompleted && completedAt) {
          isOverdue = completedAt.getTime() > dueDate.getTime();
        } else if (!isCompleted) {
          isOverdue = now.getTime() > dueDate.getTime();
        }
      }

      // —— 审单 ——
      const reviewStart =
        findFirstHistoryEnteredAt(order.id, 'pending_review') ??
        submitFirstByOrder.get(order.id) ??
        order.createdAt ?? null;
      const reviewEnd =
        findEnteredAtAfterPhase(order.id, 'pending_review') ??
        reviewLastByOrder.get(order.id) ??
        null;
      const reviewDurationHours =
        reviewStart && reviewEnd
          ? Math.round(((reviewEnd.getTime() - reviewStart.getTime()) / (1000 * 60 * 60)) * 100) / 100
          : null;

      // —— 采购 —— （同生产采购页的取数逻辑）
      const purchaseHistoryEnteredAt = findFirstHistoryEnteredAt(order.id, 'pending_purchase');
      const purchaseStart =
        purchaseHistoryEnteredAt ??
        (orderStatusCode === 'pending_purchase' && order.statusTime ? order.statusTime : null);
      const ext = extByOrder.get(order.id);
      const materials: OrderMaterialRow[] = Array.isArray(ext?.materials) ? ext!.materials! : [];
      let purchaseEnd: Date | null = null;
      for (const m of materials) {
        const raw = m?.purchaseCompletedAt;
        if (raw) {
          const d = new Date(raw);
          if (!Number.isNaN(d.getTime()) && (!purchaseEnd || d > purchaseEnd)) purchaseEnd = d;
        }
      }
      if (!purchaseEnd) purchaseEnd = findEnteredAtAfterPhase(order.id, 'pending_purchase');

      // —— 各生产环节：直接读对应实体表，逻辑与生产页一致 ——
      // 纸样实体表没有 arrivedAt 字段，到达时间从 order_status_history 找 pending_pattern 的最早进入时间，
      // 兜底用 order.statusTime（当前正处于 pending_pattern 时）；与 production-pattern.service.ts:413-416 同源。
      const pattern = patternByOrder.get(order.id);
      const patternHistoryEnteredAt = findFirstHistoryEnteredAt(order.id, 'pending_pattern');
      const patternStart =
        patternHistoryEnteredAt ??
        (orderStatusCode === 'pending_pattern' && order.statusTime ? order.statusTime : null);
      const patternEnd = pattern?.completedAt ?? null;
      const patternIsCurrent =
        orderStatusCode === 'pending_pattern' ||
        (!!pattern && (pattern.status === 'pending_assign' || pattern.status === 'in_progress'));

      const cutting = cuttingByOrder.get(order.id);
      const cuttingStart =
        cutting?.arrivedAt ?? (orderStatusCode === 'pending_cutting' && order.statusTime ? order.statusTime : null);
      const cuttingEnd = cutting?.completedAt ?? null;
      const cuttingIsCurrent =
        orderStatusCode === 'pending_cutting' ||
        (!!cutting && cutting.status === 'pending' && !!cutting.arrivedAt && !cutting.completedAt);

      const craft = craftByOrder.get(order.id);
      const craftStart =
        craft?.arrivedAtCraft ??
        (craftPhaseCodes.has(orderStatusCode) && order.statusTime ? order.statusTime : null);
      const craftEnd = craft?.completedAt ?? null;
      const craftIsCurrent =
        craftPhaseCodes.has(orderStatusCode) ||
        (!!craft && craft.status === 'pending' && !!craft.arrivedAtCraft && !craft.completedAt);

      const sewing = sewingByOrder.get(order.id);
      const sewingStart =
        sewing?.arrivedAt ?? (orderStatusCode === 'pending_sewing' && order.statusTime ? order.statusTime : null);
      const sewingEnd = sewing?.completedAt ?? null;
      const sewingIsCurrent =
        orderStatusCode === 'pending_sewing' ||
        (!!sewing && sewing.status === 'pending' && !!sewing.arrivedAt && !sewing.completedAt);

      const finishing = finishingByOrder.get(order.id);
      const finishingStart =
        finishing?.arrivedAt ??
        (orderStatusCode === 'pending_finishing' && order.statusTime ? order.statusTime : null);
      const finishingEnd = finishing?.completedAt ?? null;
      const finishingIsCurrent =
        orderStatusCode === 'pending_finishing' ||
        (!!finishing && !!finishing.arrivedAt && !finishing.completedAt && finishing.status !== 'inbound');

      // 跳过 status 不匹配 / 进入时间不在筛选范围内的订单
      if (params.statusId != null && resolvedStatusId !== params.statusId) continue;
      if (params.startDate && enteredAt < new Date(params.startDate)) continue;
      if (params.endDate && enteredAt > new Date(`${params.endDate} 23:59:59`)) continue;

      list.push({
        orderId: order.id,
        orderNo: order.orderNo ?? '',
        skuCode: order.skuCode ?? '',
        collaborationTypeId,
        collaborationTypeLabel: collaborationTypeId != null ? collaborationLabels[collaborationTypeId] ?? '' : '',
        orderTypeId,
        orderTypeLabel: orderTypeId != null ? orderTypeLabels[orderTypeId] ?? '' : '',
        quantity: order.quantity ?? 0,
        merchandiser: order.merchandiser ?? '',
        salesperson: order.salesperson ?? '',
        customerName: order.customerName ?? '',
        orderDate: order.orderDate ? order.orderDate.toISOString() : null,
        customerDueDate: order.customerDueDate ? order.customerDueDate.toISOString() : null,
        reviewAt: toIso(reviewStart),
        reviewDurationHours,
        reviewJudge: judge(limitByPhaseCode('pending_review'), reviewStart, reviewEnd, orderStatusCode === 'pending_review'),
        purchaseArrivedAt: toIso(purchaseStart),
        purchaseCompletedAt: toIso(purchaseEnd),
        purchaseJudge: judge(limitByPhaseCode('pending_purchase'), purchaseStart, purchaseEnd, orderStatusCode === 'pending_purchase'),
        patternArrivedAt: toIso(patternStart),
        patternCompletedAt: toIso(patternEnd),
        patternJudge: judge(limitByPhaseCode('pending_pattern'), patternStart, patternEnd, patternIsCurrent),
        cuttingArrivedAt: toIso(cuttingStart),
        cuttingCompletedAt: toIso(cuttingEnd),
        cuttingJudge: judge(limitByPhaseCode('pending_cutting'), cuttingStart, cuttingEnd, cuttingIsCurrent),
        craftArrivedAt: toIso(craftStart),
        craftCompletedAt: toIso(craftEnd),
        craftJudge: judge(limitByPhaseCode('pending_craft'), craftStart, craftEnd, craftIsCurrent),
        sewingArrivedAt: toIso(sewingStart),
        sewingCompletedAt: toIso(sewingEnd),
        sewingJudge: judge(limitByPhaseCode('pending_sewing'), sewingStart, sewingEnd, sewingIsCurrent),
        finishingArrivedAt: toIso(finishingStart),
        finishingCompletedAt: toIso(finishingEnd),
        finishingJudge: judge(limitByPhaseCode('pending_finishing'), finishingStart, finishingEnd, finishingIsCurrent),
        completedAt: completedAtIso,
        statusId: resolvedStatusId,
        statusLabel: resolvedStatusLabel,
        enteredAt: enteredAt.toISOString(),
        leftAt: null,
        durationDays,
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
    orderNo?: string;
    skuCode?: string;
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
    summary: { total: number; shipmentQtyTotal: number; factoryTotalProfit: number };
  }> {
    const qb = this.orderRepo.createQueryBuilder('o').where('o.deleted_at IS NULL');
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
    const orderNoKw = params.orderNo?.trim();
    if (orderNoKw) qb.andWhere('o.order_no LIKE :orderNoKw', { orderNoKw: `%${orderNoKw}%` });
    const skuCodeKw = params.skuCode?.trim();
    if (skuCodeKw) qb.andWhere('o.sku_code LIKE :skuCodeKw', { skuCodeKw: `%${skuCodeKw}%` });
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
      const productionBase = productionRows.reduce((sum, row) => {
        const unit = toNum(row?.unitPrice);
        const rawQty = row?.quantity;
        const q = rawQty === undefined || rawQty === null ? 1 : toNum(rawQty);
        const qty = Number.isFinite(q) && q >= 0 ? q : 1;
        return sum + unit * qty;
      }, 0);
      const multiplierRaw = snapshot.productionCostMultiplier;
      const multiplier =
        typeof multiplierRaw === 'number' && Number.isFinite(multiplierRaw) && multiplierRaw >= 0
          ? multiplierRaw
          : 2;
      const production = productionBase * multiplier;
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

    const summary = {
      total: list.length,
      shipmentQtyTotal: round2(list.reduce((sum, row) => sum + row.shipmentQty, 0)),
      factoryTotalProfit: round2(list.reduce((sum, row) => sum + row.factoryTotalProfit, 0)),
    };
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));
    const page = Math.max(1, params.page ?? 1);
    const start = (page - 1) * pageSize;
    return { list: list.slice(start, start + pageSize), summary };
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
