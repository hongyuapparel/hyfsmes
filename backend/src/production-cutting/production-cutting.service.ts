import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type ActualCutRow, type CuttingMaterialUsageRow } from '../entities/order-cutting.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';
import { SystemOption } from '../entities/system-option.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { SystemOptionsService } from '../system-options/system-options.service';
import { OrderStatusConfigService } from '../order-status-config/order-status-config.service';

/** 与前端一致的异常损耗原因（固定选项） */
export const CUTTING_ABNORMAL_REASONS = [
  '布头布尾',
  '疵布/次布',
  '裁错返工',
  '缩水损耗',
  '色差换片',
  '排料正常损耗',
  '其他',
] as const;

const ALLOWED_MATERIAL_CATEGORY_VALUES = new Set(['主布', '里布', '配布', '衬布']);

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
  /** 裁床总数量（actualCutRows 各格汇总） */
  actualCutTotal: number | null;
  /** 裁剪总成本（元），列表/导出展示 */
  cuttingCost: string | null;
  /** 裁剪单价（元/件），新列；无则 null */
  cuttingUnitPrice: string | null;
  /** 本次实际净耗合计（米） */
  actualFabricMeters: string | null;
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

export interface CuttingRegisterFormMaterialRow {
  rowKey: string;
  materialTypeId: number | null;
  categoryLabel: string;
  materialName: string;
  colorSpec: string;
  expectedUsagePerPiece: number | null;
  issuedMeters: number;
  returnedMeters: number;
  abnormalLossMeters: number;
  abnormalReason: string | null;
  remark: string;
}

export interface CuttingRegisterFormResponse {
  orderBrief: {
    orderNo: string;
    skuCode: string;
    quantity: number;
    customerName: string;
    orderDate: string | null;
  };
  colorSizeHeaders: string[];
  colorSizeRows: { colorName: string; quantities: number[]; remark?: string }[];
  materialUsageRows: CuttingRegisterFormMaterialRow[];
}

