import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCutting, type ActualCutRow, type CuttingMaterialUsageRow } from '../entities/order-cutting.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';
import { SystemOption } from '../entities/system-option.entity';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { SystemOptionsService } from '../system-options/system-options.service';
import { CUTTING_ABNORMAL_REASONS } from './production-cutting.types';

const ALLOWED_MATERIAL_CATEGORY_VALUES = new Set(['主布', '里布', '配布', '衬布']);

@Injectable()
export class ProductionCuttingMutationService {
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
  ) {}

  private async appendStatusHistory(orderId: number, statusCode: string): Promise<void> {
    const code = (statusCode ?? '').trim();
    if (!code) return;
    const status = await this.orderStatusRepo.findOne({ where: { code } });
    if (!status) return;
    await this.orderStatusHistoryRepo.save(this.orderStatusHistoryRepo.create({ orderId, statusId: status.id }));
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

  private sumActualCutPieces(actualCutRows: ActualCutRow[]): number {
    let sum = 0;
    for (const row of actualCutRows) {
      if (!Array.isArray(row.quantities)) continue;
      for (const q of row.quantities) {
        const n = Number(q);
        if (Number.isFinite(n) && n >= 0) sum += n;
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

  private validateAndNormalizeMaterialUsage(rows: CuttingMaterialUsageRow[]): {
    normalized: CuttingMaterialUsageRow[];
    fabricNetSum: number;
  } {
    const abnormalSet = new Set<string>(CUTTING_ABNORMAL_REASONS as unknown as string[]);
    let fabricNetSum = 0;
    const normalized: CuttingMaterialUsageRow[] = [];
    for (const r of rows) {
      const issued = Number(r.issuedMeters);
      const returned = Number(r.returnedMeters);
      const abnormal = Number(r.abnormalLossMeters);
      if (!Number.isFinite(issued) || issued < 0) throw new BadRequestException(`物料「${r.materialName}」本次领用米数须为非负数`);
      if (!Number.isFinite(returned) || returned < 0) throw new BadRequestException(`物料「${r.materialName}」退回米数须为非负数`);
      if (!Number.isFinite(abnormal) || abnormal < 0) throw new BadRequestException(`物料「${r.materialName}」异常损耗米数须为非负数`);
      if (returned > issued) throw new BadRequestException(`物料「${r.materialName}」退回米数不能大于本次领用米数`);
      const net = issued - returned;
      if (abnormal > net + 1e-9) throw new BadRequestException(`物料「${r.materialName}」异常损耗不能大于实际净耗米数（领用−退回）`);
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
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'pending_cutting') throw new NotFoundException('仅待裁床订单可完成登记');

    const rowsIn = Array.isArray(actualCutRows) ? actualCutRows : [];
    this.validateActualCutRows(rowsIn);
    const piecesGrand = this.sumActualCutPieces(rowsIn);
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const typeOptions = await this.systemOptionsService.findAllByType('material_types');
    const template = this.buildMaterialTemplateRows(ext?.materials ?? null, typeOptions);
    const mergedUsage = this.mergeMaterialUsageWithClient(template, body.materialUsage ?? null);
    const { normalized: materialNorm, fabricNetSum } = this.validateAndNormalizeMaterialUsage(mergedUsage);

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
      if (!Number.isFinite(unitNum) || unitNum < 0) throw new BadRequestException('裁剪单价须为非负数');
    }

    let totalNum: number;
    if (totalRaw != null) {
      totalNum = Number(totalRaw);
      if (!Number.isFinite(totalNum) || totalNum < 0) throw new BadRequestException('裁剪总成本须为非负数');
    } else if (legacyRaw != null && unitRaw == null) {
      totalNum = Number(legacyRaw);
      if (!Number.isFinite(totalNum) || totalNum < 0) throw new BadRequestException('裁剪成本须为非负数');
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
    if (!depNorm) throw new BadRequestException('请选择裁剪部门');
    if (depNorm === SELF && !cutterNorm) throw new BadRequestException('本厂裁床请选择裁剪人');

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
        (cutting as { cuttingDepartment?: string | null }).cuttingDepartment = depNorm || null;
        (cutting as { cutterName?: string | null }).cutterName = depNorm === SELF ? cutterNorm || null : null;
      }
      if (hasFabricCol) (cutting as { actualFabricMeters?: string | null }).actualFabricMeters = depNorm === SELF ? fabricNorm : null;
    } else {
      cutting.status = 'completed';
      cutting.arrivedAt = cutting.arrivedAt ?? arrivedAt;
      cutting.completedAt = now;
      cutting.cuttingCost = costNorm;
      cutting.actualCutRows = rowsIn.length ? rowsIn : null;
      if (hasColumns) {
        (cutting as { cuttingDepartment?: string | null }).cuttingDepartment = depNorm || null;
        (cutting as { cutterName?: string | null }).cutterName = depNorm === SELF ? cutterNorm || null : null;
      }
      if (hasFabricCol) (cutting as { actualFabricMeters?: string | null }).actualFabricMeters = depNorm === SELF ? fabricNorm : null;
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
      await this.appendStatusHistory(order.id, next);
    }
  }
}
