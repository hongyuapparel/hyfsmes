import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { RoleStatus } from '../entities/role.entity';
import { RolesService } from './roles.service';
import { PermissionsService } from '../permissions/permissions.service';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(
    private rolesService: RolesService,
    private permissionsService: PermissionsService,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  findAll() {
    return this.rolesService.findAll();
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

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.remove(id);
  }

  @Get(':id/permissions')
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/permissions')
  getPermissions(@Param('id', ParseIntPipe) id: number) {
    return this.permissionsService.getRolePermissionIds(id);
  }

  @Put(':id/permissions')
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/permissions')
  setPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { permission_ids: number[] },
  ) {
    return this.permissionsService.setRolePermissions(id, body.permission_ids ?? []);
  }
}
