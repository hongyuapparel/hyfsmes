import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ProductionProcessesService } from './production-processes.service';

@Controller('production-processes')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ProductionProcessesController {
  constructor(private readonly service: ProductionProcessesService) {}

  /** 列表，订单成本页勾选用；支持按部门、工种筛选（树表懒加载子节点时用） */
  @Get()
  @RequirePermission('/orders/list')
  findAll(
    @Query('department') department?: string,
    @Query('jobType') jobType?: string,
  ) {
    return this.service.findAll({ department, jobType });
  }

  /** 新增工序（使用 /create 避免与 @Get(':id') 冲突导致 404） */
  @Post('create')
  @RequirePermission('/orders/list')
  create(
    @Body()
    body: {
      department?: string;
      jobType?: string;
      name: string;
      unitPrice?: string;
      sortOrder?: number;
    },
  ) {
    return this.service.create(body);
  }

  @Get(':id')
  @RequirePermission('/orders/list')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @RequirePermission('/orders/list')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      department?: string;
      jobType?: string;
      name?: string;
      unitPrice?: string;
      sortOrder?: number;
    },
  ) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @RequirePermission('/orders/list')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
