import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrderStatusService } from './order-status.service';

@Injectable()
export class OrderReconcileScheduler {
  constructor(private readonly orderStatusService: OrderStatusService) {}

  @Cron('*/2 * * * *')
  async reconcile() {
    await this.orderStatusService.reconcileCompletedWorkflowOrders(undefined, { force: false });
  }
}
