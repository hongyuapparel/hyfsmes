import { Injectable } from '@nestjs/common';
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
   * 下拉用简易搜索接口
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
}

