import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, RoleStatus } from '../entities/role.entity';
import { RoleDisplayOrder } from '../entities/role-display-order.entity';

/** 角色名称/关键词 → 编码映射，与系统菜单、业务命名一致 */
const NAME_TO_CODE_MAP: { keywords: string[]; code: string }[] = [
  { keywords: ['仓管', '仓库', '库存'], code: 'inventory' },
  { keywords: ['财务'], code: 'finance' },
  { keywords: ['生产', '生产部门', '工厂'], code: 'production' },
  { keywords: ['人事', 'HR'], code: 'hr' },
  { keywords: ['采购'], code: 'purchase' },
  { keywords: ['纸样'], code: 'pattern' },
  { keywords: ['裁床'], code: 'cutting' },
  { keywords: ['车缝'], code: 'sewing' },
  { keywords: ['尾部'], code: 'finishing' },
  { keywords: ['供应商'], code: 'suppliers' },
  { keywords: ['客户'], code: 'customers' },
  { keywords: ['订单'], code: 'orders' },
  { keywords: ['跟单', '跟单员'], code: 'merchandiser' },
];

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(RoleDisplayOrder)
    private roleDisplayOrderRepo: Repository<RoleDisplayOrder>,
  ) {}

  private async ensureDisplayOrderTable(): Promise<void> {
    await this.roleDisplayOrderRepo.query(`
      CREATE TABLE IF NOT EXISTS role_display_orders (
        id INT NOT NULL AUTO_INCREMENT,
        role_id INT NOT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_role_display_order_role (role_id),
        KEY idx_role_display_order_sort (sort_order)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  private async ensureDisplayOrderRows(): Promise<void> {
    await this.ensureDisplayOrderTable();
    const roles = await this.roleRepo.find({ order: { id: 'ASC' } });
    if (!roles.length) return;
    const rows = await this.roleDisplayOrderRepo.find({ order: { sortOrder: 'ASC', roleId: 'ASC' } });
    const hasRow = new Set(rows.map((r) => r.roleId));
    let next = (rows.length ? Math.max(...rows.map((r) => Number(r.sortOrder) || 0)) : 0) + 1;
    const missing = roles.filter((r) => !hasRow.has(r.id));
    if (!missing.length) return;
    await this.roleDisplayOrderRepo.save(
      missing.map((r) => this.roleDisplayOrderRepo.create({ roleId: r.id, sortOrder: next++ })),
    );
  }

  /** 根据名称建议编码，与系统菜单/业务一致；无匹配返回 null */
  suggestCode(name: string): string | null {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;
    const lower = trimmed.toLowerCase();
    for (const { keywords, code } of NAME_TO_CODE_MAP) {
      if (keywords.some((k) => trimmed.includes(k) || lower.includes(k))) return code;
    }
    return null;
  }

  async findAll(): Promise<Role[]> {
    await this.ensureDisplayOrderRows();
    return this.roleRepo
      .createQueryBuilder('r')
      .leftJoin(RoleDisplayOrder, 'o', 'o.role_id = r.id')
      .orderBy('COALESCE(o.sort_order, 2147483647)', 'ASC')
      .addOrderBy('r.id', 'ASC')
      .getMany();
  }

  async create(dto: { code?: string; name: string }) {
    let code = (dto.code || '').trim();
    if (!code) {
      code = this.suggestCode(dto.name) ?? '';
      if (!code) {
        throw new BadRequestException(
          '请填写编码，或使用系统支持的角色名称（如仓管、财务、人事、采购、纸样、裁床、车缝、尾部、供应商等）',
        );
      }
    }
    const exists = await this.roleRepo.findOne({ where: { code } });
    if (exists) throw new ConflictException('角色编码已存在');
    const role = this.roleRepo.create({ code, name: dto.name, status: RoleStatus.ACTIVE });
    const saved = await this.roleRepo.save(role);
    await this.ensureDisplayOrderRows();
    return saved;
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
    await this.roleDisplayOrderRepo.delete({ roleId: id });
  }

  async move(id: number, direction: 'up' | 'down'): Promise<{ success: true }> {
    await this.ensureDisplayOrderRows();
    const rows = await this.roleDisplayOrderRepo.find({ order: { sortOrder: 'ASC', roleId: 'ASC' } });
    const idx = rows.findIndex((r) => r.roleId === id);
    if (idx < 0) throw new NotFoundException('角色不存在');
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= rows.length) return { success: true };
    const current = rows[idx];
    const target = rows[targetIdx];
    const currentSort = current.sortOrder;
    current.sortOrder = target.sortOrder;
    target.sortOrder = currentSort;
    await this.roleDisplayOrderRepo.save([current, target]);
    return { success: true };
  }

  async reorder(orderedIds: number[]): Promise<{ success: true }> {
    await this.ensureDisplayOrderRows();
    const ids = (orderedIds ?? []).map((x) => Number(x)).filter((x) => Number.isFinite(x) && x > 0);
    if (!ids.length) return { success: true };
    const unique = Array.from(new Set(ids));
    const rows = await this.roleDisplayOrderRepo.find({ order: { sortOrder: 'ASC', roleId: 'ASC' } });
    const map = new Map(rows.map((r) => [r.roleId, r]));
    let sort = 1;
    for (const id of unique) {
      const row = map.get(id);
      if (!row) continue;
      row.sortOrder = sort++;
      await this.roleDisplayOrderRepo.save(row);
      map.delete(id);
    }
    const remaining = Array.from(map.values()).sort(
      (a, b) => (a.sortOrder - b.sortOrder) || (a.roleId - b.roleId),
    );
    for (const row of remaining) {
      row.sortOrder = sort++;
      await this.roleDisplayOrderRepo.save(row);
    }
    return { success: true };
  }
}
