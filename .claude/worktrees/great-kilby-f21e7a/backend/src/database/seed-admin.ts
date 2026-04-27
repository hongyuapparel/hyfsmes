import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Role } from '../entities/role.entity';
import { User, UserStatus } from '../entities/user.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { Permission } from '../entities/permission.entity';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export async function seedAdmin(dataSource: DataSource): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    const usernameIsDefault = !process.env.ADMIN_USERNAME || process.env.ADMIN_USERNAME === 'admin';
    const passwordIsDefault = !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'admin123';
    if (usernameIsDefault || passwordIsDefault) {
      throw new Error('生产环境必须配置 ADMIN_USERNAME 与 ADMIN_PASSWORD，且不能使用默认值 admin/admin123');
    }
  }

  const roleRepo = dataSource.getRepository(Role);
  const userRepo = dataSource.getRepository(User);
  const permRepo = dataSource.getRepository(Permission);
  const rpRepo = dataSource.getRepository(RolePermission);

  let salespersonRole = await roleRepo.findOne({ where: { code: 'salesperson' } });
  if (!salespersonRole) {
    salespersonRole = roleRepo.create({ code: 'salesperson', name: '业务员' });
    await roleRepo.save(salespersonRole);
    console.log('[Seed] 业务员 role created.');
  }

  let adminRole = await roleRepo.findOne({ where: { code: 'admin' } });
  if (!adminRole) {
    adminRole = roleRepo.create({ code: 'admin', name: '超级管理员' });
    await roleRepo.save(adminRole);
    console.log('[Seed] Admin role created.');
  }
  const allPerms = await permRepo.find();
  const existingRp = await rpRepo.find({ where: { roleId: adminRole.id } });
  const existingPermIds = new Set(existingRp.map((r) => r.permissionId));
  for (const p of allPerms) {
    if (!existingPermIds.has(p.id)) {
      await rpRepo.save(rpRepo.create({ roleId: adminRole.id, permissionId: p.id }));
    }
  }

  const exists = await userRepo.findOne({ where: { username: ADMIN_USERNAME } });
  if (!exists) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await userRepo.save(
      userRepo.create({
        username: ADMIN_USERNAME,
        passwordHash: hash,
        displayName: '管理员',
        roleId: adminRole.id,
        status: UserStatus.ACTIVE,
      }),
    );
    console.log('[Seed] Admin user created. Username:', ADMIN_USERNAME);
  }
}
