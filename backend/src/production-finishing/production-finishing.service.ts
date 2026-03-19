import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type ActualCutRow } from '../entities/order-cutting.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderFinishing } from '../entities/order-finishing.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { InboundPending } from '../entities/inbound-pending.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';

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
  /** 登记包装完成时的备注 */
  remark: string | null;
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

  // 尾部收货尺码明细字段是否已在 DB 中落地（缓存一次，避免每次请求都查元数据）
  private hasTailReceivedQtyRowColumn: boolean | null = null;
  private async hasTailReceivedQtyRow(): Promise<boolean> {
    if (this.hasTailReceivedQtyRowColumn != null) return this.hasTailReceivedQtyRowColumn;
    try {
      const rows = await this.finishingRepo.query(
        "SHOW COLUMNS FROM `order_finishing` LIKE 'tail_received_qty_row'",
      );
      this.hasTailReceivedQtyRowColumn = Array.isArray(rows) && rows.length > 0;
      return this.hasTailReceivedQtyRowColumn;
    } catch {
      this.hasTailReceivedQtyRowColumn = false;
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
      const raw = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any).tailReceivedQtyRow : null;
      // mysql2 对 JSON 列可能返回 string/object，统一尝试 parse
      if (raw == null) return null;
      if (Array.isArray(raw)) return raw as number[];
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as number[]) : null;
      }
      if (typeof raw === 'object') {
        // 有些驱动会直接返回对象/数组
        return Array.isArray(raw) ? (raw as number[]) : null;
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
      /** pending_receive=待尾部(未登记收货), pending_assign=尾部(已登记收货待登记包装), pending_ship/shipped/inbound 同前 */
      let fStatus = finishing ? (finishing.status ?? 'pending_ship').toLowerCase() : 'pending_receive';
      // 新流程：尾部不再区分等待发货/已发货，统一视为“尾部完成（已交接仓库）”
      if (fStatus === 'pending_ship' || fStatus === 'shipped') {
        fStatus = 'inbound';
      }
      if (tab === 'pending_receive' && fStatus !== 'pending_receive') continue;
      if (tab === 'pending_assign' && fStatus !== 'pending_assign') continue;
      if (tab === 'inbound' && fStatus !== 'inbound') continue;

      const arrivedAt =
        this.toDateTimeLocalString(finishing?.arrivedAt) ??
        (order.status === 'pending_finishing' ? this.toDateTimeLocalString(order.statusTime) : null);
      const completedAt = this.toDateTimeLocalString(finishing?.completedAt);

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
        tailReceivedQty: finishing?.tailReceivedQty ?? null,
        tailShippedQty: finishing?.tailShippedQty ?? null,
        tailInboundQty: finishing?.tailInboundQty ?? null,
        defectQuantity: finishing?.defectQuantity ?? null,
        remark: finishing?.remark ?? null,
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
    tailReceivedRow: (number | null)[];
  }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const [ext, cutting, sewing, finishing] = await Promise.all([
      this.orderExtRepo.findOne({ where: { orderId } }),
      this.cuttingRepo.findOne({ where: { orderId } }),
      this.sewingRepo.findOne({ where: { orderId } }),
      this.finishingRepo.findOne({ where: { orderId } }),
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

    const receivedTotal = Number(finishing?.tailReceivedQty) || 0;
    let tailReceivedRow: (number | null)[];
    const receivedRow = await this.fetchTailReceivedQtyRow(orderId);
    if (Array.isArray(receivedRow) && receivedRow.length === headers.length) {
      tailReceivedRow = receivedRow.map((n) => (typeof n === 'number' && Number.isFinite(n) ? n : null));
    } else {
      tailReceivedRow = headers.length === 1 ? [receivedTotal] : [...Array(headers.length - 1).fill(null), receivedTotal];
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
      tailReceivedRow,
    };
  }

  /** 登记收货：待尾部订单录入尾部收货数量，进入「尾部」tab（待登记包装） */
  async registerReceive(orderId: number, tailReceivedQty: number, tailReceivedQuantities?: number[] | null): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending_finishing') {
      throw new NotFoundException('仅待尾部订单可登记收货');
    }
    const existing = await this.finishingRepo.findOne({ where: { orderId } });
    if (existing) {
      throw new NotFoundException('该订单已登记收货，请到「尾部」tab 登记包装完成');
    }

    const now = new Date();
    const arrivedAt = order.statusTime ?? now;
    const normalizedTotal = Number(tailReceivedQty) || 0;
    if (normalizedTotal <= 0) {
      throw new NotFoundException('请填写尾部收货数');
    }

    // 生成并保存按尺码明细（若传入了明细，则按表头长度补齐并计算合计；否则仅保存合计）
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const headers =
      Array.isArray(ext?.colorSizeHeaders) && ext.colorSizeHeaders.length > 0
        ? [...ext.colorSizeHeaders, '合计']
        : ['合计'];
    const sizeCount = headers.length > 1 ? headers.length - 1 : 1;
    let tailReceivedQtyRow: number[] | null = null;
    const canSaveRow = await this.hasTailReceivedQtyRow();
    if (canSaveRow) {
      if (Array.isArray(tailReceivedQuantities) && tailReceivedQuantities.length) {
        const perSize = tailReceivedQuantities.slice(0, sizeCount).map((v) => Math.max(0, Number(v) || 0));
        while (perSize.length < sizeCount) perSize.push(0);
        const total = perSize.reduce((a, b) => a + b, 0);
        tailReceivedQtyRow = headers.length === 1 ? [normalizedTotal] : [...perSize, total];
        if (total !== normalizedTotal) {
          throw new NotFoundException(`尾部收货数合计(${total})须等于尾部收货数(${normalizedTotal})`);
        }
      } else {
        tailReceivedQtyRow = headers.length === 1 ? [normalizedTotal] : [...Array(sizeCount).fill(0), normalizedTotal];
      }
    }

    const payload: Partial<OrderFinishing> = {
      orderId,
      status: 'pending_assign',
      arrivedAt,
      completedAt: null,
      tailReceivedQty: normalizedTotal,
      tailShippedQty: 0,
      tailInboundQty: 0,
      defectQuantity: 0,
      remark: null,
    };
    if (canSaveRow) {
      (payload as any).tailReceivedQtyRow = tailReceivedQtyRow;
    }
    const finishing = this.finishingRepo.create(payload);
    await this.finishingRepo.save(finishing);
  }

  /** 登记包装完成：尾部 tab 内填写发货数、入库数、次品数、备注；三者之和须等于尾部收货数 */
  async registerPackagingComplete(
    orderId: number,
    tailShippedQty: number,
    tailInboundQty: number,
    defectQuantity: number,
    remark?: string | null,
    actorUserId?: number,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) {
      throw new NotFoundException('请先登记收货');
    }
    if (finishing.status !== 'pending_assign') {
      throw new NotFoundException('仅「尾部」中待登记包装的订单可操作');
    }

    const received = Number(finishing.tailReceivedQty) || 0;
    if (received <= 0) {
      throw new NotFoundException('尾部收货数无效，请先登记收货');
    }

    /**
     * 新逻辑（工厂只负责生产完成，后续由仓库处理）：
     * - 尾部登记包装完成时，不再处理发货；入库数+次品数=尾部收货数
     * - 自动生成待入库记录（quantity=入库数），订单即视为完成
     * - 发货/分批入库等后续流程由仓库模块承接
     */
    const ship = 0;
    void tailShippedQty;

    const inbound = Number(tailInboundQty) || 0;
    const defect = Number(defectQuantity) || 0;
    if (inbound < 0 || defect < 0) {
      throw new NotFoundException('入库数/次品数不可为负数');
    }
    if (inbound + defect !== received) {
      throw new NotFoundException(`入库数(${inbound})+次品数(${defect}) 须等于尾部收货数(${received})`);
    }

    finishing.tailShippedQty = ship;
    finishing.tailInboundQty = inbound;
    finishing.defectQuantity = defect;
    finishing.remark = remark?.trim() || null;
    finishing.completedAt = new Date();
    /** 生成待入库并直接完成订单 */
    finishing.status = 'inbound';
    await this.finishingRepo.save(finishing);

    const next = await this.orderWorkflowService.resolveNextStatus({
      order,
      triggerCode: 'tailing_inbound_completed',
      actorUserId: actorUserId ?? 0,
    });
    if (next && next !== order.status) {
      order.status = next;
      order.statusTime = new Date();
      await this.orderRepo.save(order);
    }

    const pendingRows: InboundPending[] = [];
    if (inbound > 0) {
      pendingRows.push(
        this.inboundPendingRepo.create({
          orderId: order.id,
          skuCode: order.skuCode ?? '',
          quantity: inbound,
          status: 'pending',
        }),
      );
    }
    if (defect > 0) {
      pendingRows.push(
        this.inboundPendingRepo.create({
          orderId: order.id,
          skuCode: order.skuCode ?? '',
          quantity: defect,
          status: 'pending',
        }),
      );
    }
    if (pendingRows.length) {
      await this.inboundPendingRepo.save(pendingRows);
    }
  }

  /** 财务审批通过：等待发货且已分配完毕（出货+入库+次品=尾部收货数）时，订单完成并写入待入库 */
  async financeApproveFinishing(orderId: number, actorUserId?: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) {
      throw new NotFoundException('无尾部记录');
    }
    if (finishing.status !== 'pending_ship') {
      throw new NotFoundException('仅等待发货状态可进行财务审批');
    }
    const received = finishing.tailReceivedQty ?? 0;
    const shipped = finishing.tailShippedQty ?? 0;
    const inbound = finishing.tailInboundQty ?? 0;
    const defect = finishing.defectQuantity ?? 0;
    if (shipped + inbound + defect !== received) {
      throw new NotFoundException(
        `出货数(${shipped})+入库数(${inbound})+次品数(${defect}) 须等于尾部收货数(${received})后才能审批完成`,
      );
    }

    finishing.status = 'inbound';
    await this.finishingRepo.save(finishing);
    const next = await this.orderWorkflowService.resolveNextStatus({
      order,
      triggerCode: 'tailing_inbound_completed',
      actorUserId: actorUserId ?? 0,
    });
    if (next && next !== order.status) {
      order.status = next;
      order.statusTime = new Date();
      await this.orderRepo.save(order);
    }
    const pendingRows: InboundPending[] = [];
    if (inbound > 0) {
      pendingRows.push(
        this.inboundPendingRepo.create({
          orderId: order.id,
          skuCode: order.skuCode ?? '',
          quantity: inbound,
          status: 'pending',
        }),
      );
    }
    if (defect > 0) {
      pendingRows.push(
        this.inboundPendingRepo.create({
          orderId: order.id,
          skuCode: order.skuCode ?? '',
          quantity: defect,
          status: 'pending',
        }),
      );
    }
    if (pendingRows.length) {
      await this.inboundPendingRepo.save(pendingRows);
    }
  }

  /** 登记包装完成（旧）：尾部收货数、次品数，一步到位进入等待发货；保留兼容 */
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
  async inbound(orderId: number, quantity: number, actorUserId?: number): Promise<void> {
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

      const next = await this.orderWorkflowService.resolveNextStatus({
        order,
        triggerCode: 'tailing_inbound_completed',
        actorUserId: actorUserId ?? 0,
      });
      if (next && next !== order.status) {
        order.status = next;
        order.statusTime = new Date();
        await this.orderRepo.save(order);
      }

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
