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
    @Query('processItem') processItem?: string,
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
      processItem,
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
   * 各状态订单数量（用于状态 Tab 显示数量）
   * GET /orders/status-counts
   *
   * 说明：
   * - 使用与列表相同的筛选条件
   * - 忽略 status（即统计所有状态的分布）
   */
  @Get('status-counts')
  getStatusCounts(
    @Query('orderNo') orderNo?: string,
    @Query('skuCode') skuCode?: string,
    @Query('customer') customer?: string,
    @Query('orderType') orderType?: string,
    @Query('processItem') processItem?: string,
    @Query('salesperson') salesperson?: string,
    @Query('merchandiser') merchandiser?: string,
    @Query('orderDateStart') orderDateStart?: string,
    @Query('orderDateEnd') orderDateEnd?: string,
    @Query('customerDueStart') customerDueStart?: string,
    @Query('customerDueEnd') customerDueEnd?: string,
    @Query('factory') factory?: string,
  ) {
    const query: OrderListQuery = {
      orderNo,
      skuCode,
      customer,
      orderType,
      processItem,
      salesperson,
      merchandiser,
      orderDateStart,
      orderDateEnd,
      customerDueStart,
      customerDueEnd,
      factory,
    };
    return this.ordersService.countByStatus(query);
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
   * body: { ids: number[] }
   */
  @Post('batch-delete')
  @RequirePermission('orders_delete')
  batchDelete(@Body('ids') ids: number[]) {
    return this.ordersService.deleteMany(ids ?? []);
  }

  /**
   * 待审单批量审核
   * POST /orders/review
   * body: { ids: number[] }
   */
  @Post('review')
  @RequirePermission('orders_review')
  review(@Body('ids') ids: number[]) {
    return this.ordersService.reviewMany(ids ?? []);
  }

  /**
   * 批量复制为草稿
   * POST /orders/copy-to-draft
   * body: { ids: number[] }
   */
  @Post('copy-to-draft')
  copyToDraft(@Body('ids') ids: number[]) {
    return this.ordersService.copyManyToDraft(ids ?? []);
  }
}

