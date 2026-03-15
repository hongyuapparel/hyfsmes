import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryAccessory } from '../entities/inventory-accessory.entity';
import { InventoryAccessoryOutbound } from '../entities/inventory-accessory-outbound.entity';
import { User, UserStatus } from '../entities/user.entity';

@Injectable()
export class InventoryAccessoriesService {
  constructor(
    @InjectRepository(InventoryAccessory)
    private readonly repo: Repository<InventoryAccessory>,
    @InjectRepository(InventoryAccessoryOutbound)
    private readonly outboundRepo: Repository<InventoryAccessoryOutbound>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getList(params: {
    name?: string;
    category?: string;
    customerName?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: InventoryAccessory[]; total: number; page: number; pageSize: number }> {
    const { name, category, customerName, page = 1, pageSize = 20 } = params;
    const qb = this.repo.createQueryBuilder('a');

    if (name?.trim()) {
      qb.andWhere('a.name LIKE :name', { name: `%${name.trim()}%` });
    }
    if (category?.trim()) {
      qb.andWhere('a.category = :category', { category: category.trim() });
    }
     if (customerName?.trim()) {
      qb.andWhere('a.customer_name LIKE :customerName', {
        customerName: `%${customerName.trim()}%`,
      });
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

  async create(dto: {
    name: string;
    category?: string;
    quantity?: number;
    unit?: string;
    remark?: string;
    imageUrl?: string;
    customerName?: string;
  }): Promise<InventoryAccessory> {
    const entity = this.repo.create({
      name: dto.name?.trim() ?? '',
      category: dto.category?.trim() ?? '',
      quantity: dto.quantity ?? 0,
      unit: dto.unit?.trim() ?? '个',
      remark: dto.remark?.trim() ?? '',
      imageUrl: dto.imageUrl?.trim() ?? '',
      customerName: dto.customerName?.trim() ?? '',
    });
    return this.repo.save(entity);
  }

  async update(
    id: number,
    dto: {
      name?: string;
      category?: string;
      quantity?: number;
      unit?: string;
      remark?: string;
      imageUrl?: string;
      customerName?: string;
    },
  ): Promise<InventoryAccessory> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('辅料记录不存在');
    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.category !== undefined) item.category = dto.category?.trim() ?? '';
    if (dto.quantity !== undefined) item.quantity = dto.quantity;
    if (dto.unit !== undefined) item.unit = dto.unit?.trim() ?? '个';
    if (dto.remark !== undefined) item.remark = dto.remark?.trim() ?? '';
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl?.trim() ?? '';
    if (dto.customerName !== undefined) item.customerName = dto.customerName?.trim() ?? '';
    return this.repo.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('辅料记录不存在');
    await this.repo.remove(item);
  }

  /** 出库弹窗「领用人」下拉：返回全公司可用用户 */
  async getUserOptions(): Promise<{ id: number; username: string; displayName: string }[]> {
    const list = await this.userRepo.find({
      where: { status: UserStatus.ACTIVE },
      order: { id: 'ASC' },
    });
    return list.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName ?? '',
    }));
  }

  async resolveOperatorLabel(userId: number, fallbackUsername: string): Promise<string> {
    const fallback = (fallbackUsername ?? '').trim();
    try {
      const u = await this.userRepo.findOne({ where: { id: userId } });
      const label = (u?.displayName ?? '').trim() || (u?.username ?? '').trim() || fallback;
      return label || fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * 辅料出库（事务 + 行锁），并写出库记录。
   * @param params.quantity 出库数量（正数）
   */
  async outbound(params: {
    accessoryId: number;
    quantity: number;
    outboundType: 'order_auto' | 'manual';
    operatorUsername: string;
    remark?: string;
    orderId?: number | null;
    orderNo?: string;
  }): Promise<{ accessory: InventoryAccessory; record: InventoryAccessoryOutbound }> {
    const qty = Number(params.quantity) || 0;
    if (!params.accessoryId || qty <= 0) {
      throw new BadRequestException('出库参数不合法');
    }

    return this.repo.manager.transaction(async (manager) => {
      const accessoryRepo = manager.getRepository(InventoryAccessory);
      const recordRepo = manager.getRepository(InventoryAccessoryOutbound);

      const accessory = await accessoryRepo
        .createQueryBuilder('a')
        .setLock('pessimistic_write')
        .where('a.id = :id', { id: params.accessoryId })
        .getOne();

      if (!accessory) throw new NotFoundException('辅料记录不存在');

      const before = Number(accessory.quantity) || 0;
      if (before < qty) {
        throw new BadRequestException(`库存不足：当前 ${before}，需要出库 ${qty}`);
      }

      accessory.quantity = before - qty;
      const savedAccessory = await accessoryRepo.save(accessory);

      const record = recordRepo.create({
        accessoryId: params.accessoryId,
        orderId: params.orderId ?? null,
        orderNo: params.orderNo ?? '',
        outboundType: params.outboundType,
        quantity: qty,
        beforeQuantity: before,
        afterQuantity: savedAccessory.quantity,
        operatorUsername: (params.operatorUsername ?? '').trim(),
        remark: (params.remark ?? '').trim(),
      });
      const savedRecord = await recordRepo.save(record);

      return { accessory: savedAccessory, record: savedRecord };
    });
  }

  async getOutboundRecords(params: {
    accessoryId?: number;
    orderNo?: string;
    outboundType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: InventoryAccessoryOutbound[]; total: number; page: number; pageSize: number }> {
    const { accessoryId, orderNo, outboundType, page = 1, pageSize = 20 } = params;
    const qb = this.outboundRepo.createQueryBuilder('r');
    if (accessoryId) qb.andWhere('r.accessory_id = :accessoryId', { accessoryId });
    if (orderNo?.trim()) qb.andWhere('r.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    if (outboundType?.trim()) qb.andWhere('r.outbound_type = :outboundType', { outboundType: outboundType.trim() });
    qb.orderBy('r.created_at', 'DESC');

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    return { list, total, page, pageSize };
  }
}
