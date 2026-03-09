import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { SystemOptionsService } from './system-options.service';

@Controller('system-options')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission(['/settings/orders', '/settings/suppliers'])
export class SystemOptionsController {
  constructor(private service: SystemOptionsService) {}

  /** 按类型获取选项值列表（供下拉用，无需 settings 以外权限的接口在 customers/products 中提供） */
  @Get()
  findByType(@Query('type') type: string) {
    return this.service.findByType(type || '');
  }

  /** 按类型获取完整列表（含 parentId，供管理页用） */
  @Get('list')
  findAllByType(@Query('type') type: string) {
    return this.service.findAllByType(type || '');
  }

  /** 按类型获取树形结构（供管理页树形展示） */
  @Get('tree')
  findTreeByType(@Query('type') type: string) {
    return this.service.findTreeByType(type || '');
  }

  /** 懒加载树：根节点（含 hasChildren） */
  @Get('roots')
  findRootsForLazyTree(@Query('type') type: string) {
    return this.service.findRootsForLazyTree(type || '');
  }

  /** 懒加载树：子节点（含 hasChildren） */
  @Get('children')
  findChildrenByParentId(
    @Query('type') type: string,
    @Query('parent_id') parentIdStr?: string,
  ) {
    const parentId = parentIdStr ? parseInt(parentIdStr, 10) : 0;
    return this.service.findChildrenByParentId(type || '', Number.isNaN(parentId) ? 0 : parentId);
  }

  @Post()
  create(
    @Body() body: { type: string; value: string; sort_order?: number; parent_id?: number | null },
  ) {
    return this.service.create(
      body.type,
      body.value,
      body.sort_order ?? 0,
      body.parent_id ?? null,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { value?: string; sort_order?: number; parent_id?: number | null },
  ) {
    return this.service.update(id, {
      value: body.value,
      sortOrder: body.sort_order,
      parentId: body.parent_id,
    });
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
  }

  @Patch('batch/order')
  batchUpdateOrder(
    @Body() body: {
      type: string;
      parent_id?: number | null;
      items: { id: number; sort_order: number }[];
    },
  ) {
    const items = (body.items ?? []).map((i) => ({ id: i.id, sortOrder: i.sort_order }));
    return this.service.batchUpdateOrder(
      body.type ?? '',
      body.parent_id ?? null,
      items,
    );
  }
}
