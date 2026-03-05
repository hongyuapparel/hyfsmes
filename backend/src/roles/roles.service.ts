import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, RoleStatus } from '../entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
  ) {}

  async findAll(): Promise<Role[]> {
    return this.roleRepo.find({ order: { id: 'ASC' } });
  }

  async create(dto: { code: string; name: string }) {
    const exists = await this.roleRepo.findOne({ where: { code: dto.code } });
    if (exists) throw new ConflictException('角色编码已存在');
    const role = this.roleRepo.create({ code: dto.code, name: dto.name, status: RoleStatus.ACTIVE });
    return this.roleRepo.save(role);
  }

  async update(id: number, dto: { code?: string; name?: string; status?: RoleStatus }): Promise<Role> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('角色不存在');
    if (dto.code !== undefined) role.code = dto.code;
    if (dto.name !== undefined) role.name = dto.name;
    if (dto.status !== undefined) role.status = dto.status;
    return this.roleRepo.save(role);
  }

  async remove(id: number): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { id }, relations: ['users'] });
    if (!role) throw new NotFoundException('角色不存在');
    if (role.users?.length) {
      throw new BadRequestException('该角色下存在用户，无法删除');
    }
    await this.roleRepo.remove(role);
  }
}
