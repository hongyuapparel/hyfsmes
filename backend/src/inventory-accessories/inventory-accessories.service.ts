import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryAccessory } from '../entities/inventory-accessory.entity';

@Injectable()
export class InventoryAccessoriesService {
  constructor(
    @InjectRepository(InventoryAccessory)
    private readonly repo: Repository<InventoryAccessory>,
  ) {}

  async getList(params: {
    name?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: InventoryAccessory[]; total: number; page: number; pageSize: number }> {
    const { name, category, page = 1, pageSize = 20 } = params;
    const qb = this.repo.createQueryBuilder('a');

    if (name?.trim()) {
      qb.andWhere('a.name LIKE :name', { name: `%${name.trim()}%` });
    }
    if (category?.trim()) {
      qb.andWhere('a.category = :category', { category: category.trim() });
    }
    qb.orderBy('a.created_at', 'DESC');

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { list, total, page, pageSize };
  }

  async getOne(id: number): Promise<InventoryAccessory> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('辅料记录不存在');
    return item;
  }

  async create(dto: { name: string; category?: string; quantity?: number; unit?: string; remark?: string; imageUrl?: string }): Promise<InventoryAccessory> {
    const entity = this.repo.create({
      name: dto.name?.trim() ?? '',
      category: dto.category?.trim() ?? '',
      quantity: dto.quantity ?? 0,
      unit: dto.unit?.trim() ?? '个',
      remark: dto.remark?.trim() ?? '',
      imageUrl: dto.imageUrl?.trim() ?? '',
    });
    return this.repo.save(entity);
  }

  async update(
    id: number,
    dto: { name?: string; category?: string; quantity?: number; unit?: string; remark?: string; imageUrl?: string },
  ): Promise<InventoryAccessory> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('辅料记录不存在');
    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.category !== undefined) item.category = dto.category?.trim() ?? '';
    if (dto.quantity !== undefined) item.quantity = dto.quantity;
    if (dto.unit !== undefined) item.unit = dto.unit?.trim() ?? '个';
    if (dto.remark !== undefined) item.remark = dto.remark?.trim() ?? '';
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl?.trim() ?? '';
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('辅料记录不存在');
    await this.repo.remove(item);
  }
}
