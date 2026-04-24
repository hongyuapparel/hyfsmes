import { Injectable } from '@nestjs/common';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusTransition } from '../entities/order-status-transition.entity';
import { OrderWorkflowChain } from '../entities/order-workflow-chain.entity';
import { OrderStatusSla } from '../entities/order-status-sla.entity';
import { OrderStatusDefinitionService } from './order-status-definition.service';
import { OrderStatusTransitionService } from './order-status-transition.service';
import { OrderStatusReportService } from './order-status-report.service';

export type { ProductionSlaJudgeContext } from './order-status-report.service';
import type { ProductionSlaJudgeContext } from './order-status-report.service';

@Injectable()
export class OrderStatusConfigService {
  constructor(
    private readonly definitionService: OrderStatusDefinitionService,
    private readonly transitionService: OrderStatusTransitionService,
    private readonly reportService: OrderStatusReportService,
  ) {}

  getAllStatuses(): Promise<OrderStatus[]> {
    return this.definitionService.getAllStatuses();
  }

  createStatus(payload: Partial<OrderStatus>): Promise<OrderStatus> {
    return this.definitionService.createStatus(payload);
  }

  updateStatus(id: number, payload: Partial<OrderStatus>): Promise<OrderStatus> {
    return this.definitionService.updateStatus(id, payload);
  }

  toggleStatusEnabled(id: number): Promise<OrderStatus> {
    return this.definitionService.toggleStatusEnabled(id);
  }

  deleteStatus(id: number): Promise<void> {
    return this.definitionService.deleteStatus(id);
  }

  getTransitions(fromStatus?: string): Promise<OrderStatusTransition[]> {
    return this.transitionService.getTransitions(fromStatus);
  }

  createTransition(payload: Partial<OrderStatusTransition>): Promise<OrderStatusTransition> {
    return this.transitionService.createTransition(payload);
  }

  updateTransition(id: number, payload: Partial<OrderStatusTransition>): Promise<OrderStatusTransition> {
    return this.transitionService.updateTransition(id, payload);
  }

  deleteTransition(id: number): Promise<void> {
    return this.transitionService.deleteTransition(id);
  }

  createTransitionsBatch(
    steps: Array<Partial<OrderStatusTransition>>,
    conditionsJson?: unknown,
    name?: string,
  ): Promise<{ chain: OrderWorkflowChain; steps: OrderStatusTransition[] }> {
    return this.transitionService.createTransitionsBatch(steps, conditionsJson, name);
  }

  getChains(): Promise<Array<{ chain: OrderWorkflowChain; steps: OrderStatusTransition[] }>> {
    return this.transitionService.getChains();
  }

  reorderChains(orderedIds: number[]): Promise<{ success: true }> {
    return this.transitionService.reorderChains(orderedIds);
  }

  updateChain(
    chainId: number,
    payload: { name?: string; conditionsJson?: unknown; enabled?: boolean; steps?: Array<Partial<OrderStatusTransition>> },
  ): Promise<{ chain: OrderWorkflowChain; steps: OrderStatusTransition[] }> {
    return this.transitionService.updateChain(chainId, payload);
  }

  deleteChain(chainId: number): Promise<void> {
    return this.transitionService.deleteChain(chainId);
  }

  getSlaList(): Promise<OrderStatusSla[]> {
    return this.definitionService.getSlaList();
  }

  createSla(payload: { orderStatusId: number; limitHours: number; enabled?: boolean }): Promise<OrderStatusSla> {
    return this.definitionService.createSla(payload);
  }

  updateSla(
    id: number,
    payload: { orderStatusId?: number; limitHours?: number; enabled?: boolean },
  ): Promise<OrderStatusSla> {
    return this.definitionService.updateSla(id, payload);
  }

  deleteSla(id: number): Promise<void> {
    return this.definitionService.deleteSla(id);
  }

  getSlaReport(params: {
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
  }) {
    return this.reportService.getSlaReport(params);
  }

  getProfitReport(params: {
    statusId?: number;
    orderDateFrom?: string;
    orderDateTo?: string;
    completedFrom?: string;
    completedTo?: string;
    collaborationTypeId?: number;
    orderTypeId?: number;
    page?: number;
    pageSize?: number;
  }) {
    return this.reportService.getProfitReport(params);
  }

  loadProductionSlaJudgeContext(): Promise<ProductionSlaJudgeContext> {
    return this.reportService.loadProductionSlaJudgeContext();
  }

  parseProductionPhaseInstant(value: Date | string | null | undefined): Date | null {
    return this.reportService.parseProductionPhaseInstant(value);
  }

  judgeProductionPhaseDuration(
    phaseCode: string,
    startAt: Date | null,
    endAt: Date | null,
    orderStatusCode: string,
    ctx: ProductionSlaJudgeContext,
  ): string {
    return this.reportService.judgeProductionPhaseDuration(phaseCode, startAt, endAt, orderStatusCode, ctx);
  }
}
