import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { User } from '../entities/user.entity';
import { UserRole } from '../entities/user-role.entity';
import { Role } from '../entities/role.entity';

@Injectable()
export class AdminRoleGuard implements CanActivate {
  constructor(private dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as { userId?: number } | undefined;
    if (!user?.userId) throw new ForbiddenException('未登录');

    const userRepo = this.dataSource.getRepository(User);
    const userRoleRepo = this.dataSource.getRepository(UserRole);
    const roleRepo = this.dataSource.getRepository(Role);

    const u = await userRepo.findOne({ where: { id: user.userId }, select: ['roleId'] });
    const links = await userRoleRepo.find({
      where: { userId: user.userId },
      select: ['roleId'],
    });
    const roleIds = Array.from(
      new Set([u?.roleId, ...links.map((x) => x.roleId)].filter(Boolean)),
    ) as number[];
    if (!roleIds.length) throw new ForbiddenException('无权限访问');

    const roles = await roleRepo.find({
      where: { id: In(roleIds) },
      select: ['code'],
    });
    if (roles.some((r) => r.code === 'admin')) return true;
    throw new ForbiddenException('仅超级管理员可访问');
  }
}
