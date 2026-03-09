import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type ActualCutRow } from '../entities/order-cutting.entity';
import { OrderSewing } from '../entities/order-sewing.entity';

export interface SewingListItem {
  orderId: number;
  orderNo: string;
  skuCode: string;
  imageUrl: string;
  factoryName: string;
  quantity: number;
  /** 到车缝时间 */
  arrivedAt: string | null;
  /** 完成时间 */
  completedAt: string | null;
  sewingStatus: string;
  /** 裁床数量（来自 order_cutting.actualCutRows 汇总） */
  cutTotal: number | null;
  /** 车缝数量 */
  sewingQuantity: number | null;
  /** 时效判定 */
  timeRating: string;
}

export interface SewingListQuery {
  tab?: string;
  orderNo?: string;
  skuCode?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ProductionSewingService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderSewing)
    private readonly sewingRepo: Repository<OrderSewing>,
    @InjectRepository(OrderCutting)
    private readonly cuttingRepo: Repository<OrderCutting>,
  ) {}

  private sumActualCut(rows: ActualCutRow[] | null): number | null {
    if (!rows || rows.length === 0) return null;
    let sum = 0;
    for (const row of rows) {
      if (Array.isArray(row.quantities)) {
        for (const q of row.quantities) {
          if (typeof q === 'number' && Number.isFinite(q)) sum += q;
        }
      }
    }
    return sum;
  }

  async getSewingList(query: SewingListQuery): Promise<{
    list: SewingListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { tab = 'all', orderNo, skuCode, page = 1, pageSize = 20 } = query;

    const completedSewing = await this.sewingRepo.find({
      where: { status: 'completed' },
      select: ['orderId'],
    });
    const completedOrderIds = completedSewing.map((s) => s.orderId);
    const pendingFinishingWithSewIds =
      completedOrderIds.length > 0
        ? (await this.orderRepo.find({
            where: { status: 'pending_finishing', id: In(completedOrderIds) },
            select: ['id'],
          })).map((o) => o.id)
        : [];

    const qb = this.orderRepo.createQueryBuilder('o').where(
      'o.status = :pendingSewing OR (o.id IN (:...completedIds))',
      { pendingSewing: 'pending_sewing', completedIds: pendingFinishingWithSewIds.length ? pendingFinishingWithSewIds : [0] },
    );

    if (orderNo?.trim()) {
      qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    }
    if (skuCode?.trim()) {
      qb.andWhere('o.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    }

    qb.orderBy('o.order_date', 'DESC').addOrderBy('o.id', 'DESC');

    const orders = await qb.getMany();
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) {
      return { list: [], total: 0, page, pageSize };
    }

    const [sewings, cuttings] = await Promise.all([
      this.sewingRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.cuttingRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
    ]);
    const sewingMap = new Map(sewings.map((s) => [s.orderId, s]));
    const cuttingMap = new Map(cuttings.map((c) => [c.orderId, c]));

    const rows: SewingListItem[] = [];
    for (const order of orders) {
      const sewing = sewingMap.get(order.id);
      const cutting = cuttingMap.get(order.id);
      const sewingStatus = (sewing?.status ?? 'pending').toLowerCase();
      if (tab === 'pending' && sewingStatus === 'completed') continue;
      if (tab === 'completed' && sewingStatus !== 'completed') continue;

      const arrivedAt = sewing?.arrivedAt
        ? sewing.arrivedAt.toISOString().slice(0, 19).replace('T', ' ')
        : order.status === 'pending_sewing' && order.statusTime
          ? order.statusTime.toISOString().slice(0, 19).replace('T', ' ')
          : null;
      const completedAt = sewing?.completedAt
        ? sewing.completedAt.toISOString().slice(0, 19).replace('T', ' ')
        : null;

      rows.push({
        orderId: order.id,
        orderNo: order.orderNo ?? '',
        skuCode: order.skuCode ?? '',
        imageUrl: order.imageUrl ?? '',
        factoryName: order.factoryName ?? '',
        quantity: order.quantity ?? 0,
        arrivedAt,
        completedAt,
        sewingStatus: sewingStatus === 'completed' ? 'completed' : 'pending',
        cutTotal: this.sumActualCut(cutting?.actualCutRows ?? null),
        sewingQuantity: sewing?.sewingQuantity ?? null,
        timeRating: '-',
      });
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);

    return { list, total, page, pageSize };
  }

  /** 车缝登记完成：写入车缝数量、次品数量、次品说明，订单状态改为待尾部 */
  async completeSewing(
    orderId: number,
    sewingQuantity: number,
    defectQuantity: number,
    defectReason: string,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending_sewing') {
      throw new NotFoundException('仅待车缝订单可完成登记');
    }

    const now = new Date();
    const arrivedAt = order.statusTime ?? now;

    let sewing = await this.sewingRepo.findOne({ where: { orderId } });
    if (!sewing) {
      sewing = this.sewingRepo.create({
        orderId,
        status: 'completed',
        arrivedAt,
        completedAt: now,
        sewingQuantity,
        defectQuantity: defectQuantity ?? 0,
        defectReason: (defectReason ?? '').trim(),
      });
    } else {
      sewing.status = 'completed';
      sewing.arrivedAt = sewing.arrivedAt ?? arrivedAt;
      sewing.completedAt = now;
      sewing.sewingQuantity = sewingQuantity;
      sewing.defectQuantity = defectQuantity ?? 0;
      sewing.defectReason = (defectReason ?? '').trim();
    }
    await this.sewingRepo.save(sewing);

    order.status = 'pending_finishing';
    order.statusTime = now;
    await this.orderRepo.save(order);
  }
}
