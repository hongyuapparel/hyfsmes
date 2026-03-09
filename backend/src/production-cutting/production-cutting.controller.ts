import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ProductionCuttingService, CuttingListQuery } from './production-cutting.service';

@Controller('production/cutting')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/production/cutting')
export class ProductionCuttingController {
  constructor(private readonly cuttingService: ProductionCuttingService) {}

  @Get('items')
  getItems(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const query: CuttingListQuery = {
      tab,
      orderNo,
      skuCode,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.cuttingService.getCuttingList(query);
  }

  @Get('items/:orderId/color-size')
  getOrderColorSize(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.cuttingService.getOrderColorSize(orderId);
  }

  @Post('items/complete')
  complete(
    @Body('orderId') orderId: number,
    @Body('cuttingCost') cuttingCost: string,
    @Body('actualCutRows') actualCutRows: { colorName?: string; quantities?: number[]; remark?: string }[],
  ) {
    return this.cuttingService.completeCutting(
      Number(orderId),
      cuttingCost ?? '0',
      Array.isArray(actualCutRows) ? actualCutRows : [],
    );
  }
}
