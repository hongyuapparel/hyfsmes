import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { In, Repository } from 'typeorm';
import { User, UserStatus } from '../entities/user.entity';
import { Order } from '../entities/order.entity';
import { UserRole } from '../entities/user-role.entity';
import { Role } from '../entities/role.entity';

export interface SafeRoleDto {
  id: number;
  code: string;
  name: string;
}

export type SafeUserDto = Omit<User, 'passwordHash' | 'role' | 'userRoles'> & {
  roles: SafeRoleDto[];
  roleIds: number[];
  roleNames: string[];
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
  ) {}

  async findAll(): Promise<SafeUserDto[]> {
    const list = await this.userRepo.find({
      relations: ['role', 'userRoles', 'userRoles.role'],
      order: { id: 'ASC' },
    });
    return list.map((u) => this.toSafeUser(u));
  }

  /**
   * 订单编辑页用户下拉搜索（支持按关键字与角色过滤）
   */
  async search(keyword?: string, roleCode?: string): Promise<SafeUserDto[]> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'r')
      .leftJoinAndSelect('u.userRoles', 'ur')
      .leftJoinAndSelect('ur.role', 'urRole')
      .where('u.status = :status', { status: UserStatus.ACTIVE });

    if (keyword?.trim()) {
      qb.andWhere('(u.username LIKE :kw OR u.display_name LIKE :kw)', { kw: `%${keyword.trim()}%` });
    }
    if (roleCode?.trim()) {
      qb.andWhere('(r.code = :code OR urRole.code = :code)', { code: roleCode.trim() });
    }

    qb.distinct(true).orderBy('u.id', 'ASC');
    const list = await qb.getMany();
    return list.map((u) => this.toSafeUser(u));
  }

  /**
   * 用户管理页筛选：允许查询全部状态（active/disabled），可按关键字与角色过滤。
   */
  async searchForManagement(keyword?: string, roleCode?: string, status?: UserStatus): Promise<SafeUserDto[]> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'r')
      .leftJoinAndSelect('u.userRoles', 'ur')
      .leftJoinAndSelect('ur.role', 'urRole');

    if (status) {
      qb.where('u.status = :status', { status });
    } else {
      qb.where('1=1');
    }

    if (keyword?.trim()) {
      qb.andWhere('(u.username LIKE :kw OR u.display_name LIKE :kw)', { kw: `%${keyword.trim()}%` });
    }
    if (roleCode?.trim()) {
      qb.andWhere('(r.code = :code OR urRole.code = :code)', { code: roleCode.trim() });
    }

    qb.distinct(true).orderBy('u.id', 'ASC');
    const list = await qb.getMany();
    return list.map((u) => this.toSafeUser(u));
  }

  async create(dto: { username: string; password: string; displayName?: string; roleId?: number; roleIds?: number[] }) {
    const exists = await this.userRepo.findOne({ where: { username: dto.username } });
    if (exists) throw new ConflictException('用户名已存在');
    const normalizedRoleIds = await this.normalizeRoleIds(dto.roleIds, dto.roleId);
    const primaryRoleId = normalizedRoleIds[0];
    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      username: dto.username,
      passwordHash: hash,
      displayName: dto.displayName ?? dto.username,
      roleId: primaryRoleId,
      status: UserStatus.ACTIVE,
    });
    const saved = await this.userRepo.save(user);
    await this.syncUserRoles(saved.id, normalizedRoleIds);
    const full = await this.userRepo.findOne({
      where: { id: saved.id },
      relations: ['role', 'userRoles', 'userRoles.role'],
    });
    return full ? this.toSafeUser(full) : this.toSafeUser(saved);
  }

  async update(
    id: number,
    dto: { username?: string; displayName?: string; roleId?: number; roleIds?: number[]; status?: UserStatus },
  ): Promise<SafeUserDto> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    const patch: Partial<User> = {};

    // 允许修改用户名（登录账号），并做唯一性校验；同时联动更新依赖 username 的业务字段
    if (dto.username !== undefined) {
      const next = (dto.username ?? '').trim();
      if (!next) throw new ConflictException('用户名不能为空');
      if (next.length > 64) throw new ConflictException('用户名过长');
      if (next !== user.username) {
        const exists = await this.userRepo.findOne({ where: { username: next } });
        if (exists) throw new ConflictException('用户名已存在');
        const prev = user.username;
        patch.username = next;
        // 订单表目前以字符串保存业务员/跟单员；更改用户名时做一次联动更新，避免历史单据丢失关联
        await this.orderRepo
          .createQueryBuilder()
          .update(Order)
          .set({ salesperson: next })
          .where('salesperson = :prev', { prev })
          .execute();
        await this.orderRepo
          .createQueryBuilder()
          .update(Order)
          .set({ merchandiser: next })
          .where('merchandiser = :prev', { prev })
          .execute();
      }
    }
    if (dto.displayName !== undefined) patch.displayName = dto.displayName;
    if (dto.roleIds !== undefined || dto.roleId !== undefined) {
      const nextRoleIds = await this.normalizeRoleIds(dto.roleIds, dto.roleId ?? user.roleId);
      patch.roleId = nextRoleIds[0];
      await this.syncUserRoles(id, nextRoleIds);
    }
    if (dto.status !== undefined) patch.status = dto.status;
    if (Object.keys(patch).length) {
      await this.userRepo.update(id, patch);
    }
    const full = await this.userRepo.findOne({
      where: { id: user.id },
      relations: ['role', 'userRoles', 'userRoles.role'],
    });
    return full ? this.toSafeUser(full) : this.toSafeUser(user);
  }

  async resetPassword(id: number, newPassword: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
  }

  private async normalizeRoleIds(roleIds?: number[], fallbackRoleId?: number): Promise<number[]> {
    const source = Array.isArray(roleIds) && roleIds.length ? roleIds : (fallbackRoleId ? [fallbackRoleId] : []);
    const normalized = Array.from(new Set(source.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)));
    if (!normalized.length) throw new ConflictException('请选择至少一个角色');
    const exists = await this.roleRepo.find({ where: { id: In(normalized) }, select: ['id'] });
    const existsIds = new Set(exists.map((r) => r.id));
    const valid = normalized.filter((id) => existsIds.has(id));
    if (!valid.length) throw new ConflictException('角色不存在');
    return valid;
  }

  private async syncUserRoles(userId: number, roleIds: number[]): Promise<void> {
    if (!userId || !Number.isInteger(userId)) {
      throw new ConflictException('用户ID无效，无法保存角色');
    }
    await this.userRoleRepo.delete({ userId });
    const normalized = Array.from(
      new Set(roleIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)),
    );
    if (!normalized.length) return;
    await this.userRoleRepo
      .createQueryBuilder()
      .insert()
      .into(UserRole)
      .values(normalized.map((roleId) => ({ userId, roleId })))
      .execute();
  }

  private toSafeUser(u: User): SafeUserDto {
    const { passwordHash: _passwordHash, role: _role, userRoles: _userRoles, ...rest } = u;
    const roles = (u.userRoles ?? [])
      .map((ur) => ur.role)
      .filter(Boolean);
    const seen = new Set<number>();
    const normalizedRoles: Role[] = [];
    for (const r of roles) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        normalizedRoles.push(r);
      }
    }
    if (u.role && !seen.has(u.role.id)) normalizedRoles.unshift(u.role);
    return {
      ...rest,
      roles: normalizedRoles.map((r) => ({ id: r.id, code: r.code, name: r.name })),
      roleIds: normalizedRoles.map((r) => r.id),
      roleNames: normalizedRoles.map((r) => r.name),
    };
  }
}
