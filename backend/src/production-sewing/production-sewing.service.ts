import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type ActualCutRow } from '../entities/order-cutting.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';

export interface SewingListItem {
  orderId: number;
  orderNo: string;
  customerName: string;
  salesperson: string;
  merchandiser: string;
  /** 客户交期（货期） */
  customerDueDate: string | null;
  skuCode: string;
  imageUrl: string;
  factoryName: string;
  quantity: number;
  /** 到车缝时间 */
  arrivedAt: string | null;
  /** 分单时间 */
  distributedAt: string | null;
  /** 加工厂交期 */
  factoryDueDate: string | null;
  /** 车缝加工费（元） */
  sewingFee: string;
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
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    private readonly orderWorkflowService: OrderWorkflowService,
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

  /** 日期/时间字段从 DB 可能是 Date 或 string，统一转为列表用的字符串 */
  private toDateOnlyString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (v instanceof Date) {
      if (Number.isNaN(v.getTime())) return null;
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, '0');
      const d = String(v.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (typeof v === 'string') return v.slice(0, 10) || null;
    return null;
  }

  private toDateTimeString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (v instanceof Date) {
      if (Number.isNaN(v.getTime())) return null;
      const y = v.getFullYear();
      const m = String(v.getMonth() + 1).padStart(2, '0');
      const d = String(v.getDate()).padStart(2, '0');
      const hh = String(v.getHours()).padStart(2, '0');
      const mm = String(v.getMinutes()).padStart(2, '0');
      const ss = String(v.getSeconds()).padStart(2, '0');
      return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
    }
    if (typeof v === 'string') return v.slice(0, 19).replace('T', ' ') || null;
    return null;
  }

  /** 登记车缝完成弹窗用：订单数量/裁床数量按尺码（只读）、车缝数量由前端按尺码填写 */
  async getCompleteFormData(orderId: number): Promise<{
    headers: string[];
    orderRow: (number | null)[];
    cutRow: (number | null)[];
  }> {
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
    const orderRow = buildPerSize((ext as { colorSizeRows?: { quantities?: number[] }[] })?.colorSizeRows ?? null);
    const cutRow = buildPerSize(cutting?.actualCutRows ?? null);
    const cutTotal = this.sumActualCut(cutting?.actualCutRows ?? null);
    return {
      headers,
      orderRow:
        orderRow ??
        (headers.length === 1 ? [order.quantity ?? 0] : [...Array(headers.length).fill(null)]),
      cutRow:
        cutRow ??
        (headers.length === 1 ? [cutTotal != null ? cutTotal : null] : [...Array(headers.length).fill(null)]),
    };
  }

  private async buildSewingRows(baseQuery: SewingListQuery): Promise<SewingListItem[]> {
    const { tab = 'all', orderNo, skuCode } = baseQuery;

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
      return [];
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

      const arrivedAt =
        this.toDateTimeString(sewing?.arrivedAt) ??
        (order.status === 'pending_sewing' ? this.toDateTimeString(order.statusTime) : null);
      const completedAt = this.toDateTimeString(sewing?.completedAt);
      const distributedAt = this.toDateTimeString(sewing?.distributedAt);
      const factoryDueDate = this.toDateOnlyString(sewing?.factoryDueDate);
      const sewingFee = sewing?.sewingFee != null ? String(sewing.sewingFee) : '0';

      rows.push({
        orderId: order.id,
        orderNo: order.orderNo ?? '',
        customerName: order.customerName ?? '',
        salesperson: order.salesperson ?? '',
        merchandiser: order.merchandiser ?? '',
        customerDueDate: this.toDateOnlyString(order.customerDueDate),
        skuCode: order.skuCode ?? '',
        imageUrl: order.imageUrl ?? '',
        factoryName: order.factoryName ?? '',
        quantity: order.quantity ?? 0,
        arrivedAt,
        distributedAt,
        factoryDueDate,
        sewingFee,
        completedAt,
        sewingStatus: sewingStatus === 'completed' ? 'completed' : 'pending',
        cutTotal: this.sumActualCut(cutting?.actualCutRows ?? null),
        sewingQuantity: sewing?.sewingQuantity ?? null,
        timeRating: '-',
      });
    }

    return rows;
  }

  async getSewingList(query: SewingListQuery): Promise<{
    list: SewingListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page = 1, pageSize = 20 } = query;
    const rows = await this.buildSewingRows(query);
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);
    return { list, total, page, pageSize };
  }

  async getSewingExportRows(query: SewingListQuery): Promise<SewingListItem[]> {
    return this.buildSewingRows(query);
  }

  /** 分单：记录分单时间、加工厂交期、加工厂名称（写入订单）、车缝加工费 */
  async assignSewing(
    orderId: number,
    distributedAt: Date,
    factoryDueDate: Date | null,
    factoryName: string,
    sewingFee: string,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending_sewing') {
      throw new NotFoundException('仅待车缝订单可分单');
    }

    order.factoryName = (factoryName ?? '').trim();
    await this.orderRepo.save(order);

    let sewing = await this.sewingRepo.findOne({ where: { orderId } });
    if (!sewing) {
      sewing = this.sewingRepo.create({
        orderId,
        status: 'pending',
        distributedAt,
        factoryDueDate: factoryDueDate ?? null,
        sewingFee: sewingFee ?? '0',
      });
    } else {
      sewing.distributedAt = distributedAt;
      sewing.factoryDueDate = factoryDueDate ?? null;
      sewing.sewingFee = sewingFee ?? '0';
    }
    await this.sewingRepo.save(sewing);
  }

  /** 车缝登记完成：写入车缝数量（可按尺码）、次品数量、次品说明，订单状态改为待尾部 */
  async completeSewing(
    orderId: number,
    sewingQuantity: number,
    defectQuantity: number,
    defectReason: string,
    sewingQuantities?: number[] | null,
    actorUserId?: number,
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
    const totalQty =
      Array.isArray(sewingQuantities) && sewingQuantities.length > 0
        ? sewingQuantities.reduce((a, b) => a + (Number(b) || 0), 0)
        : sewingQuantity;
    const sewingQuantityRow =
      Array.isArray(sewingQuantities) && sewingQuantities.length > 0 ? sewingQuantities : null;

    let sewing = await this.sewingRepo.findOne({ where: { orderId } });
    if (!sewing) {
      sewing = this.sewingRepo.create({
        orderId,
        status: 'completed',
        arrivedAt,
        completedAt: now,
        sewingQuantity: totalQty,
        sewingQuantityRow,
        defectQuantity: defectQuantity ?? 0,
        defectReason: (defectReason ?? '').trim(),
      });
    } else {
      sewing.status = 'completed';
      sewing.arrivedAt = sewing.arrivedAt ?? arrivedAt;
      sewing.completedAt = now;
      sewing.sewingQuantity = totalQty;
      sewing.sewingQuantityRow = sewingQuantityRow;
      sewing.defectQuantity = defectQuantity ?? 0;
      sewing.defectReason = (defectReason ?? '').trim();
    }
    await this.sewingRepo.save(sewing);

    const next = await this.orderWorkflowService.resolveNextStatus({
      order,
      triggerCode: 'sewing_completed',
      actorUserId: actorUserId ?? 0,
    });
    if (next && next !== order.status) {
      order.status = next;
      order.statusTime = now;
      await this.orderRepo.save(order);
    }
  }
}
