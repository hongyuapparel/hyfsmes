import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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

  async findPage(
    filters?: { department?: string; jobType?: string; page?: number; pageSize?: number },
  ): Promise<{ items: ProductionProcess[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, Number(filters?.page ?? 1) || 1);
    const pageSize = Math.min(500, Math.max(1, Number(filters?.pageSize ?? 50) || 50));
    const qb = this.repo
      .createQueryBuilder('p')
      .orderBy('p.sort_order', 'ASC')
      .addOrderBy('p.id', 'ASC');
    if (filters?.department?.trim()) {
      qb.andWhere('p.department = :department', { department: filters.department.trim() });
    }
    if (filters?.jobType?.trim()) {
      qb.andWhere('p.job_type = :jobType', { jobType: filters.jobType.trim() });
    }
    const total = await qb.getCount();
    const items = await qb
      .clone()
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    return { items, total, page, pageSize };
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

  async batchMove(ids: number[], department: string, jobType: string): Promise<{ moved: number }> {
    const cleanIds = [...new Set((ids ?? []).map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
    const targetDepartment = (department ?? '').trim()
    const targetJobType = (jobType ?? '').trim()
    if (!cleanIds.length) {
      throw new BadRequestException('请选择要移动的工序')
    }
    if (!targetDepartment || !targetJobType) {
      throw new BadRequestException('请选择目标部门和工种')
    }

    return this.repo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(ProductionProcess)
      const items = await repo.find({
        where: { id: In(cleanIds) },
        order: { sortOrder: 'ASC', id: 'ASC' },
      })
      if (items.length !== cleanIds.length) {
        throw new BadRequestException('部分工序不存在或已被删除')
      }

      const targetRows = await repo
        .createQueryBuilder('p')
        .where('p.department = :department', { department: targetDepartment })
        .andWhere('p.job_type = :jobType', { jobType: targetJobType })
        .andWhere('p.id NOT IN (:...ids)', { ids: cleanIds })
        .orderBy('p.sort_order', 'ASC')
        .addOrderBy('p.id', 'ASC')
        .getMany()
      const nextSortOrder = targetRows.length
        ? Math.max(...targetRows.map((row) => Number(row.sortOrder) || 0)) + 1
        : 0

      items.forEach((row, index) => {
        row.department = targetDepartment
        row.jobType = targetJobType
        row.sortOrder = nextSortOrder + index
      })

      await repo.save(items)
      return { moved: items.length }
    })
  }

  private normalizeDecimal(v: string | number): string {
    const s = typeof v === 'number' ? String(v) : (v ?? '').trim();
    if (s === '') return '0.00';
    const n = parseFloat(s);
    return Number.isNaN(n) ? '0.00' : n.toFixed(2);
  }
}
