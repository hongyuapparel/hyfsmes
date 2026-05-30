import { Injectable } from '@nestjs/common';
import { ProductionFinishingQueryService } from './production-finishing-query.service';
import { ProductionFinishingMutationService } from './production-finishing-mutation.service';
import type { FinishingListItem, FinishingListQuery } from './production-finishing.types';

export type { FinishingListItem, FinishingListQuery } from './production-finishing.types';

@Injectable()
export class ProductionFinishingService {
  constructor(
    private readonly queryService: ProductionFinishingQueryService,
    private readonly mutationService: ProductionFinishingMutationService,
  ) {}

  getFinishingList(query: FinishingListQuery): Promise<{
    list: FinishingListItem[];
    total: number;
    totalQuantity: number;
    page: number;
    pageSize: number;
  }> {
    return this.queryService.getFinishingList(query);
  }

  getFinishingExportRows(query: FinishingListQuery): Promise<FinishingListItem[]> {
    return this.queryService.getFinishingExportRows(query);
  }

  getRegisterFormData(orderId: number): ReturnType<ProductionFinishingQueryService['getRegisterFormData']> {
    return this.queryService.getRegisterFormData(orderId);
  }

  registerReceive(
    orderId: number,
    tailReceivedQty: number,
    tailReceivedQuantities?: number[] | null,
    tailReceivedQuantitiesByColor?: Array<{ colorName: string; quantities: number[] }> | null,
  ): Promise<void> {
    return this.mutationService.registerReceive(orderId, tailReceivedQty, tailReceivedQuantities, tailReceivedQuantitiesByColor);
  }

  registerPackagingComplete(
    orderId: number,
    mode: 'partial' | 'full',
    tailInboundQty: number,
    defectQuantity: number,
    remark?: string | null,
    actorUserId?: number,
    actorUsername?: string,
    tailInboundQuantities?: number[] | null,
    defectQuantities?: number[] | null,
    tailInboundQuantitiesByColor?: Array<{ colorName: string; quantities: number[] }> | null,
    defectQuantitiesByColor?: Array<{ colorName: string; quantities: number[] }> | null,
  ): Promise<void> {
    return this.mutationService.registerPackagingComplete(
      orderId,
      mode,
      tailInboundQty,
      defectQuantity,
      remark,
      actorUserId,
      actorUsername,
      tailInboundQuantities,
      defectQuantities,
      tailInboundQuantitiesByColor,
      defectQuantitiesByColor,
    );
  }

  registerPackaging(orderId: number, tailReceivedQty: number, defectQuantity: number): Promise<void> {
    return this.mutationService.registerPackaging(orderId, tailReceivedQty, defectQuantity);
  }

  inbound(orderId: number, quantity: number, actorUserId?: number, actorUsername?: string): Promise<void> {
    return this.mutationService.inbound(orderId, quantity, actorUserId, actorUsername);
  }
}
