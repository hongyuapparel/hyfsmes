import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type ActualCutRow } from '../entities/order-cutting.entity';
import { OrderExt } from '../entities/order-ext.entity';

export interface CuttingListItem {
  orderId: number;
  orderNo: string;
  skuCode: string;
  quantity: number;
  /** 到裁床时间 */
  arrivedAt: string | null;
  /** 完成时间 */
  completedAt: string | null;
  cuttingStatus: string;
  /** 实裁总数量（actualCutRows 各格汇总） */
  actualCutTotal: number | null;
  cuttingCost: string | null;
  /** 时效判定：可选，暂返回 - */
  timeRating: string;
}

export interface CuttingListQuery {
  tab?: string;
  orderNo?: string;
  skuCode?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ProductionCuttingService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderCutting)
    private readonly cuttingRepo: Repository<OrderCutting>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
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

  async getCuttingList(query: CuttingListQuery): Promise<{
    list: CuttingListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { tab = 'all', orderNo, skuCode, page = 1, pageSize = 20 } = query;

    const completedCutting = await this.cuttingRepo.find({
      where: { status: 'completed' },
      select: ['orderId'],
    });
    const completedOrderIds = completedCutting.map((c) => c.orderId);
    const pendingSewingWithCutIds =
      completedOrderIds.length > 0
        ? (await this.orderRepo.find({
            where: { status: 'pending_sewing', id: In(completedOrderIds) },
            select: ['id'],
          })).map((o) => o.id)
        : [];

    const qb = this.orderRepo.createQueryBuilder('o').where(
      'o.status = :pendingCutting OR (o.id IN (:...completedIds))',
      { pendingCutting: 'pending_cutting', completedIds: pendingSewingWithCutIds.length ? pendingSewingWithCutIds : [0] },
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

    const cuttings = await this.cuttingRepo.find({
      where: orderIds.map((id) => ({ orderId: id })),
    });
    const cuttingMap = new Map(cuttings.map((c) => [c.orderId, c]));

    const rows: CuttingListItem[] = [];
    for (const order of orders) {
      const cutting = cuttingMap.get(order.id);
      const cuttingStatus = (cutting?.status ?? 'pending').toLowerCase();
      if (tab === 'pending' && cuttingStatus === 'completed') continue;
      if (tab === 'completed' && cuttingStatus !== 'completed') continue;

      const arrivedAt = cutting?.arrivedAt
        ? cutting.arrivedAt.toISOString().slice(0, 19).replace('T', ' ')
        : order.status === 'pending_cutting' && order.statusTime
          ? order.statusTime.toISOString().slice(0, 19).replace('T', ' ')
          : null;
      const completedAt = cutting?.completedAt
        ? cutting.completedAt.toISOString().slice(0, 19).replace('T', ' ')
        : null;

      rows.push({
        orderId: order.id,
        orderNo: order.orderNo ?? '',
        skuCode: order.skuCode ?? '',
        quantity: order.quantity ?? 0,
        arrivedAt,
        completedAt,
        cuttingStatus: cuttingStatus === 'completed' ? 'completed' : 'pending',
        actualCutTotal: this.sumActualCut(cutting?.actualCutRows ?? null),
        cuttingCost: cutting?.cuttingCost ?? null,
        timeRating: '-',
      });
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);

    return { list, total, page, pageSize };
  }

  /** 获取订单 B 区颜色尺码（供裁床登记表单回显计划数量） */
  async getOrderColorSize(orderId: number): Promise<{ colorSizeHeaders: string[]; colorSizeRows: { colorName: string; quantities: number[]; remark?: string }[] }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending_cutting') {
      throw new NotFoundException('仅待裁床订单可登记');
    }
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const colorSizeHeaders = ext?.colorSizeHeaders ?? [];
    const colorSizeRows = (ext?.colorSizeRows ?? []).map((r) => ({
      colorName: r.colorName ?? '',
      quantities: Array.isArray(r.quantities) ? [...r.quantities] : [],
      remark: r.remark,
    }));
    return { colorSizeHeaders, colorSizeRows };
  }

  /** 裁床登记完成：写入实裁数量与裁剪成本，订单状态改为待车缝 */
  async completeCutting(
    orderId: number,
    cuttingCost: string,
    actualCutRows: ActualCutRow[],
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending_cutting') {
      throw new NotFoundException('仅待裁床订单可完成登记');
    }

    const now = new Date();
    const arrivedAt = order.statusTime ?? now;
    const costNorm = cuttingCost === null || cuttingCost === undefined || String(cuttingCost).trim() === '' ? '0' : String(cuttingCost).trim();

    let cutting = await this.cuttingRepo.findOne({ where: { orderId } });
    if (!cutting) {
      cutting = this.cuttingRepo.create({
        orderId,
        status: 'completed',
        arrivedAt,
        completedAt: now,
        cuttingCost: costNorm,
        actualCutRows: actualCutRows?.length ? actualCutRows : null,
      });
    } else {
      cutting.status = 'completed';
      cutting.arrivedAt = cutting.arrivedAt ?? arrivedAt;
      cutting.completedAt = now;
      cutting.cuttingCost = costNorm;
      cutting.actualCutRows = actualCutRows?.length ? actualCutRows : null;
    }
    await this.cuttingRepo.save(cutting);

    order.status = 'pending_sewing';
    order.statusTime = now;
    await this.orderRepo.save(order);
  }
}
