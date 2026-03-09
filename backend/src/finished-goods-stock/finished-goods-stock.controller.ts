import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
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
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getList({
      tab: tab ?? 'all',
      orderNo,
      skuCode,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post('outbound')
  outbound(@Body('id') id: number, @Body('quantity') quantity: number) {
    return this.service.outbound(Number(id), Number(quantity));
  }
}
