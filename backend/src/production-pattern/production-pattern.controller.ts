import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ProductionPatternService, PatternListQuery } from './production-pattern.service';
import { CurrentUser } from '../auth/current-user.decorator';
import type { Response } from 'express';

@Controller('production/pattern')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/production/pattern')
export class ProductionPatternController {
  constructor(private readonly patternService: ProductionPatternService) {}

  @Get('items')
  getItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('patternMaster') patternMaster?: string,
    @Query('sampleMaker') sampleMaker?: string,
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
    const query: PatternListQuery = {
      tab,
      orderNo,
      skuCode,
      patternMaster,
      sampleMaker,
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
    return this.patternService.getPatternList(query, user?.userId);
  }

  @Get('items/export')
  async exportItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('patternMaster') patternMaster?: string,
    @Query('sampleMaker') sampleMaker?: string,
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
    const query: PatternListQuery = {
      tab,
      orderNo,
      skuCode,
      patternMaster,
      sampleMaker,
      orderTypeId: Number.isNaN(orderTypeId as number) ? undefined : (orderTypeId as number),
      collaborationTypeId: Number.isNaN(collaborationTypeId as number)
        ? undefined
        : (collaborationTypeId as number),
      orderDateStart,
      orderDateEnd,
      completedStart,
      completedEnd,
    };
    const rows = await this.patternService.getPatternExportRows(query, user?.userId);
    const header = [
      '订单号',
      'SKU',
      '客户',
      '业务员',
      '跟单员',
      '订单数量',
      '客户交期',
      '下单时间',
      '纸样师',
      '车版师',
      '纸样状态',
      '纸样完成时间',
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
          r.orderDate ?? '',
          r.patternMaster,
          r.sampleMaker,
          r.patternStatus,
          r.completedAt ?? '',
        ].map(escape).join(','),
      );
    }
    const csv = '\uFEFF' + lines.join('\n');
    const filename = `pattern-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res?.send(csv);
  }

  @Post('items/assign')
  @RequirePermission('production_pattern_assign')
  assign(
    @Body('orderId') orderId: number,
    @Body('patternMaster') patternMaster: string,
    @Body('sampleMaker') sampleMaker: string,
  ) {
    return this.patternService.assignPattern(
      Number(orderId),
      patternMaster ?? '',
      sampleMaker ?? '',
    );
  }

  @Post('items/complete')
  @RequirePermission('production_pattern_complete')
  complete(
    @Body('orderId') orderId: number,
    @Body('sampleImageUrl') sampleImageUrl: string,
    @CurrentUser() user: { userId: number; username: string },
  ) {
    return this.patternService.completePattern(Number(orderId), sampleImageUrl ?? '', user?.userId);
  }

  @Get('items/:orderId/materials')
  getMaterials(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.patternService.getPatternMaterials(orderId);
  }

  @Post('items/:orderId/materials')
  @RequirePermission('production_pattern_materials')
  saveMaterials(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body('materials') materials: any[],
    @Body('remark') remark?: string,
  ) {
    return this.patternService.savePatternMaterials(orderId, Array.isArray(materials) ? materials : [], remark ?? null);
  }
}
