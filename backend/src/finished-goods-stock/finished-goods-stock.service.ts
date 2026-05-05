import { Injectable } from '@nestjs/common';
import { FinishedGoodsStockQueryService } from './finished-goods-stock-query.service';
import { FinishedGoodsStockOperationService } from './finished-goods-stock-operation.service';
import { FinishedGoodsStockReportService } from './finished-goods-stock-report.service';
import type {
  FinishedGoodsOutboundListResult,
  FinishedGoodsStockDetailResult,
  FinishedOutboundItemInput,
  FinishedStockRow,
} from './finished-goods-stock.types';

export type { FinishedStockRow, FinishedOutboundItemInput } from './finished-goods-stock.types';

@Injectable()
export class FinishedGoodsStockService {
  constructor(
    private readonly queryService: FinishedGoodsStockQueryService,
    private readonly operationService: FinishedGoodsStockOperationService,
    private readonly reportService: FinishedGoodsStockReportService,
  ) {}

  createManual(
    dto: {
      orderNo?: string;
      skuCode: string;
      quantity: number;
      unitPrice?: string | number;
      warehouseId?: number | null;
      inventoryTypeId?: number | null;
      department: string;
      location: string;
      imageUrl?: string;
      colorSize?: unknown;
    },
    operatorUsername = '',
  ) {
    return this.operationService.createManual(dto, operatorUsername);
  }

  getList(params: {
    tab?: string;
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    inventoryTypeId?: number | null;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    list: FinishedStockRow[];
    total: number;
    page: number;
    pageSize: number;
    totalQuantity: number;
    totalAmount: number;
  }> {
    return this.queryService.getList(params);
  }

  outbound(
    items: FinishedOutboundItemInput[],
    operatorUsername: string,
    remark: string,
    pickupUserId?: number | null,
  ): Promise<void> {
    return this.operationService.outbound(items, operatorUsername, remark, pickupUserId);
  }

  getOutboundRecords(params: {
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<FinishedGoodsOutboundListResult> {
    return this.reportService.getOutboundRecords(params);
  }

  getDetail(id: number): Promise<FinishedGoodsStockDetailResult> {
    return this.queryService.getDetail(id);
  }

  updateMeta(
    id: number,
    dto: {
      department?: string;
      skuCode?: string;
      inventoryTypeId?: number | null;
      warehouseId?: number | null;
      location?: string;
      unitPrice?: string | number;
      imageUrl?: string;
      remark?: string;
      colorSize?: unknown;
      colorImages?: Array<{ colorName?: string; imageUrl?: string }>;
    },
    operatorUsername: string,
  ) {
    return this.operationService.updateMeta(id, dto, operatorUsername);
  }

  upsertColorImage(
    id: number,
    dto: { colorName: string; imageUrl: string },
    operatorUsername = '',
  ): Promise<void> {
    return this.operationService.upsertColorImage(id, dto, operatorUsername);
  }

  getPickupUserOptions() {
    return this.queryService.getPickupUserOptions();
  }
}
