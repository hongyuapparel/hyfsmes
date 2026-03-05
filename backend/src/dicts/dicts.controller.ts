import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { SystemOptionsService } from '../system-options/system-options.service';

@Controller('dicts')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/orders/edit')
export class DictsController {
  constructor(private readonly systemOptionsService: SystemOptionsService) {}

  /**
   * 字典下拉接口
   * GET /dicts?type=collaboration|materialType|orderType|sampleType
   *
   * 目前全部复用 system-options 表，不在前端硬编码
   */
  @Get()
  findByType(@Query('type') type: string) {
    return this.systemOptionsService.findByType(type || '');
  }
}

