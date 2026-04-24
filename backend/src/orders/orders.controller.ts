import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { type OrderListQuery, type OrderEditPayload, type OrderActor } from './orders.service';
import { OrderQueryService } from './order-query.service';
import { OrderMutationService } from './order-mutation.service';
import { OrderStatusService } from './order-status.service';

@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/orders/list')
export class OrdersController {
  constructor(
    private readonly orderQueryService: OrderQueryService,
    private readonly orderMutationService: OrderMutationService,
    private readonly orderStatusService: OrderStatusService,
  ) {}

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
    @Query('orderTypeId') orderTypeIdStr?: string,
    @Query('processItem') processItem?: string,
    @Query('collaborationTypeId') collaborationTypeIdStr?: string,
    @Query('salesperson') salesperson?: string,
    @Query('merchandiser') merchandiser?: string,
    @Query('orderDateStart') orderDateStart?: string,
    @Query('orderDateEnd') orderDateEnd?: string,
    @Query('completedStart') completedStart?: string,
    @Query('completedEnd') completedEnd?: string,
    @Query('customerDueStart') customerDueStart?: string,
    @Query('customerDueEnd') customerDueEnd?: string,
    @Query('factory') factory?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @CurrentUser() user?: { userId: number; username: string },
  ) {
    const orderTypeId = orderTypeIdStr ? parseInt(orderTypeIdStr, 10) : undefined;
    const collaborationTypeId = collaborationTypeIdStr ? parseInt(collaborationTypeIdStr, 10) : undefined;
    const query: OrderListQuery = {
      orderNo,
      skuCode,
      customer,
      orderTypeId: Number.isNaN(orderTypeId as number) ? undefined : (orderTypeId as number),
      processItem,
      collaborationTypeId: Number.isNaN(collaborationTypeId as number)
        ? undefined
        : (collaborationTypeId as number),
      salesperson,
      merchandiser,
      orderDateStart,
      orderDateEnd,
      completedStart,
      completedEnd,
      customerDueStart,
      customerDueEnd,
      factory,
      status,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 20,
    };
    return this.orderQueryService.findAll(query, user?.userId);
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
    @Query('orderTypeId') orderTypeIdStr?: string,
    @Query('processItem') processItem?: string,
    @Query('collaborationTypeId') collaborationTypeIdStr?: string,
    @Query('salesperson') salesperson?: string,
    @Query('merchandiser') merchandiser?: string,
    @Query('orderDateStart') orderDateStart?: string,
    @Query('orderDateEnd') orderDateEnd?: string,
    @Query('completedStart') completedStart?: string,
    @Query('completedEnd') completedEnd?: string,
    @Query('customerDueStart') customerDueStart?: string,
    @Query('customerDueEnd') customerDueEnd?: string,
    @Query('factory') factory?: string,
    @CurrentUser() user?: { userId: number; username: string },
  ) {
    const orderTypeId = orderTypeIdStr ? parseInt(orderTypeIdStr, 10) : undefined;
    const collaborationTypeId = collaborationTypeIdStr ? parseInt(collaborationTypeIdStr, 10) : undefined;
    const query: OrderListQuery = {
      orderNo,
      skuCode,
      customer,
      orderTypeId: Number.isNaN(orderTypeId as number) ? undefined : (orderTypeId as number),
      processItem,
      collaborationTypeId: Number.isNaN(collaborationTypeId as number)
        ? undefined
        : (collaborationTypeId as number),
      salesperson,
      merchandiser,
      orderDateStart,
      orderDateEnd,
      completedStart,
      completedEnd,
      customerDueStart,
      customerDueEnd,
      factory,
    };
    return this.orderQueryService.countByStatus(query, user?.userId);
  }

  /**
   * 获取订单详情（编辑回显）
   * GET /orders/:id
   */
  @Get(':id')
  // 详情页（含打印）是查看行为，不应受“可编辑状态”策略约束（如 completed）。
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orderQueryService.findOne(id);
  }

  /**
   * 获取订单尺码数量追踪明细（列表数量悬停用）
   * GET /orders/:id/size-breakdown
   */
  @Get(':id/size-breakdown')
  getSizeBreakdown(@Param('id', ParseIntPipe) id: number) {
    return this.orderQueryService.getSizeBreakdown(id);
  }

  /**
   * 获取订单颜色尺码数量明细（待入库数量悬停用）
   * GET /orders/:id/color-size-breakdown
   */
  @Get(':id/color-size-breakdown')
  getColorSizeBreakdown(@Param('id', ParseIntPipe) id: number) {
    return this.orderQueryService.getColorSizeBreakdown(id);
  }

  /**
   * 新建草稿
   * POST /orders
   */
  @Post()
  @RequirePermission('orders_edit')
  createDraft(@Body() body: OrderEditPayload, @CurrentUser() user: { userId: number; username: string }) {
    const actor: OrderActor = { userId: user.userId, username: user.username };
    return this.orderMutationService.createDraft(body, actor);
  }

  /**
   * 保存草稿
   * PUT /orders/:id
   */
  @Put(':id')
  @RequirePermission('orders_edit')
  async updateDraft(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: OrderEditPayload,
    @CurrentUser() user: { userId: number; username: string },
  ) {
    await this.orderStatusService.assertOrderActionById(id, user.userId, 'edit');
    const actor: OrderActor = { userId: user.userId, username: user.username };
    return this.orderMutationService.updateDraft(id, body, actor);
  }

  /**
   * 保存并提交（状态改为 pending_review）
   * POST /orders/:id/submit
   */
  @Post(':id/submit')
  @RequirePermission('orders_edit')
  async submit(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: { userId: number; username: string }) {
    await this.orderStatusService.assertOrderActionById(id, user.userId, 'edit');
    const actor: OrderActor = { userId: user.userId, username: user.username };
    return this.orderMutationService.submit(id, actor);
  }

  /**
   * 批量删除订单
   * POST /orders/batch-delete
   * body: { ids: number[] }
   */
  @Post('batch-delete')
  @RequirePermission('orders_delete')
  async batchDelete(
    @Body('ids') ids: number[],
    @CurrentUser() user: { userId: number; username: string },
  ) {
    await this.orderStatusService.assertOrderActionByIds(ids ?? [], user.userId, 'delete');
    const actor: OrderActor = { userId: user.userId, username: user.username };
    return this.orderMutationService.deleteMany(ids ?? [], actor);
  }

  /**
   * 待审单批量审核
   * POST /orders/review
   * body: { ids: number[] }
   */
  @Post('review')
  @RequirePermission('orders_review')
  async review(
    @Body('ids') ids: number[],
    @CurrentUser() user: { userId: number; username: string },
  ) {
    await this.orderStatusService.assertOrderActionByIds(ids ?? [], user.userId, 'review');
    const actor: OrderActor = { userId: user.userId, username: user.username };
    return this.orderMutationService.reviewMany(ids ?? [], actor);
  }

  /**
   * 待审单批量审核退回（退回为草稿并记录原因）
   * POST /orders/review/reject
   * body: { ids: number[]; reason: string }
   */
  @Post('review/reject')
  @RequirePermission('orders_review')
  async reviewReject(
    @Body('ids') ids: number[],
    @Body('reason') reason: string,
    @CurrentUser() user: { userId: number; username: string },
  ) {
    await this.orderStatusService.assertOrderActionByIds(ids ?? [], user.userId, 'review');
    const actor: OrderActor = { userId: user.userId, username: user.username };
    return this.orderMutationService.reviewRejectMany(ids ?? [], reason, actor);
  }

  /**
   * 批量复制为草稿
   * POST /orders/copy-to-draft
   * body: { ids: number[] }
   */
  @Post('copy-to-draft')
  @RequirePermission('orders_edit')
  copyToDraft(
    @Body('ids') ids: number[],
    @CurrentUser() user: { userId: number; username: string },
  ) {
    const actor: OrderActor = { userId: user.userId, username: user.username };
    return this.orderMutationService.copyManyToDraft(ids ?? [], actor);
  }

  /**
   * 获取订单操作记录
   * GET /orders/:id/logs
   */
  @Get(':id/logs')
  getLogs(@Param('id', ParseIntPipe) id: number) {
    return this.orderQueryService.getLogs(id);
  }

  /**
   * 获取订单备注列表
   * GET /orders/:id/remarks
   */
  @Get(':id/remarks')
  getRemarks(@Param('id', ParseIntPipe) id: number) {
    return this.orderQueryService.getRemarks(id);
  }

  /**
   * 新增订单备注
   * POST /orders/:id/remarks
   * body: { content: string }
   */
  @Post(':id/remarks')
  addRemark(
    @Param('id', ParseIntPipe) id: number,
    @Body('content') content: string,
    @CurrentUser() user: { userId: number; username: string },
  ) {
    const actor: OrderActor = { userId: user.userId, username: user.username };
    return this.orderMutationService.addRemark(id, actor, content);
  }
}

