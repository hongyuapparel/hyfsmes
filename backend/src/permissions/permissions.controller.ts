import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { seedAdmin } from '../database/seed-admin';
import { seedPermissions } from '../database/seed-permissions';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(
    private permissionsService: PermissionsService,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  @Get()
  @UseGuards(PermissionGuard)
  @RequirePermission('/settings/roles')
  findAll() {
    return this.permissionsService.findAll();
  }

  @Post('resync-admin')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('/settings/roles')
  async resyncAdmin() {
    await seedPermissions(this.dataSource);
    await seedAdmin(this.dataSource);
    return { success: true, message: 'admin 权限已重新同步' };
  }
}