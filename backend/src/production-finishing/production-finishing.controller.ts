import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ProductionFinishingService, FinishingListQuery } from './production-finishing.service';

@Controller('production/finishing')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/production/finishing')
export class ProductionFinishingController {
  constructor(private readonly finishingService: ProductionFinishingService) {}

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
    return this.finishingService.getFinishingList(query);
  }

  @Post('items/register')
  registerPackaging(
    @Body('orderId') orderId: number,
    @Body('tailReceivedQty') tailReceivedQty: number,
    @Body('defectQuantity') defectQuantity: number,
  ) {
    return this.finishingService.registerPackaging(
      Number(orderId),
      Number(tailReceivedQty),
      Number(defectQuantity ?? 0),
    );
  }

  @Post('items/ship')
  ship(@Body('orderId') orderId: number) {
    return this.finishingService.ship(Number(orderId));
  }

  @Post('items/inbound')
  inbound(@Body('orderId') orderId: number) {
    return this.finishingService.inbound(Number(orderId));
  }
}
