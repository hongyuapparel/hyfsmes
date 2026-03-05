import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { ProcessItemsService } from './process-items.service';

@Controller('process-items')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/orders/edit')
export class ProcessItemsController {
  constructor(private readonly service: ProcessItemsService) {}

  /**
   * 工艺项目下拉搜索
   * GET /process-items?keyword=
   *
   * 当前实现基于 system-options，type = 'processItem'
   */
  @Get()
  search(@Query('keyword') keyword?: string) {
    return this.service.search(keyword);
  }
}

