import { Injectable } from '@nestjs/common';
import { FinishedGoodsStockService } from './finished-goods-stock.service';

@Injectable()
export class FinishedGoodsStockReportService {
  constructor(private readonly finishedGoodsStockService: FinishedGoodsStockService) {}

  getOutboundRecords(params: {
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    return this.finishedGoodsStockService.getOutboundRecords(params);
  }
}
