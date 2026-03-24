import { Body, Controller, Get, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { FinishedGoodsStockService } from './finished-goods-stock.service';

@Controller('inventory/finished')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/inventory/finished')
export class FinishedGoodsStockController {
  constructor(private readonly service: FinishedGoodsStockService) {}

  @Get('items')
  getList(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('customerName') customerName?: string,
    @Query('inventoryTypeId') inventoryTypeIdStr?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const inventoryTypeId =
      inventoryTypeIdStr != null && inventoryTypeIdStr !== ''
        ? Number(inventoryTypeIdStr)
        : undefined;
    return this.service.getList({
      tab: tab ?? 'all',
      orderNo,
      skuCode,
      customerName,
      inventoryTypeId,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post('items')
  createManual(
    @Body('orderNo') orderNo: string,
    @Body('skuCode') skuCode: string,
    @Body('quantity') quantity: number,
    @Body('unitPrice') unitPrice: string | number,
    @Body('warehouseId') warehouseId: number | null,
    @Body('inventoryTypeId') inventoryTypeId: number | null,
    @Body('department') department: string,
    @Body('location') location: string,
    @Body('imageUrl') imageUrl?: string,
  ) {
    return this.service.createManual({
      orderNo,
      skuCode,
      quantity: Number(quantity),
      unitPrice,
      warehouseId,
      inventoryTypeId,
      department,
      location,
      imageUrl,
    });
  }

  @Post('outbound')
  outbound(
    @Body('items') items: Array<{ id: number; quantity: number; sizeBreakdown?: any }> | undefined,
    @Body('id') id: number,
    @Body('quantity') quantity: number,
    @Body('pickupUserId') pickupUserId: number | null,
    @Body('sizeBreakdown') sizeBreakdown: any,
    @Body('remark') remark: string,
    @CurrentUser() user: { userId: number; username: string },
  ) {
    return this.service.outbound(
      Array.isArray(items) && items.length
        ? items.map((item) => ({
            id: Number(item?.id),
            quantity: Number(item?.quantity),
            sizeBreakdown: item?.sizeBreakdown ?? null,
          }))
        : [
            {
              id: Number(id),
              quantity: Number(quantity),
              sizeBreakdown: sizeBreakdown ?? null,
            },
          ],
      user?.username ?? '',
      remark ?? '',
      pickupUserId != null ? Number(pickupUserId) : null,
    );
  }

  @Get('pickup-users')
  getPickupUsers() {
    return this.service.getPickupUserOptions();
  }

  @Get('items/:id')
  getDetail(@Param('id') id: string) {
    return this.service.getDetail(Number(id));
  }

  @Patch('items/:id')
  updateMeta(
    @Param('id') id: string,
    @Body('department') department: string | undefined,
    @Body('inventoryTypeId') inventoryTypeId: number | null | undefined,
    @Body('warehouseId') warehouseId: number | null | undefined,
    @Body('location') location: string | undefined,
    @Body('imageUrl') imageUrl: string | undefined,
    @Body('remark') remark: string | undefined,
    @CurrentUser() user: { userId: number; username: string },
  ) {
    return this.service.updateMeta(
      Number(id),
      { department, inventoryTypeId, warehouseId, location, imageUrl, remark },
      user?.username ?? '',
    );
  }

  @Put('items/:id/color-images')
  upsertColorImage(
    @Param('id') id: string,
    @Body('colorName') colorName: string,
    @Body('imageUrl') imageUrl: string,
  ) {
    return this.service.upsertColorImage(Number(id), { colorName, imageUrl });
  }

  @Get('outbounds')
  getOutbounds(
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('customerName') customerName?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getOutboundRecords({
      orderNo,
      skuCode,
      customerName,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }
}
