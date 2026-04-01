import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ProcessQuoteTemplatesService } from './process-quote-templates.service';

@Controller('process-quote-templates')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProcessQuoteTemplatesController {
  constructor(private readonly service: ProcessQuoteTemplatesService) {}

  /** 列表（订单设置页与订单成本页导入下拉共用） */
  @Get()
  @RequirePermission('/orders/list')
  findAll() {
    return this.service.findAll();
  }

  /** 单条（订单设置页编辑用） */
  @Get(':id')
  @RequirePermission('/orders/list')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  /** 模板工序项（含工序详情，订单设置页编辑与订单成本页导入共用） */
  @Get(':id/items')
  @RequirePermission('/orders/list')
  findItemsWithProcess(@Param('id', ParseIntPipe) id: number) {
    return this.service.findItemsWithProcess(id);
  }

  /**
   * 新增模板：设置页维护，或订单成本页「保存为模板」。
   * 含 `/orders/list` 时，具备订单成本列表/导入能力的跟单员也可从成本页保存模板；
   * 另可通过 `orders_cost_save_process_quote_template` 单独授权保存模板（不必给完整提交权限）。
   */
  @Post()
  @RequirePermission([
    '/settings/orders',
    'orders_cost_submit',
    'orders_cost_save_process_quote_template',
    '/orders/list',
  ])
  create(
    @Body()
    body: { name: string; sortOrder?: number },
  ) {
    return this.service.create(body);
  }

  /** 更新模板名称（仅订单设置权限） */
  @Put(':id')
  @RequirePermission('/settings/orders')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; sortOrder?: number },
  ) {
    return this.service.update(id, body);
  }

  /** 删除模板（仅订单设置权限） */
  @Delete(':id')
  @RequirePermission('/settings/orders')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  /**
   * 设置模板工序列表（覆盖）：设置页维护，或成本页保存模板第二步。
   * 含 `/orders/list` 时，具备订单成本列表/导入能力的跟单员也可从成本页保存模板；
   * 另可通过 `orders_cost_save_process_quote_template` 单独授权保存模板（不必给完整提交权限）。
   */
  @Put(':id/items')
  @RequirePermission([
    '/settings/orders',
    'orders_cost_submit',
    'orders_cost_save_process_quote_template',
    '/orders/list',
  ])
  setItems(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { processIds: number[] },
  ) {
    return this.service.setItems(id, body.processIds ?? []);
  }
}
