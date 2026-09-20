import { Body, Controller, Get, Post, Query, UseGuards, Res, HttpCode, HttpStatus, UsePipes, ValidationPipe } from '@nestjs/common';
import type { Response } from 'express';
import { OutboundExportDto } from '../common/outbound-export.dto';
import { collectOutboundExportRows, buildOutboundWorkbook, sendOutboundWorkbook } from '../common/outbound-export-workbook';
import { pendingOutboundLine, outboundColumns } from '../common/outbound-export-rows';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { InventoryPendingService } from './inventory-pending.service';

@Controller('inventory/pending')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/inventory/pending')
export class InventoryPendingController {
  constructor(private readonly service: InventoryPendingService) {}

  @Get('items')
  getList(
    @Query('tab') tab?: string,
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getList({
      tab,
      orderNo,
      skuCode,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Post('inbound')
  doInbound(
    @Body('ids') ids: number[],
    @Body('warehouseId') warehouseId: number | null,
    @Body('inventoryTypeId') inventoryTypeId: number | null,
    @Body('department') department: string,
    @Body('location') location: string,
    @Body('imageUrl') imageUrl?: string,
    @CurrentUser() user?: { userId: number; username: string },
  ) {
    return this.service.doInbound(
      Array.isArray(ids) ? ids : [ids].filter(Number),
      warehouseId != null ? Number(warehouseId) : null,
      inventoryTypeId != null ? Number(inventoryTypeId) : null,
      department ?? '',
      location ?? '',
      imageUrl,
      user?.username ?? '',
    );
  }

  @Post('outbounds/export')
  @HttpCode(HttpStatus.OK)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  async exportOutbounds(@Body() dto: OutboundExportDto, @Res() res: Response) {
    const rows = await collectOutboundExportRows(dto, query => this.service.getList({ ...query, tab: 'shipped' }));
    sendOutboundWorkbook(res, await buildOutboundWorkbook('待仓已发货记录', outboundColumns.pending, rows.map(pendingOutboundLine)));
  }

  @Get('pickup-users')
  getPickupUsers() {
    return this.service.getPickupUserOptions();
  }

  @Post('outbound')
  doOutbound(
    @Body('items') items: Array<{ id: number; quantity: number; sizeBreakdown?: unknown }> | undefined,
    @Body('id') id: number,
    @Body('quantity') quantity: number,
    @Body('pickupUserId') pickupUserId: number | null,
    @Body('sizeBreakdown') sizeBreakdown: unknown,
    @CurrentUser() user: { userId: number; username: string },
  ) {
    const normalizedItems =
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
          ];
    return this.service.doOutbound(
      normalizedItems,
      user?.username ?? '',
      pickupUserId != null ? Number(pickupUserId) : null,
    );
  }
}
