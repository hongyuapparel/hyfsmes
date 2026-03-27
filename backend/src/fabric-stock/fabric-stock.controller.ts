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
import { FabricStockService } from './fabric-stock.service';

@Controller('inventory/fabric')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/inventory/fabric')
export class FabricStockController {
  constructor(private readonly service: FabricStockService) {}

  @Get('items')
  getList(
    @Query('name') name?: string,
    @Query('customerName') customerName?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getList({
      name,
      customerName,
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
    @CurrentUser() user?: { username?: string },
  ) {
    return this.service.create({ name, quantity, unit, customerName, remark, imageUrl, operatorUsername: user?.username ?? '' });
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
    @CurrentUser() user?: { username?: string },
  ) {
    return this.service.update(Number(id), { name, quantity, unit, customerName, remark, imageUrl, operatorUsername: user?.username ?? '' });
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
    @CurrentUser() user?: { username?: string },
  ) {
    return this.service.outbound(Number(id), Number(quantity), photoUrl ?? '', remark ?? '', user?.username ?? '');
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
