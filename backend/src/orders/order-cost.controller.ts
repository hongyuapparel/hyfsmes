import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { OrderQueryService } from './order-query.service';
import { OrderMutationService } from './order-mutation.service';

/**
 * 订单成本快照子资源：GET/PUT /orders/:orderId/cost
 * 独立控制器避免与 GET /orders/:id 的路由匹配顺序问题
 */
@Controller('orders/:orderId/cost')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class OrderCostController {
  constructor(
    private readonly orderQueryService: OrderQueryService,
    private readonly orderMutationService: OrderMutationService,
  ) {}

  @Get()
  @RequirePermission('/orders/list')
  getCost(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.orderQueryService.getCostSnapshot(orderId);
  }

  /** 保存草稿：仅保存成本快照，不同步订单卡片出厂价（不按订单 edit 状态拦截，终态可补录成本） */
  @Put()
  @RequirePermission('orders_cost_submit')
  saveCost(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: { snapshot: Record<string, unknown> },
    @CurrentUser() user: { userId: number; username: string },
  ) {
    return this.orderMutationService.saveCostSnapshot(orderId, body, user);
  }

  /** 确认报价：保存快照并同步订单卡片出厂价（同上，不按订单 edit 状态拦截） */
  @Post('confirm')
  @RequirePermission('orders_cost_submit')
  confirmCost(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: { snapshot: Record<string, unknown> },
    @CurrentUser() user: { userId: number; username: string },
  ) {
    return this.orderMutationService.confirmCostQuote(orderId, body, user);
  }
}
