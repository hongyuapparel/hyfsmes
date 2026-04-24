import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { type FinishingListQuery } from './production-finishing.service';
import { ProductionFinishingQueryService } from './production-finishing-query.service';
import { ProductionFinishingMutationService } from './production-finishing-mutation.service';
import type { Response } from 'express';

@Controller('production/finishing')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/production/finishing')
export class ProductionFinishingController {
  constructor(
    private readonly finishingQueryService: ProductionFinishingQueryService,
    private readonly finishingMutationService: ProductionFinishingMutationService,
  ) {}

  @Get('items')
  getItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const query: FinishingListQuery = {
      tab,
      orderNo,
      skuCode,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.finishingQueryService.getFinishingList(query);
  }

  @Get('items/export')
  async exportItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Res() res?: Response,
  ) {
    const query: FinishingListQuery = {
      tab,
      orderNo,
      skuCode,
    };
    const rows = await this.finishingQueryService.getFinishingExportRows(query);
    const header = [
      '订单号',
      'SKU',
      '客户',
      '业务员',
      '跟单员',
      '订单数量',
      '客户交期',
      '到尾部时间',
      '尾部完成时间',
      '裁床数量',
      '车缝数量',
      '尾部收货数',
      '尾部入库数',
      '次品数',
      '备注',
      '尾部状态',
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
          r.cutTotal ?? '',
          r.sewingQuantity ?? '',
          r.tailReceivedQty ?? '',
          r.tailInboundQty ?? '',
          r.defectQuantity ?? '',
          r.remark ?? '',
          r.finishingStatus,
        ].map(escape).join(','),
      );
    }
    const csv = '\uFEFF' + lines.join('\n');
    const filename = `finishing-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res?.send(csv);
  }

  @Get('items/:orderId/register-form-data')
  getRegisterFormData(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.finishingQueryService.getRegisterFormData(orderId);
  }

  @Post('items/register-receive')
  registerReceive(
    @Body('orderId') orderId: number,
    @Body('tailReceivedQty') tailReceivedQty: number,
    @Body('tailReceivedQuantities') tailReceivedQuantities?: number[],
  ) {
    return this.finishingMutationService.registerReceive(
      Number(orderId),
      Number(tailReceivedQty),
      Array.isArray(tailReceivedQuantities) ? tailReceivedQuantities : null,
    );
  }

  @Post('items/register-packaging-complete')
  registerPackagingComplete(
    @Body('orderId') orderId: number,
    @Body('tailShippedQty') tailShippedQty: number,
    @Body('tailInboundQty') tailInboundQty: number,
    @Body('defectQuantity') defectQuantity: number,
    @Body('remark') remark?: string,
    @Body('tailInboundQuantities') tailInboundQuantities?: number[],
    @Body('defectQuantities') defectQuantities?: number[],
    @CurrentUser() user?: { userId: number; username: string },
  ) {
    return this.finishingMutationService.registerPackagingComplete(
      Number(orderId),
      Number(tailShippedQty ?? 0),
      Number(tailInboundQty ?? 0),
      Number(defectQuantity ?? 0),
      remark ?? null,
      user?.userId,
      Array.isArray(tailInboundQuantities) ? tailInboundQuantities : null,
      Array.isArray(defectQuantities) ? defectQuantities : null,
    );
  }

  @Post('items/register')
  registerPackaging(
    @Body('orderId') orderId: number,
    @Body('tailReceivedQty') tailReceivedQty: number,
    @Body('defectQuantity') defectQuantity: number,
  ) {
    return this.finishingMutationService.registerPackaging(
      Number(orderId),
      Number(tailReceivedQty),
      Number(defectQuantity ?? 0),
    );
  }

  @Post('items/ship')
  ship(
    @Body('orderId') orderId: number,
    @Body('quantity') quantity: number,
  ) {
    return this.finishingMutationService.ship(Number(orderId), Number(quantity ?? 0));
  }

  @Post('items/inbound')
  inbound(
    @Body('orderId') orderId: number,
    @Body('quantity') quantity: number,
    @CurrentUser() user?: { userId: number; username: string },
  ) {
    return this.finishingMutationService.inbound(Number(orderId), Number(quantity ?? 0), user?.userId);
  }

  @Post('items/:orderId/finance-approve')
  financeApprove(
    @Param('orderId', ParseIntPipe) orderId: number,
    @CurrentUser() user?: { userId: number; username: string },
  ) {
    return this.finishingMutationService.financeApproveFinishing(orderId, user?.userId);
  }
}
