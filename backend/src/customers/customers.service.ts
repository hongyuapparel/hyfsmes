import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { User, UserStatus } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { XiaomanService } from '../xiaoman/xiaoman.service';
import { SystemOptionsService } from '../system-options/system-options.service';

export interface CustomerListQuery {
  companyName?: string;
  salesperson?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    private xiaomanService: XiaomanService,
    private systemOptionsService: SystemOptionsService,
  ) {}

  async findAll(query: CustomerListQuery) {
    const { companyName, salesperson, page = 1, pageSize = 20, sortBy = 'id', sortOrder = 'asc' } = query;
    const qb = this.customerRepo.createQueryBuilder('c');

    if (companyName?.trim()) {
      qb.andWhere('c.company_name LIKE :companyName', { companyName: `%${companyName.trim()}%` });
    }
    if (salesperson?.trim()) {
      qb.andWhere('c.salesperson = :salesperson', { salesperson: salesperson.trim() });
    }

    const sortColumn = this.toSnakeCase(sortBy);
    const validSortColumns = ['id', 'customer_id', 'company_name', 'cooperation_date', 'salesperson'];
    if (validSortColumns.includes(sortColumn)) {
      qb.orderBy(`c.${sortColumn}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');
    }

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { list, total, page, pageSize };
  }

  async findOne(id: number) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('客户不存在');
    return customer;
  }

  /** 获取下一个客户编号，格式 KH0001 递增，每个客户编号唯一 */
  async getNextCustomerId(): Promise<string> {
    const rows = await this.customerRepo
      .createQueryBuilder('c')
      .select('c.customerId')
      .where("c.customer_id REGEXP '^KH[0-9]+$'")
      .getMany();
    let maxNum = 0;
    for (const r of rows) {
      const m = r.customerId.match(/^KH(\d+)$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
    return `KH${String(maxNum + 1).padStart(4, '0')}`;
  }

  async create(dto: {
    customer_id?: string;
    country?: string;
    company_name: string;
    contact_person?: string;
    contact_info?: string;
    cooperation_date?: string;
    salesperson?: string;
    product_group?: string;
  }) {
    const customerId = dto.customer_id?.trim() || (await this.getNextCustomerId());
    const exists = await this.customerRepo.findOne({ where: { customerId } });
    if (exists) throw new ConflictException('客户编号已存在');

    const customer = this.customerRepo.create({
      customerId,
      country: dto.country ?? '',
      companyName: dto.company_name,
      contactPerson: dto.contact_person ?? '',
      contactInfo: dto.contact_info ?? '',
      cooperationDate: dto.cooperation_date ? new Date(dto.cooperation_date) : null,
      salesperson: dto.salesperson ?? '',
      productGroup: dto.product_group ?? '',
    });
    return this.customerRepo.save(customer);
  }

  async update(
    id: number,
    dto: {
      country?: string;
      company_name?: string;
      contact_person?: string;
      contact_info?: string;
      cooperation_date?: string;
      salesperson?: string;
      product_group?: string;
    },
  ) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('客户不存在');

    // 可选字符串：null 转 ''，满足数据库 NOT NULL，不擅自改写用户已填资料
    if (dto.country !== undefined) customer.country = dto.country ?? '';
    if (dto.contact_person !== undefined) customer.contactPerson = dto.contact_person ?? '';
    if (dto.contact_info !== undefined) customer.contactInfo = dto.contact_info ?? '';
    if (dto.salesperson !== undefined) customer.salesperson = dto.salesperson ?? '';
    if (dto.product_group !== undefined) customer.productGroup = dto.product_group ?? '';
    // 公司名称：不允许用 null/空 覆盖已有值
    if (dto.company_name !== undefined && dto.company_name != null && String(dto.company_name).trim() !== '') {
      customer.companyName = dto.company_name.trim();
    }
    if (dto.cooperation_date !== undefined) customer.cooperationDate = dto.cooperation_date ? new Date(dto.cooperation_date) : null;

    return this.customerRepo.save(customer);
  }

  async remove(id: number) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('客户不存在');
    await this.customerRepo.remove(customer);
  }

  async removeMany(ids: number[]) {
    if (!ids?.length) return;
    await this.customerRepo.delete(ids);
  }

  /** 获取业务员列表：角色 code 为 salesperson 的用户（displayName 或 username） */
  async getSalespeople(): Promise<string[]> {
    const role = await this.roleRepo.findOne({ where: { code: 'salesperson' } });
    if (!role) return [];
    const users = await this.userRepo.find({
      where: { roleId: role.id, status: UserStatus.ACTIVE },
      order: { displayName: 'ASC' },
    });
    return users.map((u) => (u.displayName?.trim() || u.username) || '').filter(Boolean);
  }

  /** 获取跟单员列表：角色 code 为 merchandiser 的用户（displayName 或 username） */
  async getMerchandisers(): Promise<string[]> {
    const role = await this.roleRepo.findOne({ where: { code: 'merchandiser' } });
    if (!role) return [];
    const users = await this.userRepo.find({
      where: { roleId: role.id, status: UserStatus.ACTIVE },
      order: { displayName: 'ASC' },
    });
    return users.map((u) => (u.displayName?.trim() || u.username) || '').filter(Boolean);
  }

  /** 获取产品分组列表：来自系统配置 product_groups，无配置时回退到客户表去重 */
  async getProductGroups(): Promise<string[]> {
    const configured = await this.systemOptionsService.findByType('product_groups');
    if (configured.length > 0) return configured;
    const rows = await this.customerRepo
      .createQueryBuilder('c')
      .select('DISTINCT c.product_group')
      .where('c.product_group != ""')
      .orderBy('c.product_group')
      .getRawMany();
    return rows.map((r) => r.product_group).filter(Boolean);
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
  }

  /** 从小满获取客户列表（供前端选择），支持 keyword 模糊搜索 */
  async getXiaomanList(page = 1, pageSize = 20, keyword?: string) {
    return this.xiaomanService.getCompanyList(page, pageSize, keyword);
  }

  /** 从小满导入选中客户：客户编号、国家、合作日期、产品分组、联系电话 */
  async importFromXiaoman(companyIds: number[]): Promise<{ imported: number; skipped: number; errors: string[] }> {
    if (!companyIds?.length) return { imported: 0, skipped: 0, errors: [] };
    const details = await this.xiaomanService.getCompanyDetailsBatch(companyIds);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const d of details) {
      if (!d) continue;
      const customerId = String(d.serial_id || d.company_id).trim();
      if (!customerId) {
        errors.push(`公司 ${d.name} 无客户编号，已跳过`);
        continue;
      }
      const exists = await this.customerRepo.findOne({ where: { customerId } });
      if (exists) {
        skipped++;
        continue;
      }
      const country = d.country ?? d.country_region?.country ?? '';
      const contactInfo = Array.isArray(d.tel) ? d.tel.filter(Boolean).join('; ') : '';
      const cooperationDate = d.order_time ? d.order_time.split(' ')[0] : null;
      const productGroup = d.product_group_names ?? '';

      try {
        await this.customerRepo.save(
          this.customerRepo.create({
            customerId,
            country,
            companyName: d.name || d.short_name || customerId,
            contactPerson: '',
            contactInfo,
            cooperationDate: cooperationDate ? new Date(cooperationDate) : null,
            salesperson: '',
            productGroup,
          }),
        );
        imported++;
      } catch (e) {
        errors.push(`${d.name}: ${(e as Error).message}`);
      }
    }
    return { imported, skipped, errors };
  }
}
