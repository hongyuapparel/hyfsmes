import { Body, Controller, Get, Param, Patch, Post, UseGuards, ParseIntPipe, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../auth/permission.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { UserStatus } from '../entities/user.entity';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionGuard)
@RequirePermission('/settings/users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  findAll(
    @Query('keyword') keyword?: string,
    @Query('role') role?: string,
  ) {
    if (keyword || role) {
      return this.usersService.search(keyword, role);
    }
    return this.usersService.findAll();
  }

  /** 用户管理页筛选（不限制启用状态） */
  @Get('manage')
  findForManagement(
    @Query('keyword') keyword?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
  ) {
    const st = (status as UserStatus | undefined) || undefined;
    return this.usersService.searchForManagement(keyword, role, st);
  }

  @Post()
  create(
    @Body()
    body: { username: string; password: string; display_name?: string; role_id: number },
  ) {
    return this.usersService.create({
      username: body.username,
      password: body.password,
      displayName: body.display_name,
      roleId: body.role_id,
    });
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: { username?: string; display_name?: string; role_id?: number; status?: string },
  ) {
    const status = body.status as UserStatus | undefined;
    return this.usersService.update(id, {
      username: body.username,
      displayName: body.display_name,
      roleId: body.role_id,
      status: status as UserStatus | undefined,
    });
  }

  @Post(':id/reset-password')
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { password: string },
  ) {
    return this.usersService.resetPassword(id, body.password);
  }
}
