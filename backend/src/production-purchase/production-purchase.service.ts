import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';

/** 已审单：非草稿、非待审单，即待纸样及之后的状态 */
const PURCHASE_ORDER_STATUSES = [
  'pending_pattern',
  'pending_purchase',
  'pending_cutting',
  'pending_sewing',
  'pending_finishing',
  'completed',
];

export interface PurchaseItemRow {
  orderId: number;
  materialIndex: number;
  orderNo: string;
  orderDate: string | null;
  imageUrl: string;
  skuCode: string;
  orderType: string;
  supplierName: string;
  materialName: string;
  planQuantity: number | null;
  actualPurchaseQuantity: number | null;
  purchaseAmount: string | null;
  purchaseStatus: string;
  purchaseCompletedAt: string | null;
}

export interface PurchaseListQuery {
  /** tab: all | pending | completed */
  tab?: string;
  orderNo?: string;
  skuCode?: string;
  supplier?: string;
  orderType?: string;
  orderDateStart?: string;
  orderDateEnd?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ProductionPurchaseService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
  ) {}

  async getPurchaseItems(query: PurchaseListQuery): Promise<{
    list: PurchaseItemRow[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      tab = 'all',
      orderNo,
      skuCode,
      supplier,
      orderType,
      orderDateStart,
      orderDateEnd,
      page = 1,
      pageSize = 20,
    } = query;

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.status IN (:...statuses)', { statuses: PURCHASE_ORDER_STATUSES });

    if (orderNo?.trim()) {
      qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    }
    if (skuCode?.trim()) {
      qb.andWhere('o.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    }
    if (orderType?.trim()) {
      qb.andWhere('o.label = :orderType', { orderType: orderType.trim() });
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

    const extList = await this.orderExtRepo.find({
      where: orderIds.map((id) => ({ orderId: id })),
    });
    const extMap = new Map(extList.map((e) => [e.orderId, e]));

    const rows: PurchaseItemRow[] = [];
    for (const order of orders) {
      const ext = extMap.get(order.id);
      const materials: OrderMaterialRow[] = ext?.materials ?? [];
      const orderDate = order.orderDate ? order.orderDate.toISOString().slice(0, 10) : null;
      const orderTypeLabel = order.label?.trim() ?? '';

      for (let i = 0; i < materials.length; i++) {
        const m = materials[i];
        const supplierName = (m.supplierName ?? '').trim();
        if (supplier?.trim() && !supplierName.toLowerCase().includes((supplier.trim()).toLowerCase())) {
          continue;
        }
        const purchaseStatus = (m.purchaseStatus ?? 'pending').toLowerCase();
        if (tab === 'pending' && purchaseStatus === 'completed') continue;
        if (tab === 'completed' && purchaseStatus !== 'completed') continue;

        rows.push({
          orderId: order.id,
          materialIndex: i,
          orderNo: order.orderNo ?? '',
          orderDate: orderDate,
          imageUrl: order.imageUrl ?? '',
          skuCode: order.skuCode ?? '',
          orderType: orderTypeLabel,
          supplierName: supplierName || '-',
          materialName: (m.materialName ?? '').trim() || '-',
          planQuantity: m.purchaseQuantity ?? m.orderPieces ?? null,
          actualPurchaseQuantity: m.actualPurchaseQuantity ?? null,
          purchaseAmount: m.purchaseAmount ?? null,
          purchaseStatus: purchaseStatus === 'completed' ? 'completed' : 'pending',
          purchaseCompletedAt: m.purchaseCompletedAt ?? null,
        });
      }
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);

    return { list, total, page, pageSize };
  }

  async registerPurchase(
    orderId: number,
    materialIndex: number,
    actualPurchaseQuantity: number,
    purchaseAmount: string,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    let ext = await this.orderExtRepo.findOne({ where: { orderId } });
    if (!ext || !Array.isArray(ext.materials)) {
      throw new NotFoundException('该订单无物料数据');
    }
    if (materialIndex < 0 || materialIndex >= ext.materials.length) {
      throw new NotFoundException('物料索引无效');
    }

    const materials = [...ext.materials];
    const row = materials[materialIndex] as OrderMaterialRow;
    const normalizedAmount = purchaseAmount === null || purchaseAmount === undefined || String(purchaseAmount).trim() === '' ? '0' : String(purchaseAmount).trim();
    materials[materialIndex] = {
      ...row,
      purchaseStatus: 'completed',
      actualPurchaseQuantity,
      purchaseAmount: normalizedAmount,
      purchaseCompletedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    };
    ext.materials = materials;
    await this.orderExtRepo.save(ext);
  }
}
