import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ProductionPurchaseService, PurchaseListQuery } from './production-purchase.service';

@Controller('production/purchase')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/production/purchase')
export class ProductionPurchaseController {
  constructor(private readonly purchaseService: ProductionPurchaseService) {}

  /**
   * 采购物料列表（已审单订单的物料，支持 tab 与筛选）
   */
  @Get('items')
  getItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('supplier') supplier?: string,
    @Query('orderType') orderType?: string,
    @Query('orderDateStart') orderDateStart?: string,
    @Query('orderDateEnd') orderDateEnd?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const query: PurchaseListQuery = {
      tab,
      orderNo,
      skuCode,
      supplier,
      orderType,
      orderDateStart,
      orderDateEnd,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.purchaseService.getPurchaseItems(query);
  }

  /**
   * 登记实际采购（完成后状态为采购完成）
   */
  @Post('items/register')
  register(
    @Body('orderId') orderId: number,
    @Body('materialIndex') materialIndex: number,
    @Body('actualPurchaseQuantity') actualPurchaseQuantity: number,
    @Body('purchaseAmount') purchaseAmount: string,
  ) {
    return this.purchaseService.registerPurchase(
      Number(orderId),
      Number(materialIndex),
      Number(actualPurchaseQuantity),
      purchaseAmount == null ? '0' : String(purchaseAmount),
    );
  }
}
