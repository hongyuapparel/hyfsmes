import { Injectable } from '@nestjs/common';
import { OrdersService } from './orders.service';

@Injectable()
export class OrderStatusService {
  constructor(private readonly ordersService: OrdersService) {}

  assertOrderActionById(orderId: number, userId: number, action: string) {
    return this.ordersService.assertOrderActionById(orderId, userId, action);
  }

  assertOrderActionByIds(orderIds: number[], userId: number, action: string) {
    return this.ordersService.assertOrderActionByIds(orderIds, userId, action);
  }
}
