import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { Order } from '../entities/order.entity';
import { User, UserStatus } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
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
    @InjectRepository(Order)
    private orderRepo: Repository<Order>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
    private xiaomanService: XiaomanService,
    private systemOptionsService: SystemOptionsService,
  ) {}

  async findAll(query: CustomerListQuery) {
    const { companyName, salesperson, page = 1, pageSize = 20, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    const qb = this.customerRepo.createQueryBuilder('c');

    if (companyName?.trim()) {
      const kw = `%${companyName.trim()}%`;
      qb.andWhere('(c.company_name LIKE :kw OR c.contact_person LIKE :kw)', { kw });
    }
    if (salesperson?.trim()) {
      qb.andWhere('c.salesperson = :salesperson', { salesperson: salesperson.trim() });
    }

    const sortColumn = this.toSnakeCase(sortBy);
    /** 最近活跃：该客户被订单引用（orders.customer_id）后，订单行的最后更新时间 */
    const lastOrderRefSubquery = '(SELECT MAX(o.updated_at) FROM orders o WHERE o.customer_id = c.id)';
    const validSortColumns = [
      'id',
      'customer_id',
      'company_name',
      'cooperation_date',
      'salesperson',
      'created_at',
    ];
    if (sortColumn === 'last_order_referenced_at') {
      qb.addOrderBy(`${lastOrderRefSubquery} IS NULL`, 'ASC');
      qb.addOrderBy(lastOrderRefSubquery, sortOrder.toUpperCase() as 'ASC' | 'DESC');
    } else if (validSortColumns.includes(sortColumn)) {
      qb.orderBy(`c.${sortColumn}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');
    }

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const productGroupIds = list.map((c) => c.productGroupId).filter((id): id is number => id != null);
    const pathMap = productGroupIds.length ? await this.systemOptionsService.getProductGroupPathsByIds(productGroupIds) : {};
    const refMap = await this.getLastOrderReferencedAtMap(list.map((c) => c.id));
    const listWithPath = list.map((c) => ({
      ...c,
      productGroup: c.productGroupId != null ? (pathMap[c.productGroupId] ?? '') : '',
      lastOrderReferencedAt: refMap.get(c.id) ?? null,
    }));

    return { list: listWithPath, total, page, pageSize };
  }

  /** 各客户最后一次被订单引用的时间：关联订单中 updated_at 的最大值 */
  private async getLastOrderReferencedAtMap(customerIds: number[]): Promise<Map<number, Date | null>> {
    const map = new Map<number, Date | null>();
    if (!customerIds.length) return map;
    for (const id of customerIds) {
      map.set(id, null);
    }
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.customer_id', 'cid')
      .addSelect('MAX(o.updated_at)', 'lastRef')
      .where('o.customer_id IN (:...ids)', { ids: customerIds })
      .groupBy('o.customer_id')
      .getRawMany<{ cid: number; lastRef: Date | string | null }>();
    for (const r of rows) {
      const id = Number(r.cid);
      if (!Number.isFinite(id)) continue;
      map.set(id, r.lastRef ? new Date(r.lastRef) : null);
    }
    return map;
  }

  async findOne(id: number) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('客户不存在');
    const productGroup =
      customer.productGroupId != null
        ? await this.systemOptionsService.getProductGroupPathById(customer.productGroupId)
        : '';
    return { ...customer, productGroup };
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
    product_group_id?: number | null;
  }) {
    const customerId = dto.customer_id?.trim() || (await this.getNextCustomerId());
    const exists = await this.customerRepo.findOne({ where: { customerId } });
    if (exists) throw new ConflictException('客户编号已存在');

    const companyTrimmed = (dto.company_name ?? '').trim();
    if (!companyTrimmed) {
      throw new BadRequestException('公司名称不能为空');
    }
    const dupCompany = await this.findCustomerByTrimmedCompanyName(companyTrimmed);
    if (dupCompany) {
      throw new ConflictException('该公司名称已存在，无法创建重复客户');
    }

    const customer = this.customerRepo.create({
      customerId,
      country: dto.country ?? '',
      companyName: companyTrimmed,
      contactPerson: dto.contact_person ?? '',
      contactInfo: dto.contact_info ?? '',
      cooperationDate: dto.cooperation_date ? new Date(dto.cooperation_date) : null,
      salesperson: dto.salesperson ?? '',
      productGroupId: typeof dto.product_group_id === 'number' ? dto.product_group_id : null,
    });
    const saved = await this.customerRepo.save(customer);
    const productGroup =
      saved.productGroupId != null
        ? await this.systemOptionsService.getProductGroupPathById(saved.productGroupId)
        : '';
    return { ...saved, productGroup };
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
      product_group_id?: number | null;
    },
  ) {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('客户不存在');

    // 可选字符串：null 转 ''，满足数据库 NOT NULL，不擅自改写用户已填资料
    if (dto.country !== undefined) customer.country = dto.country ?? '';
    if (dto.contact_person !== undefined) customer.contactPerson = dto.contact_person ?? '';
    if (dto.contact_info !== undefined) customer.contactInfo = dto.contact_info ?? '';
    if (dto.salesperson !== undefined) customer.salesperson = dto.salesperson ?? '';
    if (dto.product_group_id !== undefined)
      customer.productGroupId = typeof dto.product_group_id === 'number' ? dto.product_group_id : null;
    // 公司名称：不允许用 null/空 覆盖已有值
    if (dto.company_name !== undefined && dto.company_name != null && String(dto.company_name).trim() !== '') {
      const nextName = dto.company_name.trim();
      const dup = await this.findCustomerByTrimmedCompanyName(nextName, id);
      if (dup) {
        throw new ConflictException('该公司名称已存在，请使用其他名称');
      }
      customer.companyName = nextName;
    }
    if (dto.cooperation_date !== undefined) customer.cooperationDate = dto.cooperation_date ? new Date(dto.cooperation_date) : null;

    const saved = await this.customerRepo.save(customer);
    const productGroup =
      saved.productGroupId != null
        ? await this.systemOptionsService.getProductGroupPathById(saved.productGroupId)
        : '';
    return { ...saved, productGroup };
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
    const links = await this.userRoleRepo.find({ where: { roleId: role.id }, select: ['userId'] });
    const userIds = Array.from(new Set(links.map((x) => x.userId)));
    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('(u.role_id = :rid OR u.id IN (:...ids))', { rid: role.id, ids: userIds.length ? userIds : [0] })
      .orderBy('u.display_name', 'ASC')
      .getMany();
    return users.map((u) => (u.displayName?.trim() || u.username) || '').filter(Boolean);
  }

  /** 获取跟单员列表：角色 code 为 merchandiser 的用户（displayName 或 username） */
  async getMerchandisers(): Promise<string[]> {
    const role = await this.roleRepo.findOne({ where: { code: 'merchandiser' } });
    if (!role) return [];
    const links = await this.userRoleRepo.find({ where: { roleId: role.id }, select: ['userId'] });
    const userIds = Array.from(new Set(links.map((x) => x.userId)));
    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('(u.role_id = :rid OR u.id IN (:...ids))', { rid: role.id, ids: userIds.length ? userIds : [0] })
      .orderBy('u.display_name', 'ASC')
      .getMany();
    return users.map((u) => (u.displayName?.trim() || u.username) || '').filter(Boolean);
  }

  /** 获取产品分组列表：返回 id + 路径，供前端下拉用（value=id, label=path） */
  async getProductGroups(): Promise<{ id: number; path: string }[]> {
    const list = await this.systemOptionsService.findAllByType('product_groups');
    if (list.length === 0) return [];
    const pathMap = await this.systemOptionsService.getProductGroupPathsByIds(list.map((o) => o.id));
    return list.map((o) => ({ id: o.id, path: pathMap[o.id] ?? o.value }));
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
  }

  /** 与库中已有客户公司名称是否重复（按首尾空白 trim 后完全一致） */
  private async findCustomerByTrimmedCompanyName(trimmedName: string, excludeId?: number): Promise<Customer | null> {
    const qb = this.customerRepo
      .createQueryBuilder('c')
      .where('TRIM(c.company_name) = :name', { name: trimmedName });
    if (excludeId != null) {
      qb.andWhere('c.id != :excludeId', { excludeId });
    }
    return qb.getOne();
  }

  /** 从小满获取客户列表（供前端选择），支持 keyword 模糊搜索 */
  async getXiaomanList(page = 1, pageSize = 20, keyword?: string) {
    const { list, total } = await this.xiaomanService.getCompanyList(page, pageSize, keyword);
    if (!list.length) {
      return { list: [], total };
    }
    // 为当前页公司补充主联系人姓名信息
    const details = await this.xiaomanService.getCompanyDetailsBatch(list.map((c) => c.company_id));

    const withContact = list.map((item, index) => {
      const d = details[index];
      let contactPerson = '';
      let coopDate = item.order_time || '';
      if (d) {
        const anyDetail = d as unknown as {
          main_contact_name?: string;
          main_contact?: { name?: string } | null;
          contacts?: { name?: string; contact_name?: string; nickname?: string; nick_name?: string }[] | null;
          customers?: {
            name?: string;
            nickname?: string;
            nick_name?: string;
            main_customer_flag?: number;
          }[];
          contact_person?: string;
          contact_name?: string;
          contact_nickname?: string;
          linkman?: string;
          cooperation_date?: string;
          cooperationDate?: string;
          order_time?: string;
        };
        const mainCustomer =
          (Array.isArray(anyDetail.customers) &&
            (anyDetail.customers.find((c) => c.main_customer_flag === 1) ?? anyDetail.customers[0])) ||
          null;
        contactPerson =
          anyDetail.main_contact_name?.trim() ||
          anyDetail.main_contact?.name?.trim() ||
          mainCustomer?.nickname?.trim() ||
          mainCustomer?.nick_name?.trim() ||
          mainCustomer?.name?.trim() ||
          (Array.isArray(anyDetail.contacts) &&
            (anyDetail.contacts[0]?.nickname?.trim() ||
              anyDetail.contacts[0]?.nick_name?.trim() ||
              anyDetail.contacts[0]?.name?.trim() ||
              anyDetail.contacts[0]?.contact_name?.trim())) ||
          anyDetail.contact_nickname?.trim() ||
          anyDetail.contact_person?.trim() ||
          anyDetail.contact_name?.trim() ||
          anyDetail.linkman?.trim() ||
          '';
        const rawCoopDate =
          anyDetail.cooperation_date ||
          anyDetail.cooperationDate ||
          d.order_time;
        if (typeof rawCoopDate === 'string' && rawCoopDate.trim()) {
          coopDate = rawCoopDate.split(' ')[0];
        }
      }
      return { ...item, contactPerson, order_time: coopDate };
    });
    return { list: withContact, total };
  }

  /** 从小满导入选中客户：客户编号、国家、联系人、合作日期、产品分组、联系电话
   *  导入人自动记为业务员（当前登录账号）
   */
  async importFromXiaoman(
    companyIds: number[],
    currentUser?: { userId: number; username: string },
  ): Promise<{ imported: number; skipped: number; errors: string[] }> {
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
      // 国家优先使用小满返回的中文名称，其次使用英文代码
      const anyCountry = d as unknown as { country_name?: string; country?: string; country_region?: { country?: string } };
      const country = anyCountry.country_name ?? anyCountry.country ?? anyCountry.country_region?.country ?? '';
      const contactInfo = Array.isArray(d.tel) ? d.tel.filter(Boolean).join('; ') : '';
      const pathFromXiaoman = (d.product_group_names ?? '').trim();
      let productGroupId: number | null = null;
      if (pathFromXiaoman) {
        const groups = await this.getProductGroups();
        const match = groups.find((g) => g.path === pathFromXiaoman);
        if (match) productGroupId = match.id;
      }

      // 主联系人姓名，同步到本地客户 contactPerson 字段，便于后续展示
      const anyDetail = d as unknown as {
        main_contact_name?: string;
        main_contact?: { name?: string } | null;
        contacts?: { name?: string; contact_name?: string; nickname?: string; nick_name?: string }[] | null;
        customers?: {
          name?: string;
          nickname?: string;
          nick_name?: string;
          main_customer_flag?: number;
        }[];
        contact_person?: string;
        contact_name?: string;
        contact_nickname?: string;
        linkman?: string;
        cooperation_date?: string;
        cooperationDate?: string;
        order_time?: string;
      };
      const mainCustomer =
        (Array.isArray(anyDetail.customers) &&
          (anyDetail.customers.find((c) => c.main_customer_flag === 1) ?? anyDetail.customers[0])) ||
        null;
      const contactPerson =
        anyDetail.main_contact_name?.trim() ||
        anyDetail.main_contact?.name?.trim() ||
        mainCustomer?.nickname?.trim() ||
        mainCustomer?.nick_name?.trim() ||
        mainCustomer?.name?.trim() ||
        (Array.isArray(anyDetail.contacts) &&
          (anyDetail.contacts[0]?.nickname?.trim() ||
            anyDetail.contacts[0]?.nick_name?.trim() ||
            anyDetail.contacts[0]?.name?.trim() ||
            anyDetail.contacts[0]?.contact_name?.trim())) ||
        anyDetail.contact_nickname?.trim() ||
        anyDetail.contact_person?.trim() ||
        anyDetail.contact_name?.trim() ||
        anyDetail.linkman?.trim() ||
        '';

      const rawCoopDate =
        anyDetail.cooperation_date ||
        anyDetail.cooperationDate ||
        d.order_time;
      const cooperationDate =
        typeof rawCoopDate === 'string' && rawCoopDate.trim() ? rawCoopDate.split(' ')[0] : null;

      // 导入人作为默认业务员：优先用 displayName，其次 username
      let salesperson = '';
      if (currentUser?.userId) {
        const user = await this.userRepo.findOne({ where: { id: currentUser.userId } });
        if (user) {
          salesperson = (user.displayName?.trim() || user.username || '').trim();
        }
      }

      try {
        await this.customerRepo.save(
          this.customerRepo.create({
            customerId,
            country,
            companyName: d.name || d.short_name || customerId,
            contactPerson,
            contactInfo,
            cooperationDate: cooperationDate ? new Date(cooperationDate) : null,
            salesperson,
            productGroupId,
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
