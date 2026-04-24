import { Injectable } from '@nestjs/common';
import {
  ProductionCuttingService,
  type CuttingListQuery,
  type CuttingListItem,
  type CuttingRegisterFormResponse,
  type CuttingCompletedDetailResponse,
} from './production-cutting.service';

@Injectable()
export class ProductionCuttingQueryService {
  constructor(private readonly productionCuttingService: ProductionCuttingService) {}

  getCuttingList(query: CuttingListQuery, actorUserId?: number): Promise<{
    items: CuttingListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    return this.productionCuttingService.getCuttingList(query, actorUserId);
  }

  getCuttingExportRows(query: CuttingListQuery, actorUserId?: number): Promise<CuttingListItem[]> {
    return this.productionCuttingService.getCuttingExportRows(query, actorUserId);
  }

  getQuantityBreakdown(orderId: number) {
    return this.productionCuttingService.getQuantityBreakdown(orderId);
  }

  getOrderColorSize(orderId: number): Promise<{
    colorSizeHeaders: string[];
    colorSizeRows: { colorName: string; quantities: number[]; remark?: string }[];
  }> {
    return this.productionCuttingService.getOrderColorSize(orderId);
  }

  getRegisterForm(orderId: number): Promise<CuttingRegisterFormResponse> {
    return this.productionCuttingService.getRegisterForm(orderId);
  }

  getCompletedCuttingDetail(orderId: number): Promise<CuttingCompletedDetailResponse> {
    return this.productionCuttingService.getCompletedCuttingDetail(orderId);
  }
}
