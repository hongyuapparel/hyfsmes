import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { In, Repository } from 'typeorm';
import { User, UserStatus } from '../entities/user.entity';
import { Permission } from '../entities/permission.entity';
import { RoleOrderPolicy } from '../entities/role-order-policy.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(RoleOrderPolicy)
    private roleOrderPolicyRepo: Repository<RoleOrderPolicy>,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { username },
      relations: [
        'role',
        'role.rolePermissions',
        'role.rolePermissions.permission',
        'userRoles',
        'userRoles.role',
        'userRoles.role.rolePermissions',
        'userRoles.role.rolePermissions.permission',
      ],
    });
    if (!user || user.status !== UserStatus.ACTIVE) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  async login(username: string, password: string): Promise<{ access_token: string }> {
    const user = await this.validateUser(username, password);
    if (!user) throw new UnauthorizedException('用户名或密码错误');
    const now = new Date();
    await this.userRepo.update(user.id, { lastLoginAt: now, lastActiveAt: now });
    const roleIds = Array.from(new Set([user.roleId, ...(user.userRoles ?? []).map((x) => x.roleId)].filter(Boolean)));
    const payload = { sub: user.id, username: user.username, roleId: user.roleId, roleIds };
    return { access_token: this.jwtService.sign(payload) };
  }

  async me(userId: number): Promise<{
    id: number;
    username: string;
    displayName: string;
    roleId: number;
    roleName: string;
    roleIds: number[];
    roleNames: string[];
    permissions: Permission[];
    orderPolicies: {
      edit: string[];
      review: string[];
      delete: string[];
    };
  }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: [
        'role',
        'role.rolePermissions',
        'role.rolePermissions.permission',
        'userRoles',
        'userRoles.role',
        'userRoles.role.rolePermissions',
        'userRoles.role.rolePermissions.permission',
      ],
    });
    if (!user) throw new UnauthorizedException('用户不存在');
    const roles = [
      ...(user.role ? [user.role] : []),
      ...(user.userRoles ?? []).map((ur) => ur.role).filter(Boolean),
    ].filter(Boolean);
    const roleMap = new Map<number, (typeof roles)[number]>();
    for (const r of roles) roleMap.set(r.id, r);
    const roleList = Array.from(roleMap.values());
    const permissionMap = new Map<number, Permission>();
    for (const r of roleList) {
      for (const rp of r.rolePermissions ?? []) {
        if (rp.permission?.id != null) permissionMap.set(rp.permission.id, rp.permission);
      }
    }
    const permissions = Array.from(permissionMap.values());
    const roleIds = roleList.map((r) => r.id);
    const roleNames = roleList.map((r) => r.name);
    const policyRows = await this.roleOrderPolicyRepo.find({
      where: { roleId: In(roleIds.length ? roleIds : [user.roleId]) },
      select: ['action', 'statusCode'],
    });
    const orderPolicies = { edit: [] as string[], review: [] as string[], delete: [] as string[] };
    for (const row of policyRows) {
      if (row.action === 'edit') orderPolicies.edit.push(row.statusCode);
      if (row.action === 'review') orderPolicies.review.push(row.statusCode);
      if (row.action === 'delete') orderPolicies.delete.push(row.statusCode);
    }
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      roleId: user.roleId,
      roleName: user.role?.name ?? '',
      roleIds,
      roleNames,
      permissions,
      orderPolicies,
    };
  }
}