/** 裁床已完成：列表抽屉查看登记详情 */
export interface CuttingCompletedDetailResponse {
  orderBrief: {
    orderNo: string;
    skuCode: string;
    quantity: number;
    customerName: string;
    orderDate: string | null;
  };
  colorSizeHeaders: string[];
  actualCutRows: { colorName: string; quantities: number[]; remark?: string }[];
  materialUsageRows: CuttingRegisterFormMaterialRow[];
  cuttingDepartment: string | null;
  cutterName: string | null;
  cuttingUnitPrice: string | null;
  cuttingTotalCost: string | null;
  /** 与列表一致：总成本（元） */
  cuttingCost: string | null;
  actualFabricMeters: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
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
    private readonly orderWorkflowService: OrderWorkflowService,
    private readonly systemOptionsService: SystemOptionsService,
    private readonly orderStatusConfigService: OrderStatusConfigService,
  ) {}

  private async hasCuttingDepartmentAndCutter(): Promise<boolean> {
    try {
      const depRows = await this.cuttingRepo.query(
        "SHOW COLUMNS FROM `order_cutting` LIKE 'cutting_department'",
      );
      const cutterRows = await this.cuttingRepo.query(
        "SHOW COLUMNS FROM `order_cutting` LIKE 'cutter_name'",
      );
      return Array.isArray(depRows) && depRows.length > 0 && Array.isArray(cutterRows) && cutterRows.length > 0;
    } catch {
      return false;
    }
  }

  private async hasActualFabricMeters(): Promise<boolean> {
    try {
      const rows = await this.cuttingRepo.query(
        "SHOW COLUMNS FROM `order_cutting` LIKE 'actual_fabric_meters'",
      );
      return Array.isArray(rows) && rows.length > 0;
    } catch {
      return false;
    }
  }

  private async hasCuttingRegisterV2Columns(): Promise<boolean> {
    try {
      const rows = await this.cuttingRepo.query(
        "SHOW COLUMNS FROM `order_cutting` LIKE 'cutting_unit_price'",
      );
      return Array.isArray(rows) && rows.length > 0;
    } catch {
      return false;
    }
  }

  /** 库表已加 v2 列时，在 save() 之后写入（实体列 insert/update: false，避免未迁移库报错） */
  private async persistCuttingRegisterV2Columns(
    hasV2Columns: boolean,
    orderId: number,
    unitStr: string | null,
    totalStr: string,
    materialNorm: CuttingMaterialUsageRow[],
  ): Promise<void> {
    if (!hasV2Columns) return;
    const jsonStr = materialNorm.length > 0 ? JSON.stringify(materialNorm) : null;
    await this.cuttingRepo.query(
      `UPDATE \`order_cutting\`
       SET cutting_unit_price = ?, cutting_total_cost = ?, material_usage = ?
       WHERE order_id = ?`,
      [unitStr, totalStr, jsonStr, orderId],
    );
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
          const orderId = Number((r as any).orderId);
          const v = (r as any).actualFabricMeters;
          if (!Number.isNaN(orderId) && v != null && String(v).trim() !== '') {
            map.set(orderId, String(v));
          }
        }
      }
    } catch {
      // ignore
    }
    return map;
  }

  /** 单行读取 order_cutting 扩展列（按当前库实际存在的列动态 SELECT） */
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
    if (hasFabric) {
      cols.push('actual_fabric_meters AS actualFabricMeters');
    }
    if (!cols.length) return empty;
    try {
      const rows = await this.cuttingRepo.query(
        `SELECT ${cols.join(', ')} FROM \`order_cutting\` WHERE order_id = ? LIMIT 1`,
        [orderId],
      );
      const r = Array.isArray(rows) && rows.length > 0 ? (rows[0] as Record<string, unknown>) : null;
      if (!r) return empty;
      let materialUsage: CuttingMaterialUsageRow[] = [];
      if (hasV2 && r.materialUsage != null) {
        materialUsage = this.parseMaterialUsageStored(r.materialUsage);
      }
      return {
        unit:
          hasV2 && r.cuttingUnitPrice != null && String(r.cuttingUnitPrice).trim() !== ''
            ? String(r.cuttingUnitPrice)
            : null,
        total:
          hasV2 && r.cuttingTotalCost != null && String(r.cuttingTotalCost).trim() !== ''
            ? String(r.cuttingTotalCost)
            : null,
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
          x.abnormalReason != null && String(x.abnormalReason).trim() !== ''
            ? String(x.abnormalReason).trim()
            : null,
        remark: x.remark != null ? String(x.remark) : '',
      });
    }
    return out;
  }

  private async fetchCuttingV2Map(
    orderIds: number[],
  ): Promise<Map<number, { unit: string | null; total: string | null }>> {
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
          const orderId = Number((r as any).orderId);
          if (Number.isNaN(orderId)) continue;
          const u = (r as any).cuttingUnitPrice;
          const t = (r as any).cuttingTotalCost;
          map.set(orderId, {
            unit: u != null && String(u).trim() !== '' ? String(u) : null,
            total: t != null && String(t).trim() !== '' ? String(t) : null,
          });
        }
      }
    } catch {
      // ignore
    }
    return map;
  }

  private toDateTimeLocalString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (typeof v === 'string') {
      const s = v.slice(0, 19).replace('T', ' ');
      return s || null;
    }
    if (!(v instanceof Date)) return null;
    if (Number.isNaN(v.getTime())) return null;
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
    if (!(v instanceof Date)) return null;
    if (Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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

  private sumActualCutPieces(actualCutRows: ActualCutRow[]): number {
    let sum = 0;
    for (const row of actualCutRows) {
      if (Array.isArray(row.quantities)) {
        for (const q of row.quantities) {
          const n = Number(q);
          if (Number.isFinite(n) && n >= 0) sum += n;
        }
      }
    }
    return sum;
  }

  private validateActualCutRows(rows: ActualCutRow[]): void {
    for (const row of rows) {
      if (!Array.isArray(row.quantities)) continue;
      for (const q of row.quantities) {
        const n = Number(q);
        if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
          throw new BadRequestException('裁剪数量须为非负整数');
        }
      }
    }
  }

  private normalizeMoney2(v: number): string {
    const x = Math.round(v * 100) / 100;
    return x.toFixed(2);
  }

  private normalizeMoney4(v: number): string {
    const x = Math.round(v * 10000) / 10000;
    return x.toFixed(4);
  }

  private normalizeMeters3(v: number): string {
    const x = Math.round(v * 1000) / 1000;
    return x.toFixed(3);
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

  private normalizeStr(s: unknown): string {
    return String(s ?? '').trim();
  }

  private buildMaterialBaseKey(m: OrderMaterialRow): string {
    const tid = m.materialTypeId ?? 0;
    return `${tid}:${this.normalizeStr(m.materialName)}:${this.normalizeStr(m.color)}`;
  }

  private buildColorSpec(m: OrderMaterialRow): string {
    const parts = [this.normalizeStr(m.color), this.normalizeStr(m.remark)].filter(Boolean);
    return parts.length ? parts.join(' · ') : '-';
  }

  private buildMaterialTemplateRows(
    materials: OrderMaterialRow[] | null | undefined,
    typeOptions: SystemOption[],
  ): CuttingMaterialUsageRow[] {
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

  private mergeMaterialUsageWithClient(
    template: CuttingMaterialUsageRow[],
    clientRows: CuttingMaterialUsageRow[] | null | undefined,
  ): CuttingMaterialUsageRow[] {
    const byKey = new Map<string, CuttingMaterialUsageRow>();
    if (Array.isArray(clientRows)) {
      for (const r of clientRows) {
        if (r && typeof r.rowKey === 'string' && r.rowKey) byKey.set(r.rowKey, r);
      }
    }
    return template.map((t) => {
      const c = byKey.get(t.rowKey);
      if (!c) return { ...t };
      const exp =
        c.expectedUsagePerPiece != null && String(c.expectedUsagePerPiece).trim() !== ''
          ? Number(c.expectedUsagePerPiece)
          : t.expectedUsagePerPiece;
      const expNorm = exp != null && Number.isFinite(Number(exp)) ? Number(exp) : t.expectedUsagePerPiece;
      return {
        ...t,
        expectedUsagePerPiece: expNorm,
        issuedMeters: Number(c.issuedMeters) || 0,
        returnedMeters: Number(c.returnedMeters) || 0,
        abnormalLossMeters: Number(c.abnormalLossMeters) || 0,
        abnormalReason: c.abnormalReason != null && String(c.abnormalReason).trim() !== '' ? String(c.abnormalReason).trim() : null,
        remark: c.remark != null ? String(c.remark) : '',
      };
    });
  }

  private validateAndNormalizeMaterialUsage(
    rows: CuttingMaterialUsageRow[],
    piecesGrand: number,
  ): { normalized: CuttingMaterialUsageRow[]; fabricNetSum: number } {
    const abnormalSet = new Set<string>(CUTTING_ABNORMAL_REASONS as unknown as string[]);
    let fabricNetSum = 0;
    const normalized: CuttingMaterialUsageRow[] = [];

    for (const r of rows) {
      const issued = Number(r.issuedMeters);
      const returned = Number(r.returnedMeters);
      const abnormal = Number(r.abnormalLossMeters);
      if (!Number.isFinite(issued) || issued < 0) {
        throw new BadRequestException(`物料「${r.materialName}」本次领用米数须为非负数`);
      }
      if (!Number.isFinite(returned) || returned < 0) {
        throw new BadRequestException(`物料「${r.materialName}」退回米数须为非负数`);
      }
      if (!Number.isFinite(abnormal) || abnormal < 0) {
        throw new BadRequestException(`物料「${r.materialName}」异常损耗米数须为非负数`);
      }
      if (returned > issued) {
        throw new BadRequestException(`物料「${r.materialName}」退回米数不能大于本次领用米数`);
      }
      const net = issued - returned;
      if (abnormal > net + 1e-9) {
        throw new BadRequestException(`物料「${r.materialName}」异常损耗不能大于实际净耗米数（领用−退回）`);
      }
      if (abnormal > 0) {
        const reason = r.abnormalReason != null ? String(r.abnormalReason).trim() : '';
        if (!reason || !abnormalSet.has(reason)) {
          throw new BadRequestException(`物料「${r.materialName}」填写了异常损耗时，请选择异常原因`);
        }
        if (reason === '其他' && !String(r.remark ?? '').trim()) {
          throw new BadRequestException(`物料「${r.materialName}」异常原因为「其他」时请填写备注`);
        }
      }
      fabricNetSum += net;
      normalized.push({
        ...r,
        issuedMeters: issued,
        returnedMeters: returned,
        abnormalLossMeters: abnormal,
        abnormalReason:
          r.abnormalReason != null && String(r.abnormalReason).trim() !== '' ? String(r.abnormalReason).trim() : null,
        remark: r.remark != null ? String(r.remark) : '',
      });
    }

    return { normalized, fabricNetSum };
  }

  private async buildCuttingRows(baseQuery: CuttingListQuery): Promise<CuttingListItem[]> {
    const { tab = 'all', orderNo, skuCode } = baseQuery;

    const completedCutting = await this.cuttingRepo.find({
      where: { status: 'completed' },
      select: ['orderId'],
    });
    const completedOrderIds = completedCutting.map((c) => c.orderId);
    const completedIds = completedOrderIds.length > 0 ? completedOrderIds : [0];

    const qb = this.orderRepo.createQueryBuilder('o').where(
      '(o.status = :pendingCutting OR o.id IN (:...completedIds))',
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
      if (!phaseStart && order.status === 'pending_cutting') {
        phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(order.statusTime);
      }
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
      const totalDisplay =
        v2?.total != null ? v2.total : cutting?.cuttingCost != null ? String(cutting.cuttingCost) : null;

      rows.push({
        orderId: order.id,
        orderNo: order.orderNo ?? '',
        customerName: order.customerName ?? '',
        salesperson: order.salesperson ?? '',
        merchandiser: order.merchandiser ?? '',
        customerDueDate: order.customerDueDate
          ? this.toDateOnlyLocalString(order.customerDueDate)
          : null,
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
    const out: Array<{ label: string; values: (number | null)[] }> = [];
    if (orderPerSize) out.push({ label: '订单数量', values: orderPerSize });
    if (cutPerSize) out.push({ label: '裁床数量', values: cutPerSize });
    return { headers, rows: out };
  }

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

  /** 裁床登记弹窗：订单摘要 + B 区 + C 区物料用量模板（主布/里布/配布/衬布） */
  async getRegisterForm(orderId: number): Promise<CuttingRegisterFormResponse> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending_cutting') {
      throw new NotFoundException('仅待裁床订单可登记');
    }
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

  /** 裁床已完成订单：抽屉查看登记的裁剪数量、物料用量、部门与成本等 */
  async getCompletedCuttingDetail(orderId: number): Promise<CuttingCompletedDetailResponse> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
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

  /**
   * 裁床登记完成：写入数量、单价/总成本、物料用量；订单状态改为待车缝。
   * 兼容旧客户端仅传 cuttingCost（视为总成本，单价为空）。
   */
  async completeCutting(
    orderId: number,
    actualCutRows: ActualCutRow[],
    cuttingDepartment: string | null | undefined,
    cutterName: string | null | undefined,
    body: {
      cuttingUnitPrice?: string | null;
      cuttingTotalCost?: string | null;
      cuttingCostLegacy?: string | null;
      materialUsage?: CuttingMaterialUsageRow[] | null;
    },
    actorUserId?: number,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending_cutting') {
      throw new NotFoundException('仅待裁床订单可完成登记');
    }

    const rowsIn = Array.isArray(actualCutRows) ? actualCutRows : [];
    this.validateActualCutRows(rowsIn);
    const piecesGrand = this.sumActualCutPieces(rowsIn);
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const typeOptions = await this.systemOptionsService.findAllByType('material_types');
    const template = this.buildMaterialTemplateRows(ext?.materials ?? null, typeOptions);
    const mergedUsage = this.mergeMaterialUsageWithClient(template, body.materialUsage ?? null);
    const { normalized: materialNorm, fabricNetSum } = this.validateAndNormalizeMaterialUsage(mergedUsage, piecesGrand);

    const unitRaw =
      body.cuttingUnitPrice != null && String(body.cuttingUnitPrice).trim() !== ''
        ? String(body.cuttingUnitPrice).trim()
        : null;
    const totalRaw =
      body.cuttingTotalCost != null && String(body.cuttingTotalCost).trim() !== ''
        ? String(body.cuttingTotalCost).trim()
        : null;
    const legacyRaw =
      body.cuttingCostLegacy != null && String(body.cuttingCostLegacy).trim() !== ''
        ? String(body.cuttingCostLegacy).trim()
        : null;

    let unitNum: number | null = null;
    if (unitRaw != null) {
      unitNum = Number(unitRaw);
      if (!Number.isFinite(unitNum) || unitNum < 0) {
        throw new BadRequestException('裁剪单价须为非负数');
      }
    }

    let totalNum: number;
    if (totalRaw != null) {
      totalNum = Number(totalRaw);
      if (!Number.isFinite(totalNum) || totalNum < 0) {
        throw new BadRequestException('裁剪总成本须为非负数');
      }
    } else if (legacyRaw != null && unitRaw == null) {
      totalNum = Number(legacyRaw);
      if (!Number.isFinite(totalNum) || totalNum < 0) {
        throw new BadRequestException('裁剪成本须为非负数');
      }
    } else if (unitNum != null) {
      totalNum = unitNum * piecesGrand;
    } else {
      totalNum = 0;
    }

    if (unitNum != null) {
      const expected = unitNum * piecesGrand;
      if (Math.abs(expected - totalNum) > 0.02) {
        throw new BadRequestException('裁剪总成本与「裁剪单价×实际裁剪件数」不一致，请检查后重试');
      }
    }

    const depNorm = (cuttingDepartment ?? '').trim();
    const cutterNorm = (cutterName ?? '').trim();
    const SELF = '本厂';
    if (!depNorm) {
      throw new BadRequestException('请选择裁剪部门');
    }
    if (depNorm === SELF && !cutterNorm) {
      throw new BadRequestException('本厂裁床请选择裁剪人');
    }

    const now = new Date();
    const arrivedAt = order.statusTime ?? now;
    const costNorm = this.normalizeMoney2(totalNum);
    const unitStr = unitNum != null ? this.normalizeMoney4(unitNum) : null;
    const totalStr = costNorm;
    const fabricNorm = this.normalizeMeters3(fabricNetSum);

    let cutting = await this.cuttingRepo.findOne({ where: { orderId } });
    const [hasColumns, hasFabricCol, hasV2Columns] = await Promise.all([
      this.hasCuttingDepartmentAndCutter(),
      this.hasActualFabricMeters(),
      this.hasCuttingRegisterV2Columns(),
    ]);

    if (!cutting) {
      cutting = this.cuttingRepo.create({
        orderId,
        status: 'completed',
        arrivedAt,
        completedAt: now,
        cuttingCost: costNorm,
        actualCutRows: rowsIn.length ? rowsIn : null,
      });
      if (hasColumns) {
        (cutting as any).cuttingDepartment = depNorm || null;
        (cutting as any).cutterName = depNorm === SELF ? cutterNorm || null : null;
      }
      if (hasFabricCol) {
        (cutting as any).actualFabricMeters = depNorm === SELF ? fabricNorm : null;
      }
    } else {
      cutting.status = 'completed';
      cutting.arrivedAt = cutting.arrivedAt ?? arrivedAt;
      cutting.completedAt = now;
      cutting.cuttingCost = costNorm;
      cutting.actualCutRows = rowsIn.length ? rowsIn : null;
      if (hasColumns) {
        (cutting as any).cuttingDepartment = depNorm || null;
        (cutting as any).cutterName = depNorm === SELF ? cutterNorm || null : null;
      }
      if (hasFabricCol) {
        (cutting as any).actualFabricMeters = depNorm === SELF ? fabricNorm : null;
      }
    }
    await this.cuttingRepo.save(cutting);
    await this.persistCuttingRegisterV2Columns(hasV2Columns, orderId, unitStr, totalStr, materialNorm);

    const next = await this.orderWorkflowService.resolveNextStatus({
      order,
      triggerCode: 'cutting_completed',
      actorUserId: actorUserId ?? 0,
    });
    if (next && next !== order.status) {
      order.status = next;
      order.statusTime = now;
      await this.orderRepo.save(order);
    }
  }
}
