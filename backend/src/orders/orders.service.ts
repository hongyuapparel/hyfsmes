import { Injectable } from '@nestjs/common';
import { OrderQueryService } from './order-query.service';
import { OrderMutationService } from './order-mutation.service';
import { OrderStatusService } from './order-status.service';
import { type OrderListQuery, type OrderEditPayload, type OrderActor } from './order.types';

export type { OrderListQuery, OrderEditPayload, OrderActor } from './order.types';

@Injectable()
export class OrdersService {
  constructor(
    private readonly orderQueryService: OrderQueryService,
    private readonly orderMutationService: OrderMutationService,
    private readonly orderStatusService: OrderStatusService,
  ) {}

  findOne(id: number) {
    return this.orderQueryService.findOne(id);
  }

  findAll(query: OrderListQuery, actorUserId?: number) {
    return this.orderQueryService.findAll(query, actorUserId);
  }

  countByStatus(query: OrderListQuery, actorUserId?: number) {
    return this.orderQueryService.countByStatus(query, actorUserId);
  }

  getSizeBreakdown(orderId: number) {
    return this.orderQueryService.getSizeBreakdown(orderId);
  }

  getColorSizeBreakdown(orderId: number) {
    return this.orderQueryService.getColorSizeBreakdown(orderId);
  }

  getLogs(orderId: number) {
    return this.orderQueryService.getLogs(orderId);
  }

  getRemarks(orderId: number) {
    return this.orderQueryService.getRemarks(orderId);
  }

  getCostSnapshot(orderId: number) {
    return this.orderQueryService.getCostSnapshot(orderId);
  }

  createDraft(payload: OrderEditPayload, actor: OrderActor) {
    return this.orderMutationService.createDraft(payload, actor);
  }

  updateDraft(id: number, payload: OrderEditPayload, actor: OrderActor) {
    return this.orderMutationService.updateDraft(id, payload, actor);
  }

  submit(id: number, actor: OrderActor) {
    return this.orderMutationService.submit(id, actor);
  }

  deleteMany(ids: number[], actor: OrderActor) {
    return this.orderMutationService.deleteMany(ids, actor);
  }

  restoreMany(ids: number[], actor: OrderActor) {
    return this.orderMutationService.restoreMany(ids, actor);
  }

  reviewMany(ids: number[], actor: OrderActor) {
    return this.orderMutationService.reviewMany(ids, actor);
  }

  reviewRejectMany(ids: number[], reason: string, actor: OrderActor) {
    return this.orderMutationService.reviewRejectMany(ids, reason, actor);
  }

  copyManyToDraft(ids: number[], actor: OrderActor) {
    return this.orderMutationService.copyManyToDraft(ids, actor);
  }

  addRemark(orderId: number, actor: OrderActor, content: string) {
    return this.orderMutationService.addRemark(orderId, actor, content);
  }

  saveCostSnapshot(orderId: number, payload: { snapshot: Record<string, unknown> }, actor?: OrderActor) {
    return this.orderMutationService.saveCostSnapshot(orderId, payload, actor);
  }

  confirmCostQuote(orderId: number, payload: { snapshot: Record<string, unknown> }, actor: OrderActor) {
    return this.orderMutationService.confirmCostQuote(orderId, payload, actor);
  }

  assertOrderActionById(orderId: number, userId: number, action: string): Promise<void> {
    return this.orderStatusService.assertOrderActionById(orderId, userId, action);
  }

  assertOrderActionByIds(orderIds: number[], userId: number, action: string): Promise<void> {
    return this.orderStatusService.assertOrderActionByIds(orderIds, userId, action);
  }
}
