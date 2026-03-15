import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusTransition } from '../entities/order-status-transition.entity';
import { OrderWorkflowChain } from '../entities/order-workflow-chain.entity';
import { OrderStatusSla } from '../entities/order-status-sla.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Order } from '../entities/order.entity';

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
  ) {}

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
    const chain = await this.chainRepo.save(
      this.chainRepo.create({
        name: chainName,
        conditionsJson: conditionsJson ?? null,
        enabled: true,
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
    const chains = await this.chainRepo.find({ order: { id: 'DESC' } });
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
  }): Promise<{
    list: Array<{
      orderId: number;
      orderNo: string;
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
    const qb = this.historyRepo
      .createQueryBuilder('h')
      .innerJoinAndSelect('h.order', 'o')
      .innerJoinAndSelect('h.status', 's')
      .orderBy('h.order_id', 'ASC')
      .addOrderBy('h.entered_at', 'ASC');
    if (params.statusId != null) {
      qb.andWhere('h.status_id = :statusId', { statusId: params.statusId });
    }
    if (params.startDate) {
      qb.andWhere('h.entered_at >= :startDate', { startDate: params.startDate });
    }
    if (params.endDate) {
      qb.andWhere('h.entered_at <= :endDate', { endDate: params.endDate + ' 23:59:59' });
    }
    const rows = await qb.getMany();
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
      statusId: number;
      statusLabel: string;
      enteredAt: string;
      leftAt: string | null;
      durationHours: number;
      limitHours: number | null;
      isOverdue: boolean;
    }> = [];
    const now = new Date();
    for (const [, hist] of byOrder) {
      hist.sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime());
      for (let i = 0; i < hist.length; i++) {
        const cur = hist[i];
        const next = hist[i + 1];
        const leftAt = next ? next.enteredAt : now;
        const durationHours = (leftAt.getTime() - cur.enteredAt.getTime()) / (1000 * 60 * 60);
        const limitHours = slaMap.get(cur.statusId) ?? null;
        const isOverdue = limitHours != null && durationHours > limitHours;
        list.push({
          orderId: cur.orderId,
          orderNo: (cur as any).order?.orderNo ?? '',
          statusId: cur.statusId,
          statusLabel: (cur as any).status?.label ?? '',
          enteredAt: cur.enteredAt.toISOString(),
          leftAt: next ? next.enteredAt.toISOString() : null,
          durationHours: Math.round(durationHours * 100) / 100,
          limitHours,
          isOverdue,
        });
      }
    }
    const summary = { total: list.length, overdue: list.filter((x) => x.isOverdue).length };
    return { list, summary };
  }
}

