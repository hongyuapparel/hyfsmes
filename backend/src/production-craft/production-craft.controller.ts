import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ProductionCraftService, CraftListQuery } from './production-craft.service';

@Controller('production/process')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/production/process')
export class ProductionCraftController {
  constructor(private readonly craftService: ProductionCraftService) {}

  @Get('items')
  getItems(
    @Query('tab') tab?: string,
    @Query('supplier') supplier?: string,
    @Query('processItem') processItem?: string,
    @Query('orderTypeId') orderTypeIdStr?: string,
    @Query('collaborationTypeId') collaborationTypeIdStr?: string,
    @Query('orderDateStart') orderDateStart?: string,
    @Query('orderDateEnd') orderDateEnd?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const orderTypeId = orderTypeIdStr ? parseInt(orderTypeIdStr, 10) : undefined;
    const collaborationTypeId = collaborationTypeIdStr ? parseInt(collaborationTypeIdStr, 10) : undefined;
    const query: CraftListQuery = {
      tab,
      supplier,
      processItem,
      orderTypeId: Number.isNaN(orderTypeId as number) ? undefined : (orderTypeId as number),
      collaborationTypeId: Number.isNaN(collaborationTypeId as number)
        ? undefined
        : (collaborationTypeId as number),
      orderDateStart,
      orderDateEnd,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.craftService.getCraftList(query);
  }

  @Post('items/complete')
  complete(@Body('orderId') orderId: number) {
    return this.craftService.completeCraft(Number(orderId));
  }
}
