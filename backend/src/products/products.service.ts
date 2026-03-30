import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Customer } from '../entities/customer.entity';
import { User, UserStatus } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import { SystemOptionsService } from '../system-options/system-options.service';

export interface ProductListQuery {
  productName?: string;
  companyName?: string;
  skuCode?: string;
  /** 产品分组 ID（system_options.id） */
  productGroupId?: number | null;
  /** 适用人群 ID（system_options.id） */
  applicablePeopleId?: number | null;
  salesperson?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private productRepo: Repository<Product>,
    @InjectRepository(Customer)
    private customerRepo: Repository<Customer>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
    private systemOptionsService: SystemOptionsService,
  ) {}

  async findAll(query: ProductListQuery) {
    const {
      productName,
      companyName,
      skuCode,
      productGroupId,
      applicablePeopleId,
      salesperson,
      page = 1,
      pageSize = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.customer', 'c');

    if (productName?.trim()) {
      qb.andWhere('p.product_name LIKE :productName', { productName: `%${productName.trim()}%` });
    }
    if (companyName?.trim()) {
      qb.andWhere('c.company_name LIKE :companyName', { companyName: `%${companyName.trim()}%` });
    }
    if (skuCode?.trim()) {
      qb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    }
    if (typeof productGroupId === 'number') {
      const groupIds = await this.systemOptionsService.getSelfAndDescendantIds('product_groups', productGroupId);
      qb.andWhere('p.product_group_id IN (:...groupIds)', {
        groupIds,
      });
    }
    if (typeof applicablePeopleId === 'number') {
      qb.andWhere('p.applicable_people_id = :apid', { apid: applicablePeopleId });
    }
    if (salesperson?.trim()) {
      qb.andWhere('p.salesperson = :salesperson', { salesperson: salesperson.trim() });
    }

    const validSortColumns: Record<string, string> = {
      id: 'id',
      productName: 'productName',
      skuCode: 'skuCode',
      productGroupId: 'productGroupId',
      applicablePeopleId: 'applicablePeopleId',
      createdAt: 'createdAt',
      salesperson: 'salesperson',
    };
    const sortKey = typeof sortBy === 'string' ? sortBy : '';
    const resolvedSortColumn = validSortColumns[sortKey] ?? validSortColumns.id;
    qb.orderBy(`p.${resolvedSortColumn}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');

    const total = await qb.getCount();
    const list = await qb.skip((page - 1) * pageSize).take(pageSize).getMany();

    const ids = list.map((p) => p.productGroupId).filter((id): id is number => id != null);
    const pathMap = ids.length ? await this.systemOptionsService.getProductGroupPathsByIds(ids) : {};
    const apIds = list.map((p) => p.applicablePeopleId).filter((id): id is number => id != null);
    const apLabelMap = apIds.length ? await this.systemOptionsService.getOptionLabelsByIds('applicable_people', apIds) : {};
    const listWithPath = list.map((p) => ({
      ...p,
      productGroup: p.productGroupId != null ? (pathMap[p.productGroupId] ?? '') : '',
      applicablePeople: p.applicablePeopleId != null ? (apLabelMap[p.applicablePeopleId] ?? '') : '',
    }));

    return { list: listWithPath, total, page, pageSize };
  }

  async findSkus(
    params?: { keyword?: string; page?: number; pageSize?: number },
  ): Promise<{ list: Array<{ id: number; skuCode: string; productName: string; customerId: number | null; customerName: string; imageUrl: string; productGroup: string; applicablePeople: string }>; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, Number(params?.page ?? 1) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(params?.pageSize ?? 20) || 20));
    const keyword = (params?.keyword ?? '').trim();

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.customer', 'c')
      .orderBy('p.createdAt', 'DESC')
      .addOrderBy('p.id', 'DESC');

    if (keyword) {
      qb.andWhere(
        '(p.sku_code LIKE :kw OR p.product_name LIKE :kw OR c.company_name LIKE :kw)',
        { kw: `%${keyword}%` },
      );
    }

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    const groupIds = list.map((p) => p.productGroupId).filter((id): id is number => id != null);
    const pathMap = groupIds.length ? await this.systemOptionsService.getProductGroupPathsByIds(groupIds) : {};
    const apIds = list.map((p) => p.applicablePeopleId).filter((id): id is number => id != null);
    const apLabelMap = apIds.length
      ? await this.systemOptionsService.getOptionLabelsByIds('applicable_people', apIds)
      : {};

    return {
      list: list.map((p) => ({
        id: p.id,
        skuCode: p.skuCode,
        productName: p.productName ?? '',
        customerId: p.customerId ?? null,
        customerName: p.customer?.companyName ?? '',
        imageUrl: p.imageUrl ?? '',
        productGroup: p.productGroupId != null ? (pathMap[p.productGroupId] ?? '') : '',
        applicablePeople: p.applicablePeopleId != null ? (apLabelMap[p.applicablePeopleId] ?? '') : '',
      })),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: number) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['customer'],
    });
    if (!product) throw new NotFoundException('产品不存在');
    const productGroup =
      product.productGroupId != null
        ? await this.systemOptionsService.getProductGroupPathById(product.productGroupId)
        : '';
    return { ...product, productGroup };
  }

  /** 检查 SKU 编号是否已存在（唯一性校验） */
  async checkSkuExists(sku: string): Promise<{ exists: boolean }> {
    if (!sku) return { exists: false };
    const exists = await this.productRepo.findOne({ where: { skuCode: sku } });
    return { exists: !!exists };
  }

  /** 获取下一个 SKU 编号，格式 SKU0001 递增 */
  async getNextSkuCode(): Promise<string> {
    const rows = await this.productRepo
      .createQueryBuilder('p')
      .select('p.skuCode')
      .where("p.sku_code REGEXP '^SKU[0-9]+$'")
      .getMany();
    let maxNum = 0;
    for (const r of rows) {
      const m = r.skuCode.match(/^SKU(\d+)$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    }
    return `SKU${String(maxNum + 1).padStart(4, '0')}`;
  }

  async create(dto: {
    product_name?: string;
    sku_code?: string;
    image_url?: string;
    product_group_id?: number | null;
    applicable_people_id?: number | null;
    customer_id?: number | null;
    salesperson?: string;
  }) {
    const skuCode = dto.sku_code?.trim() || (await this.getNextSkuCode());
    const exists = await this.productRepo.findOne({ where: { skuCode } });
    if (exists) throw new ConflictException('SKU 编号已存在');

    const product = this.productRepo.create({
      productName: dto.product_name?.trim() ?? '',
      skuCode,
      imageUrl: dto.image_url ?? '',
      productGroupId: typeof dto.product_group_id === 'number' ? dto.product_group_id : null,
      applicablePeopleId: typeof dto.applicable_people_id === 'number' ? dto.applicable_people_id : null,
      customerId: dto.customer_id ?? null,
      salesperson: dto.salesperson ?? '',
    });
    const saved = await this.productRepo.save(product);
    const productGroup =
      saved.productGroupId != null
        ? await this.systemOptionsService.getProductGroupPathById(saved.productGroupId)
        : '';
    return { ...saved, productGroup };
  }

  async update(
    id: number,
    dto: {
      product_name?: string;
      image_url?: string;
      product_group_id?: number | null;
      applicable_people_id?: number | null;
      customer_id?: number | null;
      salesperson?: string;
    },
  ) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('产品不存在');

    if (dto.product_name !== undefined) product.productName = dto.product_name?.trim() ?? '';
    if (dto.image_url !== undefined) product.imageUrl = dto.image_url;
    if (dto.product_group_id !== undefined)
      product.productGroupId = typeof dto.product_group_id === 'number' ? dto.product_group_id : null;
    if (dto.applicable_people_id !== undefined)
      product.applicablePeopleId = typeof dto.applicable_people_id === 'number' ? dto.applicable_people_id : null;
    if (dto.customer_id !== undefined) product.customerId = dto.customer_id;
    if (dto.salesperson !== undefined) product.salesperson = dto.salesperson;

    const saved = await this.productRepo.save(product);
    const productGroup =
      saved.productGroupId != null
        ? await this.systemOptionsService.getProductGroupPathById(saved.productGroupId)
        : '';
    return { ...saved, productGroup };
  }

  async remove(id: number) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('产品不存在');
    await this.productRepo.remove(product);
  }

  async removeMany(ids: number[]) {
    if (!ids?.length) return;
    await this.productRepo.delete(ids);
  }

  /** 各产品分组下的产品数量（按 product_group_id），返回 id + 路径 + count，改名后展示自动同步 */
  async getGroupCounts(): Promise<{ productGroupId: number; productGroupPath: string; count: number }[]> {
    const rows = await this.productRepo
      .createQueryBuilder('p')
      .select('p.product_group_id', 'productGroupId')
      .addSelect('COUNT(*)', 'count')
      .where('p.product_group_id IS NOT NULL')
      .groupBy('p.product_group_id')
      .getRawMany<{ productGroupId: number; count: string }>();
    const ids = rows.map((r) => r.productGroupId).filter((n) => typeof n === 'number');
    const pathMap = ids.length ? await this.systemOptionsService.getProductGroupPathsByIds(ids) : {};
    return rows.map((r) => ({
      productGroupId: r.productGroupId,
      productGroupPath: pathMap[r.productGroupId] ?? '',
      count: Number(r.count) || 0,
    }));
  }

  /** 获取产品分组列表：返回 id + 路径，供前端树/下拉用（value=id, label=path） */
  async getProductGroups(): Promise<{ id: number; path: string }[]> {
    const list = await this.systemOptionsService.findAllByType('product_groups');
    if (list.length === 0) return [];
    const pathMap = await this.systemOptionsService.getProductGroupPathsByIds(list.map((o) => o.id));
    return list.map((o) => ({ id: o.id, path: pathMap[o.id] ?? o.value }));
  }

  /** 获取业务员列表：角色 code 为 salesperson 的用户 */
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

}
