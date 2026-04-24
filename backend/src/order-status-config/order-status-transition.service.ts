import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderStatusTransition } from '../entities/order-status-transition.entity';
import { OrderWorkflowChain } from '../entities/order-workflow-chain.entity';

@Injectable()
export class OrderStatusTransitionService {
  constructor(
    @InjectRepository(OrderStatusTransition)
    private readonly transitionRepo: Repository<OrderStatusTransition>,
    @InjectRepository(OrderWorkflowChain)
    private readonly chainRepo: Repository<OrderWorkflowChain>,
  ) {}

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

  async getTransitions(fromStatus?: string): Promise<OrderStatusTransition[]> {
    const where = fromStatus?.trim() ? { fromStatus: fromStatus.trim() } : {};
    return this.transitionRepo.find({ where, order: { fromStatus: 'ASC', triggerCode: 'ASC', id: 'ASC' } });
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
    if (!canSort) return { success: true };
    const ids = (orderedIds ?? []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
    if (ids.length === 0) return { success: true };
    const unique = Array.from(new Set(ids));
    await Promise.all(unique.map((id, idx) => this.chainRepo.update({ id }, { sortOrder: idx + 1 })));
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
    if (payload.enabled !== undefined) chain.enabled = !chain.enabled;
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
    const steps = await this.transitionRepo.find({ where: { chainId }, order: { stepOrder: 'ASC', id: 'ASC' } });
    return { chain, steps };
  }

  async deleteChain(chainId: number): Promise<void> {
    await this.transitionRepo.delete({ chainId });
    await this.chainRepo.delete({ id: chainId });
  }
}
