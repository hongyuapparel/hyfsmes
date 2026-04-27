import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProductionCraftService, CraftListQuery } from './production-craft.service';
import type { Response } from 'express';

@Controller('production/process')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/production/process')
export class ProductionCraftController {
  constructor(private readonly craftService: ProductionCraftService) {}

  @Get('items')
  getItems(
    @Query('tab') tab?: string,
    @Query('supplier') supplier?: string,
    @Query('processItem') processItem?: string,
    @Query('orderTypeId') orderTypeIdStr?: string,
    @Query('collaborationTypeId') collaborationTypeIdStr?: string,
    @Query('orderDateStart') orderDateStart?: string,
    @Query('orderDateEnd') orderDateEnd?: string,
    @Query('completedStart') completedStart?: string,
    @Query('completedEnd') completedEnd?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: { userId: number; username: string },
  ) {
    const orderTypeId = orderTypeIdStr ? parseInt(orderTypeIdStr, 10) : undefined;
    const collaborationTypeId = collaborationTypeIdStr ? parseInt(collaborationTypeIdStr, 10) : undefined;
    const query: CraftListQuery = {
      tab,
      supplier,
      processItem,
      orderTypeId: Number.isNaN(orderTypeId as number) ? undefined : (orderTypeId as number),
      collaborationTypeId: Number.isNaN(collaborationTypeId as number)
        ? undefined
        : (collaborationTypeId as number),
      orderDateStart,
      orderDateEnd,
      completedStart,
      completedEnd,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.craftService.getCraftList(query, user?.userId);
  }

  @Get('items/export')
  async exportItems(
    @Query('tab') tab?: string,
    @Query('supplier') supplier?: string,
    @Query('processItem') processItem?: string,
    @Query('orderTypeId') orderTypeIdStr?: string,
    @Query('collaborationTypeId') collaborationTypeIdStr?: string,
    @Query('orderDateStart') orderDateStart?: string,
    @Query('orderDateEnd') orderDateEnd?: string,
    @Query('completedStart') completedStart?: string,
    @Query('completedEnd') completedEnd?: string,
    @CurrentUser() user?: { userId: number; username: string },
    @Res() res?: Response,
  ) {
    const orderTypeId = orderTypeIdStr ? parseInt(orderTypeIdStr, 10) : undefined;
    const collaborationTypeId = collaborationTypeIdStr ? parseInt(collaborationTypeIdStr, 10) : undefined;
    const query: CraftListQuery = {
      tab,
      supplier,
      processItem,
      orderTypeId: Number.isNaN(orderTypeId as number) ? undefined : (orderTypeId as number),
      collaborationTypeId: Number.isNaN(collaborationTypeId as number)
        ? undefined
        : (collaborationTypeId as number),
      orderDateStart,
      orderDateEnd,
      completedStart,
      completedEnd,
    };
    const rows = await this.craftService.getCraftExportRows(query, user?.userId);
    const header = [
      '订单号',
      'SKU',
      '客户',
      '跟单员',
      '订单数量',
      '客户交期',
      '下单时间',
      '到工艺时间',
      '工艺完成时间',
      '供应商',
      '工艺项目',
      '采购状态',
      '工艺状态',
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
          r.merchandiser,
          r.quantity,
          r.customerDueDate ?? '',
          r.orderDate ?? '',
          r.arrivedAtCraft ?? '',
          r.completedAt ?? '',
          r.supplierName,
          r.processItem,
          r.purchaseStatus,
          r.craftStatus,
        ].map(escape).join(','),
      );
    }
    const csv = '\uFEFF' + lines.join('\n');
    const filename = `craft-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res?.send(csv);
  }

  @Post('items/complete')
  @RequirePermission('production_process_complete')
  complete(
    @Body('orderId') orderId: number,
    @CurrentUser() user: { userId: number; username: string },
  ) {
    return this.craftService.completeCraft(Number(orderId), user.userId);
  }
}
