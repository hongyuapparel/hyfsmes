import { Injectable } from '@nestjs/common';
import { FinishedGoodsStockService } from './finished-goods-stock.service';

@Injectable()
export class FinishedGoodsStockQueryService {
  constructor(private readonly finishedGoodsStockService: FinishedGoodsStockService) {}

  getList(params: {
    tab?: string;
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    inventoryTypeId?: number;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }) {
    return this.finishedGoodsStockService.getList(params);
  }

  getDetail(id: number) {
    return this.finishedGoodsStockService.getDetail(id);
  }

  getPickupUserOptions() {
    return this.finishedGoodsStockService.getPickupUserOptions();
  }
}
