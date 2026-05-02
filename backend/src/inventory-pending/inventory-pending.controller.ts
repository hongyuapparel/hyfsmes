import { Body, Controller, Get, Logger, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { InventoryPendingService } from './inventory-pending.service';
import { errMsg } from '../common/http-exception.filter';

@Controller('inventory/pending')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/inventory/pending')
export class InventoryPendingController {
  private readonly logger = new Logger(InventoryPendingController.name);

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

  @Get('pickup-users')
  getPickupUsers() {
    return this.service.getPickupUserOptions();
  }

  @Post('outbound')
  async doOutbound(
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
    try {
      return await this.service.doOutbound(
        normalizedItems,
        user?.username ?? '',
        pickupUserId != null ? Number(pickupUserId) : null,
      );
    } catch (e: unknown) {
      const err = e as { stack?: unknown } | null;
      this.logger.error('[doOutbound] route=POST /inventory/pending/outbound failed');
      this.logger.error(`[doOutbound] message=${errMsg(e)}`);
      this.logger.error(`[doOutbound] stack=${String(err?.stack || '')}`);
      throw e;
    }
  }
}
