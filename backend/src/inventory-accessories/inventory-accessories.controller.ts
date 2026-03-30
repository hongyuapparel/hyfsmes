import {
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
import { InventoryAccessoriesService } from './inventory-accessories.service';

@Controller('inventory/accessories')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/inventory/accessories')
export class InventoryAccessoriesController {
  constructor(private readonly service: InventoryAccessoriesService) {}

  /** 出库弹窗「领用人」下拉（全公司用户） */
  @Get('user-options')
  getUserOptions() {
    return this.service.getUserOptions();
  }

  @Get('items')
  getList(
    @Query('name') name?: string,
    @Query('category') category?: string,
    @Query('customerName') customerName?: string,
    @Query('salesperson') salesperson?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getList({
      name,
      category,
      customerName,
      salesperson,
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
    @Body('category') category?: string,
    @Body('quantity') quantity?: number,
    @Body('unit') unit?: string,
    @Body('remark') remark?: string,
    @Body('imageUrl') imageUrl?: string,
    @Body('customerName') customerName?: string,
    @Body('salesperson') salesperson?: string,
    @CurrentUser() user?: { username?: string },
  ) {
    return this.service.create({ name, category, quantity, unit, remark, imageUrl, customerName, salesperson, operatorUsername: user?.username ?? '' });
  }

  @Put('items/:id')
  update(
    @Param('id') id: string,
    @Body('name') name?: string,
    @Body('category') category?: string,
    @Body('quantity') quantity?: number,
    @Body('unit') unit?: string,
    @Body('remark') remark?: string,
    @Body('imageUrl') imageUrl?: string,
    @Body('customerName') customerName?: string,
    @Body('salesperson') salesperson?: string,
    @CurrentUser() user?: { username?: string },
  ) {
    return this.service.update(Number(id), {
      name,
      category,
      quantity,
      unit,
      remark,
      imageUrl,
      customerName,
      salesperson,
      operatorUsername: user?.username ?? '',
    });
  }

  @Delete('items/:id')
  remove(@Param('id') id: string, @CurrentUser() user?: { username?: string }) {
    return this.service.remove(Number(id), user?.username ?? '');
  }

  @Get('items/:id/logs')
  getLogs(@Param('id') id: string) {
    return this.service.getOperationLogs(Number(id));
  }

  /**
   * 出库记录列表
   * GET /inventory/accessories/outbounds
   */
  @Get('outbounds')
  getOutbounds(
    @Query('accessoryId') accessoryId?: string,
    @Query('orderNo') orderNo?: string,
    @Query('outboundType') outboundType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getOutboundRecords({
      accessoryId: accessoryId ? Number(accessoryId) : undefined,
      orderNo,
      outboundType,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  /**
   * 手动出库（领用/调整等）
   * POST /inventory/accessories/outbounds
   */
  @Post('outbounds')
  manualOutbound(
    @Body('accessoryId') accessoryId: number,
    @Body('quantity') quantity: number,
    @Body('remark') remark: string,
    @CurrentUser() user: { userId: number; username: string },
  ) {
    const uid = user?.userId ?? 0;
    const uname = user?.username ?? '';
    return this.service.resolveOperatorLabel(uid, uname).then((operatorUsername) =>
      this.service.outbound({
        accessoryId: Number(accessoryId),
        quantity: Number(quantity),
        outboundType: 'manual',
        operatorUsername,
        remark,
        orderId: null,
        orderNo: '',
      }),
    );
  }
}
