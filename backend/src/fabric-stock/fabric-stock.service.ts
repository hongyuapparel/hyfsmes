import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FabricStock } from '../entities/fabric-stock.entity';
import { FabricOutbound } from '../entities/fabric-outbound.entity';

@Injectable()
export class FabricStockService {
  constructor(
    @InjectRepository(FabricStock)
    private readonly stockRepo: Repository<FabricStock>,
    @InjectRepository(FabricOutbound)
    private readonly outboundRepo: Repository<FabricOutbound>,
  ) {}

  async getList(params: {
    name?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: FabricStock[]; total: number; page: number; pageSize: number }> {
    const { name, page = 1, pageSize = 20 } = params;
    const qb = this.stockRepo.createQueryBuilder('s');
    if (name?.trim()) {
      qb.andWhere('s.name LIKE :name', { name: `%${name.trim()}%` });
    }
    qb.orderBy('s.created_at', 'DESC');
    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    return { list, total, page, pageSize };
  }

  async getOne(id: number): Promise<FabricStock> {
    const item = await this.stockRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('面料记录不存在');
    return item;
  }

  async create(dto: { name: string; quantity?: number; unit?: string; remark?: string; imageUrl?: string }): Promise<FabricStock> {
    const entity = this.stockRepo.create({
      name: dto.name?.trim() ?? '',
      quantity: String(dto.quantity ?? 0),
      unit: dto.unit?.trim() ?? '米',
      remark: dto.remark?.trim() ?? '',
      imageUrl: dto.imageUrl?.trim() ?? '',
    });
    return this.stockRepo.save(entity);
  }

  async update(id: number, dto: { name?: string; quantity?: number; unit?: string; remark?: string; imageUrl?: string }): Promise<FabricStock> {
    const item = await this.stockRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('面料记录不存在');
    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.quantity !== undefined) item.quantity = String(dto.quantity);
    if (dto.unit !== undefined) item.unit = dto.unit?.trim() ?? '米';
    if (dto.remark !== undefined) item.remark = dto.remark?.trim() ?? '';
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl?.trim() ?? '';
    return this.stockRepo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.stockRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('面料记录不存在');
    await this.stockRepo.remove(item);
  }

  /** 出库：减少数量，并记录照片与备注（谁领走、用途） */
  async outbound(
    id: number,
    quantity: number,
    photoUrl: string,
    remark: string,
  ): Promise<void> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) throw new NotFoundException('面料记录不存在');
    const qty = Number(quantity);
    const current = parseFloat(stock.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new NotFoundException('出库数量必须大于 0');
    }
    if (qty > current) {
      throw new NotFoundException('出库数量不能大于当前库存');
    }
    stock.quantity = String(current - qty);
    await this.stockRepo.save(stock);
    const out = this.outboundRepo.create({
      fabricStockId: id,
      quantity: String(qty),
      photoUrl: photoUrl?.trim() ?? '',
      remark: remark?.trim() ?? '',
    });
    await this.outboundRepo.save(out);
  }
}
