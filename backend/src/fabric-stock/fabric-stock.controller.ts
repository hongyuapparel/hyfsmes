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
    @Body('remark') remark?: string,
    @Body('imageUrl') imageUrl?: string,
  ) {
    return this.service.create({ name, quantity, unit, remark, imageUrl });
  }

  @Put('items/:id')
  update(
    @Param('id') id: string,
    @Body('name') name?: string,
    @Body('quantity') quantity?: number,
    @Body('unit') unit?: string,
    @Body('remark') remark?: string,
    @Body('imageUrl') imageUrl?: string,
  ) {
    return this.service.update(Number(id), { name, quantity, unit, remark, imageUrl });
  }

  @Delete('items/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(Number(id));
  }

  @Post('outbound')
  outbound(
    @Body('id') id: number,
    @Body('quantity') quantity: number,
    @Body('photoUrl') photoUrl: string,
    @Body('remark') remark: string,
  ) {
    return this.service.outbound(Number(id), Number(quantity), photoUrl ?? '', remark ?? '');
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
