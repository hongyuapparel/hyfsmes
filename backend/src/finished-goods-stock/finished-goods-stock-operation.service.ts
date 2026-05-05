import { Injectable } from '@nestjs/common';
import type { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import type { FinishedOutboundItemInput } from './finished-goods-stock.types';
import { FinishedGoodsStockInboundService } from './finished-goods-stock-inbound.service';
import { FinishedGoodsStockOutboundService } from './finished-goods-stock-outbound.service';

@Injectable()
export class FinishedGoodsStockOperationService {
  constructor(
    private readonly inboundService: FinishedGoodsStockInboundService,
    private readonly outboundService: FinishedGoodsStockOutboundService,
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
  ): Promise<FinishedGoodsStock> {
    return this.inboundService.createManual(dto, operatorUsername);
  }

  outbound(
    items: FinishedOutboundItemInput[],
    operatorUsername: string,
    remark: string,
    pickupUserId?: number | null,
  ): Promise<void> {
    return this.outboundService.outbound(items, operatorUsername, remark, pickupUserId);
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
  ): Promise<FinishedGoodsStock> {
    return this.inboundService.updateMeta(id, dto, operatorUsername);
  }

  upsertColorImage(id: number, dto: { colorName: string; imageUrl: string }, operatorUsername = ''): Promise<void> {
    return this.inboundService.upsertColorImage(id, dto, operatorUsername);
  }
}
