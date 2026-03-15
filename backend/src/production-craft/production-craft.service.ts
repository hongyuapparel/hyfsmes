import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCraft } from '../entities/order-craft.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';

export interface CraftListItem {
  orderId: number;
  orderNo: string;
  orderDate: string | null;
  skuCode: string;
  imageUrl: string;
  supplierName: string;
  processItem: string;
  /** 订单类型 ID（system_options.id, option_type='order_types'） */
  orderTypeId: number | null;
  /** 合作方式 ID（system_options.id, option_type='collaboration'） */
  collaborationTypeId: number | null;
  purchaseStatus: string;
  craftStatus: string;
  completedAt: string | null;
}

export interface CraftListQuery {
  tab?: string;
  supplier?: string;
  processItem?: string;
  /** 订单类型 ID */
  orderTypeId?: number;
  /** 合作方式 ID */
  collaborationTypeId?: number;
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
      orderTypeId,
      collaborationTypeId,
      orderDateStart,
      orderDateEnd,
      page = 1,
      pageSize = 20,
    } = query;

    // 工艺管理：所有选择了工艺的订单都展示（不限制订单状态）
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where("o.process_item IS NOT NULL AND o.process_item != ''");

    if (processItem?.trim()) {
      qb.andWhere('o.process_item LIKE :processItem', { processItem: `%${processItem.trim()}%` });
    }
    if (typeof orderTypeId === 'number') {
      qb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId });
    }
    if (typeof collaborationTypeId === 'number') {
      qb.andWhere('o.collaboration_type_id = :collaborationTypeId', {
        collaborationTypeId,
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
        orderTypeId: order.orderTypeId ?? null,
        collaborationTypeId: order.collaborationTypeId ?? null,
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
