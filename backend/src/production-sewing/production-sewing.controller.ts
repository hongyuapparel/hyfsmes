import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ProductionSewingService, SewingListQuery } from './production-sewing.service';

@Controller('production/sewing')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/production/sewing')
export class ProductionSewingController {
  constructor(private readonly sewingService: ProductionSewingService) {}

  @Get('items')
  getItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const query: SewingListQuery = {
      tab,
      orderNo,
      skuCode,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.sewingService.getSewingList(query);
  }

  @Post('items/complete')
  complete(
    @Body('orderId') orderId: number,
    @Body('sewingQuantity') sewingQuantity: number,
    @Body('defectQuantity') defectQuantity: number,
    @Body('defectReason') defectReason: string,
  ) {
    return this.sewingService.completeSewing(
      Number(orderId),
      Number(sewingQuantity),
      Number(defectQuantity ?? 0),
      defectReason ?? '',
    );
  }
}
