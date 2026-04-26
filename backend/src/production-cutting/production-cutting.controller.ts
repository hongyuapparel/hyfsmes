import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { type CuttingListQuery } from './production-cutting.service';
import { ProductionCuttingService } from './production-cutting.service';
import { ProductionCuttingMutationService } from './production-cutting-mutation.service';
import type { Response } from 'express';

@Controller('production/cutting')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/production/cutting')
export class ProductionCuttingController {
  constructor(
    private readonly cuttingService: ProductionCuttingService,
    private readonly cuttingMutationService: ProductionCuttingMutationService,
  ) {}

  @Get('items')
  getItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: { userId: number; username: string },
  ) {
    const query: CuttingListQuery = {
      tab,
      orderNo,
      skuCode,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.cuttingService.getCuttingList(query, user?.userId);
  }

  @Get('items/export')
  async exportItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @CurrentUser() user?: { userId: number; username: string },
    @Res() res?: Response,
  ) {
    const query: CuttingListQuery = {
      tab,
      orderNo,
      skuCode,
    };
    const rows = await this.cuttingService.getCuttingExportRows(query, user?.userId);
    const header = [
      '订单号',
      'SKU',
      '客户',
      '业务员',
      '跟单员',
      '订单数量',
      '客户交期',
      '到裁床时间',
      '裁床完成时间',
      '订单数量',
      '裁床数量',
      '裁剪单价(元/件)',
      '裁剪总成本(元)',
      '本次净耗合计(米)',
    ];
    const escape = (v: unknown) => {
      const str = v == null ? '' : String(v);
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };
    const lines = [header.map(escape).join(',')];
    for (const r of rows) {
      lines.push(
        [
          r.orderNo,
          r.skuCode,
          r.customerName,
          r.salesperson,
          r.merchandiser,
          r.quantity,
          r.customerDueDate ?? '',
          r.arrivedAt ?? '',
          r.completedAt ?? '',
          r.quantity,
          r.actualCutTotal ?? '',
          r.cuttingUnitPrice ?? '',
          r.cuttingCost ?? '',
          r.actualFabricMeters ?? '',
        ].map(escape).join(','),
      );
    }
    const csv = '\uFEFF' + lines.join('\n');
    const filename = `cutting-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res?.send(csv);
  }

  @Get('items/:orderId/color-size')
  getOrderColorSize(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.cuttingService.getOrderColorSize(orderId);
  }

  @Get('items/:orderId/register-form')
  getRegisterForm(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.cuttingService.getRegisterForm(orderId);
  }

  @Get('items/:orderId/quantity-breakdown')
  getQuantityBreakdown(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.cuttingService.getQuantityBreakdown(orderId);
  }

  @Get('items/:orderId/completed-detail')
  getCompletedCuttingDetail(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.cuttingService.getCompletedCuttingDetail(orderId);
  }

  @Post('items/complete')
  complete(
    @Body('orderId') orderId: number,
    @Body('actualCutRows') actualCutRows: { colorName?: string; quantities?: number[]; remark?: string }[],
    @Body('cuttingDepartment') cuttingDepartment?: string,
    @Body('cutterName') cutterName?: string,
    @Body('cuttingUnitPrice') cuttingUnitPrice?: string,
    @Body('cuttingTotalCost') cuttingTotalCost?: string,
    @Body('cuttingCost') cuttingCostLegacy?: string,
    @Body('materialUsage') materialUsage?: unknown,
    @CurrentUser() user?: { userId: number; username: string },
  ) {
    return this.cuttingMutationService.completeCutting(
      Number(orderId),
      Array.isArray(actualCutRows) ? actualCutRows : [],
      cuttingDepartment ?? null,
      cutterName ?? null,
      {
        cuttingUnitPrice: cuttingUnitPrice ?? null,
        cuttingTotalCost: cuttingTotalCost ?? null,
        cuttingCostLegacy: cuttingCostLegacy ?? null,
        materialUsage: Array.isArray(materialUsage) ? (materialUsage as any) : null,
      },
      user?.userId,
    );
  }
}
