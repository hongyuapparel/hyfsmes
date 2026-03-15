import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type ActualCutRow } from '../entities/order-cutting.entity';
import { OrderExt } from '../entities/order-ext.entity';

export interface CuttingListItem {
  orderId: number;
  orderNo: string;
  customerName: string;
  salesperson: string;
  merchandiser: string;
  /** 客户交期（货期） */
  customerDueDate: string | null;
  skuCode: string;
  quantity: number;
  /** 订单主图，用于列表展示 */
  imageUrl: string;
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

  private async buildCuttingRows(baseQuery: CuttingListQuery): Promise<CuttingListItem[]> {
    const { tab = 'all', orderNo, skuCode } = baseQuery;

    const completedCutting = await this.cuttingRepo.find({
      where: { status: 'completed' },
      select: ['orderId'],
    });
    const completedOrderIds = completedCutting.map((c) => c.orderId);
    // 裁床完成 / 全部：包含所有已裁床完成的订单（不论当前是待车缝、待尾部或已完成），便于在裁床页查看历史
    const completedIds = completedOrderIds.length > 0 ? completedOrderIds : [0];

    const qb = this.orderRepo.createQueryBuilder('o').where(
      'o.status = :pendingCutting OR (o.id IN (:...completedIds))',
      { pendingCutting: 'pending_cutting', completedIds: completedIds },
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
      return [];
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
        customerName: order.customerName ?? '',
        salesperson: order.salesperson ?? '',
        merchandiser: order.merchandiser ?? '',
        customerDueDate: order.customerDueDate
          ? order.customerDueDate.toISOString().slice(0, 10)
          : null,
        skuCode: order.skuCode ?? '',
        quantity: order.quantity ?? 0,
        imageUrl: order.imageUrl ?? '',
        arrivedAt,
        completedAt,
        cuttingStatus: cuttingStatus === 'completed' ? 'completed' : 'pending',
        actualCutTotal: this.sumActualCut(cutting?.actualCutRows ?? null),
        cuttingCost: cutting?.cuttingCost ?? null,
        timeRating: '-',
      });
    }

    return rows;
  }

  async getCuttingList(query: CuttingListQuery): Promise<{
    list: CuttingListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page = 1, pageSize = 20 } = query;
    const rows = await this.buildCuttingRows(query);
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);
    return { list, total, page, pageSize };
  }

  async getCuttingExportRows(query: CuttingListQuery): Promise<CuttingListItem[]> {
    return this.buildCuttingRows(query);
  }

  /** 裁床列表用：订单数量/实裁数量按尺码明细（悬停展示，与订单列表数量追踪同结构） */
  async getQuantityBreakdown(orderId: number): Promise<{ headers: string[]; rows: Array<{ label: string; values: (number | null)[] }> }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const [ext, cutting] = await Promise.all([
      this.orderExtRepo.findOne({ where: { orderId } }),
      this.cuttingRepo.findOne({ where: { orderId } }),
    ]);
    const headers =
      Array.isArray(ext?.colorSizeHeaders) && ext.colorSizeHeaders.length > 0
        ? [...ext.colorSizeHeaders, '合计']
        : ['合计'];
    const sizeLen = headers.length - 1;
    const buildPerSize = (rows: { quantities?: number[] }[] | null | undefined): (number | null)[] | null => {
      if (!rows || rows.length === 0 || sizeLen <= 0) return null;
      const sums = Array(sizeLen).fill(0) as number[];
      rows.forEach((row) => {
        if (Array.isArray(row.quantities)) {
          row.quantities.forEach((q: unknown, idx: number) => {
            if (idx < sizeLen) {
              const n = Number(q);
              if (!Number.isNaN(n)) sums[idx] += n;
            }
          });
        }
      });
      const total = sums.reduce((a, b) => a + b, 0);
      return [...sums, total];
    };
    const orderPerSize = buildPerSize((ext as { colorSizeRows?: { quantities?: number[] }[] })?.colorSizeRows ?? null);
    const cutPerSize = buildPerSize(cutting?.actualCutRows ?? null);
    const rows: Array<{ label: string; values: (number | null)[] }> = [];
    if (orderPerSize) rows.push({ label: '订单数量', values: orderPerSize });
    if (cutPerSize) rows.push({ label: '实裁数量', values: cutPerSize });
    return { headers, rows };
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
