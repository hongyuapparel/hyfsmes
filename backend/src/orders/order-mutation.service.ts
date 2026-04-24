import { Injectable } from '@nestjs/common';
import { OrdersService, type OrderActor, type OrderEditPayload } from './orders.service';

@Injectable()
export class OrderMutationService {
  constructor(private readonly ordersService: OrdersService) {}

  createDraft(payload: OrderEditPayload, actor: OrderActor) {
    return this.ordersService.createDraft(payload, actor);
  }

  updateDraft(id: number, payload: OrderEditPayload, actor: OrderActor) {
    return this.ordersService.updateDraft(id, payload, actor);
  }

  submit(id: number, actor: OrderActor) {
    return this.ordersService.submit(id, actor);
  }

  deleteMany(ids: number[], actor: OrderActor) {
    return this.ordersService.deleteMany(ids, actor);
  }

  reviewMany(ids: number[], actor: OrderActor) {
    return this.ordersService.reviewMany(ids, actor);
  }

  reviewRejectMany(ids: number[], reason: string, actor: OrderActor) {
    return this.ordersService.reviewRejectMany(ids, reason, actor);
  }

  copyManyToDraft(ids: number[], actor: OrderActor) {
    return this.ordersService.copyManyToDraft(ids, actor);
  }

  addRemark(orderId: number, actor: OrderActor, content: string) {
    return this.ordersService.addRemark(orderId, actor, content);
  }

  saveCostSnapshot(orderId: number, body: { snapshot: Record<string, unknown> }, user: { userId: number; username: string }) {
    return this.ordersService.saveCostSnapshot(orderId, body, user);
  }

  confirmCostQuote(orderId: number, body: { snapshot: Record<string, unknown> }, user: { userId: number; username: string }) {
    return this.ordersService.confirmCostQuote(orderId, body, user);
  }
}
