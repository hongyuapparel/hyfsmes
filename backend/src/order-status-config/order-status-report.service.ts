import { Injectable } from '@nestjs/common';
import { OrderStatusConfigService } from './order-status-config.service';

@Injectable()
export class OrderStatusReportService {
  constructor(private readonly orderStatusConfigService: OrderStatusConfigService) {}

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
    return this.orderStatusConfigService.getSlaReport(params);
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
    return this.orderStatusConfigService.getProfitReport(params);
  }
}
