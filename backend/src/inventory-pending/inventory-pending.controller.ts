import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { InventoryPendingService } from './inventory-pending.service';

@Controller('inventory/pending')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/inventory/pending')
export class InventoryPendingController {
  constructor(private readonly service: InventoryPendingService) {}

  @Get('items')
  getList(
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getList({
      orderNo,
      skuCode,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post('inbound')
  doInbound(
    @Body('ids') ids: number[],
    @Body('warehouse') warehouse: string,
    @Body('department') department: string,
    @Body('location') location: string,
    @Body('imageUrl') imageUrl?: string,
  ) {
    return this.service.doInbound(
      Array.isArray(ids) ? ids : [ids].filter(Number),
      warehouse ?? '',
      department ?? '',
      location ?? '',
      imageUrl,
    );
  }
}
