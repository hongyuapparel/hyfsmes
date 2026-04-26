import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { OrderStatusDefinitionService } from './order-status-definition.service';
import { OrderStatusTransitionService } from './order-status-transition.service';
import { OrderStatusReportService } from './order-status-report.service';
import { RequirePermission } from '../auth/require-permission.decorator';
import {
  CreateOrderStatusDto,
  UpdateOrderStatusDto,
  CreateOrderStatusTransitionDto,
  UpdateOrderStatusTransitionDto,
  BatchCreateTransitionsDto,
  CreateOrderStatusSlaDto,
  UpdateOrderStatusSlaDto,
} from './dto';

@Controller('order-status-config')
export class OrderStatusConfigController {
  constructor(
    private readonly definitionService: OrderStatusDefinitionService,
    private readonly transitionService: OrderStatusTransitionService,
    private readonly reportService: OrderStatusReportService,
  ) {}

  // --- 状态定义 ---

  @Get('statuses')
  async getStatuses() {
    return this.definitionService.getAllStatuses();
  }

  @Post('statuses')
  @RequirePermission('/settings/orders')
  async createStatus(@Body() dto: CreateOrderStatusDto) {
    return this.definitionService.createStatus(dto);
  }

  @Patch('statuses/:id')
  @RequirePermission('/settings/orders')
  async updateStatus(@Param('id') id: number, @Body() dto: UpdateOrderStatusDto) {
    return this.definitionService.updateStatus(Number(id), dto);
  }

  /** 仅切换启用状态，供列表里的开关按钮使用 */
  @Patch('statuses/:id/enabled')
  @RequirePermission('/settings/orders')
  async toggleStatusEnabled(@Param('id') id: number) {
    return this.definitionService.toggleStatusEnabled(Number(id));
  }

  @Delete('statuses/:id')
  @RequirePermission('/settings/orders')
  async deleteStatus(@Param('id') id: number) {
    await this.definitionService.deleteStatus(Number(id));
    return { success: true };
  }

  // --- 流转规则 ---

  @Get('transitions')
  async getTransitions(@Query('from_status') fromStatus?: string) {
    return this.transitionService.getTransitions(fromStatus);
  }

  @Post('transitions')
  @RequirePermission('/settings/orders')
  async createTransition(@Body() dto: CreateOrderStatusTransitionDto) {
    return this.transitionService.createTransition(dto);
  }

  @Post('transitions/batch')
  @RequirePermission('/settings/orders')
  async createTransitionsBatch(@Body() dto: BatchCreateTransitionsDto) {
    return this.transitionService.createTransitionsBatch(dto.steps, dto.conditionsJson, dto.name);
  }

  // --- 流程链路（整条链路配置） ---

  @Get('chains')
  async getChains() {
    return this.transitionService.getChains();
  }

  @Patch('chains/reorder')
  @RequirePermission('/settings/orders')
  async reorderChains(@Body() body: { orderedIds: number[] }) {
    return this.transitionService.reorderChains(body?.orderedIds ?? []);
  }

  @Patch('chains/:id')
  @RequirePermission('/settings/orders')
  async updateChain(
    @Param('id') id: number,
    @Body()
    body: {
      name?: string;
      conditionsJson?: unknown;
      enabled?: boolean;
      steps?: CreateOrderStatusTransitionDto[];
    },
  ) {
    return this.transitionService.updateChain(Number(id), body);
  }

  @Delete('chains/:id')
  @RequirePermission('/settings/orders')
  async deleteChain(@Param('id') id: number) {
    await this.transitionService.deleteChain(Number(id));
    return { success: true };
  }

  @Patch('transitions/:id')
  @RequirePermission('/settings/orders')
  async updateTransition(@Param('id') id: number, @Body() dto: UpdateOrderStatusTransitionDto) {
    return this.transitionService.updateTransition(Number(id), dto);
  }

  @Delete('transitions/:id')
  @RequirePermission('/settings/orders')
  async deleteTransition(@Param('id') id: number) {
    await this.transitionService.deleteTransition(Number(id));
    return { success: true };
  }

  // --- 订单状态时效配置（SLA）---

  @Get('sla')
  async getSlaList() {
    return this.definitionService.getSlaList();
  }

  @Post('sla')
  @RequirePermission('/settings/orders')
  async createSla(@Body() dto: CreateOrderStatusSlaDto) {
    return this.definitionService.createSla(dto);
  }

  @Patch('sla/:id')
  @RequirePermission('/settings/orders')
  async updateSla(@Param('id') id: number, @Body() dto: UpdateOrderStatusSlaDto) {
    return this.definitionService.updateSla(Number(id), dto);
  }

  @Delete('sla/:id')
  @RequirePermission('/settings/orders')
  async deleteSla(@Param('id') id: number) {
    await this.definitionService.deleteSla(Number(id));
    return { success: true };
  }

  @Get('sla-report')
  async getSlaReport(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('status_id') statusId?: string,
    @Query('order_date_from') orderDateFrom?: string,
    @Query('order_date_to') orderDateTo?: string,
    @Query('completed_from') completedFrom?: string,
    @Query('completed_to') completedTo?: string,
    @Query('collaboration_type_id') collaborationTypeId?: string,
    @Query('order_type_id') orderTypeId?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    return this.reportService.getSlaReport({
      startDate,
      endDate,
      statusId: statusId != null ? Number(statusId) : undefined,
      orderDateFrom,
      orderDateTo,
      completedFrom,
      completedTo,
      collaborationTypeId: collaborationTypeId != null ? Number(collaborationTypeId) : undefined,
      orderTypeId: orderTypeId != null ? Number(orderTypeId) : undefined,
      page: page != null ? Number(page) : undefined,
      pageSize: pageSize != null ? Number(pageSize) : undefined,
    });
  }

  @Get('profit-report')
  async getProfitReport(
    @Query('status_id') statusId?: string,
    @Query('order_date_from') orderDateFrom?: string,
    @Query('order_date_to') orderDateTo?: string,
    @Query('completed_from') completedFrom?: string,
    @Query('completed_to') completedTo?: string,
    @Query('collaboration_type_id') collaborationTypeId?: string,
    @Query('order_type_id') orderTypeId?: string,
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
  ) {
    return this.reportService.getProfitReport({
      statusId: statusId != null ? Number(statusId) : undefined,
      orderDateFrom,
      orderDateTo,
      completedFrom,
      completedTo,
      collaborationTypeId: collaborationTypeId != null ? Number(collaborationTypeId) : undefined,
      orderTypeId: orderTypeId != null ? Number(orderTypeId) : undefined,
      page: page != null ? Number(page) : undefined,
      pageSize: pageSize != null ? Number(pageSize) : undefined,
    });
  }
}

