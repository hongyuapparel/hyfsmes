import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../entities/user.entity';
import { Order } from '../entities/order.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
  ) {}

  async findAll() {
    const list = await this.userRepo.find({
      relations: ['role'],
      order: { id: 'ASC' },
    });
    return list.map((u) => {
      const { passwordHash: _, ...rest } = u;
      return rest;
    });
  }

  /**
   * 订单编辑页用户下拉搜索（支持按关键字与角色过滤）
   */
  async search(keyword?: string, roleCode?: string) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'r')
      .where('u.status = :status', { status: UserStatus.ACTIVE });

    if (keyword?.trim()) {
      qb.andWhere('(u.username LIKE :kw OR u.display_name LIKE :kw)', { kw: `%${keyword.trim()}%` });
    }
    if (roleCode?.trim()) {
      qb.andWhere('r.code = :code', { code: roleCode.trim() });
    }

    qb.orderBy('u.id', 'ASC');
    const list = await qb.getMany();
    return list.map((u) => {
      const { passwordHash: _, ...rest } = u;
      return rest;
    });
  }

  /**
   * 用户管理页筛选：允许查询全部状态（active/disabled），可按关键字与角色过滤。
   */
  async searchForManagement(keyword?: string, roleCode?: string, status?: UserStatus) {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'r');

    if (status) {
      qb.where('u.status = :status', { status });
    } else {
      qb.where('1=1');
    }

    if (keyword?.trim()) {
      qb.andWhere('(u.username LIKE :kw OR u.display_name LIKE :kw)', { kw: `%${keyword.trim()}%` });
    }
    if (roleCode?.trim()) {
      qb.andWhere('r.code = :code', { code: roleCode.trim() });
    }

    qb.orderBy('u.id', 'ASC');
    const list = await qb.getMany();
    return list.map((u) => {
      const { passwordHash: _, ...rest } = u;
      return rest;
    });
  }

  async create(dto: { username: string; password: string; displayName?: string; roleId: number }) {
    const exists = await this.userRepo.findOne({ where: { username: dto.username } });
    if (exists) throw new ConflictException('用户名已存在');
    const hash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepo.create({
      username: dto.username,
      passwordHash: hash,
      displayName: dto.displayName ?? dto.username,
      roleId: dto.roleId,
      status: UserStatus.ACTIVE,
    });
    return this.userRepo.save(user);
  }

  async update(
    id: number,
    dto: { username?: string; displayName?: string; roleId?: number; status?: UserStatus },
  ): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');

    // 允许修改用户名（登录账号），并做唯一性校验；同时联动更新依赖 username 的业务字段
    if (dto.username !== undefined) {
      const next = (dto.username ?? '').trim();
      if (!next) throw new ConflictException('用户名不能为空');
      if (next.length > 64) throw new ConflictException('用户名过长');
      if (next !== user.username) {
        const exists = await this.userRepo.findOne({ where: { username: next } });
        if (exists) throw new ConflictException('用户名已存在');
        const prev = user.username;
        user.username = next;
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
    if (dto.displayName !== undefined) user.displayName = dto.displayName;
    if (dto.roleId !== undefined) user.roleId = dto.roleId;
    if (dto.status !== undefined) user.status = dto.status;
    return this.userRepo.save(user);
  }

  async resetPassword(id: number, newPassword: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepo.save(user);
  }
}
