import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type ActualCutRow } from '../entities/order-cutting.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderFinishing } from '../entities/order-finishing.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { OrderStatusConfigService } from '../order-status-config/order-status-config.service';
import type { FinishingListItem, FinishingListQuery } from './production-finishing.types';

@Injectable()
export class ProductionFinishingQueryService {
  private hasTailReceivedQtyRowColumn: boolean | null = null;
  private hasPackagingQtyRowColumns: boolean | null = null;

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
    private readonly orderStatusConfigService: OrderStatusConfigService,
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

  private isDateTimeInRange(
    v: Date | string | null | undefined,
    start?: string,
    end?: string,
  ): boolean {
    const text = this.toDateTimeLocalString(v);
    if (!text) return false;
    if (start && text < `${start} 00:00:00`) return false;
    if (end && text > `${end} 23:59:59`) return false;
    return true;
  }

  private normalizeFinishingQtyRowToHeaders(stored: number[] | null, headers: string[]): (number | null)[] | null {
    if (!stored || stored.length === 0) return null;
    const hLen = headers.length;
    const sizeLen = Math.max(0, hLen - 1);
    if (stored.length === hLen) {
      return stored.map((n) => (typeof n === 'number' && Number.isFinite(n) ? n : Number(n) || 0));
    }
    if (hLen > 1 && stored.length === sizeLen) {
      const sum = stored.reduce((a, b) => a + (Number(b) || 0), 0);
      return [...stored.map((n) => Number(n) || 0), sum];
    }
    if (hLen === 1 && stored.length >= 1) return [Number(stored[0]) || 0];
    return null;
  }

  private async hasTailReceivedQtyRow(): Promise<boolean> {
    if (this.hasTailReceivedQtyRowColumn != null) return this.hasTailReceivedQtyRowColumn;
    try {
      const rows = await this.finishingRepo.query("SHOW COLUMNS FROM `order_finishing` LIKE 'tail_received_qty_row'");
      this.hasTailReceivedQtyRowColumn = Array.isArray(rows) && rows.length > 0;
      return this.hasTailReceivedQtyRowColumn;
    } catch {
      this.hasTailReceivedQtyRowColumn = false;
      return false;
    }
  }

  private async hasPackagingQtyRows(): Promise<boolean> {
    if (this.hasPackagingQtyRowColumns != null) return this.hasPackagingQtyRowColumns;
    try {
      const r1 = await this.finishingRepo.query("SHOW COLUMNS FROM `order_finishing` LIKE 'tail_inbound_qty_row'");
      const r2 = await this.finishingRepo.query("SHOW COLUMNS FROM `order_finishing` LIKE 'defect_quantity_row'");
      this.hasPackagingQtyRowColumns = Array.isArray(r1) && r1.length > 0 && Array.isArray(r2) && r2.length > 0;
      return this.hasPackagingQtyRowColumns;
    } catch {
      this.hasPackagingQtyRowColumns = false;
      return false;
    }
  }

