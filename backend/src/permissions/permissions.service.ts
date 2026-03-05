import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { RolePermission } from '../entities/role-permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private permRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rpRepo: Repository<RolePermission>,
  ) {}

  async findAll(): Promise<Permission[]> {
    return this.permRepo.find({ order: { id: 'ASC' } });
  }

  async getRolePermissionIds(roleId: number): Promise<number[]> {
    const list = await this.rpRepo.find({
      where: { roleId },
      select: ['permissionId'],
    });
    return list.map((r) => r.permissionId);
  }

  async setRolePermissions(roleId: number, permissionIds: number[]): Promise<void> {
    await this.rpRepo.delete({ roleId });
    for (const pid of permissionIds) {
      await this.rpRepo.save(this.rpRepo.create({ roleId, permissionId: pid }));
    }
  }
}
