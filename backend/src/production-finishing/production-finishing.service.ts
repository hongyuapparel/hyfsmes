import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type ActualCutRow } from '../entities/order-cutting.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderFinishing } from '../entities/order-finishing.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { InboundPending } from '../entities/inbound-pending.entity';

export interface FinishingListItem {
  orderId: number;
  orderNo: string;
  skuCode: string;
  /** 订单主图，列表展示用 */
  imageUrl: string;
  customerName: string;
  salesperson: string;
  merchandiser: string;
  quantity: number;
  /** 客户交期（货期） */
  customerDueDate: string | null;
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
  /** 尾部入库数（可多次累加） */
  tailInboundQty: number | null;
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
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
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

  private async buildFinishingRows(baseQuery: FinishingListQuery): Promise<FinishingListItem[]> {
    const { tab = 'all', orderNo, skuCode } = baseQuery;

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
      return [];
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
        imageUrl: order.imageUrl ?? '',
        customerName: order.customerName ?? '',
        salesperson: order.salesperson ?? '',
        merchandiser: order.merchandiser ?? '',
        quantity: order.quantity ?? 0,
        customerDueDate: order.customerDueDate
          ? order.customerDueDate.toISOString().slice(0, 10)
          : null,
        arrivedAt,
        completedAt,
        finishingStatus: fStatus,
        cutTotal: this.sumActualCut(cutting?.actualCutRows ?? null),
        sewingQuantity: sewing?.sewingQuantity ?? null,
        tailReceivedQty: finishing?.tailReceivedQty ?? null,
        tailShippedQty: finishing?.tailShippedQty ?? null,
        tailInboundQty: finishing?.tailInboundQty ?? null,
        defectQuantity: finishing?.defectQuantity ?? null,
      });
    }

    return rows;
  }

  async getFinishingList(query: FinishingListQuery): Promise<{
    list: FinishingListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page = 1, pageSize = 20 } = query;
    const rows = await this.buildFinishingRows(query);
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);
    return { list, total, page, pageSize };
  }

  async getFinishingExportRows(query: FinishingListQuery): Promise<FinishingListItem[]> {
    return this.buildFinishingRows(query);
  }

  /** 登记包装完成弹窗用：订单/裁床/车缝按尺码（只读），尾部收货数由前端按尺码填写 */
  async getRegisterFormData(orderId: number): Promise<{
    headers: string[];
    orderRow: (number | null)[];
    cutRow: (number | null)[];
    sewingRow: (number | null)[];
  }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const [ext, cutting, sewing] = await Promise.all([
      this.orderExtRepo.findOne({ where: { orderId } }),
      this.cuttingRepo.findOne({ where: { orderId } }),
      this.sewingRepo.findOne({ where: { orderId } }),
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
    let sewingRow: (number | null)[];
    const sewingQtyRow = sewing?.sewingQuantityRow;
    if (Array.isArray(sewingQtyRow) && sewingQtyRow.length === headers.length) {
      sewingRow = sewingQtyRow.map((n) => (typeof n === 'number' && Number.isFinite(n) ? n : null));
    } else if (Array.isArray(sewingQtyRow) && sewingQtyRow.length > 0) {
      const total = sewingQtyRow.reduce((a, b) => a + (Number(b) || 0), 0);
      sewingRow = headers.length === 1 ? [total] : [...sewingQtyRow.slice(0, sizeLen), total];
      while (sewingRow.length < headers.length) sewingRow.push(null);
    } else {
      const total = sewing?.sewingQuantity ?? 0;
      sewingRow = headers.length === 1 ? [total] : [...Array(headers.length - 1).fill(null), total];
    }
    return {
      headers,
      orderRow:
        orderRow ??
        (headers.length === 1 ? [order.quantity ?? 0] : [...Array(headers.length).fill(null)]),
      cutRow:
        cutRow ??
        (headers.length === 1 ? [cutTotal != null ? cutTotal : null] : [...Array(headers.length).fill(null)]),
      sewingRow,
    };
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
        tailInboundQty: 0,
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

  /** 发货：填本次出货数并累加，第一次发货后状态变为已发货 */
  async ship(orderId: number, quantity: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) {
      throw new NotFoundException('请先登记包装完成');
    }
    if (finishing.status !== 'pending_ship' && finishing.status !== 'shipped') {
      throw new NotFoundException('仅等待发货或已发货状态可操作发货');
    }

    const qty = Number(quantity) || 0;
    if (qty <= 0) {
      throw new NotFoundException('请填写本次出货数');
    }
    const received = finishing.tailReceivedQty ?? 0;
    const defect = finishing.defectQuantity ?? 0;
    const inbound = finishing.tailInboundQty ?? 0;
    const newShipped = (finishing.tailShippedQty ?? 0) + qty;
    if (newShipped + inbound + defect > received) {
      throw new NotFoundException(
        `出货数+入库数+次品数不能超过尾部收货数(${received})，当前出货将累加为${newShipped}`,
      );
    }

    finishing.tailShippedQty = newShipped;
    if (finishing.status === 'pending_ship') {
      finishing.status = 'shipped';
    }
    await this.finishingRepo.save(finishing);
  }

  /** 入库：填本次入库数并累加；当 出货+入库+次品=尾部收货数 时订单完成 */
  async inbound(orderId: number, quantity: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) {
      throw new NotFoundException('请先登记包装完成');
    }
    if (finishing.status !== 'shipped') {
      throw new NotFoundException('请先执行发货后再入库');
    }

    const qty = Number(quantity) || 0;
    if (qty <= 0) {
      throw new NotFoundException('请填写本次入库数');
    }
    const received = finishing.tailReceivedQty ?? 0;
    const shipped = finishing.tailShippedQty ?? 0;
    const defect = finishing.defectQuantity ?? 0;
    const newInbound = (finishing.tailInboundQty ?? 0) + qty;

    if (shipped + newInbound + defect > received) {
      throw new NotFoundException(
        `出货数(${shipped})+入库数+次品数(${defect})不能超过尾部收货数(${received})`,
      );
    }

    finishing.tailInboundQty = newInbound;
    const total = shipped + newInbound + defect;
    if (total === received) {
      finishing.status = 'inbound';
      await this.finishingRepo.save(finishing);

      order.status = 'completed';
      order.statusTime = new Date();
      await this.orderRepo.save(order);

      const pending = this.inboundPendingRepo.create({
        orderId: order.id,
        skuCode: order.skuCode ?? '',
        quantity: finishing.tailInboundQty ?? 0,
        status: 'pending',
      });
      await this.inboundPendingRepo.save(pending);
    } else {
      await this.finishingRepo.save(finishing);
    }
  }
}
