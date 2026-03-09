import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InboundPending } from '../entities/inbound-pending.entity';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { Order } from '../entities/order.entity';

export interface PendingListItem {
  id: number;
  orderId: number;
  orderNo: string;
  skuCode: string;
  quantity: number;
  createdAt: string;
}

@Injectable()
export class InventoryPendingService {
  constructor(
    @InjectRepository(InboundPending)
    private readonly pendingRepo: Repository<InboundPending>,
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async getList(params: {
    orderNo?: string;
    skuCode?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: PendingListItem[]; total: number; page: number; pageSize: number }> {
    const { orderNo, skuCode, page = 1, pageSize = 20 } = params;

    const qb = this.pendingRepo
      .createQueryBuilder('p')
      .innerJoin(Order, 'o', 'o.id = p.order_id')
      .where('p.status = :status', { status: 'pending' })
      .select([
        'p.id AS id',
        'p.order_id AS orderId',
        'o.order_no AS orderNo',
        'p.sku_code AS skuCode',
        'p.quantity AS quantity',
        'p.created_at AS createdAt',
      ]);

    if (orderNo?.trim()) {
      qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    }
    if (skuCode?.trim()) {
      qb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    }
    qb.orderBy('p.created_at', 'DESC');

    const countQb = this.pendingRepo
      .createQueryBuilder('p')
      .innerJoin(Order, 'o', 'o.id = p.order_id')
      .where('p.status = :status', { status: 'pending' });
    if (orderNo?.trim()) {
      countQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    }
    if (skuCode?.trim()) {
      countQb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    }
    const total = await countQb.getCount();

    const rows = await qb
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<{ id: number; orderId: number; orderNo: string; skuCode: string; quantity: number; createdAt: Date }>();

    const list: PendingListItem[] = rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNo: r.orderNo ?? '',
      skuCode: r.skuCode ?? '',
      quantity: r.quantity ?? 0,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
    }));

    return { list, total, page, pageSize };
  }

  /** 执行入库：选中记录填写仓库、部门、位置，写入成品库存并标记待入库完成；可选传 imageUrl */
  async doInbound(ids: number[], warehouse: string, department: string, location: string, imageUrl?: string): Promise<void> {
    if (!ids?.length) {
      throw new NotFoundException('请选择待入库记录');
    }
    const pendings = await this.pendingRepo.find({
      where: { id: In(ids), status: 'pending' },
    });
    if (pendings.length === 0) {
      throw new NotFoundException('未找到有效的待入库记录');
    }
    const img = imageUrl?.trim() ?? '';
    for (const p of pendings) {
      const stock = this.stockRepo.create({
        orderId: p.orderId,
        skuCode: p.skuCode,
        quantity: p.quantity,
        warehouse: warehouse?.trim() ?? '',
        department: department?.trim() ?? '',
        location: location?.trim() ?? '',
        imageUrl: img,
      });
      await this.stockRepo.save(stock);
      p.status = 'completed';
      await this.pendingRepo.save(p);
    }
  }
}
