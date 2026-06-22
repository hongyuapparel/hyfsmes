import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type ActualCutRow } from '../entities/order-cutting.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { OrderStatusConfigService } from '../order-status-config/order-status-config.service';
import { User } from '../entities/user.entity';
import { OrderOperationLog } from '../entities/order-operation-log.entity';
import { resolveOperatorDisplayName } from '../common/operator.util';
import { applyRowSort } from '../common/list-row-sort.util';
import {
  type ColorSizeQuantityRow,
  assertColorRowsShape,
  normalizeColorRows,
  sumColorRows,
  sumColorRowsBySize,
} from '../common/color-size-row.util';

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
  completedStart?: string;
  completedEnd?: string;
  page?: number;
  pageSize?: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
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
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(OrderOperationLog)
    private readonly orderLogRepo: Repository<OrderOperationLog>,
    private readonly orderWorkflowService: OrderWorkflowService,
    private readonly orderStatusConfigService: OrderStatusConfigService,
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

  private isDateTimeInRange(
    v: Date | string | null | undefined,
    start?: string,
    end?: string,
  ): boolean {
    const text = this.toDateTimeString(v);
    if (!text) return false;
    if (start && text < `${start} 00:00:00`) return false;
    if (end && text > `${end} 23:59:59`) return false;
    return true;
  }

  /** 登记车缝完成弹窗用：订单数量/裁床数量按颜色×尺码（只读）+ 聚合行；车缝按颜色×尺码填写 */
  async getCompleteFormData(orderId: number): Promise<{
    headers: string[];
    orderRow: (number | null)[];
    cutRow: (number | null)[];
    /** 不含合计列的纯尺码 headers，用于二维矩阵 */
    sizeHeaders: string[];
    /** 订单计划按颜色×尺码（参考与上限基础） */
    orderColorRows: Array<{ colorName: string; quantities: number[]; imageUrl?: string }>;
    /** 裁床实际按颜色×尺码（车缝/入库的每格上限） */
    cutColorRows: Array<{ colorName: string; quantities: number[] }>;
  }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const [ext, cutting] = await Promise.all([
      this.orderExtRepo.findOne({ where: { orderId } }),
      this.cuttingRepo.findOne({ where: { orderId } }),
    ]);
    const sizeHeaders = Array.isArray(ext?.colorSizeHeaders) ? ext.colorSizeHeaders.slice() : [];
    const headers = sizeHeaders.length > 0 ? [...sizeHeaders, '合计'] : ['合计'];
    const sizeLen = sizeHeaders.length;
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
    const planRows = (ext as { colorSizeRows?: Array<{ colorName?: string; quantities?: number[]; imageUrl?: string }> })?.colorSizeRows ?? [];
    const planRowsArr = Array.isArray(planRows) ? planRows : [];
    const actualCutRows = Array.isArray(cutting?.actualCutRows) ? cutting!.actualCutRows : [];

    const orderRow = buildPerSize(planRowsArr);
    const cutRow = buildPerSize(actualCutRows);
    const cutTotal = this.sumActualCut(actualCutRows);

    // 按订单计划颜色顺序对齐 cut（裁床可能少颜色或顺序不同，缺失补 0）
    const norm = (s: unknown) => String(s ?? '').trim();
    const cutByColorName = new Map<string, number[]>();
    for (const r of actualCutRows) {
      const name = norm(r?.colorName);
      const q = Array.isArray(r?.quantities) ? r.quantities.slice(0, sizeLen) : [];
      const filled = Array.from({ length: sizeLen }, (_, i) => Math.max(0, Math.trunc(Number(q[i]) || 0)));
      if (cutByColorName.has(name)) {
        const prev = cutByColorName.get(name)!;
        for (let i = 0; i < sizeLen; i++) prev[i] += filled[i];
      } else {
        cutByColorName.set(name, filled);
      }
    }
    const orderColorRows = planRowsArr.map((r) => {
      const name = norm(r?.colorName);
      const q = Array.isArray(r?.quantities) ? r.quantities.slice(0, sizeLen) : [];
      const quantities = Array.from({ length: sizeLen }, (_, i) => Math.max(0, Math.trunc(Number(q[i]) || 0)));
      return { colorName: name, quantities, imageUrl: String(r?.imageUrl ?? '').trim() };
    });
    const cutColorRows = planRowsArr.map((r) => {
      const name = norm(r?.colorName);
      const quantities = cutByColorName.get(name) ?? Array(sizeLen).fill(0);
      return { colorName: name, quantities };
    });

    return {
      headers,
      sizeHeaders,
      orderRow:
        orderRow ??
        (headers.length === 1 ? [order.quantity ?? 0] : [...Array(headers.length).fill(null)]),
      cutRow:
        cutRow ??
        (headers.length === 1 ? [cutTotal != null ? cutTotal : null] : [...Array(headers.length).fill(null)]),
      orderColorRows,
      cutColorRows,
    };
  }

  private async buildSewingRows(baseQuery: SewingListQuery): Promise<SewingListItem[]> {
    const { tab = 'all', orderNo, skuCode, completedStart, completedEnd } = baseQuery;

    const completedSewing = await this.sewingRepo.find({
      where: { status: 'completed' },
      select: ['orderId'],
    });
    const completedOrderIds = completedSewing.map((s) => s.orderId);
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.deleted_at IS NULL')
      .andWhere(
        '(o.status = :pendingSewing OR o.id IN (:...completedIds))',
        { pendingSewing: 'pending_sewing', completedIds: completedOrderIds.length ? completedOrderIds : [0] },
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
    const slaCtx = await this.orderStatusConfigService.loadProductionSlaJudgeContext();

    const rows: SewingListItem[] = [];
    for (const order of orders) {
      const sewing = sewingMap.get(order.id);
      const cutting = cuttingMap.get(order.id);
      const sewingStatus = (sewing?.status ?? 'pending').toLowerCase();
      if (tab === 'pending' && sewingStatus === 'completed') continue;
      if (tab === 'completed' && sewingStatus !== 'completed') continue;
      if ((completedStart || completedEnd) && !this.isDateTimeInRange(sewing?.completedAt, completedStart, completedEnd)) {
        continue;
      }

      const arrivedAt =
        this.toDateTimeString(sewing?.arrivedAt) ??
        (order.status === 'pending_sewing' ? this.toDateTimeString(order.statusTime) : null);
      const completedAt = this.toDateTimeString(sewing?.completedAt);
      const distributedAt = this.toDateTimeString(sewing?.distributedAt);
      const factoryDueDate = this.toDateOnlyString(sewing?.factoryDueDate);
      const sewingFee = sewing?.sewingFee != null ? String(sewing.sewingFee) : '0';

      let phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(sewing?.arrivedAt ?? null);
      if (!phaseStart && order.status === 'pending_sewing') {
        phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(order.statusTime);
      }
      const phaseEnd =
        sewingStatus === 'completed' && sewing?.completedAt
          ? this.orderStatusConfigService.parseProductionPhaseInstant(sewing.completedAt)
          : null;
      const timeRating = this.orderStatusConfigService.judgeProductionPhaseDuration(
        'pending_sewing',
        phaseStart,
        phaseEnd,
        order.status ?? '',
        slaCtx,
      );

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
        timeRating,
      });
    }

    return rows;
  }

  async getSewingList(query: SewingListQuery): Promise<{
    list: SewingListItem[];
    total: number;
    totalQuantity: number;
    page: number;
    pageSize: number;
  }> {
    const { page = 1, pageSize = 20 } = query;
    const allRows = await this.buildSewingRows(query);
    const rows = applyRowSort(allRows, query.sortField, query.sortOrder, ['arrivedAt', 'distributedAt', 'completedAt']);
    const total = rows.length;
    const totalQuantity = rows.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);
    return { list, total, totalQuantity, page, pageSize };
  }

  async getSewingTabCounts(query: SewingListQuery): Promise<Record<string, number>> {
    const rows = await this.buildSewingRows({ ...query, tab: 'all' });
    const counts: Record<string, number> = { all: rows.length, pending: 0, completed: 0 };
    for (const row of rows) {
      if (row.sewingStatus in counts) counts[row.sewingStatus]++;
    }
    return counts;
  }

  async getSewingExportRows(query: SewingListQuery): Promise<SewingListItem[]> {
    return this.buildSewingRows(query);
  }

  private buildSewingLogDetail(
    sewingQuantity: number,
    sewingQuantities: number[] | null | undefined,
    ext: OrderExt | null,
  ): string {
    const qtys = Array.isArray(sewingQuantities) && sewingQuantities.length ? sewingQuantities : null;
    if (!qtys) {
      return `车缝登记：合计 ${sewingQuantity} 件`;
    }
    const headers = Array.isArray(ext?.colorSizeHeaders) ? ext.colorSizeHeaders : [];
    const parts: string[] = [];
    for (let i = 0; i < Math.min(headers.length, qtys.length); i++) {
      const q = Number(qtys[i]) || 0;
      if (q > 0) parts.push(`${headers[i]} ${q} 件`);
    }
    const total = qtys.reduce((a, b) => a + (Number(b) || 0), 0);
    if (!parts.length) return `车缝登记：合计 ${total} 件`;
    return `车缝登记：${parts.join(' / ')}`;
  }

  /** 分单/补录分单：记录分单时间、加工供应商交期、加工供应商名称（写入订单）、车缝加工费 */
  async assignSewing(
    orderId: number,
    distributedAt: Date,
    factoryDueDate: Date | null,
    factoryName: string,
    sewingFee: string,
    actor?: { userId?: number; username?: string },
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    // 临时放开：已车缝完成（待尾部）订单允许补录分单信息，不改动其完成状态。
    if (order.status !== 'pending_sewing' && order.status !== 'pending_finishing') {
      throw new NotFoundException('仅待车缝或待尾部订单可分单');
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

    try {
      const operator = await resolveOperatorDisplayName(this.userRepo, actor ?? {});
      const nameForLog = (order.factoryName ?? (factoryName ?? '').trim()) || '-';
      await this.orderLogRepo.save(
        this.orderLogRepo.create({
          orderId,
          orderNo: order.orderNo,
          operatorUsername: operator,
          action: 'production_sewing_register',
          detail: `车缝分配：${nameForLog}`,
          targetType: 'order',
          targetRef: null,
        }),
      );
    } catch (err) {
      console.warn('[sewing assign] write operation log failed:', err);
    }
  }

  /** 车缝登记完成：写入车缝数量（按颜色×尺码真值）、次品数量、次品说明，订单状态改为待尾部 */
  async completeSewing(
    orderId: number,
    sewingQuantity: number,
    defectQuantity: number,
    defectReason: string,
    sewingQuantities?: number[] | null,
    sewingQuantitiesByColor?: ColorSizeQuantityRow[] | null,
    actor?: { userId?: number; username?: string },
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending_sewing') {
      throw new NotFoundException('仅待车缝订单可完成登记');
    }

    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const now = new Date();
    const arrivedAt = order.statusTime ?? now;
    const headers = Array.isArray(ext?.colorSizeHeaders) ? ext.colorSizeHeaders : [];
    const sizeLen = headers.length;
    const planColors = (Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : []).map((r) => String(r?.colorName ?? '').trim());

    // 真值优先级：byColor（前端二维矩阵）→ 一维兜底（仅单色订单或老客户端）
    let byColor: ColorSizeQuantityRow[] | null = null;
    if (Array.isArray(sewingQuantitiesByColor) && sewingQuantitiesByColor.length > 0) {
      byColor = normalizeColorRows(sewingQuantitiesByColor, sizeLen);
      if (planColors.length > 0 && sizeLen > 0) {
        assertColorRowsShape(byColor, planColors, sizeLen);
      }
    } else if (Array.isArray(sewingQuantities) && sewingQuantities.length > 0) {
      if (planColors.length === 1 && sizeLen > 0) {
        // 单色订单：把一维兜底为单色二维
        byColor = normalizeColorRows([{ colorName: planColors[0], quantities: sewingQuantities }], sizeLen);
      } else if (planColors.length > 1) {
        throw new BadRequestException('多色订单必须按颜色×尺码填写车缝数量');
      }
    }

    const totalQty = byColor
      ? sumColorRows(byColor)
      : Array.isArray(sewingQuantities) && sewingQuantities.length > 0
        ? sewingQuantities.reduce((a, b) => a + (Number(b) || 0), 0)
        : sewingQuantity;
    const sewingQuantityRow = byColor
      ? sumColorRowsBySize(byColor, sizeLen)
      : Array.isArray(sewingQuantities) && sewingQuantities.length > 0
        ? sewingQuantities
        : null;

    const next = await this.orderWorkflowService.resolveNextStatus({
      order,
      triggerCode: 'sewing_completed',
      actorUserId: actor?.userId ?? 0,
    });
    if (!next) {
      throw new BadRequestException('未匹配到“车缝完成”流转规则，请先在订单设置中检查流程链路配置');
    }

    let sewing = await this.sewingRepo.findOne({ where: { orderId } });
    if (!sewing) {
      sewing = this.sewingRepo.create({
        orderId,
        status: 'completed',
        arrivedAt,
        completedAt: now,
        sewingQuantity: totalQty,
        sewingQuantityRow,
        sewingQuantitiesByColor: byColor,
        defectQuantity: defectQuantity ?? 0,
        defectReason: (defectReason ?? '').trim(),
      });
    } else {
      sewing.status = 'completed';
      sewing.arrivedAt = sewing.arrivedAt ?? arrivedAt;
      sewing.completedAt = now;
      sewing.sewingQuantity = totalQty;
      sewing.sewingQuantityRow = sewingQuantityRow;
      sewing.sewingQuantitiesByColor = byColor;
      sewing.defectQuantity = defectQuantity ?? 0;
      sewing.defectReason = (defectReason ?? '').trim();
    }
    await this.sewingRepo.save(sewing);

    // sewing_quantities_by_color 是 select:false JSON 列，typeorm save 不会写入 DB，
    // 必须用 raw UPDATE 显式落库（否则用户填的按颜色×尺码细数会丢失）。
    await this.sewingRepo.manager.query(
      'UPDATE order_sewing SET sewing_quantities_by_color = ? WHERE order_id = ?',
      [byColor ? JSON.stringify(byColor) : null, orderId],
    );

    if (next && next !== order.status) {
      order.status = next;
      order.statusTime = now;
      await this.orderRepo.save(order);
    }

    try {
      const operator = await resolveOperatorDisplayName(this.userRepo, actor ?? {});
      const detail = this.buildSewingLogDetail(sewingQuantity, sewingQuantities ?? null, ext);
      await this.orderLogRepo.save(
        this.orderLogRepo.create({
          orderId,
          orderNo: order.orderNo,
          operatorUsername: operator,
          action: 'production_sewing_register',
          detail,
          targetType: 'order',
          targetRef: null,
        }),
      );
    } catch (err) {
      console.warn('[sewing complete] write operation log failed:', err);
    }
  }
}
