import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { RoleStatus } from '../entities/role.entity';
import { RolesService } from './roles.service';
import { PermissionsService } from '../permissions/permissions.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleOrderPolicy, type RoleOrderAction } from '../entities/role-order-policy.entity';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(
    private rolesService: RolesService,
    private permissionsService: PermissionsService,
    @InjectRepository(RoleOrderPolicy)
    private roleOrderPolicyRepo: Repository<RoleOrderPolicy>,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('suggest-code')
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  suggestCode(@Query('name') name?: string) {
    const code = this.rolesService.suggestCode(name ?? '');
    return { code: code ?? null };
  }

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  create(@Body() body: { code: string; name: string }) {
    return this.rolesService.create(body);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { code?: string; name?: string; status?: string },
  ) {
    return this.rolesService.update(id, {
      code: body.code,
      name: body.name,
      status: body.status as RoleStatus | undefined,
    });
  }

  @Patch(':id/move')
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  move(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { direction: 'up' | 'down' },
  ) {
    return this.rolesService.move(id, body.direction);
  }

  @Put('reorder')
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  reorder(@Body() body: { orderedIds: number[] }) {
    return this.rolesService.reorder(body.orderedIds ?? []);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.remove(id);
  }

  @Get(':id/permissions')
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  getPermissions(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.getRolePermissionIds(id);
  }

  @Put(':id/permissions')
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  setPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { permission_ids: number[] },
  ) {
    return this.permissionsService.setRolePermissions(id, body.permission_ids ?? []);
  }

  @Get(':id/order-policies')
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  async getOrderPolicies(@Param('id', ParseIntPipe) id: number) {
    const rows = await this.roleOrderPolicyRepo.find({
      where: { roleId: id },
      order: { action: 'ASC', statusCode: 'ASC' },
    });
    const grouped: Record<RoleOrderAction, string[]> = {
      edit: [],
      review: [],
      delete: [],
    };
    rows.forEach((r) => {
      if (grouped[r.action]) grouped[r.action].push(r.statusCode);
    });
    return grouped;
  }

  @Put(':id/order-policies')
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  async setOrderPolicies(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      edit?: string[];
      review?: string[];
      delete?: string[];
    },
  ) {
    const normalize = (arr?: string[]) =>
      [...new Set((arr ?? []).map((v) => (v ?? '').trim()).filter(Boolean))];
    const edit = normalize(body.edit);
    const review = normalize(body.review);
    const del = normalize(body.delete);

    await this.roleOrderPolicyRepo.delete({ roleId: id });
    const insertRows = [
      ...edit.map((statusCode) => ({ roleId: id, action: 'edit' as const, statusCode })),
      ...review.map((statusCode) => ({ roleId: id, action: 'review' as const, statusCode })),
      ...del.map((statusCode) => ({ roleId: id, action: 'delete' as const, statusCode })),
    ];
    if (insertRows.length) {
      await this.roleOrderPolicyRepo.save(this.roleOrderPolicyRepo.create(insertRows));
    }
    return { success: true };
  }
}
