import { Body, Controller, Get, Param, ParseIntPipe, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { OrdersService } from './orders.service';

/**
 * 订单成本快照子资源：GET/PUT /orders/:orderId/cost
 * 独立控制器避免与 GET /orders/:id 的路由匹配顺序问题
 */
@Controller('orders/:orderId/cost')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/orders/list')
export class OrderCostController {
  constructor(private readonly ordersService: OrdersService) {}

  @Get()
  getCost(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.ordersService.getCostSnapshot(orderId);
  }

  @Put()
  saveCost(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body() body: { snapshot: Record<string, unknown> },
  ) {
    return this.ordersService.saveCostSnapshot(orderId, body);
  }
}
