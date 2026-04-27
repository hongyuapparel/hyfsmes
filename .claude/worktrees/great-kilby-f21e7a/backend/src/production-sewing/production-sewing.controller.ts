import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProductionSewingService, SewingListQuery } from './production-sewing.service';
import type { Response } from 'express';

@Controller('production/sewing')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/production/sewing')
export class ProductionSewingController {
  constructor(private readonly sewingService: ProductionSewingService) {}

  @Get('items')
  getItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const query: SewingListQuery = {
      tab,
      orderNo,
      skuCode,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.sewingService.getSewingList(query);
  }

  @Get('items/export')
  async exportItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Res() res?: Response,
  ) {
    const query: SewingListQuery = {
      tab,
      orderNo,
      skuCode,
    };
    const rows = await this.sewingService.getSewingExportRows(query);
    const header = [
      '订单号',
      'SKU',
      '客户',
      '业务员',
      '跟单员',
      '客户交期',
      '加工厂',
      '订单数量',
      '裁床数量',
      '车缝数量',
      '到车缝时间',
      '车缝完成时间',
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
          r.customerDueDate ?? '',
          r.factoryName,
          r.quantity,
          r.cutTotal ?? '',
          r.sewingQuantity ?? '',
          r.arrivedAt ?? '',
          r.completedAt ?? '',
        ].map(escape).join(','),
      );
    }
    const csv = '\uFEFF' + lines.join('\n');
    const filename = `sewing-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res?.send(csv);
  }

  @Get('items/:orderId/complete-form-data')
  getCompleteFormData(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.sewingService.getCompleteFormData(orderId);
  }

  @Post('items/assign')
  assign(
    @Body('orderId') orderId: number,
    @Body('distributedAt') distributedAt: string,
    @Body('factoryDueDate') factoryDueDate: string,
    @Body('factoryName') factoryName: string,
    @Body('sewingFee') sewingFee: string,
  ) {
    const at = distributedAt ? new Date(distributedAt) : new Date();
    const due = factoryDueDate ? new Date(factoryDueDate) : null;
    return this.sewingService.assignSewing(
      Number(orderId),
      at,
      due,
      factoryName ?? '',
      sewingFee ?? '0',
    );
  }

  @Post('items/complete')
  complete(
    @Body('orderId') orderId: number,
    @Body('sewingQuantity') sewingQuantity: number,
    @Body('defectQuantity') defectQuantity: number,
    @Body('defectReason') defectReason: string,
    @Body('sewingQuantities') sewingQuantities?: number[],
    @CurrentUser() user?: { userId: number; username: string },
  ) {
    return this.sewingService.completeSewing(
      Number(orderId),
      Number(sewingQuantity),
      Number(defectQuantity ?? 0),
      defectReason ?? '',
      Array.isArray(sewingQuantities) ? sewingQuantities : undefined,
      user?.userId,
    );
  }
}
