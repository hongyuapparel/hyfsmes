import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
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
    dto: { displayName?: string; roleId?: number; status?: UserStatus },
  ): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('用户不存在');
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
