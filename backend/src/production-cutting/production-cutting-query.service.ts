import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type CuttingMaterialUsageRow } from '../entities/order-cutting.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';
import { SystemOption } from '../entities/system-option.entity';
import { SystemOptionsService } from '../system-options/system-options.service';
import type { CuttingCompletedDetailResponse, CuttingRegisterFormMaterialRow, CuttingRegisterFormResponse } from './production-cutting.types';

const ALLOWED_MATERIAL_CATEGORY_VALUES = new Set(['主布', '里布', '配布', '衬布']);

@Injectable()
export class ProductionCuttingQueryService {
  constructor(@InjectRepository(Order) private readonly orderRepo: Repository<Order>, @InjectRepository(OrderCutting) private readonly cuttingRepo: Repository<OrderCutting>, @InjectRepository(OrderExt) private readonly orderExtRepo: Repository<OrderExt>, private readonly systemOptionsService: SystemOptionsService) {}

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
      const materialTypeIdRaw = x.materialTypeId;
      const materialTypeIdNum = materialTypeIdRaw == null || materialTypeIdRaw === '' ? null : Number(materialTypeIdRaw);
      const expectedRaw = x.expectedUsagePerPiece;
      const expectedNum = expectedRaw == null || String(expectedRaw).trim() === '' ? null : Number(expectedRaw);
      out.push({
        rowKey: String(x.rowKey ?? ''),
        materialTypeId: materialTypeIdNum != null && Number.isFinite(materialTypeIdNum) ? materialTypeIdNum : null,
        categoryLabel: String(x.categoryLabel ?? ''),
        materialName: String(x.materialName ?? ''),
        colorSpec: String(x.colorSpec ?? ''),
        expectedUsagePerPiece: expectedNum != null && Number.isFinite(expectedNum) ? expectedNum : null,
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
    if (hasV2) cols.push('cutting_unit_price AS cuttingUnitPrice', 'cutting_total_cost AS cuttingTotalCost', 'material_usage AS materialUsage');
    if (hasDept) cols.push('cutting_department AS cuttingDepartment', 'cutter_name AS cutterName');
    if (hasFabric) cols.push('actual_fabric_meters AS actualFabricMeters');
    if (!cols.length) return empty;
    try {
      const rows = await this.cuttingRepo.query(`SELECT ${cols.join(', ')} FROM \`order_cutting\` WHERE order_id = ? LIMIT 1`, [orderId]);
      const r = Array.isArray(rows) && rows.length > 0 ? (rows[0] as Record<string, unknown>) : null;
      if (!r) return empty;
      const materialUsage = hasV2 && r.materialUsage != null ? this.parseMaterialUsageStored(r.materialUsage) : [];
      return {
        unit: hasV2 && r.cuttingUnitPrice != null && String(r.cuttingUnitPrice).trim() !== '' ? String(r.cuttingUnitPrice) : null,
        total: hasV2 && r.cuttingTotalCost != null && String(r.cuttingTotalCost).trim() !== '' ? String(r.cuttingTotalCost) : null,
        materialUsage,
        department: hasDept && r.cuttingDepartment != null && String(r.cuttingDepartment).trim() !== '' ? String(r.cuttingDepartment).trim() : null,
        cutter: hasDept && r.cutterName != null && String(r.cutterName).trim() !== '' ? String(r.cutterName).trim() : null,
        fabric: hasFabric && r.actualFabricMeters != null && String(r.actualFabricMeters).trim() !== '' ? String(r.actualFabricMeters) : null,
      };
    } catch {
      return empty;
    }
  }
  private toDateTimeLocalString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (typeof v === 'string') return v.slice(0, 19).replace('T', ' ') || null;
    if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')} ${String(v.getHours()).padStart(2, '0')}:${String(v.getMinutes()).padStart(2, '0')}:${String(v.getSeconds()).padStart(2, '0')}`;
  }
  private toDateOnlyLocalString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (typeof v === 'string') return v.slice(0, 10) || null;
    if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  private normalizeStr(s: unknown): string {
    return String(s ?? '').trim();
  }

