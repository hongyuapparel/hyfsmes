import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { FabricStockService } from './fabric-stock.service';

@Controller('inventory/fabric')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/inventory/fabric')
export class FabricStockController {
  constructor(private readonly service: FabricStockService) {}

  @Get('supplier-options')
  getFabricSupplierOptions() {
    return this.service.listFabricSupplierOptions();
  }

  @Get('pickup-users')
  getPickupUsers() {
    return this.service.getPickupUserOptions();
  }

  @Get('items')
  getList(
    @Query('name') name?: string,
    @Query('customerName') customerName?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('skipTotal') skipTotal?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getList({
      name,
      customerName,
      startDate,
      endDate,
      skipTotal: skipTotal === 'true' || skipTotal === '1',
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Get('items/:id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(Number(id));
  }

  @Post('items')
  create(
    @Body('name') name: string,
    @Body('quantity') quantity?: number,
    @Body('unit') unit?: string,
    @Body('customerName') customerName?: string,
    @Body('remark') remark?: string,
    @Body('imageUrl') imageUrl?: string,
    @Body('supplierId') supplierId?: unknown,
    @Body('warehouseId') warehouseId?: unknown,
    @Body('storageLocation') storageLocation?: string,
    @CurrentUser() user?: { username?: string },
  ) {
    return this.service.create({
      name,
      quantity,
      unit,
      customerName,
      remark,
      imageUrl,
      supplierId,
      warehouseId,
      storageLocation,
      operatorUsername: user?.username ?? '',
    });
  }

  @Put('items/:id')
  update(
    @Param('id') id: string,
    @Body('name') name?: string,
    @Body('quantity') quantity?: number,
    @Body('unit') unit?: string,
    @Body('customerName') customerName?: string,
    @Body('remark') remark?: string,
    @Body('imageUrl') imageUrl?: string,
    @Body('supplierId') supplierId?: unknown,
    @Body('warehouseId') warehouseId?: unknown,
    @Body('storageLocation') storageLocation?: string,
    @CurrentUser() user?: { username?: string },
  ) {
    return this.service.update(Number(id), {
      name,
      quantity,
      unit,
      customerName,
      remark,
      imageUrl,
      supplierId,
      warehouseId,
      storageLocation,
      operatorUsername: user?.username ?? '',
    });
  }

  @Delete('items/:id')
  remove(@Param('id') id: string, @CurrentUser() user?: { username?: string }) {
    return this.service.remove(Number(id), user?.username ?? '');
  }

  @Post('outbound')
  outbound(
    @Body('id') id: number,
    @Body('quantity') quantity: number,
    @Body('photoUrl') photoUrl: string,
    @Body('remark') remark: string,
    @Body('pickupUserId') pickupUserId?: unknown,
    @CurrentUser() user?: { username?: string },
  ) {
    const uid = Number(pickupUserId);
    if (!Number.isFinite(uid) || uid <= 0) {
      throw new BadRequestException('请选择领取人');
    }
    return this.service.outbound(
      Number(id),
      Number(quantity),
      photoUrl ?? '',
      remark ?? '',
      user?.username ?? '',
      uid,
    );
  }

  @Get('items/:id/logs')
  getLogs(@Param('id') id: string) {
    return this.service.getOperationLogs(Number(id));
  }

  @Get('outbounds')
  getOutbounds(
    @Query('name') name?: string,
    @Query('customerName') customerName?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getOutboundRecords({
      name,
      customerName,
      startDate,
      endDate,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }
}
