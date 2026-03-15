import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
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
      warehouseId,
      inventoryTypeId,
      department,
      location,
      imageUrl,
    });
  }

  @Post('outbound')
  outbound(
    @Body('id') id: number,
    @Body('quantity') quantity: number,
    @Body('remark') remark: string,
    @CurrentUser() user: { userId: number; username: string },
  ) {
    return this.service.outbound(Number(id), Number(quantity), user?.username ?? '', remark ?? '');
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
