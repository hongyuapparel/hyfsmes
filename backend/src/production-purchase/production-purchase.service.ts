import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';

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
  /** 到待采购状态的时间（订单进入待采购时记录） */
  pendingPurchaseAt: string | null;
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
    @InjectRepository(OrderStatus)
    private readonly orderStatusRepo: Repository<OrderStatus>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoryRepo: Repository<OrderStatusHistory>,
    private readonly orderWorkflowService: OrderWorkflowService,
  ) {}

  private toDateOnlyLocalString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (typeof v === 'string') return v.slice(0, 10) || null;
    if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private toDateTimeLocalString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (typeof v === 'string') return v.slice(0, 19).replace('T', ' ') || null;
    if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    const hh = String(v.getHours()).padStart(2, '0');
    const mm = String(v.getMinutes()).padStart(2, '0');
    const ss = String(v.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

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

    // 到采购时间：从状态历史表中取进入 pending_purchase 的时间（取最新一次进入时间）
    let pendingPurchaseEnteredAtMap = new Map<number, string>();
    try {
      const pendingStatus = await this.orderStatusRepo.findOne({ where: { code: 'pending_purchase' } });
      const statusId = pendingStatus?.id;
      if (statusId) {
        const historyRows = await this.orderStatusHistoryRepo
          .createQueryBuilder('h')
          .select('h.order_id', 'orderId')
          .addSelect('MAX(h.entered_at)', 'enteredAt')
          .where('h.status_id = :statusId', { statusId })
          .andWhere('h.order_id IN (:...orderIds)', { orderIds })
          .groupBy('h.order_id')
          .getRawMany<{ orderId: number; enteredAt: string }>();
        const map = new Map<number, string>();
        for (const r of historyRows) {
          const orderId = Number((r as any)?.orderId);
          const enteredAt = (r as any)?.enteredAt as string | undefined;
          if (!Number.isFinite(orderId) || !enteredAt) continue;
          const formatted = this.toDateTimeLocalString(enteredAt);
          if (!formatted) continue;
          map.set(orderId, formatted);
        }
        pendingPurchaseEnteredAtMap = map;
      }
    } catch {
      pendingPurchaseEnteredAtMap = new Map<number, string>();
    }

    const extList = await this.orderExtRepo.find({
      where: orderIds.map((id) => ({ orderId: id })),
    });
    const extMap = new Map(extList.map((e) => [e.orderId, e]));

    const rows: PurchaseItemRow[] = [];
    for (const order of orders) {
      const ext = extMap.get(order.id);
      const materials: OrderMaterialRow[] = ext?.materials ?? [];
      const orderDate = this.toDateOnlyLocalString(order.orderDate);
      const pendingPurchaseAt =
        pendingPurchaseEnteredAtMap.get(order.id) ||
        (order.status === 'pending_purchase' && order.statusTime
          ? this.toDateTimeLocalString(order.statusTime)
          : null);

      // 采购页仅展示“当前待采购”或“历史进入过待采购”的订单：
      // 若某条链路配置为不经过待采购（如部分成品链路），则不应出现在采购页。
      if (!pendingPurchaseAt) {
        continue;
      }

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
          pendingPurchaseAt,
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
      purchaseCompletedAt: this.toDateTimeLocalString(new Date()),
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
        if (next && next !== order.status) {
          order.status = next;
          order.statusTime = new Date();
          await this.orderRepo.save(order);
        }
      }
    }
  }
}
