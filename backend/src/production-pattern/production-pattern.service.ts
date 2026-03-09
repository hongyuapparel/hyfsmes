import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';
import { OrderPattern } from '../entities/order-pattern.entity';

export interface PatternListItem {
  orderId: number;
  orderNo: string;
  orderDate: string | null;
  skuCode: string;
  imageUrl: string;
  orderType: string;
  collaborationType: string;
  /** 采购状态：completed | pending */
  purchaseStatus: string;
  patternStatus: string;
  patternMaster: string;
  sampleMaker: string;
  completedAt: string | null;
  sampleImageUrl: string;
}

export interface PatternListQuery {
  tab?: string;
  orderNo?: string;
  skuCode?: string;
  orderType?: string;
  collaborationType?: string;
  purchaseStatus?: string;
  orderDateStart?: string;
  orderDateEnd?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ProductionPatternService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderPattern)
    private readonly patternRepo: Repository<OrderPattern>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
  ) {}

  private isPurchaseCompleted(materials: OrderMaterialRow[] | null): boolean {
    if (!materials || materials.length === 0) return false;
    return materials.every((m) => (m.purchaseStatus ?? 'pending').toLowerCase() === 'completed');
  }

  async getPatternList(query: PatternListQuery): Promise<{
    list: PatternListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      tab = 'all',
      orderNo,
      skuCode,
      orderType,
      collaborationType,
      purchaseStatus,
      orderDateStart,
      orderDateEnd,
      page = 1,
      pageSize = 20,
    } = query;

    const completedPatterns = await this.patternRepo.find({
      where: { status: 'completed' },
      select: ['orderId'],
    });
    const completedOrderIds = completedPatterns.map((p) => p.orderId);
    const pendingPurchaseOrderIds =
      completedOrderIds.length > 0
        ? (await this.orderRepo.find({
            where: { status: 'pending_purchase', id: In(completedOrderIds) },
            select: ['id'],
          })).map((o) => o.id)
        : [];

    const qb = this.orderRepo.createQueryBuilder('o').where(
      'o.status = :pendingPattern OR (o.id IN (:...completedIds))',
      { pendingPattern: 'pending_pattern', completedIds: pendingPurchaseOrderIds.length ? pendingPurchaseOrderIds : [0] },
    );

    if (orderNo?.trim()) {
      qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    }
    if (skuCode?.trim()) {
      qb.andWhere('o.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    }
    if (orderType?.trim()) {
      qb.andWhere('o.label = :orderType', { orderType: orderType.trim() });
    }
    if (collaborationType?.trim()) {
      qb.andWhere('o.collaboration_type = :collaborationType', {
        collaborationType: collaborationType.trim(),
      });
    }
    if (orderDateStart) {
      qb.andWhere('o.order_date >= :orderDateStart', { orderDateStart: `${orderDateStart} 00:00:00` });
    }
    if (orderDateEnd) {
      qb.andWhere('o.order_date <= :orderDateEnd', { orderDateEnd: `${orderDateEnd} 23:59:59` });
    }

    qb.orderBy('o.order_date', 'DESC').addOrderBy('o.id', 'DESC');

    const orders = await qb.getMany();
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) {
      return { list: [], total: 0, page, pageSize };
    }

    const [patterns, extList] = await Promise.all([
      this.patternRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.orderExtRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
    ]);
    const patternMap = new Map(patterns.map((p) => [p.orderId, p]));
    const extMap = new Map(extList.map((e) => [e.orderId, e]));

    const rows: PatternListItem[] = [];
    for (const order of orders) {
      const pattern = patternMap.get(order.id);
      const ext = extMap.get(order.id);
      const materials = ext?.materials ?? null;
      const purchaseCompleted = this.isPurchaseCompleted(materials);
      const purchaseStatusStr = purchaseCompleted ? 'completed' : 'pending';
      if (purchaseStatus === 'completed' && !purchaseCompleted) continue;
      if (purchaseStatus === 'pending' && purchaseStatusStr === 'completed') continue;

      const pStatus = pattern?.status ?? 'pending_assign';
      if (tab === 'pending_assign' && pStatus !== 'pending_assign') continue;
      if (tab === 'in_progress' && pStatus !== 'in_progress') continue;
      if (tab === 'completed' && pStatus !== 'completed') continue;

      rows.push({
        orderId: order.id,
        orderNo: order.orderNo ?? '',
        orderDate: order.orderDate ? order.orderDate.toISOString().slice(0, 10) : null,
        skuCode: order.skuCode ?? '',
        imageUrl: order.imageUrl ?? '',
        orderType: order.label?.trim() ?? '',
        collaborationType: order.collaborationType?.trim() ?? '',
        purchaseStatus: purchaseStatusStr,
        patternStatus: pStatus,
        patternMaster: pattern?.patternMaster ?? '',
        sampleMaker: pattern?.sampleMaker ?? '',
        completedAt: pattern?.completedAt
          ? pattern.completedAt.toISOString().slice(0, 19).replace('T', ' ')
          : null,
        sampleImageUrl: pattern?.sampleImageUrl ?? '',
      });
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);

    return { list, total, page, pageSize };
  }

  async assignPattern(orderId: number, patternMaster: string, sampleMaker: string): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending_pattern') {
      throw new NotFoundException('仅待纸样订单可分配');
    }

    let pattern = await this.patternRepo.findOne({ where: { orderId } });
    if (!pattern) {
      pattern = this.patternRepo.create({
        orderId,
        patternMaster: patternMaster.trim(),
        sampleMaker: sampleMaker.trim(),
        status: 'in_progress',
      });
    } else {
      pattern.patternMaster = patternMaster.trim();
      pattern.sampleMaker = sampleMaker.trim();
      pattern.status = 'in_progress';
    }
    await this.patternRepo.save(pattern);
  }

  async completePattern(orderId: number, sampleImageUrl: string): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending_pattern') {
      throw new NotFoundException('仅待纸样订单可确认完成');
    }

    let pattern = await this.patternRepo.findOne({ where: { orderId } });
    if (!pattern) {
      pattern = this.patternRepo.create({
        orderId,
        patternMaster: '',
        sampleMaker: '',
        status: 'completed',
        completedAt: new Date(),
        sampleImageUrl: (sampleImageUrl ?? '').trim(),
      });
    } else {
      pattern.status = 'completed';
      pattern.completedAt = new Date();
      pattern.sampleImageUrl = (sampleImageUrl ?? '').trim();
    }
    await this.patternRepo.save(pattern);

    order.status = 'pending_purchase';
    order.statusTime = new Date();
    await this.orderRepo.save(order);
  }
}
