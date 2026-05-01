import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderOperationLog } from '../entities/order-operation-log.entity';
import { OrderExt, type OrderMaterialRow, type ProcessRow } from '../entities/order-ext.entity';
import { OrderCutting } from '../entities/order-cutting.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { OrderFinishing } from '../entities/order-finishing.entity';
import { OrderCraft } from '../entities/order-craft.entity';
import { OrderPattern } from '../entities/order-pattern.entity';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { OrderStatusTransition } from '../entities/order-status-transition.entity';
import { User } from '../entities/user.entity';
import { RoleOrderPolicy } from '../entities/role-order-policy.entity';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import { SystemOptionsService } from '../system-options/system-options.service';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { ORDER_STATUS_LABEL_MAP, type OrderActor, type OrderEditPayload } from './order.types';

@Injectable()
export class OrderStatusService {
  private readonly logger = new Logger(OrderStatusService.name);
  private craftReconcileRunning = false;
  private craftReconcileLastRunAt = 0;
  private readonly craftReconcileIntervalMs = 5 * 60 * 1000;
  private sewingReconcileRunning = false;
  private sewingReconcileLastRunAt = 0;
  private readonly sewingReconcileIntervalMs = 5 * 60 * 1000;
  private finishingReconcileRunning = false;
  private finishingReconcileLastRunAt = 0;
  private readonly finishingReconcileIntervalMs = 5 * 60 * 1000;
  private workflowReconcileRunning = false;
  private workflowReconcileLastRunAt = 0;
  private readonly workflowReconcileIntervalMs = 5 * 60 * 1000;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(OrderOperationLog)
    private readonly orderLogRepo: Repository<OrderOperationLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
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
    @InjectRepository(OrderStatus)
    private readonly orderStatusRepo: Repository<OrderStatus>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoryRepo: Repository<OrderStatusHistory>,
    @InjectRepository(OrderStatusTransition)
    private readonly orderStatusTransitionRepo: Repository<OrderStatusTransition>,
    @InjectRepository(RoleOrderPolicy)
    private readonly roleOrderPolicyRepo: Repository<RoleOrderPolicy>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly systemOptionsService: SystemOptionsService,
    private readonly orderWorkflowService: OrderWorkflowService,
  ) {}

  formatLogDetail(detail: string): string {
    if (!detail) return '';
    let result = detail;
    result = result.replace(/(\d{4}-\d{2}-\d{2})T[0-9:.Z+-]*/g, '$1');
    Object.entries(ORDER_STATUS_LABEL_MAP).forEach(([code, label]) => {
      const reg = new RegExp(`\\b${code}\\b`, 'g');
      result = result.replace(reg, label);
    });
    return result;
  }

  async appendStatusHistory(orderId: number, statusCode: string): Promise<void> {
    const code = (statusCode ?? '').trim();
    if (!code) return;
    const status = await this.orderStatusRepo.findOne({ where: { code } });
    if (!status) return;
    await this.orderStatusHistoryRepo.save(
      this.orderStatusHistoryRepo.create({ orderId, statusId: status.id }),
    );
  }

  async addLog(order: Order, actor: OrderActor, action: string, detail: string): Promise<void> {
    let operatorUsername = actor.username;
    try {
      const user = await this.userRepo.findOne({ where: { id: actor.userId } });
      if (user) {
        operatorUsername = (user.displayName && user.displayName.trim()) || user.username || actor.username;
      }
    } catch {
      operatorUsername = actor.username;
    }

    const normalizedDetail = this.formatLogDetail(detail);
    if (!normalizedDetail?.trim()) return;

    const MERGE_WINDOW_MS = 3000;
    const since = new Date(Date.now() - MERGE_WINDOW_MS);
    const latest = await this.orderLogRepo
      .createQueryBuilder('l')
      .where('l.order_id = :orderId', { orderId: order.id })
      .andWhere('l.operator_username = :operatorUsername', { operatorUsername })
      .andWhere('l.action = :action', { action })
      .andWhere('l.created_at >= :since', { since })
      .orderBy('l.created_at', 'DESC')
      .getOne();

    if (latest) {
      const prev = this.formatLogDetail(latest.detail || '').trim();
      const next = normalizedDetail.trim();
      if (prev && prev !== next) {
        latest.detail = this.formatLogDetail(`${prev}; ${next}`);
        await this.orderLogRepo.save(latest);
      }
      return;
    }

    const log = this.orderLogRepo.create({
      orderId: order.id,
      orderNo: order.orderNo,
      operatorUsername,
      action,
      detail: normalizedDetail,
    });
    await this.orderLogRepo.save(log);
  }

  private normalizeWorkflowMaterialRows(rows: unknown): OrderMaterialRow[] {
    return Array.isArray(rows)
      ? (rows as OrderMaterialRow[]).map((row) => {
          const {
            materialType: _dropType,
            materialSource: _dropSource,
            purchaseStatus: _dropPurchaseStatus,
            actualPurchaseQuantity: _dropActualPurchaseQuantity,
            purchaseAmount: _dropPurchaseAmount,
            purchaseCompletedAt: _dropPurchaseCompletedAt,
            purchaseUnitPrice: _dropPurchaseUnitPrice,
            purchaseOtherCost: _dropPurchaseOtherCost,
            purchaseRemark: _dropPurchaseRemark,
            purchaseImageUrl: _dropPurchaseImageUrl,
            pickStatus: _dropPickStatus,
            pickCompletedAt: _dropPickCompletedAt,
            pickRemark: _dropPickRemark,
            pickLogs: _dropPickLogs,
            ...rest
          } = row;
          return rest as OrderMaterialRow;
        })
      : [];
  }

  private normalizeWorkflowPayloadValue(key: keyof OrderEditPayload, value: unknown): unknown {
    if (key === 'materials') return this.normalizeWorkflowMaterialRows(value);
    if (key === 'processItem') return typeof value === 'string' ? value.trim() : '';
    return value ?? null;
  }

  hasWorkflowRelevantChanges(
    before: Order & { materials?: OrderMaterialRow[]; processItems?: ProcessRow[] },
    payload: OrderEditPayload,
  ): boolean {
    const keys: Array<keyof OrderEditPayload> = [
      'orderTypeId',
      'collaborationTypeId',
      'processItem',
      'materials',
      'processItems',
    ];
    for (const key of keys) {
      if (!Object.prototype.hasOwnProperty.call(payload, key)) continue;
      const beforeValue =
        key === 'materials'
          ? before.materials ?? []
          : key === 'processItems'
            ? before.processItems ?? []
            : (before as any)[key];
      const nextValue = (payload as any)[key];
      if (
        JSON.stringify(this.normalizeWorkflowPayloadValue(key, beforeValue)) !==
        JSON.stringify(this.normalizeWorkflowPayloadValue(key, nextValue))
      ) {
        return true;
      }
    }
    return false;
  }

  hasWorkflowRelevantPayload(payload: OrderEditPayload): boolean {
    return ['orderTypeId', 'collaborationTypeId', 'processItem', 'materials', 'processItems'].some((key) =>
      Object.prototype.hasOwnProperty.call(payload, key),
    );
  }

  canRebaseWorkflowStatus(status: string | null | undefined): boolean {
    const code = (status ?? '').trim();
    return !!code && !['draft', 'pending_review', 'completed'].includes(code);
  }

  private resolveMaterialRouteBySourceLabel(sourceLabel: string): 'purchase' | 'picking' {
    const label = sourceLabel.trim();
    if (label === '公司库存' || label === '客供面料') return 'picking';
    return 'purchase';
  }

  private async getMaterialSourceLabelMap(): Promise<Map<number, string>> {
    const list = await this.systemOptionsService.findAllByType('material_sources');
    return new Map(list.map((item) => [item.id, item.value]));
  }

  private isMaterialFlowCompleted(material: OrderMaterialRow, materialSourceLabelById: Map<number, string>): boolean {
    const sourceId = material.materialSourceId ?? null;
    const sourceLabel = sourceId == null ? '' : materialSourceLabelById.get(Number(sourceId)) ?? '';
    const route = this.resolveMaterialRouteBySourceLabel(sourceLabel);
    if (route === 'purchase') return (material.purchaseStatus ?? 'pending').toLowerCase() === 'completed';
    return (material.pickStatus ?? 'pending').toLowerCase() === 'completed';
  }

  private getMaterialFlowCompletedAt(material: OrderMaterialRow, materialSourceLabelById: Map<number, string>): Date | null {
    const sourceId = material.materialSourceId ?? null;
    const sourceLabel = sourceId == null ? '' : materialSourceLabelById.get(Number(sourceId)) ?? '';
    const route = this.resolveMaterialRouteBySourceLabel(sourceLabel);
    const raw = route === 'purchase' ? material.purchaseCompletedAt : material.pickCompletedAt;
    if (raw == null || String(raw).trim() === '') return null;
    const completedAt = new Date(raw);
    return Number.isNaN(completedAt.getTime()) ? null : completedAt;
  }

  private getLatestMaterialFlowCompletedAt(
    materials: OrderMaterialRow[],
    materialSourceLabelById: Map<number, string>,
  ): Date | null {
    let latest: Date | null = null;
    for (const material of materials) {
      const completedAt = this.getMaterialFlowCompletedAt(material, materialSourceLabelById);
      if (!completedAt) continue;
      if (!latest || completedAt.getTime() > latest.getTime()) latest = completedAt;
    }
    return latest;
  }

  private async getCompletedWorkflowTriggers(orderId: number): Promise<Array<{ triggerCode: string; completedAt: Date | null }>> {
    const triggers: Array<{ triggerCode: string; completedAt: Date | null }> = [];
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const materials = Array.isArray(ext?.materials) ? ext.materials : [];
    if (materials.length) {
      const materialSourceLabelById = await this.getMaterialSourceLabelMap();
      if (materials.every((material) => this.isMaterialFlowCompleted(material, materialSourceLabelById))) {
        triggers.push({
          triggerCode: 'purchase_all_completed',
          completedAt: this.getLatestMaterialFlowCompletedAt(materials, materialSourceLabelById),
        });
      }
    }

    const pattern = await this.orderPatternRepo.findOne({ where: { orderId } });
    if ((pattern?.status ?? '').toLowerCase() === 'completed') {
      triggers.push({ triggerCode: 'pattern_completed', completedAt: pattern?.completedAt ?? null });
    }
    const craft = await this.orderCraftRepo.findOne({ where: { orderId } });
    if ((craft?.status ?? '').toLowerCase() === 'completed') {
      triggers.push({ triggerCode: 'craft_completed', completedAt: craft?.completedAt ?? null });
    }
    const cutting = await this.orderCuttingRepo.findOne({ where: { orderId } });
    if ((cutting?.status ?? '').toLowerCase() === 'completed') {
      triggers.push({ triggerCode: 'cutting_completed', completedAt: cutting?.completedAt ?? null });
    }
    const sewing = await this.orderSewingRepo.findOne({ where: { orderId } });
    if ((sewing?.status ?? '').toLowerCase() === 'completed') {
      triggers.push({ triggerCode: 'sewing_completed', completedAt: sewing?.completedAt ?? null });
    }
    const finishing = await this.orderFinishingRepo.findOne({ where: { orderId } });
    if ((finishing?.status ?? '').toLowerCase() === 'inbound') {
      triggers.push({ triggerCode: 'tailing_inbound_completed', completedAt: finishing?.completedAt ?? null });
    }
    return triggers;
  }

  private async resolveSingleTargetWorkflowFallback(status: string, triggerCode: string): Promise<string | null> {
    const rules = await this.orderStatusTransitionRepo.find({
      where: { fromStatus: status, triggerCode: triggerCode.trim(), enabled: true },
      order: { id: 'ASC' },
    });
    const targets = Array.from(new Set(rules.map((rule) => (rule.toStatus ?? '').trim()).filter(Boolean)));
    return targets.length === 1 ? targets[0] : null;
  }

  async resolveStatusAfterCompletedWorkflowSteps(
    order: Order,
    actorUserId = 0,
  ): Promise<{ status: string; statusTime: Date }> {
    const now = new Date();
    let status = order.status;
    let statusTime = order.statusTime ?? now;
    const triggers = await this.getCompletedWorkflowTriggers(order.id);
    if (!triggers.length) return { status, statusTime };

    for (let i = 0; i < 10; i++) {
      let advanced = false;
      for (const trigger of triggers) {
        const stepOrder = this.orderRepo.create({ ...order, status });
        const next =
          (await this.orderWorkflowService.resolveNextStatus({
            order: stepOrder,
            triggerCode: trigger.triggerCode,
            actorUserId,
          })) ?? (await this.resolveSingleTargetWorkflowFallback(status, trigger.triggerCode));
        if (!next || next === status) continue;
        status = next;
        statusTime = trigger.completedAt ?? now;
        advanced = true;
        break;
      }
      if (!advanced || status === 'completed') break;
    }
    return { status, statusTime };
  }

  async resolveWorkflowStatusFromCurrentOrder(order: Order, actorUserId: number): Promise<{ status: string; statusTime: Date }> {
    const now = new Date();
    const reviewOrder = this.orderRepo.create({ ...order, status: 'pending_review' });
    const status =
      (await this.orderWorkflowService.resolveNextStatus({
        order: reviewOrder,
        triggerCode: 'review_approve',
        actorUserId,
      })) ?? 'pending_purchase';
    return this.resolveStatusAfterCompletedWorkflowSteps(this.orderRepo.create({ ...order, status, statusTime: now }), actorUserId);
  }

  async rebaseWorkflowStatusAfterOrderEdit(orderId: number, actor: OrderActor): Promise<Order | null> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order || !this.canRebaseWorkflowStatus(order.status)) return order;
    const next = await this.resolveWorkflowStatusFromCurrentOrder(order, actor.userId);
    if (!next.status || next.status === order.status) return order;
    const beforeStatus = order.status;
    order.status = next.status;
    order.statusTime = next.statusTime;
    const saved = await this.orderRepo.save(order);
    await this.addLog(saved, actor, 'workflow_rebase', `流程参数变更重算状态: ${beforeStatus} -> ${saved.status}`);
    await this.appendStatusHistory(saved.id, saved.status);
    return saved;
  }

  async reconcileCompletedWorkflowOrders(actorUserId = 0, options?: { force?: boolean; orderNo?: string }): Promise<void> {
    if (this.workflowReconcileRunning) return;
    const now = Date.now();
    const force = options?.force ?? false;
    if (!force && now - this.workflowReconcileLastRunAt < this.workflowReconcileIntervalMs) return;

    this.workflowReconcileRunning = true;
    this.workflowReconcileLastRunAt = now;
    try {
      const qb = this.orderRepo
        .createQueryBuilder('o')
        .where('o.status NOT IN (:...excluded)', { excluded: ['draft', 'pending_review', 'completed'] });
      if (options?.orderNo?.trim()) {
        qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${options.orderNo.trim()}%` });
      }
      const orders = await qb.getMany();
      for (const order of orders) {
        try {
          const next = await this.resolveStatusAfterCompletedWorkflowSteps(order, actorUserId);
          if (!next.status || next.status === order.status) continue;
          order.status = next.status;
          order.statusTime = next.statusTime;
          await this.orderRepo.save(order);
          await this.appendStatusHistory(order.id, next.status);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`[reconcile] 订单 ${order.id} 状态调和失败: ${msg}`);
        }
      }
    } finally {
      this.workflowReconcileRunning = false;
    }
  }

  async assertOrderActionById(orderId: number, userId: number, action: string): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId }, select: ['id', 'status'] });
    if (!order) throw new ForbiddenException('订单不存在');
    await this.assertOrderActionByStatuses([order.status], userId, action);
  }

  async assertOrderActionByIds(orderIds: number[], userId: number, action: string): Promise<void> {
    const ids = [...new Set((orderIds ?? []).filter((id) => typeof id === 'number' && id > 0))];
    if (!ids.length) return;
    const rows = await this.orderRepo.find({ where: { id: In(ids) }, select: ['id', 'status'] });
    await this.assertOrderActionByStatuses(rows.map((r) => r.status), userId, action);
  }

  private async assertOrderActionByStatuses(statuses: string[], userId: number, action: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'roleId'] });
    if (!user?.roleId) throw new ForbiddenException('无权限访问');
    const links = await this.userRoleRepo.find({ where: { userId }, select: ['roleId'] });
    const roleIds = Array.from(new Set([user.roleId, ...links.map((x) => x.roleId)].filter(Boolean))) as number[];
    if (!roleIds.length) throw new ForbiddenException('无权限访问');

    const roles = await this.roleRepo.find({ where: { id: In(roleIds) }, select: ['code'] });
    if (roles.some((r) => r.code === 'admin')) return;

    const normalized = [...new Set((statuses ?? []).map((s) => (s ?? '').trim()).filter(Boolean))];
    if (!normalized.length) return;
    const actionKey = (action ?? '').trim();
    if (!['edit', 'review', 'delete'].includes(actionKey)) return;

    const rows = await this.roleOrderPolicyRepo.find({
      where: { roleId: In(roleIds), action: actionKey as any },
      select: ['statusCode'],
    });
    if (!rows.length) throw new ForbiddenException('该操作未配置可操作状态');
    const allowSet = new Set(rows.map((r) => (r.statusCode ?? '').trim()).filter(Boolean));
    const denied = normalized.filter((s) => !allowSet.has(s));
    if (denied.length) throw new ForbiddenException(`当前状态不允许该操作: ${denied.join('、')}`);
  }

  scheduleCraftReconcile(actorUserId?: number): void {
    if (typeof actorUserId !== 'number') return;
    if (this.craftReconcileRunning) return;
    const now = Date.now();
    if (now - this.craftReconcileLastRunAt < this.craftReconcileIntervalMs) return;
    this.craftReconcileRunning = true;
    this.craftReconcileLastRunAt = now;
    void this.reconcileCraftCompletedOrders(actorUserId)
      .catch(() => undefined)
      .finally(() => {
        this.craftReconcileRunning = false;
      });
  }

  scheduleSewingReconcile(actorUserId?: number): void {
    if (typeof actorUserId !== 'number') return;
    if (this.sewingReconcileRunning) return;
    const now = Date.now();
    if (now - this.sewingReconcileLastRunAt < this.sewingReconcileIntervalMs) return;
    this.sewingReconcileRunning = true;
    this.sewingReconcileLastRunAt = now;
    void this.reconcileSewingCompletedOrders(actorUserId)
      .catch(() => undefined)
      .finally(() => {
        this.sewingReconcileRunning = false;
      });
  }

  scheduleFinishingReconcile(actorUserId?: number): void {
    if (typeof actorUserId !== 'number') return;
    if (this.finishingReconcileRunning) return;
    const now = Date.now();
    if (now - this.finishingReconcileLastRunAt < this.finishingReconcileIntervalMs) return;
    this.finishingReconcileRunning = true;
    this.finishingReconcileLastRunAt = now;
    void this.reconcileFinishingCompletedOrders(actorUserId)
      .catch(() => undefined)
      .finally(() => {
        this.finishingReconcileRunning = false;
      });
  }

  private async reconcileCraftCompletedOrders(actorUserId?: number): Promise<void> {
    if (typeof actorUserId !== 'number') return;
    const crafts = await this.orderCraftRepo.find({ where: { status: 'completed' } });
    if (!crafts.length) return;
    const orderIds = crafts.map((c) => c.orderId);
    const orders = await this.orderRepo.find({ where: { id: In(orderIds) } });
    if (!orders.length) return;
    const craftMap = new Map(crafts.map((c) => [c.orderId, c]));
    for (const order of orders) {
      const next = await this.orderWorkflowService.resolveNextStatus({ order, triggerCode: 'craft_completed', actorUserId });
      if (!next || next === order.status) continue;
      const craft = craftMap.get(order.id);
      order.status = next;
      order.statusTime = craft?.completedAt ?? new Date();
      await this.orderRepo.save(order);
      await this.appendStatusHistory(order.id, next);
    }
  }

  private async reconcileSewingCompletedOrders(actorUserId?: number): Promise<void> {
    if (typeof actorUserId !== 'number') return;
    const sewings = await this.orderSewingRepo.find({ where: { status: 'completed' } });
    if (!sewings.length) return;
    const orderIds = sewings.map((s) => s.orderId);
    const orders = await this.orderRepo.find({ where: { id: In(orderIds), status: 'pending_sewing' } });
    if (!orders.length) return;
    const sewingMap = new Map(sewings.map((s) => [s.orderId, s]));
    for (const order of orders) {
      const next = await this.orderWorkflowService.resolveNextStatus({ order, triggerCode: 'sewing_completed', actorUserId });
      if (!next || next === order.status) continue;
      const sewing = sewingMap.get(order.id);
      order.status = next;
      order.statusTime = sewing?.completedAt ?? new Date();
      await this.orderRepo.save(order);
      await this.appendStatusHistory(order.id, next);
    }
  }

  private async reconcileFinishingCompletedOrders(actorUserId?: number): Promise<void> {
    if (typeof actorUserId !== 'number') return;
    const finishings = await this.orderFinishingRepo.find({ where: { status: 'inbound' } });
    if (!finishings.length) return;
    const orderIds = finishings.map((f) => f.orderId);
    const orders = await this.orderRepo.find({ where: { id: In(orderIds), status: 'pending_finishing' } });
    if (!orders.length) return;
    const finishingMap = new Map(finishings.map((f) => [f.orderId, f]));
    for (const order of orders) {
      const next = await this.orderWorkflowService.resolveNextStatus({
        order,
        triggerCode: 'tailing_inbound_completed',
        actorUserId,
      });
      if (!next || next === order.status) continue;
      const finishing = finishingMap.get(order.id);
      order.status = next;
      order.statusTime = finishing?.completedAt ?? new Date();
      await this.orderRepo.save(order);
      await this.appendStatusHistory(order.id, next);
    }
  }
}
