import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';

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
  /** 订单类型 ID（system_options.id, option_type='order_types'） */
  orderTypeId: number | null;
  supplierName: string;
  materialName: string;
  planQuantity: number | null;
  actualPurchaseQuantity: number | null;
  purchaseAmount: string | null;
  purchaseStatus: string;
  purchaseCompletedAt: string | null;
  purchaseUnitPrice: string | null;
  purchaseOtherCost: string | null;
  purchaseRemark: string | null;
  purchaseImageUrl: string | null;
}

export interface PurchaseListQuery {
  /** tab: all | pending | completed */
  tab?: string;
  orderNo?: string;
  skuCode?: string;
  supplier?: string;
  /** 订单类型 ID */
  orderTypeId?: number;
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
    private readonly orderWorkflowService: OrderWorkflowService,
  ) {}

  /**
   * 采购登记金额类字段统一归一化：
   * - 空字符串 / null / undefined -> '0'
   * - 其他值去两端空格后按原样返回
   */
  private normalizeDecimalInput(v: unknown): string {
    if (v === null || v === undefined) return '0';
    if (typeof v === 'number') {
      return Number.isFinite(v) ? String(v) : '0';
    }
    if (typeof v === 'string') {
      const t = v.trim();
      return t || '0';
    }
    return '0';
  }

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
      orderTypeId,
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
    if (typeof orderTypeId === 'number') {
      qb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId });
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
          orderTypeId: order.orderTypeId ?? null,
          supplierName: supplierName || '-',
          materialName: (m.materialName ?? '').trim() || '-',
          planQuantity: m.purchaseQuantity ?? m.orderPieces ?? null,
          actualPurchaseQuantity: m.actualPurchaseQuantity ?? null,
          purchaseAmount: m.purchaseAmount ?? null,
          purchaseStatus: purchaseStatus === 'completed' ? 'completed' : 'pending',
          purchaseCompletedAt: m.purchaseCompletedAt ?? null,
          purchaseUnitPrice: m.purchaseUnitPrice ?? null,
          purchaseOtherCost: m.purchaseOtherCost ?? null,
          purchaseRemark: m.purchaseRemark ?? null,
          purchaseImageUrl: m.purchaseImageUrl ?? null,
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
    unitPrice: string,
    otherCost: string,
    remark: string | null | undefined,
    imageUrl: string | null | undefined,
    actorUserId?: number,
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

    const normalizedQty = Number.isFinite(actualPurchaseQuantity) ? actualPurchaseQuantity : 0;
    const normalizedUnit = Number(this.normalizeDecimalInput(unitPrice)) || 0;
    const normalizedOther = Number(this.normalizeDecimalInput(otherCost)) || 0;
    const total = normalizedQty * normalizedUnit + normalizedOther;
    const totalStr = Number.isFinite(total) ? total.toFixed(2) : '0';

    materials[materialIndex] = {
      ...row,
      purchaseStatus: 'completed',
      actualPurchaseQuantity: normalizedQty,
      purchaseUnitPrice: this.normalizeDecimalInput(unitPrice),
      purchaseOtherCost: this.normalizeDecimalInput(otherCost),
      purchaseAmount: totalStr,
      purchaseCompletedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      purchaseRemark: (remark ?? '').trim() || null,
      purchaseImageUrl: (imageUrl ?? '').trim() || null,
    };
    ext.materials = materials;
    await this.orderExtRepo.save(ext);

    // 若该订单全部物料采购完成，则按配置规则流转
    if (order.status === 'pending_purchase') {
      const allCompleted = materials.length > 0 && materials.every((m) => (m.purchaseStatus ?? 'pending').toLowerCase() === 'completed');
      if (allCompleted) {
        let next: string | null = await this.orderWorkflowService.resolveNextStatus({
          order,
          triggerCode: 'purchase_all_completed',
          actorUserId: actorUserId ?? 0,
        });
        // 若未命中任何配置规则，则按默认样品/大货逻辑继续流转
        if (!next) {
          next = await this.orderWorkflowService.resolveFallbackNextStatusForPurchase(order);
        }
        if (next && next !== order.status) {
          order.status = next;
          order.statusTime = new Date();
          await this.orderRepo.save(order);
        }
      }
    }
  }
}
