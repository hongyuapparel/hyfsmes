import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductionProcess } from '../entities/production-process.entity';

@Injectable()
export class ProductionProcessesService {
  constructor(
    @InjectRepository(ProductionProcess)
    private readonly repo: Repository<ProductionProcess>,
  ) {}

  /** 列表（按 sort_order 升序）；可选按 department、jobType 筛选（树表懒加载用） */
  async findAll(filters?: { department?: string; jobType?: string }): Promise<ProductionProcess[]> {
    const qb = this.repo.createQueryBuilder('p').orderBy('p.sort_order', 'ASC').addOrderBy('p.id', 'ASC');
    if (filters?.department?.trim()) {
      qb.andWhere('p.department = :department', { department: filters.department.trim() });
    }
    if (filters?.jobType?.trim()) {
      qb.andWhere('p.job_type = :jobType', { jobType: filters.jobType.trim() });
    }
    return qb.getMany();
  }

  async findOne(id: number): Promise<ProductionProcess> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('生产工序不存在');
    return row;
  }

  async create(dto: {
    department?: string;
    jobType?: string;
    name: string;
    unitPrice?: string;
    sortOrder?: number;
  }): Promise<ProductionProcess> {
    const entity = this.repo.create({
      department: (dto.department ?? '').trim(),
      jobType: (dto.jobType ?? '').trim(),
      name: dto.name.trim(),
      unitPrice: this.normalizeDecimal(dto.unitPrice ?? ''),
      sortOrder: dto.sortOrder ?? 0,
    });
    return this.repo.save(entity);
  }

  async update(
    id: number,
    dto: { department?: string; jobType?: string; name?: string; unitPrice?: string; sortOrder?: number },
  ): Promise<ProductionProcess> {
    const row = await this.findOne(id);
    if (dto.department !== undefined) row.department = dto.department.trim();
    if (dto.jobType !== undefined) row.jobType = dto.jobType.trim();
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.unitPrice !== undefined) row.unitPrice = this.normalizeDecimal(dto.unitPrice);
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    return this.repo.save(row);
  }

  async remove(id: number): Promise<void> {
    const row = await this.findOne(id);
    await this.repo.remove(row);
  }

  private normalizeDecimal(v: string | number): string {
    const s = typeof v === 'number' ? String(v) : (v ?? '').trim();
    if (s === '') return '0.00';
    const n = parseFloat(s);
    return Number.isNaN(n) ? '0.00' : n.toFixed(2);
  }
}
