import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { FinanceDashboardService } from './finance-dashboard.service';

@Controller('finance/dashboard')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/finance/dashboard')
export class FinanceDashboardController {
  constructor(private readonly svc: FinanceDashboardService) {}

  @Get()
  getSummary(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.svc.getSummary({ dateFrom, dateTo });
  }
}
