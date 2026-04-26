import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';
import { RolePermission } from '../entities/role-permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private permRepo: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rpRepo: Repository<RolePermission>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
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

  async setRolePermissions(
    roleId: number,
    permissionIds: number[],
    isAdminRole?: boolean,
  ): Promise<void> {
    await this.rpRepo.delete({ roleId });
    for (const pid of permissionIds) {
      await this.rpRepo.save(this.rpRepo.create({ roleId, permissionId: pid }));
    }

    const role = await this.roleRepo.findOne({ where: { id: roleId }, select: ['code'] });
    const roleIsAdmin = isAdminRole === true || role?.code === 'admin';
    if (roleIsAdmin) {
      const allPerms = await this.permRepo.find({ select: ['id'] });
      const saved = new Set(permissionIds);
      for (const p of allPerms) {
        if (!saved.has(p.id)) {
          await this.rpRepo.save(this.rpRepo.create({ roleId, permissionId: p.id }));
        }
      }
    }
  }
}
