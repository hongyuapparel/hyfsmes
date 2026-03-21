import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
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
      relations: ['role', 'role.rolePermissions', 'role.rolePermissions.permission'],
    });
    if (!user || user.status !== UserStatus.ACTIVE) return null;
    const ok = await bcrypt.compare(password, user.passwordHash);
    return ok ? user : null;
  }

  async login(username: string, password: string): Promise<{ access_token: string }> {
    const user = await this.validateUser(username, password);
    if (!user) throw new UnauthorizedException('用户名或密码错误');
    await this.userRepo.update(user.id, { lastLoginAt: new Date() });
    const payload = { sub: user.id, username: user.username, roleId: user.roleId };
    return { access_token: this.jwtService.sign(payload) };
  }

  async me(userId: number): Promise<{
    id: number;
    username: string;
    displayName: string;
    roleId: number;
    roleName: string;
    permissions: Permission[];
    orderPolicies: {
      edit: string[];
      review: string[];
      delete: string[];
    };
  }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['role', 'role.rolePermissions', 'role.rolePermissions.permission'],
    });
    if (!user) throw new UnauthorizedException('用户不存在');
    const permissions = (user.role?.rolePermissions ?? [])
      .map((rp) => rp.permission)
      .filter(Boolean);
    const policyRows = await this.roleOrderPolicyRepo.find({
      where: { roleId: user.roleId },
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
      permissions,
      orderPolicies,
    };
  }
}
