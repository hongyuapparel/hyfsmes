import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { UserRole } from '../entities/user-role.entity';
import { REQUIRE_PERMISSION } from './require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.get<string | string[]>(
      REQUIRE_PERMISSION,
      context.getHandler(),
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId?: number } | undefined;
    if (!user?.userId) throw new ForbiddenException('未登录');

    const userRepo = this.dataSource.getRepository(User);
    const userRoleRepo = this.dataSource.getRepository(UserRole);
    const rpRepo = this.dataSource.getRepository(RolePermission);

    const u = await userRepo.findOne({ where: { id: user.userId }, select: ['roleId'] });
    const links = await userRoleRepo.find({ where: { userId: user.userId }, select: ['roleId'] });
    const roleIds = Array.from(new Set([u?.roleId, ...links.map((x) => x.roleId)].filter(Boolean))) as number[];
    if (!roleIds.length) throw new ForbiddenException('无权限访问');

    const perms = await rpRepo.find({
      where: { roleId: In(roleIds) },
      relations: ['permission'],
    });
    const routes = perms.map((p) => p.permission?.routePath).filter(Boolean);
    const codes = perms.map((p) => p.permission?.code).filter(Boolean);
    const requiredList = Array.isArray(required) ? required : [required];
    const allowed = requiredList.some(
      (r) => routes.includes(r) || codes.includes(r),
    );
    if (!allowed) throw new ForbiddenException('无权限访问');
    return true;
  }
}