  private async fetchTailReceivedQtyRow(orderId: number): Promise<number[] | null> {
    if (!(await this.hasTailReceivedQtyRow())) return null;
    try {
      const rows = await this.finishingRepo.query(
        'SELECT tail_received_qty_row AS tailReceivedQtyRow FROM `order_finishing` WHERE order_id = ? LIMIT 1',
        [orderId],
      );
      const raw = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { tailReceivedQtyRow?: unknown }).tailReceivedQtyRow : null;
      if (raw == null) return null;
      if (Array.isArray(raw)) return raw as number[];
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as number[]) : null;
      }
      if (typeof raw === 'object') return Array.isArray(raw) ? (raw as number[]) : null;
      return null;
    } catch {
      return null;
    }
  }

  private async fetchTailInboundQtyRow(orderId: number): Promise<number[] | null> {
    if (!(await this.hasPackagingQtyRows())) return null;
    try {
      const rows = await this.finishingRepo.query(
        'SELECT tail_inbound_qty_row AS tailInboundQtyRow FROM `order_finishing` WHERE order_id = ? LIMIT 1',
        [orderId],
      );
      const raw = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { tailInboundQtyRow?: unknown }).tailInboundQtyRow : null;
      if (raw == null) return null;
      if (Array.isArray(raw)) return raw.map((n: unknown) => Number(n) || 0);
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map((n: unknown) => Number(n) || 0) : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async fetchDefectQuantityRow(orderId: number): Promise<number[] | null> {
    if (!(await this.hasPackagingQtyRows())) return null;
    try {
      const rows = await this.finishingRepo.query(
        'SELECT defect_quantity_row AS defectQuantityRow FROM `order_finishing` WHERE order_id = ? LIMIT 1',
        [orderId],
      );
      const raw = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { defectQuantityRow?: unknown }).defectQuantityRow : null;
      if (raw == null) return null;
      if (Array.isArray(raw)) return raw.map((n: unknown) => Number(n) || 0);
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map((n: unknown) => Number(n) || 0) : null;
      }
      return null;
    } catch {
      return null;
    }
  }

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
    const { tab = 'all', orderNo, skuCode, completedStart, completedEnd } = baseQuery;
    const inboundFinishing = await this.finishingRepo.find({ where: { status: 'inbound' }, select: ['orderId'] });
    const inboundOrderIds = inboundFinishing.map((f) => f.orderId);
    const completedWithInbound =
      inboundOrderIds.length > 0
        ? (
            await this.orderRepo.find({
              where: { status: 'completed', id: In(inboundOrderIds) },
              select: ['id'],
            })
          ).map((o) => o.id)
        : [];

    const qb = this.orderRepo.createQueryBuilder('o').where('(o.status = :pendingFinishing OR o.id IN (:...inboundIds))', {
      pendingFinishing: 'pending_finishing',
      inboundIds: completedWithInbound.length ? completedWithInbound : [0],
    });
    if (orderNo?.trim()) qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    if (skuCode?.trim()) qb.andWhere('o.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    qb.orderBy('o.order_date', 'DESC').addOrderBy('o.id', 'DESC');

    const orders = await qb.getMany();
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) return [];

    const [finishings, cuttings, sewings] = await Promise.all([
      this.finishingRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.cuttingRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.sewingRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
    ]);
    const finishingMap = new Map(finishings.map((f) => [f.orderId, f]));
    const cuttingMap = new Map(cuttings.map((c) => [c.orderId, c]));
    const sewingMap = new Map(sewings.map((s) => [s.orderId, s]));
    const slaCtx = await this.orderStatusConfigService.loadProductionSlaJudgeContext();

    const rows: FinishingListItem[] = [];
    for (const order of orders) {
      const finishing = finishingMap.get(order.id);
      const cutting = cuttingMap.get(order.id);
      const sewing = sewingMap.get(order.id);
      let fStatus = finishing ? (finishing.status ?? 'pending_ship').toLowerCase() : 'pending_receive';
      if (fStatus === 'pending_ship' || fStatus === 'shipped') fStatus = 'inbound';
      if (tab === 'pending_receive' && fStatus !== 'pending_receive') continue;
      if (tab === 'pending_assign' && fStatus !== 'pending_assign') continue;
      if (tab === 'inbound' && fStatus !== 'inbound') continue;
      if ((completedStart || completedEnd) && !this.isDateTimeInRange(finishing?.completedAt, completedStart, completedEnd)) {
        continue;
      }

      const arrivedAt =
        this.toDateTimeLocalString(finishing?.arrivedAt) ??
        (order.status === 'pending_finishing' ? this.toDateTimeLocalString(order.statusTime) : null);
      const completedAt = this.toDateTimeLocalString(finishing?.completedAt);
      let phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(finishing?.arrivedAt ?? null);
      if (!phaseStart && order.status === 'pending_finishing') {
        phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(order.statusTime);
      }
      const phaseEnd = finishing?.completedAt
        ? this.orderStatusConfigService.parseProductionPhaseInstant(finishing.completedAt)
        : null;
      const timeRating = this.orderStatusConfigService.judgeProductionPhaseDuration(
        'pending_finishing',
        phaseStart,
        phaseEnd,
        order.status ?? '',
        slaCtx,
      );
      rows.push({
        orderId: order.id,
        orderNo: order.orderNo ?? '',
        skuCode: order.skuCode ?? '',
        imageUrl: order.imageUrl ?? '',
        customerName: order.customerName ?? '',
        salesperson: order.salesperson ?? '',
        merchandiser: order.merchandiser ?? '',
        quantity: order.quantity ?? 0,
        customerDueDate: this.toDateOnlyLocalString(order.customerDueDate),
        arrivedAt,
        completedAt,
        finishingStatus: fStatus,
        cutTotal: this.sumActualCut(cutting?.actualCutRows ?? null),
        sewingQuantity: sewing?.sewingQuantity ?? null,
        factoryName: order.factoryName ?? null,
        tailReceivedQty: finishing?.tailReceivedQty ?? null,
        tailShippedQty: finishing?.tailShippedQty ?? null,
        tailInboundQty: finishing?.tailInboundQty ?? null,
        defectQuantity: finishing?.defectQuantity ?? null,
        remark: finishing?.remark ?? null,
        timeRating,
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

  async getRegisterFormData(orderId: number): Promise<{
    headers: string[];
    orderRow: (number | null)[];
    cutRow: (number | null)[];
    sewingRow: (number | null)[];
    tailReceivedRow: (number | null)[];
    tailInboundRow: (number | null)[] | null;
    defectRow: (number | null)[] | null;
  }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const [ext, cutting, sewing, finishing] = await Promise.all([
      this.orderExtRepo.findOne({ where: { orderId } }),
      this.cuttingRepo.findOne({ where: { orderId } }),
      this.sewingRepo.findOne({ where: { orderId } }),
      this.finishingRepo.findOne({ where: { orderId } }),
    ]);
    const headers =
      Array.isArray(ext?.colorSizeHeaders) && ext.colorSizeHeaders.length > 0 ? [...ext.colorSizeHeaders, '合计'] : ['合计'];
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

    const receivedTotal = Number(finishing?.tailReceivedQty) || 0;
    let tailReceivedRow: (number | null)[];
    const receivedRow = await this.fetchTailReceivedQtyRow(orderId);
    if (Array.isArray(receivedRow) && receivedRow.length === headers.length) {
      tailReceivedRow = receivedRow.map((n) => (typeof n === 'number' && Number.isFinite(n) ? n : null));
    } else {
      tailReceivedRow = headers.length === 1 ? [receivedTotal] : [...Array(headers.length - 1).fill(null), receivedTotal];
    }

    const [inboundStored, defectStored] = await Promise.all([
      this.fetchTailInboundQtyRow(orderId),
      this.fetchDefectQuantityRow(orderId),
    ]);
    const tailInboundRow = this.normalizeFinishingQtyRowToHeaders(inboundStored, headers);
    const defectRow = this.normalizeFinishingQtyRowToHeaders(defectStored, headers);

    return {
      headers,
      orderRow: orderRow ?? (headers.length === 1 ? [order.quantity ?? 0] : [...Array(headers.length).fill(null)]),
      cutRow:
        cutRow ??
        (headers.length === 1 ? [cutTotal != null ? cutTotal : null] : [...Array(headers.length).fill(null)]),
      sewingRow,
      tailReceivedRow,
      tailInboundRow,
      defectRow,
    };
  }
}
