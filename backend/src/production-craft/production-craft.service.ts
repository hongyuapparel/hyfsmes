import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCraft } from '../entities/order-craft.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';

/** 已审单且需展示工艺的订单状态 */
const CRAFT_ORDER_STATUSES = [
  'pending_pattern',
  'pending_purchase',
  'pending_cutting',
  'pending_sewing',
  'pending_finishing',
  'completed',
];

export interface CraftListItem {
  orderId: number;
  orderNo: string;
  orderDate: string | null;
  skuCode: string;
  imageUrl: string;
  supplierName: string;
  processItem: string;
  orderType: string;
  collaborationType: string;
  purchaseStatus: string;
  craftStatus: string;
  completedAt: string | null;
}

export interface CraftListQuery {
  tab?: string;
  supplier?: string;
  processItem?: string;
  orderType?: string;
  collaborationType?: string;
  orderDateStart?: string;
  orderDateEnd?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ProductionCraftService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderCraft)
    private readonly craftRepo: Repository<OrderCraft>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
  ) {}

  private isPurchaseCompleted(materials: OrderMaterialRow[] | null): boolean {
    if (!materials || materials.length === 0) return false;
    return materials.every((m) => (m.purchaseStatus ?? 'pending').toLowerCase() === 'completed');
  }

  private firstSupplierName(materials: OrderMaterialRow[] | null): string {
    if (!materials || materials.length === 0) return '';
    const first = materials.find((m) => (m.supplierName ?? '').trim());
    return first ? (first.supplierName ?? '').trim() : (materials[0]?.supplierName ?? '').trim();
  }

  private anySupplierMatches(materials: OrderMaterialRow[] | null, supplier: string): boolean {
    if (!supplier?.trim()) return true;
    if (!materials || materials.length === 0) return false;
    const lower = supplier.trim().toLowerCase();
    return materials.some((m) => (m.supplierName ?? '').toLowerCase().includes(lower));
  }

  async getCraftList(query: CraftListQuery): Promise<{
    list: CraftListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      tab = 'all',
      supplier,
      processItem,
      orderType,
      collaborationType,
      orderDateStart,
      orderDateEnd,
      page = 1,
      pageSize = 20,
    } = query;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.status IN (:...statuses)', { statuses: CRAFT_ORDER_STATUSES })
      .andWhere("o.process_item IS NOT NULL AND o.process_item != ''");

    if (processItem?.trim()) {
      qb.andWhere('o.process_item LIKE :processItem', { processItem: `%${processItem.trim()}%` });
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

    const [crafts, extList] = await Promise.all([
      this.craftRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.orderExtRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
    ]);
    const craftMap = new Map(crafts.map((c) => [c.orderId, c]));
    const extMap = new Map(extList.map((e) => [e.orderId, e]));

    const rows: CraftListItem[] = [];
    for (const order of orders) {
      const ext = extMap.get(order.id);
      const materials = ext?.materials ?? null;
      if (supplier?.trim() && !this.anySupplierMatches(materials, supplier)) continue;

      const craft = craftMap.get(order.id);
      const craftStatus = (craft?.status ?? 'pending').toLowerCase();
      if (tab === 'pending' && craftStatus === 'completed') continue;
      if (tab === 'completed' && craftStatus !== 'completed') continue;

      const purchaseCompleted = this.isPurchaseCompleted(materials);
      rows.push({
        orderId: order.id,
        orderNo: order.orderNo ?? '',
        orderDate: order.orderDate ? order.orderDate.toISOString().slice(0, 10) : null,
        skuCode: order.skuCode ?? '',
        imageUrl: order.imageUrl ?? '',
        supplierName: this.firstSupplierName(materials) || '-',
        processItem: order.processItem?.trim() ?? '-',
        orderType: order.label?.trim() ?? '',
        collaborationType: order.collaborationType?.trim() ?? '',
        purchaseStatus: purchaseCompleted ? 'completed' : 'pending',
        craftStatus: craftStatus === 'completed' ? 'completed' : 'pending',
        completedAt: craft?.completedAt
          ? craft.completedAt.toISOString().slice(0, 19).replace('T', ' ')
          : null,
      });
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);

    return { list, total, page, pageSize };
  }

  async completeCraft(orderId: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (!order.processItem?.trim()) {
      throw new NotFoundException('该订单无工艺项目');
    }

    let craft = await this.craftRepo.findOne({ where: { orderId } });
    const now = new Date();
    if (!craft) {
      craft = this.craftRepo.create({
        orderId,
        status: 'completed',
        completedAt: now,
      });
    } else {
      craft.status = 'completed';
      craft.completedAt = now;
    }
    await this.craftRepo.save(craft);
  }
}
