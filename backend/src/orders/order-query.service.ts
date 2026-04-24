import { Injectable } from '@nestjs/common';
import { OrdersService, type OrderListQuery } from './orders.service';

@Injectable()
export class OrderQueryService {
  constructor(private readonly ordersService: OrdersService) {}

  findAll(query: OrderListQuery, actorUserId?: number) {
    return this.ordersService.findAll(query, actorUserId);
  }

  countByStatus(query: OrderListQuery, actorUserId?: number) {
    return this.ordersService.countByStatus(query, actorUserId);
  }

  findOne(id: number) {
    return this.ordersService.findOne(id);
  }

  getSizeBreakdown(orderId: number) {
    return this.ordersService.getSizeBreakdown(orderId);
  }

  getColorSizeBreakdown(orderId: number) {
    return this.ordersService.getColorSizeBreakdown(orderId);
  }

  getLogs(orderId: number) {
    return this.ordersService.getLogs(orderId);
  }

  getRemarks(orderId: number) {
    return this.ordersService.getRemarks(orderId);
  }

  getCostSnapshot(orderId: number) {
    return this.ordersService.getCostSnapshot(orderId);
  }
}