  private categoryLabelForTypeId(options: SystemOption[], materialTypeId: number | null | undefined): string | null {
    if (materialTypeId == null || !Number.isFinite(Number(materialTypeId))) return null;
    const byId = new Map(options.map((o) => [o.id, o]));
    const node = byId.get(Number(materialTypeId));
    return node && ALLOWED_MATERIAL_CATEGORY_VALUES.has(node.value) ? node.value : null;
  }

  private buildMaterialBaseKey(m: OrderMaterialRow): string {
    return `${m.materialTypeId ?? 0}:${this.normalizeStr(m.materialName)}:${this.normalizeStr(m.color)}`;
  }

  private buildColorSpec(m: OrderMaterialRow): string {
    const parts = [this.normalizeStr(m.color), this.normalizeStr(m.remark)].filter(Boolean);
    return parts.length ? parts.join(' · ') : '-';
  }

  private buildMaterialTemplateRows(materials: OrderMaterialRow[] | null | undefined, typeOptions: SystemOption[]): CuttingMaterialUsageRow[] {
    const filtered = (Array.isArray(materials) ? materials : []).filter((m) => this.categoryLabelForTypeId(typeOptions, m.materialTypeId) != null);
    const counts = new Map<string, number>();
    const rows: CuttingMaterialUsageRow[] = [];
    for (const m of filtered) {
      const base = this.buildMaterialBaseKey(m);
      const n = (counts.get(base) ?? 0) + 1;
      counts.set(base, n);
      const usage = m.usagePerPiece;
      let expected: number | null = null;
      if (usage != null && String(usage).trim() !== '') {
        const u = Number(usage);
        if (Number.isFinite(u)) expected = u;
      }
      rows.push({
        rowKey: n === 1 ? base : `${base}#${n}`,
        materialTypeId: m.materialTypeId ?? null,
        categoryLabel: this.categoryLabelForTypeId(typeOptions, m.materialTypeId)!,
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

  async getQuantityBreakdown(orderId: number): Promise<{ headers: string[]; rows: Array<{ label: string; values: (number | null)[] }> }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const [ext, cutting] = await Promise.all([this.orderExtRepo.findOne({ where: { orderId } }), this.cuttingRepo.findOne({ where: { orderId } })]);
    const headers = Array.isArray(ext?.colorSizeHeaders) && ext.colorSizeHeaders.length > 0 ? [...ext.colorSizeHeaders, '合计'] : ['合计'];
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
      return [...sums, sums.reduce((a, b) => a + b, 0)];
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
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'pending_cutting') throw new NotFoundException('仅待裁床订单可登记');
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const colorSizeRows = (ext?.colorSizeRows ?? []).map((r) => ({
      colorName: r.colorName ?? '',
      quantities: Array.isArray(r.quantities) ? [...r.quantities] : [],
      remark: r.remark,
    }));
    return { colorSizeHeaders: ext?.colorSizeHeaders ?? [], colorSizeRows };
  }

  async getRegisterForm(orderId: number): Promise<CuttingRegisterFormResponse> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'pending_cutting') throw new NotFoundException('仅待裁床订单可登记');
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const typeOptions = await this.systemOptionsService.findAllByType('material_types');
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
      colorSizeHeaders: ext?.colorSizeHeaders ?? [],
      colorSizeRows,
      materialUsageRows: this.toFormMaterialRows(this.buildMaterialTemplateRows(ext?.materials ?? null, typeOptions)),
    };
  }

  async getCompletedCuttingDetail(orderId: number): Promise<CuttingCompletedDetailResponse> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const cutting = await this.cuttingRepo.findOne({ where: { orderId } });
    if (!cutting || String(cutting.status ?? '').toLowerCase() !== 'completed') throw new NotFoundException('该订单尚无裁床完成记录');
    const headers = (await this.orderExtRepo.findOne({ where: { orderId } }))?.colorSizeHeaders ?? [];
    const len = headers.length;
    const rawRows = Array.isArray(cutting.actualCutRows) ? cutting.actualCutRows : [];
    const actualCutRows = rawRows.map((r) => {
      const q = Array.isArray(r.quantities) ? [...r.quantities] : [];
      while (q.length < len) q.push(0);
      return { colorName: r.colorName ?? '', quantities: len > 0 ? q.slice(0, len) : q, remark: r.remark };
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
