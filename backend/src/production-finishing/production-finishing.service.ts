import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type ActualCutRow } from '../entities/order-cutting.entity';
import { OrderFinishing } from '../entities/order-finishing.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { InboundPending } from '../entities/inbound-pending.entity';

export interface FinishingListItem {
  orderId: number;
  orderNo: string;
  skuCode: string;
  /** 到尾部时间 */
  arrivedAt: string | null;
  /** 完成时间（包装完成） */
  completedAt: string | null;
  finishingStatus: string;
  /** 裁床数量 */
  cutTotal: number | null;
  /** 车缝数量 */
  sewingQuantity: number | null;
  tailReceivedQty: number | null;
  tailShippedQty: number | null;
  defectQuantity: number | null;
}

export interface FinishingListQuery {
  tab?: string;
  orderNo?: string;
  skuCode?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ProductionFinishingService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderFinishing)
    private readonly finishingRepo: Repository<OrderFinishing>,
    @InjectRepository(OrderCutting)
    private readonly cuttingRepo: Repository<OrderCutting>,
    @InjectRepository(OrderSewing)
    private readonly sewingRepo: Repository<OrderSewing>,
    @InjectRepository(InboundPending)
    private readonly inboundPendingRepo: Repository<InboundPending>,
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

  async getFinishingList(query: FinishingListQuery): Promise<{
    list: FinishingListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { tab = 'all', orderNo, skuCode, page = 1, pageSize = 20 } = query;

    const inboundFinishing = await this.finishingRepo.find({
      where: { status: 'inbound' },
      select: ['orderId'],
    });
    const inboundOrderIds = inboundFinishing.map((f) => f.orderId);
    const completedWithInbound =
      inboundOrderIds.length > 0
        ? (await this.orderRepo.find({
            where: { status: 'completed', id: In(inboundOrderIds) },
            select: ['id'],
          })).map((o) => o.id)
        : [];

    const qb = this.orderRepo.createQueryBuilder('o').where(
      'o.status = :pendingFinishing OR (o.id IN (:...inboundIds))',
      { pendingFinishing: 'pending_finishing', inboundIds: completedWithInbound.length ? completedWithInbound : [0] },
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

    const [finishings, cuttings, sewings] = await Promise.all([
      this.finishingRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.cuttingRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.sewingRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
    ]);
    const finishingMap = new Map(finishings.map((f) => [f.orderId, f]));
    const cuttingMap = new Map(cuttings.map((c) => [c.orderId, c]));
    const sewingMap = new Map(sewings.map((s) => [s.orderId, s]));

    const rows: FinishingListItem[] = [];
    for (const order of orders) {
      const finishing = finishingMap.get(order.id);
      const cutting = cuttingMap.get(order.id);
      const sewing = sewingMap.get(order.id);
      const fStatus = (finishing?.status ?? 'pending_ship').toLowerCase();
      if (tab === 'pending_ship' && fStatus !== 'pending_ship') continue;
      if (tab === 'shipped' && fStatus !== 'shipped') continue;
      if (tab === 'inbound' && fStatus !== 'inbound') continue;

      const arrivedAt = finishing?.arrivedAt
        ? finishing.arrivedAt.toISOString().slice(0, 19).replace('T', ' ')
        : order.status === 'pending_finishing' && order.statusTime
          ? order.statusTime.toISOString().slice(0, 19).replace('T', ' ')
          : null;
      const completedAt = finishing?.completedAt
        ? finishing.completedAt.toISOString().slice(0, 19).replace('T', ' ')
        : null;

      rows.push({
        orderId: order.id,
        orderNo: order.orderNo ?? '',
        skuCode: order.skuCode ?? '',
        arrivedAt,
        completedAt,
        finishingStatus: fStatus,
        cutTotal: this.sumActualCut(cutting?.actualCutRows ?? null),
        sewingQuantity: sewing?.sewingQuantity ?? null,
        tailReceivedQty: finishing?.tailReceivedQty ?? null,
        tailShippedQty: finishing?.tailShippedQty ?? null,
        defectQuantity: finishing?.defectQuantity ?? null,
      });
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);

    return { list, total, page, pageSize };
  }

  /** 登记包装完成：尾部收货数、次品数 */
  async registerPackaging(
    orderId: number,
    tailReceivedQty: number,
    defectQuantity: number,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending_finishing') {
      throw new NotFoundException('仅待尾部订单可登记包装');
    }

    const now = new Date();
    const arrivedAt = order.statusTime ?? now;

    let finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) {
      finishing = this.finishingRepo.create({
        orderId,
        status: 'pending_ship',
        arrivedAt,
        completedAt: now,
        tailReceivedQty,
        tailShippedQty: 0,
        defectQuantity: defectQuantity ?? 0,
      });
    } else {
      finishing.arrivedAt = finishing.arrivedAt ?? arrivedAt;
      finishing.completedAt = now;
      finishing.tailReceivedQty = tailReceivedQty;
      finishing.defectQuantity = defectQuantity ?? 0;
      finishing.status = 'pending_ship';
    }
    await this.finishingRepo.save(finishing);
  }

  /** 发货：等待发货 -> 已发货，出货数 = 收货数 */
  async ship(orderId: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) {
      throw new NotFoundException('请先登记包装完成');
    }
    if (finishing.status !== 'pending_ship') {
      throw new NotFoundException('仅等待发货状态可操作发货');
    }

    finishing.status = 'shipped';
    finishing.tailShippedQty = finishing.tailReceivedQty;
    await this.finishingRepo.save(finishing);
  }

  /** 入库：已发货 -> 已入库，订单状态改为已完成 */
  async inbound(orderId: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) {
      throw new NotFoundException('请先登记包装并发货');
    }
    if (finishing.status !== 'shipped') {
      throw new NotFoundException('仅已发货状态可操作入库');
    }

    finishing.status = 'inbound';
    await this.finishingRepo.save(finishing);

    order.status = 'completed';
    order.statusTime = new Date();
    await this.orderRepo.save(order);

    // 写入待入库表，供库存-待入库页使用
    const pending = this.inboundPendingRepo.create({
      orderId: order.id,
      skuCode: order.skuCode ?? '',
      quantity: finishing.tailShippedQty ?? 0,
      status: 'pending',
    });
    await this.inboundPendingRepo.save(pending);
  }
}
