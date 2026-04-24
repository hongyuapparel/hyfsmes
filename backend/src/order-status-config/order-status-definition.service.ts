import { Injectable } from '@nestjs/common';
import { OrderStatusConfigService } from './order-status-config.service';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusSla } from '../entities/order-status-sla.entity';

@Injectable()
export class OrderStatusDefinitionService {
  constructor(private readonly orderStatusConfigService: OrderStatusConfigService) {}

  getAllStatuses(): Promise<OrderStatus[]> {
    return this.orderStatusConfigService.getAllStatuses();
  }

  createStatus(payload: Partial<OrderStatus>): Promise<OrderStatus> {
    return this.orderStatusConfigService.createStatus(payload);
  }

  updateStatus(id: number, payload: Partial<OrderStatus>): Promise<OrderStatus> {
    return this.orderStatusConfigService.updateStatus(id, payload);
  }

  toggleStatusEnabled(id: number): Promise<OrderStatus> {
    return this.orderStatusConfigService.toggleStatusEnabled(id);
  }

  deleteStatus(id: number): Promise<void> {
    return this.orderStatusConfigService.deleteStatus(id);
  }

  getSlaList(): Promise<OrderStatusSla[]> {
    return this.orderStatusConfigService.getSlaList();
  }

  createSla(payload: { orderStatusId: number; limitHours: number; enabled?: boolean }): Promise<OrderStatusSla> {
    return this.orderStatusConfigService.createSla(payload);
  }

  updateSla(
    id: number,
    payload: { orderStatusId?: number; limitHours?: number; enabled?: boolean },
  ): Promise<OrderStatusSla> {
    return this.orderStatusConfigService.updateSla(id, payload);
  }

  deleteSla(id: number): Promise<void> {
    return this.orderStatusConfigService.deleteSla(id);
  }
}
