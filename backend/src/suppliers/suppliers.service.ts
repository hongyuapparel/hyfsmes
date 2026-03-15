import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, Repository } from 'typeorm';
import { Supplier } from '../entities/supplier.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepo: Repository<Supplier>,
  ) {}

  /**
   * 下拉用简易搜索接口（订单编辑等调用）
   */
  async search(keyword: string | undefined, page = 1, pageSize = 20) {
    const where = keyword?.trim()
      ? [
          { name: Like(`%${keyword.trim()}%`) },
          { contactPerson: Like(`%${keyword.trim()}%`) },
        ]
      : {};

    const [list, total] = await this.supplierRepo.findAndCount({
      where,
      order: { id: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { list, total, page, pageSize };
  }

  /**
   * 供应商管理页：列表（支持名称、类型筛选）
   */
  async getList(params: {
    name?: string;
    supplierTypeId?: number | null;
    page?: number;
    pageSize?: number;
  }) {
    const { name, supplierTypeId, page = 1, pageSize = 20 } = params;
    const qb = this.supplierRepo.createQueryBuilder('s');
    if (name?.trim()) {
      qb.andWhere('s.name LIKE :name', { name: `%${name.trim()}%` });
    }
    if (supplierTypeId != null) {
      qb.andWhere('s.supplier_type_id = :supplierTypeId', { supplierTypeId });
    }
    qb.orderBy('s.id', 'DESC');
    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    return { list, total, page, pageSize };
  }

  async getOne(id: number): Promise<Supplier> {
    const item = await this.supplierRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('供应商不存在');
    return item;
  }

  async create(dto: {
    name: string;
    supplierTypeId?: number | null;
    businessScopeId?: number | null;
    cooperationDate?: string;
    contactPerson?: string;
    contactInfo?: string;
    factoryAddress?: string;
    settlementTime?: string;
  }): Promise<Supplier> {
    const entity = this.supplierRepo.create({
      name: dto.name?.trim() ?? '',
      supplierTypeId:
        dto.supplierTypeId != null ? Number(dto.supplierTypeId) : null,
      businessScopeId:
        dto.businessScopeId != null ? Number(dto.businessScopeId) : null,
      cooperationDate: dto.cooperationDate ? new Date(dto.cooperationDate) : null,
      contactPerson: dto.contactPerson?.trim() ?? '',
      contactInfo: dto.contactInfo?.trim() ?? '',
      factoryAddress: dto.factoryAddress?.trim() ?? '',
      settlementTime: dto.settlementTime?.trim() ?? '',
    });
    return this.supplierRepo.save(entity);
  }

  async update(
    id: number,
    dto: {
      name?: string;
      supplierTypeId?: number | null;
      businessScopeId?: number | null;
      cooperationDate?: string;
      contactPerson?: string;
      contactInfo?: string;
      factoryAddress?: string;
      settlementTime?: string;
    },
  ): Promise<Supplier> {
    const item = await this.supplierRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('供应商不存在');
    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.supplierTypeId !== undefined) {
      item.supplierTypeId =
        dto.supplierTypeId != null ? Number(dto.supplierTypeId) : null;
    }
    if (dto.businessScopeId !== undefined) {
      item.businessScopeId =
        dto.businessScopeId != null ? Number(dto.businessScopeId) : null;
    }
    if (dto.cooperationDate !== undefined) {
      item.cooperationDate = dto.cooperationDate ? new Date(dto.cooperationDate) : null;
    }
    if (dto.contactPerson !== undefined) item.contactPerson = dto.contactPerson?.trim() ?? '';
    if (dto.contactInfo !== undefined) item.contactInfo = dto.contactInfo?.trim() ?? '';
    if (dto.factoryAddress !== undefined) item.factoryAddress = dto.factoryAddress?.trim() ?? '';
    if (dto.settlementTime !== undefined) item.settlementTime = dto.settlementTime?.trim() ?? '';
    return this.supplierRepo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.supplierRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('供应商不存在');
    await this.supplierRepo.remove(item);
  }
}

