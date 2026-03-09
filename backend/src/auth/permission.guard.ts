import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { REQUIRE_PERMISSION } from './require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(RolePermission)
    private rpRepo: Repository<RolePermission>,
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

    const u = await this.userRepo.findOne({ where: { id: user.userId }, select: ['roleId'] });
    if (!u?.roleId) throw new ForbiddenException('无权限访问');

    const perms = await this.rpRepo.find({
      where: { roleId: u.roleId },
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
