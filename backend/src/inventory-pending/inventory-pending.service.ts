import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InboundPending } from '../entities/inbound-pending.entity';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { Order } from '../entities/order.entity';
import { Product } from '../entities/product.entity';

export interface PendingListItem {
  id: number;
  orderId: number;
  orderNo: string;
  customerName: string;
  skuCode: string;
  imageUrl: string;
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
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
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
      .leftJoin(Product, 'pr', 'pr.sku_code = p.sku_code')
      .where('p.status = :status', { status: 'pending' })
      .select([
        'p.id AS id',
        'p.order_id AS orderId',
        'o.order_no AS orderNo',
        'o.customer_name AS customerName',
        'p.sku_code AS skuCode',
        'pr.image_url AS imageUrl',
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
      .getRawMany<{
        id: number;
        orderId: number;
        orderNo: string;
        customerName: string;
        skuCode: string;
        imageUrl: string;
        quantity: number;
        createdAt: Date;
      }>();

    const list: PendingListItem[] = rows.map((r) => ({
      id: r.id,
      orderId: r.orderId,
      orderNo: r.orderNo ?? '',
      customerName: r.customerName ?? '',
      skuCode: r.skuCode ?? '',
      imageUrl: r.imageUrl ?? '',
      quantity: r.quantity ?? 0,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
    }));

    return { list, total, page, pageSize };
  }

  /** 执行入库：选中记录填写仓库、库存类型、部门、位置，写入成品库存并标记待入库完成；可选传 imageUrl */
  async doInbound(
    ids: number[],
    warehouseId: number | null,
    inventoryTypeId: number | null,
    department: string,
    location: string,
    imageUrl?: string,
  ): Promise<void> {
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

    // 预加载订单以获取客户信息
    const orderIds = Array.from(
      new Set(pendings.map((p) => p.orderId).filter((id) => typeof id === 'number' && id > 0)),
    );
    const orders = orderIds.length
      ? await this.orderRepo.find({
          where: { id: In(orderIds) },
        })
      : [];
    const orderMap = new Map<number, Order>();
    for (const o of orders) {
      orderMap.set(o.id, o);
    }
    for (const p of pendings) {
      const order = orderMap.get(p.orderId);
      const stock = this.stockRepo.create({
        orderId: p.orderId,
        skuCode: p.skuCode,
        quantity: p.quantity,
        warehouseId: warehouseId != null ? Number(warehouseId) : null,
        inventoryTypeId: inventoryTypeId != null ? Number(inventoryTypeId) : null,
        department: department?.trim() ?? '',
        location: location?.trim() ?? '',
        customerId: order?.customerId ?? null,
        customerName: order?.customerName?.trim() ?? '',
        imageUrl: img,
      });
      await this.stockRepo.save(stock);
      p.status = 'completed';
      await this.pendingRepo.save(p);
    }
  }
}
