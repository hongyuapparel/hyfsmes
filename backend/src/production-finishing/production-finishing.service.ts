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
    page: number;
    pageSize: number;
  }> {
    return this.queryService.getFinishingList(query);
  }

  getFinishingExportRows(query: FinishingListQuery): Promise<FinishingListItem[]> {
    return this.queryService.getFinishingExportRows(query);
  }

  getRegisterFormData(orderId: number): Promise<{
    headers: string[];
    orderRow: (number | null)[];
    cutRow: (number | null)[];
    sewingRow: (number | null)[];
    tailReceivedRow: (number | null)[];
    tailInboundRow: (number | null)[] | null;
    defectRow: (number | null)[] | null;
  }> {
    return this.queryService.getRegisterFormData(orderId);
  }

  registerReceive(orderId: number, tailReceivedQty: number, tailReceivedQuantities?: number[] | null): Promise<void> {
    return this.mutationService.registerReceive(orderId, tailReceivedQty, tailReceivedQuantities);
  }

  registerPackagingComplete(
    orderId: number,
    tailShippedQty: number,
    tailInboundQty: number,
    defectQuantity: number,
    remark?: string | null,
    actorUserId?: number,
    tailInboundQuantities?: number[] | null,
    defectQuantities?: number[] | null,
  ): Promise<void> {
    return this.mutationService.registerPackagingComplete(
      orderId,
      tailShippedQty,
      tailInboundQty,
      defectQuantity,
      remark,
      actorUserId,
      tailInboundQuantities,
      defectQuantities,
    );
  }

  financeApproveFinishing(orderId: number, actorUserId?: number): Promise<void> {
    return this.mutationService.financeApproveFinishing(orderId, actorUserId);
  }

  registerPackaging(orderId: number, tailReceivedQty: number, defectQuantity: number): Promise<void> {
    return this.mutationService.registerPackaging(orderId, tailReceivedQty, defectQuantity);
  }

  ship(orderId: number, quantity: number): Promise<void> {
    return this.mutationService.ship(orderId, quantity);
  }

  inbound(orderId: number, quantity: number, actorUserId?: number): Promise<void> {
    return this.mutationService.inbound(orderId, quantity, actorUserId);
  }
}
