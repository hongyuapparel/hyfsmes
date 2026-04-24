import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type ActualCutRow, type CuttingMaterialUsageRow } from '../entities/order-cutting.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';
import { SystemOption } from '../entities/system-option.entity';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { SystemOptionsService } from '../system-options/system-options.service';
import { OrderStatusConfigService } from '../order-status-config/order-status-config.service';
import type {
  CuttingCompletedDetailResponse,
  CuttingListItem,
  CuttingListQuery,
  CuttingRegisterFormMaterialRow,
  CuttingRegisterFormResponse,
} from './production-cutting.types';

const ALLOWED_MATERIAL_CATEGORY_VALUES = new Set(['主布', '里布', '配布', '衬布']);

@Injectable()
export class ProductionCuttingQueryService {
  private cuttingReconcileRunning = false;
  private cuttingReconcileLastRunAt = 0;
  private readonly cuttingReconcileIntervalMs = 5 * 60 * 1000;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderCutting)
    private readonly cuttingRepo: Repository<OrderCutting>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(OrderStatus)
    private readonly orderStatusRepo: Repository<OrderStatus>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoryRepo: Repository<OrderStatusHistory>,
    private readonly orderWorkflowService: OrderWorkflowService,
    private readonly systemOptionsService: SystemOptionsService,
    private readonly orderStatusConfigService: OrderStatusConfigService,
  ) {}

  private async appendStatusHistory(orderId: number, statusCode: string): Promise<void> {
    const code = (statusCode ?? '').trim();
    if (!code) return;
    const status = await this.orderStatusRepo.findOne({ where: { code } });
    if (!status) return;
    await this.orderStatusHistoryRepo.save(this.orderStatusHistoryRepo.create({ orderId, statusId: status.id }));
  }

  private async reconcileCuttingCompletedOrders(actorUserId?: number): Promise<void> {
    if (typeof actorUserId !== 'number') return;
    const cuttings = await this.cuttingRepo.find({ where: { status: 'completed' } });
    if (!cuttings.length) return;
    const orderIds = cuttings.map((c) => c.orderId);
    const orders = await this.orderRepo.find({ where: { id: In(orderIds), status: 'pending_cutting' } });
    if (!orders.length) return;
    const cuttingMap = new Map(cuttings.map((c) => [c.orderId, c]));
    for (const order of orders) {
      const next = await this.orderWorkflowService.resolveNextStatus({
        order,
        triggerCode: 'cutting_completed',
        actorUserId,
      });
      if (!next || next === order.status) continue;
      const cutting = cuttingMap.get(order.id);
      order.status = next;
      order.statusTime = cutting?.completedAt ?? new Date();
      await this.orderRepo.save(order);
      await this.appendStatusHistory(order.id, next);
    }
  }

  private scheduleCuttingReconcile(actorUserId?: number): void {
    if (typeof actorUserId !== 'number') return;
    if (this.cuttingReconcileRunning) return;
    const now = Date.now();
    if (now - this.cuttingReconcileLastRunAt < this.cuttingReconcileIntervalMs) return;
    this.cuttingReconcileRunning = true;
    this.cuttingReconcileLastRunAt = now;
    void this.reconcileCuttingCompletedOrders(actorUserId)
      .catch(() => {})
      .finally(() => {
        this.cuttingReconcileRunning = false;
      });
  }

  private async hasCuttingDepartmentAndCutter(): Promise<boolean> {
    try {
      const depRows = await this.cuttingRepo.query("SHOW COLUMNS FROM `order_cutting` LIKE 'cutting_department'");
      const cutterRows = await this.cuttingRepo.query("SHOW COLUMNS FROM `order_cutting` LIKE 'cutter_name'");
      return Array.isArray(depRows) && depRows.length > 0 && Array.isArray(cutterRows) && cutterRows.length > 0;
    } catch {
      return false;
    }
  }

  private async hasActualFabricMeters(): Promise<boolean> {
    try {
      const rows = await this.cuttingRepo.query("SHOW COLUMNS FROM `order_cutting` LIKE 'actual_fabric_meters'");
      return Array.isArray(rows) && rows.length > 0;
    } catch {
      return false;
    }
  }

  private async hasCuttingRegisterV2Columns(): Promise<boolean> {
    try {
      const rows = await this.cuttingRepo.query("SHOW COLUMNS FROM `order_cutting` LIKE 'cutting_unit_price'");
      return Array.isArray(rows) && rows.length > 0;
    } catch {
      return false;
    }
  }

  private parseMaterialUsageStored(raw: unknown): CuttingMaterialUsageRow[] {
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [];
      }
    }
    if (!Array.isArray(parsed)) return [];
    const out: CuttingMaterialUsageRow[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const x = item as Record<string, unknown>;
      out.push({
        rowKey: String(x.rowKey ?? ''),
        materialTypeId: (() => {
          if (x.materialTypeId == null || x.materialTypeId === '') return null;
          const n = Number(x.materialTypeId);
          return Number.isFinite(n) ? n : null;
        })(),
        categoryLabel: String(x.categoryLabel ?? ''),
        materialName: String(x.materialName ?? ''),
        colorSpec: String(x.colorSpec ?? ''),
        expectedUsagePerPiece: (() => {
          if (x.expectedUsagePerPiece == null || String(x.expectedUsagePerPiece).trim() === '') return null;
          const n = Number(x.expectedUsagePerPiece);
          return Number.isFinite(n) ? n : null;
        })(),
        issuedMeters: Number(x.issuedMeters) || 0,
        returnedMeters: Number(x.returnedMeters) || 0,
        abnormalLossMeters: Number(x.abnormalLossMeters) || 0,
        abnormalReason:
          x.abnormalReason != null && String(x.abnormalReason).trim() !== '' ? String(x.abnormalReason).trim() : null,
        remark: x.remark != null ? String(x.remark) : '',
      });
    }
    return out;
  }

  private async fetchActualFabricMetersMap(orderIds: number[]): Promise<Map<number, string>> {
    const ids = Array.isArray(orderIds) ? orderIds.filter((v) => typeof v === 'number' && v > 0) : [];
    const map = new Map<number, string>();
    if (!ids.length) return map;
    if (!(await this.hasActualFabricMeters())) return map;
    try {
      const rows = await this.cuttingRepo.query(
        `SELECT order_id AS orderId, actual_fabric_meters AS actualFabricMeters
         FROM \`order_cutting\`
         WHERE order_id IN (?)`,
        [ids],
      );
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const orderId = Number((r as { orderId: unknown }).orderId);
          const v = (r as { actualFabricMeters: unknown }).actualFabricMeters;
          if (!Number.isNaN(orderId) && v != null && String(v).trim() !== '') map.set(orderId, String(v));
        }
      }
    } catch {}
    return map;
  }

  private async fetchCuttingV2Map(orderIds: number[]): Promise<Map<number, { unit: string | null; total: string | null }>> {
    const map = new Map<number, { unit: string | null; total: string | null }>();
    const ids = Array.isArray(orderIds) ? orderIds.filter((v) => typeof v === 'number' && v > 0) : [];
    if (!ids.length) return map;
    if (!(await this.hasCuttingRegisterV2Columns())) return map;
    try {
      const rows = await this.cuttingRepo.query(
        `SELECT order_id AS orderId, cutting_unit_price AS cuttingUnitPrice, cutting_total_cost AS cuttingTotalCost
         FROM \`order_cutting\`
         WHERE order_id IN (?)`,
        [ids],
      );
      if (Array.isArray(rows)) {
        for (const r of rows) {
          const orderId = Number((r as { orderId: unknown }).orderId);
          if (Number.isNaN(orderId)) continue;
          const u = (r as { cuttingUnitPrice: unknown }).cuttingUnitPrice;
          const t = (r as { cuttingTotalCost: unknown }).cuttingTotalCost;
          map.set(orderId, {
            unit: u != null && String(u).trim() !== '' ? String(u) : null,
            total: t != null && String(t).trim() !== '' ? String(t) : null,
          });
        }
      }
    } catch {}
    return map;
  }

  private async fetchSingleOrderCuttingExtras(orderId: number): Promise<{
    unit: string | null;
    total: string | null;
    materialUsage: CuttingMaterialUsageRow[];
    department: string | null;
    cutter: string | null;
    fabric: string | null;
  }> {
    const empty = {
      unit: null as string | null,
      total: null as string | null,
      materialUsage: [] as CuttingMaterialUsageRow[],
      department: null as string | null,
      cutter: null as string | null,
      fabric: null as string | null,
    };
    const [hasV2, hasDept, hasFabric] = await Promise.all([
      this.hasCuttingRegisterV2Columns(),
      this.hasCuttingDepartmentAndCutter(),
      this.hasActualFabricMeters(),
    ]);
    const cols: string[] = [];
    if (hasV2) {
      cols.push('cutting_unit_price AS cuttingUnitPrice');
      cols.push('cutting_total_cost AS cuttingTotalCost');
      cols.push('material_usage AS materialUsage');
    }
    if (hasDept) {
      cols.push('cutting_department AS cuttingDepartment');
      cols.push('cutter_name AS cutterName');
    }
    if (hasFabric) cols.push('actual_fabric_meters AS actualFabricMeters');
    if (!cols.length) return empty;
    try {
      const rows = await this.cuttingRepo.query(
        `SELECT ${cols.join(', ')} FROM \`order_cutting\` WHERE order_id = ? LIMIT 1`,
        [orderId],
      );
      const r = Array.isArray(rows) && rows.length > 0 ? (rows[0] as Record<string, unknown>) : null;
      if (!r) return empty;
      let materialUsage: CuttingMaterialUsageRow[] = [];
      if (hasV2 && r.materialUsage != null) materialUsage = this.parseMaterialUsageStored(r.materialUsage);
      return {
        unit: hasV2 && r.cuttingUnitPrice != null && String(r.cuttingUnitPrice).trim() !== '' ? String(r.cuttingUnitPrice) : null,
        total: hasV2 && r.cuttingTotalCost != null && String(r.cuttingTotalCost).trim() !== '' ? String(r.cuttingTotalCost) : null,
        materialUsage,
        department:
          hasDept && r.cuttingDepartment != null && String(r.cuttingDepartment).trim() !== ''
            ? String(r.cuttingDepartment).trim()
            : null,
        cutter:
          hasDept && r.cutterName != null && String(r.cutterName).trim() !== ''
            ? String(r.cutterName).trim()
            : null,
        fabric:
          hasFabric && r.actualFabricMeters != null && String(r.actualFabricMeters).trim() !== ''
            ? String(r.actualFabricMeters)
            : null,
      };
    } catch {
      return empty;
    }
  }

  private toDateTimeLocalString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (typeof v === 'string') {
      const s = v.slice(0, 19).replace('T', ' ');
      return s || null;
    }
    if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    const hh = String(v.getHours()).padStart(2, '0');
    const mm = String(v.getMinutes()).padStart(2, '0');
    const ss = String(v.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }

  private toDateOnlyLocalString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (typeof v === 'string') {
      const s = v.slice(0, 10);
      return s || null;
    }
    if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private sumActualCut(rows: ActualCutRow[] | null): number | null {
    if (!rows || rows.length === 0) return null;
    let sum = 0;
    for (const row of rows) {
      if (!Array.isArray(row.quantities)) continue;
      for (const q of row.quantities) {
        if (typeof q === 'number' && Number.isFinite(q)) sum += q;
      }
    }
    return sum;
  }

  private normalizeStr(s: unknown): string {
    return String(s ?? '').trim();
  }

  private categoryLabelForTypeId(options: SystemOption[], materialTypeId: number | null | undefined): string | null {
    if (materialTypeId == null || !Number.isFinite(Number(materialTypeId))) return null;
    const id = Number(materialTypeId);
    const byId = new Map(options.map((o) => [o.id, o]));
    const node = byId.get(id);
    if (!node) return null;
    if (ALLOWED_MATERIAL_CATEGORY_VALUES.has(node.value)) return node.value;
    return null;
  }

  private buildMaterialBaseKey(m: OrderMaterialRow): string {
    const tid = m.materialTypeId ?? 0;
    return `${tid}:${this.normalizeStr(m.materialName)}:${this.normalizeStr(m.color)}`;
  }

  private buildColorSpec(m: OrderMaterialRow): string {
    const parts = [this.normalizeStr(m.color), this.normalizeStr(m.remark)].filter(Boolean);
    return parts.length ? parts.join(' · ') : '-';
  }

  private buildMaterialTemplateRows(materials: OrderMaterialRow[] | null | undefined, typeOptions: SystemOption[]): CuttingMaterialUsageRow[] {
    const list = Array.isArray(materials) ? materials : [];
    const filtered = list.filter((m) => this.categoryLabelForTypeId(typeOptions, m.materialTypeId) != null);
    const counts = new Map<string, number>();
    const rows: CuttingMaterialUsageRow[] = [];
    for (const m of filtered) {
      const cat = this.categoryLabelForTypeId(typeOptions, m.materialTypeId)!;
      const base = this.buildMaterialBaseKey(m);
      const n = (counts.get(base) ?? 0) + 1;
      counts.set(base, n);
      const rowKey = n === 1 ? base : `${base}#${n}`;
      const usage = m.usagePerPiece;
      let expected: number | null = null;
      if (usage != null && String(usage).trim() !== '') {
        const u = Number(usage);
        if (Number.isFinite(u)) expected = u;
      }
      rows.push({
        rowKey,
        materialTypeId: m.materialTypeId ?? null,
        categoryLabel: cat,
        materialName: this.normalizeStr(m.materialName) || '-',
        colorSpec: this.buildColorSpec(m),
        expectedUsagePerPiece: expected,
        issuedMeters: 0,
        returnedMeters: 0,
        abnormalLossMeters: 0,
        abnormalReason: null,
        remark: '',
      });
    }
    return rows;
  }

  private toFormMaterialRows(rows: CuttingMaterialUsageRow[]): CuttingRegisterFormMaterialRow[] {
    return rows.map((r) => ({
      rowKey: r.rowKey,
      materialTypeId: r.materialTypeId ?? null,
      categoryLabel: r.categoryLabel,
      materialName: r.materialName,
      colorSpec: r.colorSpec,
      expectedUsagePerPiece: r.expectedUsagePerPiece,
      issuedMeters: r.issuedMeters,
      returnedMeters: r.returnedMeters,
      abnormalLossMeters: r.abnormalLossMeters,
      abnormalReason: r.abnormalReason,
      remark: r.remark ?? '',
    }));
  }

  private async buildCuttingRows(baseQuery: CuttingListQuery): Promise<CuttingListItem[]> {
    const { tab = 'all', orderNo, skuCode } = baseQuery;
    const completedCutting = await this.cuttingRepo.find({ where: { status: 'completed' }, select: ['orderId'] });
    const completedOrderIds = completedCutting.map((c) => c.orderId);
    const completedIds = completedOrderIds.length > 0 ? completedOrderIds : [0];
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('(o.status = :pendingCutting OR o.id IN (:...completedIds))', {
        pendingCutting: 'pending_cutting',
        completedIds,
      });
    if (orderNo?.trim()) qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    if (skuCode?.trim()) qb.andWhere('o.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    qb.orderBy('o.order_date', 'DESC').addOrderBy('o.id', 'DESC');
    const orders = await qb.getMany();
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) return [];
    const [cuttings, actualFabricMap, v2Map] = await Promise.all([
      this.cuttingRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.fetchActualFabricMetersMap(orderIds),
      this.fetchCuttingV2Map(orderIds),
    ]);
    const cuttingMap = new Map(cuttings.map((c) => [c.orderId, c]));
    const slaCtx = await this.orderStatusConfigService.loadProductionSlaJudgeContext();
    const rows: CuttingListItem[] = [];
    for (const order of orders) {
      const cutting = cuttingMap.get(order.id);
      const cuttingStatus = (cutting?.status ?? 'pending').toLowerCase();
      if (tab === 'pending' && cuttingStatus === 'completed') continue;
      if (tab === 'completed' && cuttingStatus !== 'completed') continue;
      const arrivedAt =
        this.toDateTimeLocalString(cutting?.arrivedAt) ??
        this.toDateTimeLocalString(cutting?.completedAt) ??
        (order.status === 'pending_cutting' ? this.toDateTimeLocalString(order.statusTime) : null);
      const completedAt = this.toDateTimeLocalString(cutting?.completedAt);
      let phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(cutting?.arrivedAt ?? null);
      if (!phaseStart && order.status === 'pending_cutting') phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(order.statusTime);
      const phaseEnd =
        cuttingStatus === 'completed' && cutting?.completedAt
          ? this.orderStatusConfigService.parseProductionPhaseInstant(cutting.completedAt)
          : null;
      const timeRating = this.orderStatusConfigService.judgeProductionPhaseDuration(
        'pending_cutting',
        phaseStart,
        phaseEnd,
        order.status ?? '',
        slaCtx,
      );
      const v2 = v2Map.get(order.id);
      const totalDisplay = v2?.total != null ? v2.total : cutting?.cuttingCost != null ? String(cutting.cuttingCost) : null;
      rows.push({
        orderId: order.id,
        orderNo: order.orderNo ?? '',
        customerName: order.customerName ?? '',
        salesperson: order.salesperson ?? '',
        merchandiser: order.merchandiser ?? '',
        customerDueDate: order.customerDueDate ? this.toDateOnlyLocalString(order.customerDueDate) : null,
        skuCode: order.skuCode ?? '',
        quantity: order.quantity ?? 0,
        imageUrl: order.imageUrl ?? '',
        arrivedAt,
        completedAt,
        cuttingStatus: cuttingStatus === 'completed' ? 'completed' : 'pending',
        actualCutTotal: this.sumActualCut(cutting?.actualCutRows ?? null),
        cuttingCost: totalDisplay,
        cuttingUnitPrice: v2?.unit ?? null,
        actualFabricMeters: actualFabricMap.get(order.id) ?? null,
        timeRating,
      });
    }
    return rows;
  }

  async getCuttingList(query: CuttingListQuery, actorUserId?: number): Promise<{
    list: CuttingListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    this.scheduleCuttingReconcile(actorUserId);
    const { page = 1, pageSize = 20 } = query;
    const rows = await this.buildCuttingRows(query);
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);
    return { list, total, page, pageSize };
  }

  async getCuttingExportRows(query: CuttingListQuery, actorUserId?: number): Promise<CuttingListItem[]> {
    this.scheduleCuttingReconcile(actorUserId);
    return this.buildCuttingRows(query);
  }

  async getQuantityBreakdown(orderId: number): Promise<{
    headers: string[];
    rows: Array<{ label: string; values: (number | null)[] }>;
  }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const [ext, cutting] = await Promise.all([
      this.orderExtRepo.findOne({ where: { orderId } }),
      this.cuttingRepo.findOne({ where: { orderId } }),
    ]);
    const headers =
      Array.isArray(ext?.colorSizeHeaders) && ext.colorSizeHeaders.length > 0 ? [...ext.colorSizeHeaders, '合计'] : ['合计'];
    const sizeLen = headers.length - 1;
    const buildPerSize = (rows: { quantities?: number[] }[] | null | undefined): (number | null)[] | null => {
      if (!rows || rows.length === 0 || sizeLen <= 0) return null;
      const sums = Array(sizeLen).fill(0) as number[];
      rows.forEach((row) => {
        if (!Array.isArray(row.quantities)) return;
        row.quantities.forEach((q: unknown, idx: number) => {
          if (idx < sizeLen) {
            const n = Number(q);
            if (!Number.isNaN(n)) sums[idx] += n;
          }
        });
      });
      const total = sums.reduce((a, b) => a + b, 0);
      return [...sums, total];
    };
    const orderPerSize = buildPerSize((ext as { colorSizeRows?: { quantities?: number[] }[] })?.colorSizeRows ?? null);
    const cutPerSize = buildPerSize(cutting?.actualCutRows ?? null);
    const out: Array<{ label: string; values: (number | null)[] }> = [];
    if (orderPerSize) out.push({ label: '订单数量', values: orderPerSize });
    if (cutPerSize) out.push({ label: '裁床数量', values: cutPerSize });
    return { headers, rows: out };
  }

  async getOrderColorSize(orderId: number): Promise<{
    colorSizeHeaders: string[];
    colorSizeRows: { colorName: string; quantities: number[]; remark?: string }[];
  }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'pending_cutting') throw new NotFoundException('仅待裁床订单可登记');
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const colorSizeHeaders = ext?.colorSizeHeaders ?? [];
    const colorSizeRows = (ext?.colorSizeRows ?? []).map((r) => ({
      colorName: r.colorName ?? '',
      quantities: Array.isArray(r.quantities) ? [...r.quantities] : [],
      remark: r.remark,
    }));
    return { colorSizeHeaders, colorSizeRows };
  }

  async getRegisterForm(orderId: number): Promise<CuttingRegisterFormResponse> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'pending_cutting') throw new NotFoundException('仅待裁床订单可登记');
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const typeOptions = await this.systemOptionsService.findAllByType('material_types');
    const template = this.buildMaterialTemplateRows(ext?.materials ?? null, typeOptions);
    const colorSizeHeaders = ext?.colorSizeHeaders ?? [];
    const colorSizeRows = (ext?.colorSizeRows ?? []).map((r) => ({
      colorName: r.colorName ?? '',
      quantities: Array.isArray(r.quantities) ? [...r.quantities] : [],
      remark: r.remark,
    }));
    return {
      orderBrief: {
        orderNo: order.orderNo ?? '',
        skuCode: order.skuCode ?? '',
        quantity: order.quantity ?? 0,
        customerName: order.customerName ?? '',
        orderDate: this.toDateOnlyLocalString(order.orderDate),
      },
      colorSizeHeaders,
      colorSizeRows,
      materialUsageRows: this.toFormMaterialRows(template),
    };
  }

  async getCompletedCuttingDetail(orderId: number): Promise<CuttingCompletedDetailResponse> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const cutting = await this.cuttingRepo.findOne({ where: { orderId } });
    if (!cutting || String(cutting.status ?? '').toLowerCase() !== 'completed') {
      throw new NotFoundException('该订单尚无裁床完成记录');
    }
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const headers = ext?.colorSizeHeaders ?? [];
    const len = headers.length;
    const rawRows = Array.isArray(cutting.actualCutRows) ? cutting.actualCutRows : [];
    const actualCutRows = rawRows.map((r) => {
      const q = Array.isArray(r.quantities) ? [...r.quantities] : [];
      while (q.length < len) q.push(0);
      return {
        colorName: r.colorName ?? '',
        quantities: len > 0 ? q.slice(0, len) : q,
        remark: r.remark,
      };
    });
    const extras = await this.fetchSingleOrderCuttingExtras(orderId);
    return {
      orderBrief: {
        orderNo: order.orderNo ?? '',
        skuCode: order.skuCode ?? '',
        quantity: order.quantity ?? 0,
        customerName: order.customerName ?? '',
        orderDate: this.toDateOnlyLocalString(order.orderDate),
      },
      colorSizeHeaders: headers,
      actualCutRows,
      materialUsageRows: this.toFormMaterialRows(extras.materialUsage),
      cuttingDepartment: extras.department,
      cutterName: extras.cutter,
      cuttingUnitPrice: extras.unit,
      cuttingTotalCost: extras.total,
      cuttingCost: cutting.cuttingCost != null ? String(cutting.cuttingCost) : null,
      actualFabricMeters: extras.fabric,
      arrivedAt: this.toDateTimeLocalString(cutting.arrivedAt),
      completedAt: this.toDateTimeLocalString(cutting.completedAt),
    };
  }
}
