import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ProductionCuttingService, CuttingListQuery } from './production-cutting.service';
import type { Response } from 'express';

@Controller('production/cutting')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/production/cutting')
export class ProductionCuttingController {
  constructor(private readonly cuttingService: ProductionCuttingService) {}

  @Get('items')
  getItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const query: CuttingListQuery = {
      tab,
      orderNo,
      skuCode,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.cuttingService.getCuttingList(query);
  }

  @Get('items/export')
  async exportItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Res() res?: Response,
  ) {
    const query: CuttingListQuery = {
      tab,
      orderNo,
      skuCode,
    };
    const rows = await this.cuttingService.getCuttingExportRows(query);
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
      '实裁数量',
      '裁剪成本',
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
          r.cuttingCost ?? '',
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

  @Get('items/:orderId/quantity-breakdown')
  getQuantityBreakdown(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.cuttingService.getQuantityBreakdown(orderId);
  }

  @Post('items/complete')
  complete(
    @Body('orderId') orderId: number,
    @Body('cuttingCost') cuttingCost: string,
    @Body('actualCutRows') actualCutRows: { colorName?: string; quantities?: number[]; remark?: string }[],
  ) {
    return this.cuttingService.completeCutting(
      Number(orderId),
      cuttingCost ?? '0',
      Array.isArray(actualCutRows) ? actualCutRows : [],
    );
  }
}
