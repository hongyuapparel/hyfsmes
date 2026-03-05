import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { OrdersService, OrderListQuery, OrderEditPayload } from './orders.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/orders/list')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * 订单列表
   * GET /orders
   *
   * 支持的查询参数见 OrderListQuery
   */
  @Get()
  findAll(
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('customer') customer?: string,
    @Query('orderType') orderType?: string,
    @Query('secondaryProcess') secondaryProcess?: string,
    @Query('salesperson') salesperson?: string,
    @Query('merchandiser') merchandiser?: string,
    @Query('orderDateStart') orderDateStart?: string,
    @Query('orderDateEnd') orderDateEnd?: string,
    @Query('customerDueStart') customerDueStart?: string,
    @Query('customerDueEnd') customerDueEnd?: string,
    @Query('factory') factory?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const query: OrderListQuery = {
      orderNo,
      skuCode,
      customer,
      orderType,
      secondaryProcess,
      salesperson,
      merchandiser,
      orderDateStart,
      orderDateEnd,
      customerDueStart,
      customerDueEnd,
      factory,
      status,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.ordersService.findAll(query);
  }

  /**
   * 获取订单详情（编辑回显）
   * GET /orders/:id
   */
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  /**
   * 新建草稿
   * POST /orders
   */
  @Post()
  createDraft(@Body() body: OrderEditPayload) {
    return this.ordersService.createDraft(body);
  }

  /**
   * 保存草稿
   * PUT /orders/:id
   */
  @Put(':id')
  updateDraft(@Param('id', ParseIntPipe) id: number, @Body() body: OrderEditPayload) {
    return this.ordersService.updateDraft(id, body);
  }

  /**
   * 保存并提交（状态改为 pending_review）
   * POST /orders/:id/submit
   */
  @Post(':id/submit')
  submit(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.submit(id);
  }

  /**
   * 批量删除订单
   * POST /orders/batch-delete
   */
  @Post('batch-delete')
  @RequirePermission('orders_delete')
  batchDelete(@Body() body: { ids?: number[] }) {
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    return this.ordersService.batchDelete(ids);
  }

  /**
   * 批量审单（仅待审单状态）
   * POST /orders/review
   */
  @Post('review')
  @RequirePermission('orders_review')
  review(@Body() body: { ids?: number[] }) {
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    return this.ordersService.review(ids);
  }
}

