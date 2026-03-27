import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
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
    @Query('orderTypeId') orderTypeIdStr?: string,
    @Query('orderDateStart') orderDateStart?: string,
    @Query('orderDateEnd') orderDateEnd?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
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
