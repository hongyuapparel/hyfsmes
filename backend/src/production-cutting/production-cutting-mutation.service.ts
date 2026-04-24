import { Injectable } from '@nestjs/common';
import { ProductionCuttingService } from './production-cutting.service';

@Injectable()
export class ProductionCuttingMutationService {
  constructor(private readonly productionCuttingService: ProductionCuttingService) {}

  completeCutting(
    orderId: number,
    actualCutRows: { colorName?: string; quantities?: number[]; remark?: string }[],
    cuttingDepartment?: string | null,
    cutterName?: string | null,
    extra?: {
      cuttingUnitPrice?: string | null;
      cuttingTotalCost?: string | null;
      cuttingCostLegacy?: string | null;
      materialUsage?: any[] | null;
    },
    actorUserId?: number,
  ) {
    return this.productionCuttingService.completeCutting(
      orderId,
      actualCutRows,
      cuttingDepartment,
      cutterName,
      extra,
      actorUserId,
    );
  }
}
