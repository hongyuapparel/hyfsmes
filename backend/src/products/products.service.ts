import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Product } from '../entities/product.entity';
import { Customer } from '../entities/customer.entity';
import { User, UserStatus } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { SystemOptionsService } from '../system-options/system-options.service';

export interface ProductListQuery {
  companyName?: string;
  skuCode?: string;
  productGroup?: string;
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
    private systemOptionsService: SystemOptionsService,
  ) {}

  async findAll(query: ProductListQuery) {
    const {
      companyName,
      skuCode,
      productGroup,
      salesperson,
      page = 1,
      pageSize = 20,
      sortBy = 'id',
      sortOrder = 'asc',
    } = query;
    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.customer', 'c');

    if (companyName?.trim()) {
      qb.andWhere('c.company_name LIKE :companyName', { companyName: `%${companyName.trim()}%` });
    }
    if (skuCode?.trim()) {
      qb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    }
    if (productGroup?.trim()) {
      // 产品分组使用「前缀匹配」：父分组会包含其所有子分组
      qb.andWhere('p.product_group LIKE :productGroup', { productGroup: `${productGroup.trim()}%` });
    }
    if (salesperson?.trim()) {
      qb.andWhere('p.salesperson = :salesperson', { salesperson: salesperson.trim() });
    }

    const sortColumn = this.toSnakeCase(sortBy);
    const validSortColumns = ['id', 'sku_code', 'product_group', 'created_at', 'salesperson'];
    if (validSortColumns.includes(sortColumn)) {
      qb.orderBy(`p.${sortColumn}`, sortOrder.toUpperCase() as 'ASC' | 'DESC');
    }

    const total = await qb.getCount();
    const list = await qb.skip((page - 1) * pageSize).take(pageSize).getMany();

    return { list, total, page, pageSize };
  }

  async findOne(id: number) {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: ['customer'],
    });
    if (!product) throw new NotFoundException('产品不存在');
    return product;
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
    product_group?: string;
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
      productGroup: dto.product_group ?? '',
      customerId: dto.customer_id ?? null,
      salesperson: dto.salesperson ?? '',
    });
    return this.productRepo.save(product);
  }

  async update(
    id: number,
    dto: {
      product_name?: string;
      image_url?: string;
      product_group?: string;
      customer_id?: number | null;
      salesperson?: string;
    },
  ) {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('产品不存在');

    if (dto.product_name !== undefined) product.productName = dto.product_name;
    if (dto.image_url !== undefined) product.imageUrl = dto.image_url;
    if (dto.product_group !== undefined) product.productGroup = dto.product_group;
    if (dto.customer_id !== undefined) product.customerId = dto.customer_id;
    if (dto.salesperson !== undefined) product.salesperson = dto.salesperson;

    return this.productRepo.save(product);
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

  /** 各产品分组下的产品数量（按 product_group 精确匹配） */
  async getGroupCounts(): Promise<{ productGroup: string; count: number }[]> {
    const rows = await this.productRepo
      .createQueryBuilder('p')
      .select('p.product_group', 'productGroup')
      .addSelect('COUNT(*)', 'count')
      .groupBy('p.product_group')
      .getRawMany();
    return rows.map((r) => ({
      productGroup: (r.productGroup ?? '') as string,
      count: Number(r.count) || 0,
    }));
  }

  /** 获取产品分组列表：来自系统配置 product_groups，无配置时回退到产品表去重 */
  async getProductGroups(): Promise<string[]> {
    const configured = await this.systemOptionsService.findByType('product_groups');
    if (configured.length > 0) return configured;
    const rows = await this.productRepo
      .createQueryBuilder('p')
      .select('DISTINCT p.product_group', 'productGroup')
      .where('p.product_group != ""')
      .orderBy('p.product_group')
      .getRawMany();
    return rows.map((r) => r.productGroup).filter(Boolean);
  }

  /** 获取业务员列表：角色 code 为 salesperson 的用户 */
  async getSalespeople(): Promise<string[]> {
    const role = await this.roleRepo.findOne({ where: { code: 'salesperson' } });
    if (!role) return [];
    const users = await this.userRepo.find({
      where: { roleId: role.id, status: UserStatus.ACTIVE },
      order: { displayName: 'ASC' },
    });
    return users.map((u) => (u.displayName?.trim() || u.username) || '').filter(Boolean);
  }

  private toSnakeCase(str: string): string {
    return str.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
  }
}
