import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProductionPurchaseService } from './production-purchase.service';
import { ProductionPurchaseQueryService } from './production-purchase-query.service';
import { type PurchaseListQuery } from './production-purchase.types';
import type { Response } from 'express';

@Controller('production/purchase')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/production/purchase')
export class ProductionPurchaseController {
  constructor(
    private readonly purchaseService: ProductionPurchaseService,
    private readonly purchaseQueryService: ProductionPurchaseQueryService,
  ) {}

  /**
   * 采购物料列表（已审单订单的物料，支持 tab 与筛选）
   */
  @Get('items')
  getItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('supplier') supplier?: string,
    @Query('orderTypeId') orderTypeIdStr?: string,
    @Query('orderDateStart') orderDateStart?: string,
    @Query('orderDateEnd') orderDateEnd?: string,
    @Query('completedStart') completedStart?: string,
    @Query('completedEnd') completedEnd?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: { userId: number; username: string },
  ) {
    const orderTypeId = orderTypeIdStr ? parseInt(orderTypeIdStr, 10) : undefined;
    const query: PurchaseListQuery = {
      tab,
      orderNo,
      skuCode,
      supplier,
      orderTypeId: Number.isNaN(orderTypeId as number) ? undefined : (orderTypeId as number),
      orderDateStart,
      orderDateEnd,
      completedStart,
      completedEnd,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.purchaseQueryService.getPurchaseItems(query, user?.userId);
  }

  @Get('items/export')
  async exportItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('supplier') supplier?: string,
    @Query('orderTypeId') orderTypeIdStr?: string,
    @Query('orderDateStart') orderDateStart?: string,
    @Query('orderDateEnd') orderDateEnd?: string,
    @Query('completedStart') completedStart?: string,
    @Query('completedEnd') completedEnd?: string,
    @CurrentUser() user?: { userId: number; username: string },
    @Res() res?: Response,
  ) {
    const orderTypeId = orderTypeIdStr ? parseInt(orderTypeIdStr, 10) : undefined;
    const query: PurchaseListQuery = {
      tab,
      orderNo,
      skuCode,
      supplier,
      orderTypeId: Number.isNaN(orderTypeId as number) ? undefined : (orderTypeId as number),
      orderDateStart,
      orderDateEnd,
      completedStart,
      completedEnd,
    };
    const rows = await this.purchaseQueryService.getPurchaseExportRows(query, user?.userId);
    const header = [
      '订单号',
      'SKU',
      '客户',
      '跟单员',
      '订单件数',
      '客户交期',
      '下单时间',
      '到采购时间',
      '完成时间',
      '处理路线',
      '供应商',
      '物料类型',
      '物料名称',
      '颜色',
      '计划用量',
      '实际采购数量',
      '采购金额',
      '状态',
      '备注',
    ];
    const escape = (v: unknown) => {
      const str = v == null ? '' : String(v);
      const escaped = str.replace(/"/g, '""');
      return `"${escaped}"`;
    };
    const lines = [header.map(escape).join(',')];
    for (const r of rows) {
      const completedAt = r.processRoute === 'picking' ? r.pickCompletedAt : r.purchaseCompletedAt;
      const status =
        r.processRoute === 'picking'
          ? r.pickStatus === 'completed'
            ? '领料完成'
            : '待领料'
          : r.purchaseStatus === 'completed'
            ? '采购完成'
            : '等待采购';
      lines.push(
        [
          r.orderNo,
          r.skuCode,
          r.customerName,
          r.merchandiser,
          r.orderQuantity,
          r.customerDueDate ?? '',
          r.orderDate ?? '',
          r.pendingPurchaseAt ?? '',
          completedAt ?? '',
          r.processRoute === 'picking' ? '领料' : '采购',
          r.supplierName,
          r.materialType,
          r.materialName,
          r.color,
          r.planQuantity ?? '',
          r.actualPurchaseQuantity ?? '',
          r.purchaseAmount ?? '',
          status,
          r.purchaseRemark ?? '',
        ].map(escape).join(','),
      );
    }
    const csv = '\uFEFF' + lines.join('\n');
    const filename = `purchase-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res?.send(csv);
  }

  /**
   * 登记实际采购（完成后状态为采购完成）
   */
  @Post('items/register')
  @RequirePermission('production_purchase_register')
  register(
    @Body('orderId') orderId: number,
    @Body('materialIndex') materialIndex: number,
    @Body('actualPurchaseQuantity') actualPurchaseQuantity: number,
    @Body('unitPrice') unitPrice: string,
    @Body('otherCost') otherCost: string,
    @Body('remark') remark: string | null,
    @Body('imageUrl') imageUrl: string | null,
    @CurrentUser() user?: { userId: number; username: string },
  ) {
    return this.purchaseService.registerPurchase(
      Number(orderId),
      Number(materialIndex),
      Number(actualPurchaseQuantity),
      unitPrice == null ? '0' : String(unitPrice),
      otherCost == null ? '0' : String(otherCost),
      remark,
      imageUrl,
      user?.userId,
    );
  }

  /**
   * 登记领料（可选择库存扣减或仅备注处理）
   */
  @Post('items/pick')
  @RequirePermission('production_purchase_register')
  registerPick(
    @Body('orderId') orderId: number,
    @Body('materialIndex') materialIndex: number,
    @Body('inventorySourceType') inventorySourceType?: 'fabric' | 'accessory' | 'finished' | null,
    @Body('inventoryId') inventoryId?: number | null,
    @Body('quantity') quantity?: number | null,
    @Body('stockBatch') stockBatch?: string | null,
    @Body('stockColorCode') stockColorCode?: string | null,
    @Body('stockSpec') stockSpec?: string | null,
    @Body('remark') remark?: string | null,
    @CurrentUser() user?: { userId: number; username: string },
  ) {
    return this.purchaseService.registerPicking({
      orderId: Number(orderId),
      materialIndex: Number(materialIndex),
      inventorySourceType: inventorySourceType ?? null,
      inventoryId: inventoryId != null ? Number(inventoryId) : null,
      quantity: quantity != null ? Number(quantity) : null,
      stockBatch: stockBatch ?? null,
      stockColorCode: stockColorCode ?? null,
      stockSpec: stockSpec ?? null,
      remark: remark ?? null,
      actorUserId: user?.userId,
      actorUsername: user?.username,
    });
  }
}
