import { Injectable } from '@nestjs/common';
import { OrderStatusConfigService } from './order-status-config.service';
import { OrderStatusTransition } from '../entities/order-status-transition.entity';
import { OrderWorkflowChain } from '../entities/order-workflow-chain.entity';

@Injectable()
export class OrderStatusTransitionService {
  constructor(private readonly orderStatusConfigService: OrderStatusConfigService) {}

  getTransitions(fromStatus?: string): Promise<OrderStatusTransition[]> {
    return this.orderStatusConfigService.getTransitions(fromStatus);
  }

  createTransition(payload: Partial<OrderStatusTransition>): Promise<OrderStatusTransition> {
    return this.orderStatusConfigService.createTransition(payload);
  }

  updateTransition(id: number, payload: Partial<OrderStatusTransition>): Promise<OrderStatusTransition> {
    return this.orderStatusConfigService.updateTransition(id, payload);
  }

  deleteTransition(id: number): Promise<void> {
    return this.orderStatusConfigService.deleteTransition(id);
  }

  createTransitionsBatch(
    steps: Array<Partial<OrderStatusTransition>>,
    conditionsJson?: unknown,
    name?: string,
  ): Promise<{ chain: OrderWorkflowChain; steps: OrderStatusTransition[] }> {
    return this.orderStatusConfigService.createTransitionsBatch(steps, conditionsJson, name);
  }

  getChains(): Promise<Array<{ chain: OrderWorkflowChain; steps: OrderStatusTransition[] }>> {
    return this.orderStatusConfigService.getChains();
  }

  reorderChains(orderedIds: number[]): Promise<{ success: true }> {
    return this.orderStatusConfigService.reorderChains(orderedIds);
  }

  updateChain(
    chainId: number,
    payload: { name?: string; conditionsJson?: unknown; enabled?: boolean; steps?: Array<Partial<OrderStatusTransition>> },
  ): Promise<{ chain: OrderWorkflowChain; steps: OrderStatusTransition[] }> {
    return this.orderStatusConfigService.updateChain(chainId, payload);
  }

  deleteChain(chainId: number): Promise<void> {
    return this.orderStatusConfigService.deleteChain(chainId);
  }
}
