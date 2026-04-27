import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { SystemOptionsService } from '../system-options/system-options.service';

@Controller('dicts')
@UseGuards(JwtAuthGuard, PermissionGuard)
// 复用订单列表菜单权限，确保有「订单管理」权限的用户即可加载下拉字典
@RequirePermission('/orders/list')
export class DictsController {
  constructor(private readonly systemOptionsService: SystemOptionsService) {}

  /**
   * 字典下拉接口（扁平，供合作方式等下拉）
   * GET /dicts?type=collaboration|material_types|order_types|...
   * 与「订单设置」同源 system-options 表，仅读权限用 /orders/list
   */
  @Get()
  findByType(@Query('type') type: string) {
    return this.systemOptionsService.findByType(type || '');
  }

  /**
   * 字典树形接口（供订单相关页面树形下拉复用）
   * GET /dicts/tree?type=order_types|product_groups|...
   */
  @Get('tree')
  findTreeByType(@Query('type') type: string) {
    return this.systemOptionsService.findTreeByType(type || '');
  }

  /**
   * 字典完整列表（含 id / parentId），供需要使用 optionId 的业务页使用
   * GET /dicts/list?type=collaboration|order_types|...
   */
  @Get('list')
  findListByType(@Query('type') type: string) {
    return this.systemOptionsService.findAllByType(type || '');
  }
}

