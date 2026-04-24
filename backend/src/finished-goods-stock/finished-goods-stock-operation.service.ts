import { Injectable } from '@nestjs/common';
import { FinishedGoodsStockService } from './finished-goods-stock.service';

@Injectable()
export class FinishedGoodsStockOperationService {
  constructor(private readonly finishedGoodsStockService: FinishedGoodsStockService) {}

  createManual(
    payload: {
      orderNo: string;
      skuCode: string;
      quantity: number;
      unitPrice: string | number;
      warehouseId: number | null;
      inventoryTypeId: number | null;
      department: string;
      location: string;
      imageUrl?: string;
      colorSize?: unknown;
    },
    operatorName: string,
  ) {
    return this.finishedGoodsStockService.createManual(payload, operatorName);
  }

  outbound(
    items: Array<{ id: number; quantity: number; sizeBreakdown?: any }>,
    operatorName: string,
    remark: string,
    pickupUserId?: number | null,
  ) {
    return this.finishedGoodsStockService.outbound(items, operatorName, remark, pickupUserId);
  }

  updateMeta(
    id: number,
    patch: {
      department?: string;
      inventoryTypeId?: number | null;
      warehouseId?: number | null;
      location?: string;
      unitPrice?: string | number;
      imageUrl?: string;
      remark?: string;
    },
    operatorName: string,
  ) {
    return this.finishedGoodsStockService.updateMeta(id, patch, operatorName);
  }

  upsertColorImage(
    id: number,
    payload: { colorName: string; imageUrl: string },
    operatorName: string,
  ) {
    return this.finishedGoodsStockService.upsertColorImage(id, payload, operatorName);
  }
}
