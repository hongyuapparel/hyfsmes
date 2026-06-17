import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { PackingListsService } from './packing-lists.service';
import { PackingListsPickableService } from './packing-lists-pickable.service';
import { PackingListsShipService } from './packing-lists-ship.service';
import { XiaomanService } from '../xiaoman/xiaoman.service';
import { SavePackingListDto } from './dto';

@Controller('packing-lists')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/inventory/packing')
export class PackingListsController {
  constructor(
    private readonly service: PackingListsService,
    private readonly pickableService: PackingListsPickableService,
    private readonly shipService: PackingListsShipService,
    private readonly xiaomanService: XiaomanService,
  ) {}

  @Get('xiaoman/orders')
  searchXiaomanOrders(
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.xiaomanService.getOrderList(page ? parseInt(page, 10) : 1, pageSize ? parseInt(pageSize, 10) : 20, keyword);
  }

  @Post(':id/ship')
  ship(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { userId: number; username: string }) {
    return this.shipService.ship(id, user?.username ?? '');
  }

  @Get('pickable/pending')
  getPendingPickable(
    @Query('customerName') customerName?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.pickableService.getPendingPickable({
      customerName,
      keyword,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Get('pickable/finished')
  getFinishedPickable(
    @Query('customerName') customerName?: string,
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.pickableService.getFinishedPickable({
      customerName,
      keyword,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Get()
  getList(
    @Query('status') status?: string,
    @Query('customerName') customerName?: string,
    @Query('keyword') keyword?: string,
    @Query('xiaomanOrderNo') xiaomanOrderNo?: string,
    @Query('serviceManager') serviceManager?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.getList({
      status,
      customerName,
      keyword,
      xiaomanOrderNo,
      serviceManager,
      dateFrom,
      dateTo,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    });
  }

  @Get(':id/logs')
  getLogs(@Param('id', ParseIntPipe) id: number) {
    return this.service.getLogs(id);
  }

  @Get(':id')
  getDetail(@Param('id', ParseIntPipe) id: number) {
    return this.service.getDetail(id);
  }

  @Post()
  create(@Body() payload: SavePackingListDto, @CurrentUser() user: { userId: number; username: string }) {
    return this.service.create(payload, user?.username ?? '');
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: SavePackingListDto,
    @CurrentUser() user: { userId: number; username: string },
  ) {
    return this.service.update(id, payload, user?.username ?? '');
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { userId: number; username: string }) {
    return this.service.remove(id, user?.username ?? '');
  }
}
