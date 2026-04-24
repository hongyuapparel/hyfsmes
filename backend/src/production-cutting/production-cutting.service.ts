import { Injectable } from '@nestjs/common';
import type { ActualCutRow, CuttingMaterialUsageRow } from '../entities/order-cutting.entity';
import { ProductionCuttingQueryService } from './production-cutting-query.service';
import { ProductionCuttingMutationService } from './production-cutting-mutation.service';

export {
  CUTTING_ABNORMAL_REASONS,
  type CuttingListItem,
  type CuttingListQuery,
  type CuttingRegisterFormMaterialRow,
  type CuttingRegisterFormResponse,
  type CuttingCompletedDetailResponse,
} from './production-cutting.types';
import type {
  CuttingCompletedDetailResponse,
  CuttingListItem,
  CuttingListQuery,
  CuttingRegisterFormResponse,
} from './production-cutting.types';

@Injectable()
export class ProductionCuttingService {
  constructor(
    private readonly queryService: ProductionCuttingQueryService,
    private readonly mutationService: ProductionCuttingMutationService,
  ) {}

  getCuttingList(query: CuttingListQuery, actorUserId?: number): Promise<{
    list: CuttingListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    return this.queryService.getCuttingList(query, actorUserId);
  }

  getCuttingExportRows(query: CuttingListQuery, actorUserId?: number): Promise<CuttingListItem[]> {
    return this.queryService.getCuttingExportRows(query, actorUserId);
  }

  getQuantityBreakdown(orderId: number): Promise<{
    headers: string[];
    rows: Array<{ label: string; values: (number | null)[] }>;
  }> {
    return this.queryService.getQuantityBreakdown(orderId);
  }

  getOrderColorSize(orderId: number): Promise<{
    colorSizeHeaders: string[];
    colorSizeRows: { colorName: string; quantities: number[]; remark?: string }[];
  }> {
    return this.queryService.getOrderColorSize(orderId);
  }

  getRegisterForm(orderId: number): Promise<CuttingRegisterFormResponse> {
    return this.queryService.getRegisterForm(orderId);
  }

  getCompletedCuttingDetail(orderId: number): Promise<CuttingCompletedDetailResponse> {
    return this.queryService.getCompletedCuttingDetail(orderId);
  }

  completeCutting(
    orderId: number,
    actualCutRows: ActualCutRow[],
    cuttingDepartment: string | null | undefined,
    cutterName: string | null | undefined,
    body: {
      cuttingUnitPrice?: string | null;
      cuttingTotalCost?: string | null;
      cuttingCostLegacy?: string | null;
      materialUsage?: CuttingMaterialUsageRow[] | null;
    },
    actorUserId?: number,
  ): Promise<void> {
    return this.mutationService.completeCutting(
      orderId,
      actualCutRows,
      cuttingDepartment,
      cutterName,
      body,
      actorUserId,
    );
  }
}
