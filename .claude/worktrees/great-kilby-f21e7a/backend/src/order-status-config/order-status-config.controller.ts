import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { OrderStatusConfigService } from './order-status-config.service';
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
  constructor(private readonly service: OrderStatusConfigService) {}

  // --- 状态定义 ---

  @Get('statuses')
  async getStatuses() {
    return this.service.getAllStatuses();
  }

  @Post('statuses')
  async createStatus(@Body() dto: CreateOrderStatusDto) {
    return this.service.createStatus(dto);
  }

  @Patch('statuses/:id')
  async updateStatus(@Param('id') id: number, @Body() dto: UpdateOrderStatusDto) {
    return this.service.updateStatus(Number(id), dto);
  }

  /** 仅切换启用状态，供列表里的开关按钮使用 */
  @Patch('statuses/:id/enabled')
  async toggleStatusEnabled(@Param('id') id: number) {
    return this.service.toggleStatusEnabled(Number(id));
  }

  @Delete('statuses/:id')
  async deleteStatus(@Param('id') id: number) {
    await this.service.deleteStatus(Number(id));
    return { success: true };
  }

  // --- 流转规则 ---

  @Get('transitions')
  async getTransitions(@Query('from_status') fromStatus?: string) {
    return this.service.getTransitions(fromStatus);
  }

  @Post('transitions')
  async createTransition(@Body() dto: CreateOrderStatusTransitionDto) {
    return this.service.createTransition(dto);
  }

  @Post('transitions/batch')
  async createTransitionsBatch(@Body() dto: BatchCreateTransitionsDto) {
    return this.service.createTransitionsBatch(dto.steps, dto.conditionsJson, dto.name);
  }

  // --- 流程链路（整条链路配置） ---

  @Get('chains')
  async getChains() {
    return this.service.getChains();
  }

  @Patch('chains/reorder')
  async reorderChains(@Body() body: { orderedIds: number[] }) {
    return this.service.reorderChains(body?.orderedIds ?? []);
  }

  @Patch('chains/:id')
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
    return this.service.updateChain(Number(id), body);
  }

  @Delete('chains/:id')
  async deleteChain(@Param('id') id: number) {
    await this.service.deleteChain(Number(id));
    return { success: true };
  }

  @Patch('transitions/:id')
  async updateTransition(@Param('id') id: number, @Body() dto: UpdateOrderStatusTransitionDto) {
    return this.service.updateTransition(Number(id), dto);
  }

  @Delete('transitions/:id')
  async deleteTransition(@Param('id') id: number) {
    await this.service.deleteTransition(Number(id));
    return { success: true };
  }

  // --- 订单状态时效配置（SLA）---

  @Get('sla')
  async getSlaList() {
    return this.service.getSlaList();
  }

  @Post('sla')
  async createSla(@Body() dto: CreateOrderStatusSlaDto) {
    return this.service.createSla(dto);
  }

  @Patch('sla/:id')
  async updateSla(@Param('id') id: number, @Body() dto: UpdateOrderStatusSlaDto) {
    return this.service.updateSla(Number(id), dto);
  }

  @Delete('sla/:id')
  async deleteSla(@Param('id') id: number) {
    await this.service.deleteSla(Number(id));
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
    return this.service.getSlaReport({
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
    return this.service.getProfitReport({
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

