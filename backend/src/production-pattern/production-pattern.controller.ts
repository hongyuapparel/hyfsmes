import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ProductionPatternService, PatternListQuery } from './production-pattern.service';

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
    @Query('orderType') orderType?: string,
    @Query('collaborationType') collaborationType?: string,
    @Query('purchaseStatus') purchaseStatus?: string,
    @Query('orderDateStart') orderDateStart?: string,
    @Query('orderDateEnd') orderDateEnd?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const query: PatternListQuery = {
      tab,
      orderNo,
      skuCode,
      orderType,
      collaborationType,
      purchaseStatus,
      orderDateStart,
      orderDateEnd,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.patternService.getPatternList(query);
  }

  @Post('items/assign')
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
  complete(@Body('orderId') orderId: number, @Body('sampleImageUrl') sampleImageUrl: string) {
    return this.patternService.completePattern(Number(orderId), sampleImageUrl ?? '');
  }
}
