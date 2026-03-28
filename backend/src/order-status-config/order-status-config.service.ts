import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusTransition } from '../entities/order-status-transition.entity';
import { OrderWorkflowChain } from '../entities/order-workflow-chain.entity';
import { OrderStatusSla } from '../entities/order-status-sla.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Order } from '../entities/order.entity';
import { OrderCostSnapshot } from '../entities/order-cost-snapshot.entity';
import { SystemOptionsService } from '../system-options/system-options.service';

/** 生产列表时效判定：单次列表请求内复用 SLA 与状态 code → 实体映射 */
export type ProductionSlaJudgeContext = {
  slaMap: Map<number, number>;
  statusByCode: Map<string, OrderStatus>;
};

@Injectable()
export class OrderStatusConfigService {
  constructor(
    @InjectRepository(OrderStatus)
    private readonly statusRepo: Repository<OrderStatus>,
    @InjectRepository(OrderStatusTransition)
    private readonly transitionRepo: Repository<OrderStatusTransition>,
    @InjectRepository(OrderWorkflowChain)
    private readonly chainRepo: Repository<OrderWorkflowChain>,
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

  /** 由于项目默认不启用 migrations/synchronize，需兼容数据库尚未加列的情况 */
  private chainSortOrderSupport: boolean | null = null;

  private async supportsChainSortOrder(): Promise<boolean> {
    if (this.chainSortOrderSupport !== null) return this.chainSortOrderSupport;
    try {
      const rows = (await this.chainRepo.query(
        `
        SELECT COUNT(*) AS cnt
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'order_workflow_chains'
          AND COLUMN_NAME = 'sort_order'
        `,
      )) as Array<{ cnt: number | string }>;
      const cnt = Number(rows?.[0]?.cnt ?? 0);
      this.chainSortOrderSupport = cnt > 0;
    } catch {
      this.chainSortOrderSupport = false;
    }
    return this.chainSortOrderSupport;
  }

  async getAllStatuses(): Promise<OrderStatus[]> {
    return this.statusRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async createStatus(payload: Partial<OrderStatus>): Promise<OrderStatus> {
    const rawCode = payload.code?.trim();
    const rawLabel = payload.label?.trim() ?? '';
    const predefinedMap: Record<string, string> = {
      草稿: 'draft',
      待审单: 'pending_review',
      待纸样: 'pending_pattern',
      待采购: 'pending_purchase',
      待工艺: 'pending_craft',
      待裁床: 'pending_cutting',
      待车缝: 'pending_sewing',
      待尾部: 'pending_finishing',
      订单完成: 'completed',
    };
    const mappedCode = predefinedMap[rawLabel];
    const code = rawCode && rawCode.length > 0 ? rawCode : mappedCode || `status_${Date.now()}`;
    const entity = this.statusRepo.create({
      code,
      label: rawLabel,
      sortOrder: payload.sortOrder ?? 0,
      groupKey: payload.groupKey?.trim() || null,
      isFinal: Boolean(payload.isFinal),
      enabled: payload.enabled ?? true,
    });
    return this.statusRepo.save(entity);
  }

  async updateStatus(id: number, payload: Partial<OrderStatus>): Promise<OrderStatus> {
    const status = await this.statusRepo.findOne({ where: { id } });
    if (!status) throw new NotFoundException('状态不存在');
    if (payload.code !== undefined) status.code = payload.code.trim();
    if (payload.label !== undefined) status.label = payload.label.trim();
    if (payload.sortOrder !== undefined) status.sortOrder = payload.sortOrder;
    if (payload.groupKey !== undefined) status.groupKey = payload.groupKey?.trim() || null;
    if (payload.isFinal !== undefined) status.isFinal = Boolean(payload.isFinal);
    if (payload.enabled !== undefined) status.enabled = Boolean(payload.enabled);
    return this.statusRepo.save(status);
  }

  /**
   * 仅切换启用状态（给列表开关使用），避免布尔序列化差异导致保存失败。
   */
  async toggleStatusEnabled(id: number): Promise<OrderStatus> {
    const status = await this.statusRepo.findOne({ where: { id } });
    if (!status) throw new NotFoundException('状态不存在');
    status.enabled = !status.enabled;
    return this.statusRepo.save(status);
  }

  async deleteStatus(id: number): Promise<void> {
    await this.statusRepo.delete(id);
  }

  async getTransitions(fromStatus?: string): Promise<OrderStatusTransition[]> {
    const where = fromStatus?.trim() ? { fromStatus: fromStatus.trim() } : {};
    return this.transitionRepo.find({
      where,
      order: { fromStatus: 'ASC', triggerCode: 'ASC', id: 'ASC' },
    });
  }

  async createTransition(payload: Partial<OrderStatusTransition>): Promise<OrderStatusTransition> {
    const entity = this.transitionRepo.create({
      fromStatus: payload.fromStatus?.trim() ?? '',
      toStatus: payload.toStatus?.trim() ?? '',
      triggerType: payload.triggerType?.trim() ?? 'button',
      triggerCode: payload.triggerCode?.trim() ?? '',
      conditionsJson: payload.conditionsJson ?? null,
      nextDepartment: payload.nextDepartment?.trim() || null,
      allowRoles: payload.allowRoles?.trim() || null,
      enabled: payload.enabled ?? true,
    });
    return this.transitionRepo.save(entity);
  }

  async updateTransition(id: number, payload: Partial<OrderStatusTransition>): Promise<OrderStatusTransition> {
    const rule = await this.transitionRepo.findOne({ where: { id } });
    if (!rule) throw new NotFoundException('流转规则不存在');
    if (payload.fromStatus !== undefined) rule.fromStatus = payload.fromStatus.trim();
    if (payload.toStatus !== undefined) rule.toStatus = payload.toStatus.trim();
    if (payload.triggerType !== undefined) rule.triggerType = payload.triggerType.trim();
    if (payload.triggerCode !== undefined) rule.triggerCode = payload.triggerCode.trim();
    if (payload.conditionsJson !== undefined) rule.conditionsJson = payload.conditionsJson;
    if (payload.nextDepartment !== undefined) rule.nextDepartment = payload.nextDepartment?.trim() || null;
    if (payload.allowRoles !== undefined) rule.allowRoles = payload.allowRoles?.trim() || null;
    if (payload.enabled !== undefined) rule.enabled = Boolean(payload.enabled);
    return this.transitionRepo.save(rule);
  }

  async deleteTransition(id: number): Promise<void> {
    await this.transitionRepo.delete(id);
  }

  /** 批量创建流转规则（一条链路多步），共用 conditionsJson 时写入每条规则 */
  async createTransitionsBatch(
    steps: Array<Partial<OrderStatusTransition>>,
    conditionsJson?: unknown,
    name?: string,
  ): Promise<{ chain: OrderWorkflowChain; steps: OrderStatusTransition[] }> {
    const chainName = (name ?? '').trim() || `流程链路-${new Date().toISOString().slice(0, 10)}`;
    const canSort = await this.supportsChainSortOrder();
    let nextSortOrder: number | undefined;
    if (canSort) {
      const max = await this.chainRepo
        .createQueryBuilder('c')
        .select('MAX(c.sortOrder)', 'max')
        .getRawOne<{ max: string | null }>();
      nextSortOrder = (max?.max ? Number(max.max) : 0) + 1;
    }
    const chain = await this.chainRepo.save(
      this.chainRepo.create({
        name: chainName,
        conditionsJson: conditionsJson ?? null,
        enabled: true,
        ...(nextSortOrder != null ? { sortOrder: nextSortOrder } : {}),
      }),
    );

    const created: OrderStatusTransition[] = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const entity = this.transitionRepo.create({
        chainId: chain.id,
        stepOrder: i + 1,
        fromStatus: step.fromStatus?.trim() ?? '',
        toStatus: step.toStatus?.trim() ?? '',
        triggerType: step.triggerType?.trim() ?? 'button',
        triggerCode: step.triggerCode?.trim() ?? '',
        conditionsJson: conditionsJson ?? step.conditionsJson ?? null,
        nextDepartment: step.nextDepartment?.trim() || null,
        allowRoles: step.allowRoles?.trim() || null,
        enabled: step.enabled ?? true,
      });
      created.push(await this.transitionRepo.save(entity));
    }
    return { chain, steps: created };
  }

  async getChains(): Promise<Array<{ chain: OrderWorkflowChain; steps: OrderStatusTransition[] }>> {
    const canSort = await this.supportsChainSortOrder();
    const chains = canSort
      ? await this.chainRepo.find({ order: { sortOrder: 'ASC', id: 'DESC' } })
      : await this.chainRepo
          .createQueryBuilder('c')
          .select(['c.id', 'c.name', 'c.conditionsJson', 'c.enabled', 'c.createdAt'])
          .orderBy('c.id', 'DESC')
          .getMany();
    if (chains.length === 0) return [];
    const chainIds = chains.map((c) => c.id);
    const steps = await this.transitionRepo.find({
      where: chainIds.map((id) => ({ chainId: id })),
      order: { chainId: 'ASC', stepOrder: 'ASC', id: 'ASC' },
    });
    const byChain = new Map<number, OrderStatusTransition[]>();
    for (const s of steps) {
      const key = s.chainId ?? 0;
      if (!byChain.has(key)) byChain.set(key, []);
      byChain.get(key)!.push(s);
    }
    return chains.map((c) => ({ chain: c, steps: byChain.get(c.id) ?? [] }));
  }

  async reorderChains(orderedIds: number[]): Promise<{ success: true }> {
    const canSort = await this.supportsChainSortOrder();
    if (!canSort) {
      // 数据库未加 sort_order 列时，降级为 no-op，避免前端页面报错
      return { success: true };
    }
    const ids = (orderedIds ?? []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
    if (ids.length === 0) return { success: true };
    const unique = Array.from(new Set(ids));

    // 仅更新当前传入的链路排序：从 1 开始递增
    await Promise.all(
      unique.map((id, idx) => this.chainRepo.update({ id }, { sortOrder: idx + 1 })),
    );
    return { success: true };
  }

  async updateChain(
    chainId: number,
    payload: { name?: string; conditionsJson?: unknown; enabled?: boolean; steps?: Array<Partial<OrderStatusTransition>> },
  ): Promise<{ chain: OrderWorkflowChain; steps: OrderStatusTransition[] }> {
    const chain = await this.chainRepo.findOne({ where: { id: chainId } });
    if (!chain) throw new NotFoundException('链路不存在');
    if (payload.name !== undefined) chain.name = payload.name.trim() || chain.name;
    if (payload.conditionsJson !== undefined) chain.conditionsJson = payload.conditionsJson ?? null;
    // 若传入 enabled，则按“开关取反”处理，避免前端与后端布尔值字符串等差异导致保存失败
    if (payload.enabled !== undefined) {
      chain.enabled = !chain.enabled;
    }
    await this.chainRepo.save(chain);

    if (payload.steps) {
      await this.transitionRepo.delete({ chainId });
      const created: OrderStatusTransition[] = [];
      for (let i = 0; i < payload.steps.length; i++) {
        const step = payload.steps[i];
        const entity = this.transitionRepo.create({
          chainId,
          stepOrder: i + 1,
          fromStatus: step.fromStatus?.trim() ?? '',
          toStatus: step.toStatus?.trim() ?? '',
          triggerType: step.triggerType?.trim() ?? 'button',
          triggerCode: step.triggerCode?.trim() ?? '',
          conditionsJson: chain.conditionsJson ?? step.conditionsJson ?? null,
          nextDepartment: step.nextDepartment?.trim() || null,
          allowRoles: step.allowRoles?.trim() || null,
          enabled: step.enabled ?? true,
        });
        created.push(await this.transitionRepo.save(entity));
      }
      return { chain, steps: created };
    }

    const steps = await this.transitionRepo.find({
      where: { chainId },
      order: { stepOrder: 'ASC', id: 'ASC' },
    });
    return { chain, steps };
  }

  async deleteChain(chainId: number): Promise<void> {
    await this.transitionRepo.delete({ chainId });
    await this.chainRepo.delete({ id: chainId });
  }

  // --- 订单状态时效配置（SLA）---

  async getSlaList(): Promise<OrderStatusSla[]> {
    return this.slaRepo.find({
      relations: ['orderStatus'],
      order: { orderStatusId: 'ASC', id: 'ASC' },
    });
  }

  async createSla(payload: { orderStatusId: number; limitHours: number; enabled?: boolean }): Promise<OrderStatusSla> {
    const status = await this.statusRepo.findOne({ where: { id: payload.orderStatusId } });
    if (!status) throw new NotFoundException('订单状态不存在');
    const entity = this.slaRepo.create({
      orderStatusId: payload.orderStatusId,
      limitHours: String(payload.limitHours),
      enabled: payload.enabled ?? true,
    });
    return this.slaRepo.save(entity);
  }

  async updateSla(id: number, payload: { orderStatusId?: number; limitHours?: number; enabled?: boolean }): Promise<OrderStatusSla> {
    const row = await this.slaRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('时效配置不存在');
    if (payload.orderStatusId !== undefined) row.orderStatusId = payload.orderStatusId;
    if (payload.limitHours !== undefined) row.limitHours = String(payload.limitHours);
    if (payload.enabled !== undefined) row.enabled = Boolean(payload.enabled);
    return this.slaRepo.save(row);
  }

  async deleteSla(id: number): Promise<void> {
    await this.slaRepo.delete(id);
  }

  /**
   * 订单流转时效报表：按状态停留段统计，含是否超期
   */
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
      orderQb.andWhere('o.order_date <= :orderDateTo', { orderDateTo: params.orderDateTo + ' 23:59:59' });
    }
    if (params.completedFrom) {
      orderQb.andWhere("o.status = 'completed' AND o.status_time >= :completedFrom", {
        completedFrom: params.completedFrom,
      });
    }
    if (params.completedTo) {
      orderQb.andWhere("o.status = 'completed' AND o.status_time <= :completedTo", {
        completedTo: params.completedTo + ' 23:59:59',
      });
    }
    if (params.collaborationTypeId != null) {
      orderQb.andWhere('o.collaboration_type_id = :collaborationTypeId', {
        collaborationTypeId: params.collaborationTypeId,
      });
    }
    if (params.orderTypeId != null) {
      orderQb.andWhere('o.order_type_id = :orderTypeId', {
        orderTypeId: params.orderTypeId,
      });
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
    for (const r of slaRows) {
      slaMap.set(r.orderStatusId, parseFloat(r.limitHours));
    }
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

    const orders = filteredOrders;
    const collaborationIds = Array.from(
      new Set(orders.map((o) => o.collaborationTypeId).filter((v) => v != null) as number[]),
    );
    const orderTypeIds = Array.from(
      new Set(orders.map((o) => o.orderTypeId).filter((v) => v != null) as number[]),
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
    /**
     * 按状态历史时间轴计算环节窗口：到达时间=首次进入该状态的 entered_at；
     * 离开时间=时间轴上「下一条记录」的 entered_at（与真实流转顺序一致，不依赖固定环节顺序）。
     * 若该环节是历史中的最后一段且订单已完成，且无下一条，则用订单完成时间作为离开时间。
     */
    const getPhaseWindow = (
      histSorted: OrderStatusHistory[],
      phaseCode: string,
      orderCompletedAt: Date | null,
    ): { start: Date | null; end: Date | null } => {
      const timeline = histSorted
        .map((h) => ({
          code: String((h as any)?.status?.code ?? '').trim(),
          enteredAt: h.enteredAt,
        }))
        .filter((x) => x.code.length > 0);
      const idx = timeline.findIndex((t) => t.code === phaseCode);
      if (idx < 0) return { start: null, end: null };
      const start = timeline[idx].enteredAt;
      if (idx + 1 < timeline.length) {
        return { start, end: timeline[idx + 1].enteredAt };
      }
      if (phaseCode === 'pending_finishing' && orderCompletedAt) {
        return { start, end: orderCompletedAt };
      }
      return { start, end: null };
    };

    for (const [, hist] of byOrder) {
      hist.sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());
      const latest = hist[hist.length - 1];
      if (!latest) continue;

      // 仅保留“一单一行”，展示该单当前停留段（最后一次进入状态）数据
      const order = (latest as any).order as Order | undefined;
      const orderStatusCode = (order?.status ?? '').trim();

      // 优先按订单当前状态匹配对应历史段，确保与订单列表状态一致；
      // 若历史暂缺该状态段，则回退到最后一段。
      const matchedByOrderStatus =
        orderStatusCode.length > 0
          ? [...hist]
              .reverse()
              .find((h) => String((h as any)?.status?.code ?? '').trim() === orderStatusCode)
          : undefined;
      const currentSeg = matchedByOrderStatus ?? latest;

      const leftAt = now;
      const durationHours = (leftAt.getTime() - currentSeg.enteredAt.getTime()) / (1000 * 60 * 60);

      const statusFromOrder = orderStatusCode ? statusByCode.get(orderStatusCode) : undefined;
      const resolvedStatusId = statusFromOrder?.id ?? currentSeg.statusId;
      const resolvedStatusLabel = statusFromOrder?.label ?? String((currentSeg as any)?.status?.label ?? '');

      const limitHours = slaMap.get(resolvedStatusId) ?? null;
      const isOverdue = limitHours != null && durationHours > limitHours;
      const collaborationTypeId = order?.collaborationTypeId ?? null;
      const orderTypeId = order?.orderTypeId ?? null;
      const completedAt =
        order?.status === 'completed' && order.statusTime ? order.statusTime.toISOString() : null;
      const orderCompletedAtDate =
        order?.status === 'completed' && order.statusTime ? order.statusTime : null;

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
      const purchaseArrivedAtDate = purchaseW.start;
      const purchaseCompletedAtDate = purchaseW.end;
      const patternW = getPhaseWindow(hist, 'pending_pattern', orderCompletedAtDate);
      const patternArrivedAtDate = patternW.start;
      const patternCompletedAtDate = patternW.end;
      const cuttingW = getPhaseWindow(hist, 'pending_cutting', orderCompletedAtDate);
      const cuttingArrivedAtDate = cuttingW.start;
      const cuttingCompletedAtDate = cuttingW.end;
      const craftW = getPhaseWindow(hist, 'pending_craft', orderCompletedAtDate);
      const craftArrivedAtDate = craftW.start;
      const craftCompletedAtDate = craftW.end;
      const sewingW = getPhaseWindow(hist, 'pending_sewing', orderCompletedAtDate);
      const sewingArrivedAtDate = sewingW.start;
      const sewingCompletedAtDate = sewingW.end;
      const finishingW = getPhaseWindow(hist, 'pending_finishing', orderCompletedAtDate);
      const finishingArrivedAtDate = finishingW.start;
      const finishingCompletedAtDate = finishingW.end;

      // 过滤：按“当前状态”与“当前进入时间”筛选（避免同一订单多段命中导致重复）
      if (params.statusId != null && resolvedStatusId !== params.statusId) continue;
      if (params.startDate && currentSeg.enteredAt < new Date(params.startDate)) continue;
      if (params.endDate && currentSeg.enteredAt > new Date(params.endDate + ' 23:59:59')) continue;

      list.push({
        orderId: currentSeg.orderId,
        orderNo: order?.orderNo ?? '',
        skuCode: order?.skuCode ?? '',
        collaborationTypeId,
        collaborationTypeLabel:
          collaborationTypeId != null ? collaborationLabels[collaborationTypeId] ?? '' : '',
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
        purchaseArrivedAt: toIso(purchaseArrivedAtDate),
        purchaseCompletedAt: toIso(purchaseCompletedAtDate),
        purchaseJudge: getJudge('pending_purchase', purchaseArrivedAtDate, purchaseCompletedAtDate),
        patternArrivedAt: toIso(patternArrivedAtDate),
        patternCompletedAt: toIso(patternCompletedAtDate),
        patternJudge: getJudge('pending_pattern', patternArrivedAtDate, patternCompletedAtDate),
        cuttingArrivedAt: toIso(cuttingArrivedAtDate),
        cuttingCompletedAt: toIso(cuttingCompletedAtDate),
        cuttingJudge: getJudge('pending_cutting', cuttingArrivedAtDate, cuttingCompletedAtDate),
        craftArrivedAt: toIso(craftArrivedAtDate),
        craftCompletedAt: toIso(craftCompletedAtDate),
        craftJudge: getJudge('pending_craft', craftArrivedAtDate, craftCompletedAtDate),
        sewingArrivedAt: toIso(sewingArrivedAtDate),
        sewingCompletedAt: toIso(sewingCompletedAtDate),
        sewingJudge: getJudge('pending_sewing', sewingArrivedAtDate, sewingCompletedAtDate),
        finishingArrivedAt: toIso(finishingArrivedAtDate),
        finishingCompletedAt: toIso(finishingCompletedAtDate),
        finishingJudge: getJudge('pending_finishing', finishingArrivedAtDate, finishingCompletedAtDate),
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
    const pagedList = list.slice(start, start + pageSize);
    return { list: pagedList, summary };
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
      if (status?.code) {
        qb.andWhere('o.status = :statusCode', { statusCode: status.code });
      }
    }
    if (params.orderDateFrom) {
      qb.andWhere('o.order_date >= :orderDateFrom', { orderDateFrom: params.orderDateFrom });
    }
    if (params.orderDateTo) {
      qb.andWhere('o.order_date <= :orderDateTo', { orderDateTo: params.orderDateTo + ' 23:59:59' });
    }
    if (params.completedFrom) {
      qb.andWhere("o.status = 'completed' AND o.status_time >= :completedFrom", {
        completedFrom: params.completedFrom,
      });
    }
    if (params.completedTo) {
      qb.andWhere("o.status = 'completed' AND o.status_time <= :completedTo", {
        completedTo: params.completedTo + ' 23:59:59',
      });
    }
    if (params.collaborationTypeId != null) {
      qb.andWhere('o.collaboration_type_id = :collaborationTypeId', {
        collaborationTypeId: params.collaborationTypeId,
      });
    }
    if (params.orderTypeId != null) {
      qb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId: params.orderTypeId });
    }
    const orders = await qb.orderBy('o.order_date', 'DESC').addOrderBy('o.id', 'DESC').getMany();
    const orderIds = orders.map((o) => o.id);
    const snapshots =
      orderIds.length > 0
        ? await this.orderCostSnapshotRepo.find({
            where: orderIds.map((id) => ({ orderId: id })),
          })
        : [];
    const snapshotMap = new Map<number, Record<string, unknown> | null>();
    for (const row of snapshots) {
      snapshotMap.set(row.orderId, (row.snapshot as Record<string, unknown> | null) ?? null);
    }

    const collaborationIds = Array.from(
      new Set(orders.map((o) => o.collaborationTypeId).filter((v) => v != null) as number[]),
    );
    const orderTypeIds = Array.from(
      new Set(orders.map((o) => o.orderTypeId).filter((v) => v != null) as number[]),
    );
    const [collaborationLabels, orderTypeLabels] = await Promise.all([
      this.systemOptionsService.getOptionLabelsByIds('collaboration', collaborationIds),
      this.systemOptionsService.getOptionLabelsByIds('order_types', orderTypeIds),
    ]);

    const toNum = (v: unknown): number => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const round2 = (n: number): number => Math.round(n * 100) / 100;
    const calcCosts = (snapshot: Record<string, unknown> | null): { material: number; process: number; production: number } => {
      if (!snapshot || typeof snapshot !== 'object') return { material: 0, process: 0, production: 0 };
      const materialRows = Array.isArray(snapshot.materialRows) ? (snapshot.materialRows as Array<Record<string, unknown>>) : [];
      const processRows = Array.isArray(snapshot.processItemRows) ? (snapshot.processItemRows as Array<Record<string, unknown>>) : [];
      const productionRows = Array.isArray(snapshot.productionRows) ? (snapshot.productionRows as Array<Record<string, unknown>>) : [];
      const material = materialRows.reduce((sum, row) => {
        const usage = toNum(row?.usagePerPiece);
        const loss = toNum(row?.lossPercent);
        const unitPrice = toNum(row?.unitPrice);
        return sum + usage * (1 + loss / 100) * unitPrice;
      }, 0);
      const process = processRows.reduce((sum, row) => sum + toNum(row?.quantity) * toNum(row?.unitPrice), 0);
      const production = productionRows.reduce((sum, row) => sum + toNum(row?.unitPrice), 0);
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

  /** 列表中的时间字符串或 Date 解析为 Date（YYYY-MM-DD、YYYY-MM-DD HH:mm:ss、ISO） */
  parseProductionPhaseInstant(value: Date | string | null | undefined): Date | null {
    if (value == null) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
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

  /**
   * 生产模块列表：「进入该阶段时间 → 完成时间」小时数对比订单时效配置（order_status_sla，按状态 code）。
   * 未完成且订单当前正处于该阶段：进行中；无开始时间：-；该阶段未配置时限：未配置时限。
   */
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

