import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, RoleStatus } from '../entities/role.entity';

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
];

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
  ) {}

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
    return this.roleRepo.find({ order: { id: 'ASC' } });
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
