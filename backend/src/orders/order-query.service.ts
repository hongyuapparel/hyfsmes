import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository, SelectQueryBuilder } from 'typeorm';
import { Order } from '../entities/order.entity';
import {
  OrderExt,
  type OrderMaterialRow,
  type ColorSizeRow,
  type SizeInfoRow,
  type ProcessRow,
  type PackagingCell,
} from '../entities/order-ext.entity';
import { OrderOperationLog } from '../entities/order-operation-log.entity';
import { OrderRemark } from '../entities/order-remark.entity';
import { Product } from '../entities/product.entity';
import { OrderCostSnapshot } from '../entities/order-cost-snapshot.entity';
import { OrderCutting, type ActualCutRow } from '../entities/order-cutting.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { OrderFinishing } from '../entities/order-finishing.entity';
import { SystemOptionsService } from '../system-options/system-options.service';
import { OrderStatusService } from './order-status.service';
import { type OrderDetail, type OrderListQuery } from './order.types';

@Injectable()
export class OrderQueryService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(OrderOperationLog)
    private readonly orderLogRepo: Repository<OrderOperationLog>,
    @InjectRepository(OrderRemark)
    private readonly orderRemarkRepo: Repository<OrderRemark>,
    @InjectRepository(OrderCutting)
    private readonly orderCuttingRepo: Repository<OrderCutting>,
    @InjectRepository(OrderSewing)
    private readonly orderSewingRepo: Repository<OrderSewing>,
    @InjectRepository(OrderFinishing)
    private readonly orderFinishingRepo: Repository<OrderFinishing>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(OrderCostSnapshot)
    private readonly orderCostSnapshotRepo: Repository<OrderCostSnapshot>,
    private readonly systemOptionsService: SystemOptionsService,
    private readonly orderStatusService: OrderStatusService,
  ) {}

  private async enrichMaterialsWithOptionLabels(materials: OrderMaterialRow[]): Promise<OrderMaterialRow[]> {
    if (!materials.length) return materials;
    const [materialTypes, materialSources] = await Promise.all([
      this.systemOptionsService.findAllByType('material_types'),
      this.systemOptionsService.findAllByType('material_sources'),
    ]);
    const materialTypeMap = new Map(materialTypes.map((o) => [o.id, o.value]));
    const materialSourceMap = new Map(materialSources.map((o) => [o.id, o.value]));
    return materials.map((row) => ({
      ...row,
      materialType: row.materialTypeId != null ? (materialTypeMap.get(row.materialTypeId) ?? '') : '',
      materialSource: row.materialSourceId != null ? (materialSourceMap.get(row.materialSourceId) ?? '') : '',
    }));
  }

  private sumActualCut(rows: ActualCutRow[] | null | undefined): number | null {
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

  private async resolveOrderTypeFilterIds(orderTypeId: number): Promise<number[]> {
    const all = await this.systemOptionsService.findAllByType('order_types');
    if (!all.length) return [orderTypeId];
    const byParent = new Map<number, number[]>();
    for (const item of all) {
      if (item.parentId == null) continue;
      const list = byParent.get(item.parentId) ?? [];
      list.push(item.id);
      byParent.set(item.parentId, list);
    }
    const result = new Set<number>([orderTypeId]);
    const queue: number[] = [orderTypeId];
    while (queue.length) {
      const cur = queue.shift() as number;
      const children = byParent.get(cur) ?? [];
      for (const childId of children) {
        if (result.has(childId)) continue;
        result.add(childId);
        queue.push(childId);
      }
    }
    return Array.from(result);
  }

  /**
   * 解析"样品单"对应的订单类型 ID 集合：取顶级类目「样品」及其全部子孙节点。
   * 不按子项名称匹配，样品下子项（头版/修改版/产前版/拍照版/销售版等）增减改名均自动覆盖。
   */
  private async resolveSampleOrderTypeIds(): Promise<number[]> {
    const all = await this.systemOptionsService.findAllByType('order_types');
    if (!all.length) return [];
    const byParent = new Map<number, number[]>();
    for (const item of all) {
      if (item.parentId == null) continue;
      const list = byParent.get(item.parentId) ?? [];
      list.push(item.id);
      byParent.set(item.parentId, list);
    }
    const result = new Set<number>();
    const queue: number[] = all.filter((o) => o.parentId == null && (o.value ?? '').includes('样品')).map((o) => o.id);
    while (queue.length) {
      const cur = queue.shift() as number;
      if (result.has(cur)) continue;
      result.add(cur);
      for (const childId of byParent.get(cur) ?? []) queue.push(childId);
    }
    return Array.from(result);
  }

  private async applyListFilters(
    qb: SelectQueryBuilder<Order>,
    query: OrderListQuery,
    options?: { includeStatus?: boolean },
  ) {
    const {
      orderNo,
      skuCode,
      customer,
      processItem,
      salesperson,
      merchandiser,
      orderDateStart,
      orderDateEnd,
      completedStart,
      completedEnd,
      customerDueStart,
      customerDueEnd,
      factory,
      status,
      deletedOnly,
    } = query;
    const includeStatus = options?.includeStatus ?? true;

    if (deletedOnly) qb.andWhere('o.deleted_at IS NOT NULL');
    else qb.andWhere('o.deleted_at IS NULL');

    if (orderNo?.trim()) qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    if (skuCode?.trim()) qb.andWhere('o.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    if (customer?.trim()) qb.andWhere('o.customer_name LIKE :customer', { customer: `%${customer.trim()}%` });
    if (typeof query.orderTypeId === 'number') {
      const orderTypeIds = await this.resolveOrderTypeFilterIds(query.orderTypeId);
      qb.andWhere('o.order_type_id IN (:...orderTypeIds)', { orderTypeIds });
    }
    if (typeof query.collaborationTypeId === 'number') {
      qb.andWhere('o.collaboration_type_id = :collaborationTypeId', { collaborationTypeId: query.collaborationTypeId });
    }
    if (processItem?.trim()) qb.andWhere('o.process_item LIKE :processItem', { processItem: `%${processItem.trim()}%` });
    if (salesperson?.trim()) qb.andWhere('o.salesperson = :salesperson', { salesperson: salesperson.trim() });
    if (merchandiser?.trim()) qb.andWhere('o.merchandiser = :merchandiser', { merchandiser: merchandiser.trim() });
    if (factory?.trim()) qb.andWhere('o.factory_name LIKE :factory', { factory: `%${factory.trim()}%` });
    if (includeStatus && status?.trim()) qb.andWhere('o.status = :status', { status: status.trim() });
    if (orderDateStart) qb.andWhere('o.order_date >= :orderDateStart', { orderDateStart: `${orderDateStart} 00:00:00` });
    if (orderDateEnd) qb.andWhere('o.order_date <= :orderDateEnd', { orderDateEnd: `${orderDateEnd} 23:59:59` });
    if (completedStart || completedEnd) {
      qb.andWhere('o.status = :completedStatus', { completedStatus: 'completed' });
      if (completedStart) qb.andWhere('o.status_time >= :completedStart', { completedStart: `${completedStart} 00:00:00` });
      if (completedEnd) qb.andWhere('o.status_time <= :completedEnd', { completedEnd: `${completedEnd} 23:59:59` });
    }
    if (customerDueStart) {
      qb.andWhere('o.customer_due_date >= :customerDueStart', { customerDueStart: `${customerDueStart} 00:00:00` });
    }
    if (customerDueEnd) {
      qb.andWhere('o.customer_due_date <= :customerDueEnd', { customerDueEnd: `${customerDueEnd} 23:59:59` });
    }
    if (query.unquoted) {
      qb.andWhere('o.status = :unquotedCompleted', { unquotedCompleted: 'completed' });
      const sampleOrderTypeIds = await this.resolveSampleOrderTypeIds();
      if (sampleOrderTypeIds.length) {
        qb.andWhere('o.order_type_id IN (:...sampleOrderTypeIds)', { sampleOrderTypeIds });
      } else {
        qb.andWhere('1 = 0');
      }
      qb.andWhere(
        "NOT EXISTS (SELECT 1 FROM order_cost_snapshots ocs WHERE ocs.order_id = o.id AND JSON_EXTRACT(ocs.snapshot, '$.quoteConfirmedAt') IS NOT NULL)",
      );
    }
  }

  async findOne(id: number): Promise<OrderDetail> {
    const order = await this.orderRepo.findOne({ where: { id, deletedAt: IsNull() } });
    if (!order) throw new NotFoundException('订单不存在');

    const ext = await this.orderExtRepo.findOne({ where: { orderId: id } });
    const rawMaterials = ext?.materials ?? [];
    const materials = await this.enrichMaterialsWithOptionLabels(rawMaterials);
    const colorSizeHeaders = ext?.colorSizeHeaders ?? [];
    const colorSizeRows = ext?.colorSizeRows ?? [];
    const sizeInfoMetaHeaders = ext?.sizeInfoMetaHeaders ?? [];
    const sizeInfoRows = ext?.sizeInfoRows ?? [];
    const processItems = ext?.processItems ?? [];
    const revisionNotes = ext?.revisionNotes ?? '';
    const productionRequirement = ext?.productionRequirement ?? '';
    const packagingHeaders = ext?.packagingHeaders ?? [];
    const packagingCells = ext?.packagingCells ?? [];
    const packagingMethod = ext?.packagingMethod ?? '';
    const attachments = ext?.attachments ?? [];
    const skuCode = String(order.skuCode ?? '').trim();
    let productGroupId: number | null = null;
    let productGroupName = '';
    let applicablePeopleId: number | null = null;
    let applicablePeopleName = '';
    if (skuCode) {
      const product = await this.productRepo.findOne({ where: { skuCode } });
      if (product) {
        productGroupId = product.productGroupId ?? null;
        applicablePeopleId = product.applicablePeopleId ?? null;
        if (productGroupId != null) {
          productGroupName = await this.systemOptionsService.getProductGroupPathById(productGroupId);
        }
        if (applicablePeopleId != null) {
          const labelMap = await this.systemOptionsService.getOptionLabelsByIds('applicable_people', [applicablePeopleId]);
          applicablePeopleName = labelMap[applicablePeopleId] ?? '';
        }
      }
    }
    return {
      ...order,
      materials,
      colorSizeHeaders,
      colorSizeRows,
      sizeInfoMetaHeaders,
      sizeInfoRows,
      processItems,
      revisionNotes,
      productionRequirement,
      packagingHeaders,
      packagingCells,
      packagingMethod,
      attachments,
      productGroupId,
      productGroupName,
      applicablePeopleId,
      applicablePeopleName,
    };
  }

  async findAll(query: OrderListQuery, actorUserId?: number) {
    void actorUserId;
    const { page = 1, pageSize = 20 } = query;
    const qb = this.orderRepo.createQueryBuilder('o');
    await this.applyListFilters(qb, query, { includeStatus: true });
    qb.orderBy('o.id', 'DESC');

    const total = await qb.getCount();
    const totalQuantityRaw = await qb
      .clone()
      .select('COALESCE(SUM(o.quantity), 0)', 'totalQuantity')
      .getRawOne<{ totalQuantity?: string | number }>();
    const totalQuantity = Number(totalQuantityRaw?.totalQuantity ?? 0) || 0;
    const list = await qb.skip((page - 1) * pageSize).take(pageSize).getMany();

    const ids = list.map((o) => o.id);
    const remarkCountMap: Record<number, number> = {};
    const cutTotalMap: Record<number, number | null> = {};
    const sewingQtyMap: Record<number, number | null> = {};
    const tailReceivedMap: Record<number, number | null> = {};
    const tailShippedMap: Record<number, number | null> = {};

    if (ids.length > 0) {
      const [remarkRows, cuttings, sewings, finishings] = await Promise.all([
        this.orderRemarkRepo
          .createQueryBuilder('r')
          .select('r.order_id', 'orderId')
          .addSelect('COUNT(1)', 'count')
          .where('r.order_id IN (:...ids)', { ids })
          .groupBy('r.order_id')
          .getRawMany<{ orderId: number; count: string }>(),
        this.orderCuttingRepo.find({ where: { orderId: In(ids) }, select: ['orderId', 'actualCutRows'] }),
        this.orderSewingRepo.find({ where: { orderId: In(ids) }, select: ['orderId', 'sewingQuantity'] }),
        this.orderFinishingRepo.find({
          where: { orderId: In(ids) },
          select: ['orderId', 'tailReceivedQty', 'tailShippedQty'],
        }),
      ]);
      remarkRows.forEach((r) => {
        remarkCountMap[r.orderId] = Number(r.count) || 0;
      });
      cuttings.forEach((c) => {
        cutTotalMap[c.orderId] = this.sumActualCut(c.actualCutRows);
      });
      sewings.forEach((s) => {
        sewingQtyMap[s.orderId] = s.sewingQuantity ?? null;
      });
      finishings.forEach((f) => {
        tailReceivedMap[f.orderId] = f.tailReceivedQty ?? null;
        tailShippedMap[f.orderId] = f.tailShippedQty ?? null;
      });
    }

    const listWithCount = list.map((o) => ({
      ...o,
      remarkCount: remarkCountMap[o.id] ?? 0,
      actualCutTotal: cutTotalMap[o.id] ?? null,
      sewingQuantity: sewingQtyMap[o.id] ?? null,
      tailReceivedQty: tailReceivedMap[o.id] ?? null,
      tailShippedQty: tailShippedMap[o.id] ?? null,
    }));
    return { list: listWithCount, total, totalQuantity, page, pageSize };
  }

  async countByStatus(query: OrderListQuery, actorUserId?: number) {
    void actorUserId;
    const baseQuery = { ...query, page: undefined, pageSize: undefined };
    const groupQb = this.orderRepo.createQueryBuilder('o');
    await this.applyListFilters(groupQb, baseQuery, { includeStatus: false });
    const rows = await groupQb
      .select('o.status', 'status')
      .addSelect('COUNT(1)', 'count')
      .groupBy('o.status')
      .getRawMany<{ status: string; count: string }>();
    const byStatus: Record<string, number> = {};
    let total = 0;
    rows.forEach((r) => {
      const key = r?.status ?? '';
      if (!key) return;
      const count = Number.isNaN(Number(r.count)) ? 0 : Number(r.count);
      byStatus[key] = count;
      total += count;
    });
    return { total, byStatus };
  }

  private normColorNameForBreakdown(s: unknown): string {
    return String(s ?? '').trim();
  }

  private orderRowFromColorSizeRow(row: ColorSizeRow, sizeLen: number): number[] {
    const q = Array.isArray(row?.quantities) ? row.quantities : [];
    const sizes = Array.from({ length: sizeLen }, (_, i) => Math.max(0, Number(q[i]) || 0));
    const tot = sizes.reduce((a, b) => a + b, 0);
    return [...sizes, tot];
  }

  private cutRowForColor(colorName: string, actualCutRows: ActualCutRow[] | null | undefined, sizeLen: number): number[] | null {
    if (!actualCutRows?.length) return null;
    const target = this.normColorNameForBreakdown(colorName);
    const matching = actualCutRows.filter((r) => this.normColorNameForBreakdown(r.colorName) === target);
    if (!matching.length) return null;
    const sums = Array(sizeLen).fill(0) as number[];
    for (const r of matching) {
      const q = Array.isArray(r.quantities) ? r.quantities : [];
      for (let i = 0; i < sizeLen; i++) sums[i] += Math.max(0, Number(q[i]) || 0);
    }
    const tot = sums.reduce((a, b) => a + b, 0);
    return [...sums, tot];
  }

  private allocateAggByOrderColumns(
    agg: (number | null)[] | null,
    orderC: number[],
    orderAll: number[],
  ): (number | null)[] | null {
    if (!agg || orderC.length !== agg.length || orderAll.length !== agg.length) return null;
    const L = orderC.length;
    const sizeLen = L - 1;
    const out: (number | null)[] = [];
    for (let i = 0; i < sizeLen; i++) {
      const a = agg[i];
      if (a == null) {
        out.push(null);
        continue;
      }
      const oc = Number(orderC[i]) || 0;
      const oa = Number(orderAll[i]) || 0;
      if (oa > 0) out.push(Math.round((Number(a) * oc) / oa));
      else out.push(null);
    }
    const hasAnyPerSize = out.some((v) => v != null);
    if (!hasAnyPerSize) out.push(null);
    else out.push(out.reduce((sum: number, v) => sum + (Number(v) || 0), 0));
    return out;
  }

  async getSizeBreakdown(orderId: number) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');

    const [ext, cutting, sewing, finishing] = await Promise.all([
      this.orderExtRepo.findOne({ where: { orderId } }),
      this.orderCuttingRepo.findOne({ where: { orderId } }),
      this.orderSewingRepo.findOne({ where: { orderId } }),
      this.orderFinishingRepo.findOne({ where: { orderId } }),
    ]);

    const headers = Array.isArray(ext?.colorSizeHeaders) && ext.colorSizeHeaders.length > 0 ? [...ext.colorSizeHeaders, '合计'] : ['合计'];
    const sizeLen = Math.max(0, headers.length - 1);
    const buildPerSizeFromRows = (rows: ColorSizeRow[] | ActualCutRow[] | null | undefined): number[] | null => {
      if (!rows || rows.length === 0 || headers.length <= 1) return null;
      const sLen = headers.length - 1;
      const sums = Array(sLen).fill(0) as number[];
      rows.forEach((row: ColorSizeRow | ActualCutRow) => {
        if (!Array.isArray(row.quantities)) return;
        row.quantities.forEach((q: number, idx: number) => {
          if (idx >= sLen) return;
          const n = Number(q);
          if (!Number.isNaN(n)) sums[idx] += n;
        });
      });
      const total = sums.reduce((a, b) => a + b, 0);
      return [...sums, total];
    };

    const orderPerSize = buildPerSizeFromRows(ext?.colorSizeRows ?? null);
    const cutPerSize = buildPerSizeFromRows(cutting?.actualCutRows ?? null);

    let sewingRow: (number | null)[] | null = null;
    const sewingQtyRow = sewing?.sewingQuantityRow ?? null;
    const sewingTotal = sewing?.sewingQuantity ?? null;
    if (headers.length === 1) {
      if (sewingTotal != null) sewingRow = [sewingTotal];
    } else if (Array.isArray(sewingQtyRow) && sewingQtyRow.length > 0) {
      const perSize: (number | null)[] = Array.from({ length: sizeLen }, (_, i) => {
        const v = sewingQtyRow[i];
        return typeof v === 'number' && Number.isFinite(v) ? v : null;
      });
      const total = perSize.reduce((sum: number, v) => sum + (Number(v) || 0), 0);
      sewingRow = [...perSize, total];
    } else if (sewingTotal != null) {
      sewingRow = [...Array(sizeLen).fill(null), sewingTotal];
    }

    // 严格"以系统填写为准"：不再用 fin.tailInboundQty / fin.defectQuantity 标量
    // 按 tail_received_qty_row 比例兜底估算尾部入库数 / 次品数的尺码分布。
    // 真值（tail_inbound_quantities_by_color / defect_quantities_by_color）存在
    // 时由下方真值优先路径补行；不存在则该行不出现在结果中。

    const rows: Array<{ label: string; values: (number | null)[] }> = [];
    if (orderPerSize) rows.push({ label: '订单数量', values: orderPerSize });
    if (cutPerSize) rows.push({ label: '裁床数量', values: cutPerSize });
    if (sewingRow) rows.push({ label: '车缝数量', values: sewingRow });

    const colorSizeRowsList = Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : [];
    let orderAllNumeric: number[] = [];
    if (orderPerSize && orderPerSize.length === headers.length) {
      orderAllNumeric = orderPerSize.map((x) => Number(x) || 0);
    } else {
      orderAllNumeric = Array(headers.length).fill(0);
      for (const cr of colorSizeRowsList) {
        const r = this.orderRowFromColorSizeRow(cr, sizeLen);
        for (let i = 0; i < r.length; i++) orderAllNumeric[i] += r[i];
      }
    }
    // === 真值优先：读 *_by_color 三个字段（select=false，需原生 SQL） ===
    const fetchByColorTruth = async (
      repo: { query: (sql: string, params: unknown[]) => Promise<unknown> },
      table: string,
      column: string,
    ): Promise<Map<string, number[]> | null> => {
      try {
        const rs = await repo.query(`SELECT \`${column}\` AS value FROM \`${table}\` WHERE order_id = ? LIMIT 1`, [orderId]);
        const raw = Array.isArray(rs) && rs.length > 0 ? (rs[0] as { value?: unknown }).value : null;
        if (raw == null) return null;
        let parsed: unknown = raw;
        if (typeof raw === 'string') {
          try { parsed = JSON.parse(raw); } catch { return null; }
        }
        if (!Array.isArray(parsed) || parsed.length === 0) return null;
        const m = new Map<string, number[]>();
        for (const r of parsed as Array<{ colorName?: string; quantities?: unknown }>) {
          const name = this.normColorNameForBreakdown(r?.colorName);
          const q = Array.isArray(r?.quantities) ? (r.quantities as unknown[]) : [];
          const filled = Array.from({ length: sizeLen }, (_, i) => Math.max(0, Math.trunc(Number(q[i]) || 0)));
          if (m.has(name)) {
            const prev = m.get(name)!;
            for (let i = 0; i < sizeLen; i++) prev[i] += filled[i];
          } else {
            m.set(name, filled);
          }
        }
        return m;
      } catch {
        return null;
      }
    };
    const [sewingByColorMap, receivedByColorMap, inboundByColorMap, defectByColorMap] = await Promise.all([
      fetchByColorTruth(this.orderSewingRepo, 'order_sewing', 'sewing_quantities_by_color'),
      fetchByColorTruth(this.orderFinishingRepo, 'order_finishing', 'tail_received_quantities_by_color'),
      fetchByColorTruth(this.orderFinishingRepo, 'order_finishing', 'tail_inbound_quantities_by_color'),
      fetchByColorTruth(this.orderFinishingRepo, 'order_finishing', 'defect_quantities_by_color'),
    ]);

    // 真值优先时，把聚合行也按真值之和重算（避免读到老的 sewingQuantityRow 一维与新二维不一致）
    if (sewingByColorMap && sizeLen > 0) {
      const sums = Array(sizeLen).fill(0) as number[];
      for (const q of sewingByColorMap.values()) {
        for (let i = 0; i < sizeLen; i++) sums[i] += q[i] || 0;
      }
      const total = sums.reduce((a, b) => a + b, 0);
      const sewingRowAgg: (number | null)[] = [...sums, total];
      const idx = rows.findIndex((r) => r.label === '车缝数量');
      if (idx >= 0) rows[idx].values = sewingRowAgg;
      else rows.push({ label: '车缝数量', values: sewingRowAgg });
    }
    if (receivedByColorMap && sizeLen > 0) {
      const sums = Array(sizeLen).fill(0) as number[];
      for (const q of receivedByColorMap.values()) {
        for (let i = 0; i < sizeLen; i++) sums[i] += q[i] || 0;
      }
      const total = sums.reduce((a, b) => a + b, 0);
      const receivedRowAgg: (number | null)[] = [...sums, total];
      const idx = rows.findIndex((r) => r.label === '尾部收货数');
      if (idx >= 0) rows[idx].values = receivedRowAgg;
      else rows.push({ label: '尾部收货数', values: receivedRowAgg });
    }
    if (inboundByColorMap && sizeLen > 0) {
      const sums = Array(sizeLen).fill(0) as number[];
      for (const q of inboundByColorMap.values()) {
        for (let i = 0; i < sizeLen; i++) sums[i] += q[i] || 0;
      }
      const total = sums.reduce((a, b) => a + b, 0);
      const inboundRowAgg: (number | null)[] = [...sums, total];
      const idx = rows.findIndex((r) => r.label === '尾部入库数');
      if (idx >= 0) rows[idx].values = inboundRowAgg;
      else rows.push({ label: '尾部入库数', values: inboundRowAgg });
    }
    if (defectByColorMap && sizeLen > 0) {
      const sums = Array(sizeLen).fill(0) as number[];
      for (const q of defectByColorMap.values()) {
        for (let i = 0; i < sizeLen; i++) sums[i] += q[i] || 0;
      }
      const total = sums.reduce((a, b) => a + b, 0);
      const defectRowAgg: (number | null)[] = [...sums, total];
      const idx = rows.findIndex((r) => r.label === '次品数');
      if (idx >= 0) rows[idx].values = defectRowAgg;
      else rows.push({ label: '次品数', values: defectRowAgg });
    }

    const byColor: Array<{ colorName: string; rows: Array<{ label: string; values: (number | null)[] }> }> = [];
    if (!colorSizeRowsList.length) {
      byColor.push({ colorName: '-', rows: rows.map((r) => ({ label: r.label, values: [...r.values] })) });
    } else {
      for (const cr of colorSizeRowsList) {
        const displayName = this.normColorNameForBreakdown(cr?.colorName) || '-';
        const orderC = this.orderRowFromColorSizeRow(cr, sizeLen);
        // 裁床：actualCutRows 本身按颜色分行的真值；缺该色就不输出本色裁床行（不再按订单计划比例分摊）
        const cutExact = this.cutRowForColor(this.normColorNameForBreakdown(cr?.colorName), cutting?.actualCutRows ?? null, sizeLen);
        const cutVals: (number | null)[] | null = cutExact ? cutExact.map((x) => x) : null;

        // 车缝：严格真值（sewing_quantities_by_color），没真值不输出本色车缝行
        let sewVals: (number | null)[] | null = null;
        const sewTruth = sewingByColorMap?.get(displayName);
        if (sewTruth && sizeLen > 0) {
          const total = sewTruth.reduce((a, b) => a + (Number(b) || 0), 0);
          sewVals = [...sewTruth.map((n) => Number(n)), total];
        }

        // 尾部收货：严格真值，没真值不输出本色尾部收货行
        let recVals: (number | null)[] | null = null;
        const recTruth = receivedByColorMap?.get(displayName);
        if (recTruth && sizeLen > 0) {
          const total = recTruth.reduce((a, b) => a + (Number(b) || 0), 0);
          recVals = [...recTruth.map((n) => Number(n)), total];
        }

        // 尾部入库：严格真值，没真值不输出本色尾部入库行
        let inbVals: (number | null)[] | null = null;
        const inbTruth = inboundByColorMap?.get(displayName);
        if (inbTruth && sizeLen > 0) {
          const total = inbTruth.reduce((a, b) => a + (Number(b) || 0), 0);
          inbVals = [...inbTruth.map((n) => Number(n)), total];
        }

        // 次品：严格真值，没真值不输出本色次品行
        let defVals: (number | null)[] | null = null;
        const defTruth = defectByColorMap?.get(displayName);
        if (defTruth && sizeLen > 0) {
          const total = defTruth.reduce((a, b) => a + (Number(b) || 0), 0);
          defVals = [...defTruth.map((n) => Number(n)), total];
        }

        const blockRows: Array<{ label: string; values: (number | null)[] }> = [];
        blockRows.push({ label: '订单数量', values: orderC.map((x) => x) });
        if (cutVals) blockRows.push({ label: '裁床数量', values: cutVals });
        if (sewVals) blockRows.push({ label: '车缝数量', values: sewVals });
        if (recVals) blockRows.push({ label: '尾部收货数', values: recVals });
        if (inbVals) blockRows.push({ label: '尾部入库数', values: inbVals });
        if (defVals) blockRows.push({ label: '次品数', values: defVals });
        byColor.push({ colorName: displayName, rows: blockRows });
      }
    }
    return { headers, rows, byColor };
  }

  async getColorSizeBreakdown(orderId: number): Promise<{ headers: string[]; rows: Array<{ colorName: string; values: number[] }> }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const headers = Array.isArray(ext?.colorSizeHeaders) && ext.colorSizeHeaders.length > 0 ? ext.colorSizeHeaders : [];
    const baseRows = Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : [];
    if (!headers.length || !baseRows.length) return { headers: [], rows: [] };
    const rows = baseRows.map((r: ColorSizeRow) => {
      const quantities = Array.isArray(r?.quantities) ? r.quantities : [];
      const values = headers.map((_, idx) => Math.max(0, Number(quantities[idx]) || 0));
      const total = values.reduce((a, b) => a + b, 0);
      return { colorName: String(r?.colorName ?? ''), values: [...values, total] };
    });
    return { headers: [...headers, '合计'], rows };
  }

  async getLogs(orderId: number) {
    const logs = await this.orderLogRepo.find({ where: { orderId }, order: { createdAt: 'DESC' } });
    return logs.map((log) => ({ ...log, detail: this.orderStatusService.formatLogDetail(log.detail) }));
  }

  async getOperationLogs(
    orderId: number,
    module?: string | null,
    targetType?: string | null,
    targetRef?: string | null,
  ): Promise<OrderOperationLog[]> {
    const qb = this.orderLogRepo
      .createQueryBuilder('log')
      .where('log.orderId = :orderId', { orderId });
    if (module) {
      qb.andWhere('log.action LIKE :prefix', { prefix: `${module}_%` });
    }
    if (targetType) {
      qb.andWhere('log.targetType = :targetType', { targetType });
    }
    if (targetRef) {
      qb.andWhere('log.targetRef = :targetRef', { targetRef });
    }
    return qb.orderBy('log.createdAt', 'DESC').limit(200).getMany();
  }

  async getRemarks(orderId: number) {
    await this.findOne(orderId);
    return this.orderRemarkRepo.find({ where: { orderId }, order: { createdAt: 'DESC' } });
  }

  private normalizeProfitMargin(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n < 0) return 0.1;
    if (Math.abs(n - 0.15) < 1e-9) return 0.1;
    return n;
  }

  async getCostSnapshot(orderId: number): Promise<OrderCostSnapshot | null> {
    await this.findOne(orderId);
    const row = await this.orderCostSnapshotRepo.findOne({ where: { orderId } });
    if (row?.snapshot && typeof row.snapshot === 'object') {
      const snapshot = row.snapshot as Record<string, unknown>;
      const normalized = this.normalizeProfitMargin(snapshot.profitMargin);
      const current = typeof snapshot.profitMargin === 'number' ? snapshot.profitMargin : Number(snapshot.profitMargin);
      if (!Number.isFinite(current) || Math.abs(current - normalized) > 1e-9) {
        row.snapshot = { ...snapshot, profitMargin: normalized };
        await this.orderCostSnapshotRepo.save(row);
      }
    }
    return row ?? null;
  }
}
