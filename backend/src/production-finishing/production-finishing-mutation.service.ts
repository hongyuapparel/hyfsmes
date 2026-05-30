import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderFinishing } from '../entities/order-finishing.entity';
import { InboundPending } from '../entities/inbound-pending.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { User } from '../entities/user.entity';
import { OrderOperationLog } from '../entities/order-operation-log.entity';
import { resolveOperatorDisplayName } from '../common/operator.util';
import {
  type ColorSizeQuantityRow,
  assertColorRowsShape,
  normalizeColorRows,
  sumColorRows,
  sumColorRowsBySize,
  addColorRows,
} from '../common/color-size-row.util';

@Injectable()
export class ProductionFinishingMutationService {
  private hasTailReceivedQtyRowColumn: boolean | null = null;
  private hasPackagingQtyRowColumns: boolean | null = null;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderFinishing)
    private readonly finishingRepo: Repository<OrderFinishing>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(InboundPending)
    private readonly inboundPendingRepo: Repository<InboundPending>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(OrderOperationLog)
    private readonly orderLogRepo: Repository<OrderOperationLog>,
    private readonly orderWorkflowService: OrderWorkflowService,
  ) {}

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

  /**
   * 读取 `order_finishing` 表中某个 JSON 数字数组列（按尺码细数行）。
   * column 为代码内固定字面量（非外部输入），无注入风险。
   */
  private async fetchJsonNumberRow(orderId: number, column: string): Promise<number[] | null> {
    try {
      const rows = await this.finishingRepo.query(
        `SELECT \`${column}\` AS value FROM \`order_finishing\` WHERE order_id = ? LIMIT 1`,
        [orderId],
      );
      const raw = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { value?: unknown }).value : null;
      if (raw == null) return null;
      if (Array.isArray(raw)) return raw as number[];
      if (typeof raw === 'string') {
        const parsed: unknown = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as number[]) : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async fetchTailReceivedQtyRow(orderId: number): Promise<number[] | null> {
    if (!(await this.hasTailReceivedQtyRow())) return null;
    return this.fetchJsonNumberRow(orderId, 'tail_received_qty_row');
  }

  private async fetchTailInboundQtyRow(orderId: number): Promise<number[] | null> {
    if (!(await this.hasPackagingQtyRows())) return null;
    return this.fetchJsonNumberRow(orderId, 'tail_inbound_qty_row');
  }

  private async fetchDefectQuantityRow(orderId: number): Promise<number[] | null> {
    if (!(await this.hasPackagingQtyRows())) return null;
    return this.fetchJsonNumberRow(orderId, 'defect_quantity_row');
  }

  /**
   * 读取 order_finishing 表中某个 JSON 颜色×尺码列（如 tail_inbound_quantities_by_color）。
   * column 为代码内固定字面量。列不存在或为 null 时返回 null。
   */
  private async fetchJsonColorRows(orderId: number, column: string): Promise<ColorSizeQuantityRow[] | null> {
    try {
      const rows = await this.finishingRepo.query(
        `SELECT \`${column}\` AS value FROM \`order_finishing\` WHERE order_id = ? LIMIT 1`,
        [orderId],
      );
      const raw = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { value?: unknown }).value : null;
      if (raw == null) return null;
      let parsed: unknown = raw;
      if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch { return null; }
      }
      if (!Array.isArray(parsed)) return null;
      return (parsed as Array<{ colorName?: string; quantities?: unknown }>).map((r) => ({
        colorName: String(r?.colorName ?? '').trim(),
        quantities: Array.isArray(r?.quantities) ? (r.quantities as unknown[]).map((n) => Math.max(0, Math.trunc(Number(n) || 0))) : [],
      }));
    } catch {
      return null;
    }
  }

  /** 取该订单下一个批次序号；现有最大值 + 1，从 1 起算 */
  private async nextBatchNo(orderId: number): Promise<number> {
    const rows = await this.inboundPendingRepo.query(
      'SELECT COALESCE(MAX(batch_no), 0) AS m FROM inbound_pending WHERE order_id = ?',
      [orderId],
    );
    const max = Number((rows as { m?: number | string }[])?.[0]?.m ?? 0) || 0;
    return max + 1;
  }

  private async assertCanAmendPackagingPending(orderId: number, finishing: OrderFinishing): Promise<void> {
    const all = await this.inboundPendingRepo.find({ where: { orderId } });
    const hasCompleted = all.some((p) => (p.status ?? '') === 'completed');
    if (hasCompleted) {
      throw new BadRequestException(
        '该订单已有待仓记录完成入库或发货，无法在尾部修改入库/次品数量，请通过仓库库存或业务单据调整。',
      );
    }
    const pendingList = all.filter((p) => (p.status ?? 'pending') === 'pending');
    const expectedTotal = (Number(finishing.tailInboundQty) || 0) + (Number(finishing.defectQuantity) || 0);
    const pendingSum = pendingList.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    if (pendingList.length > 0 && pendingSum !== expectedTotal) {
      throw new BadRequestException('待仓处理数量与当前登记不一致（可能已在仓库部分处理），无法在尾部修改。');
    }
    if (pendingList.length === 0 && expectedTotal > 0) {
      throw new BadRequestException('未找到可调整的待仓记录，可能已全部完成入库；无法在尾部修改。');
    }
  }

  async registerReceive(
    orderId: number,
    tailReceivedQty: number,
    tailReceivedQuantities?: number[] | null,
    tailReceivedQuantitiesByColor?: ColorSizeQuantityRow[] | null,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'pending_finishing') throw new NotFoundException('仅待尾部订单可登记收货');
    const existing = await this.finishingRepo.findOne({ where: { orderId } });
    if (existing) throw new NotFoundException('该订单已登记收货，请到「尾部」tab 登记包装完成');

    const now = new Date();
    const arrivedAt = order.statusTime ?? now;
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const sizeHeaders = Array.isArray(ext?.colorSizeHeaders) ? ext.colorSizeHeaders : [];
    const headers = sizeHeaders.length > 0 ? [...sizeHeaders, '合计'] : ['合计'];
    const sizeCount = sizeHeaders.length || 1;
    const planColors = (Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : []).map((r) => String(r?.colorName ?? '').trim());

    // 真值优先 byColor → 一维 → 单总数（仅单色或无尺码订单）
    let byColor: ColorSizeQuantityRow[] | null = null;
    let normalizedTotal: number;
    let tailReceivedQtyRow: number[] | null = null;

    if (Array.isArray(tailReceivedQuantitiesByColor) && tailReceivedQuantitiesByColor.length > 0 && sizeHeaders.length > 0) {
      byColor = normalizeColorRows(tailReceivedQuantitiesByColor, sizeHeaders.length);
      if (planColors.length > 0) assertColorRowsShape(byColor, planColors, sizeHeaders.length);
      const perSize = sumColorRowsBySize(byColor, sizeHeaders.length);
      normalizedTotal = sumColorRows(byColor);
      tailReceivedQtyRow = [...perSize, normalizedTotal];
      if (normalizedTotal !== (Number(tailReceivedQty) || 0)) {
        throw new BadRequestException(`尾部收货数合计(${normalizedTotal})须等于尾部收货数(${Number(tailReceivedQty) || 0})`);
      }
    } else {
      normalizedTotal = Number(tailReceivedQty) || 0;
      if (normalizedTotal <= 0) throw new NotFoundException('请填写尾部收货数');
      if (planColors.length > 1 && sizeHeaders.length > 0) {
        throw new BadRequestException('多色订单必须按颜色×尺码填写尾部收货数');
      }
      if (Array.isArray(tailReceivedQuantities) && tailReceivedQuantities.length) {
        const perSize = tailReceivedQuantities.slice(0, sizeCount).map((v) => Math.max(0, Number(v) || 0));
        while (perSize.length < sizeCount) perSize.push(0);
        const total = perSize.reduce((a, b) => a + b, 0);
        tailReceivedQtyRow = headers.length === 1 ? [normalizedTotal] : [...perSize, total];
        if (total !== normalizedTotal) {
          throw new NotFoundException(`尾部收货数合计(${total})须等于尾部收货数(${normalizedTotal})`);
        }
        // 单色订单：把一维兜底为单色二维
        if (planColors.length === 1 && sizeHeaders.length > 0) {
          byColor = [{ colorName: planColors[0], quantities: perSize }];
        }
      } else {
        tailReceivedQtyRow = headers.length === 1 ? [normalizedTotal] : [...Array(sizeCount).fill(0), normalizedTotal];
      }
    }

    const canSaveRow = await this.hasTailReceivedQtyRow();
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
    const finishing = this.finishingRepo.create(payload);
    await this.finishingRepo.save(finishing);

    // tail_received_qty_row / tail_received_quantities_by_color 都是 select:false JSON 列，
    // typeorm save 不会写入。raw UPDATE 显式落库（保留用户填的按颜色×尺码真值）。
    await this.finishingRepo.manager.query(
      `UPDATE order_finishing SET
        tail_received_qty_row = ?,
        tail_received_quantities_by_color = ?
      WHERE order_id = ?`,
      [
        tailReceivedQtyRow ? JSON.stringify(tailReceivedQtyRow) : null,
        byColor ? JSON.stringify(byColor) : null,
        orderId,
      ],
    );
  }

  async registerPackagingComplete(
    orderId: number,
    mode: 'partial' | 'full',
    tailInboundQtyThisBatch: number,
    defectQuantityThisBatch: number,
    remark?: string | null,
    actorUserId?: number,
    actorUsername?: string,
    tailInboundQuantitiesThisBatch?: number[] | null,
    defectQuantitiesThisBatch?: number[] | null,
    tailInboundQuantitiesThisBatchByColor?: ColorSizeQuantityRow[] | null,
    defectQuantitiesThisBatchByColor?: ColorSizeQuantityRow[] | null,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) throw new NotFoundException('请先登记收货');

    const received = Number(finishing.tailReceivedQty) || 0;
    if (received <= 0) throw new NotFoundException('尾部收货数无效，请先登记收货');

    const alreadyInbound = Number(finishing.tailInboundQty) || 0;
    const alreadyDefect = Number(finishing.defectQuantity) || 0;
    const remaining = received - alreadyInbound - alreadyDefect;

    // 已完成订单（status='inbound'）走 amend 分支，沿用旧语义
    if (finishing.status === 'inbound') {
      await this.amendPackagingComplete(
        order,
        finishing,
        tailInboundQtyThisBatch,
        defectQuantityThisBatch,
        remark,
        tailInboundQuantitiesThisBatch,
        defectQuantitiesThisBatch,
        tailInboundQuantitiesThisBatchByColor,
        defectQuantitiesThisBatchByColor,
      );
      return;
    }

    if (finishing.status !== 'pending_assign') {
      throw new BadRequestException('仅「待登记包装」或「尾部完成且待仓未处理」的订单可操作');
    }

    const inboundThis = Number(tailInboundQtyThisBatch) || 0;
    const defectThis = Number(defectQuantityThisBatch) || 0;
    if (inboundThis < 0 || defectThis < 0) {
      throw new BadRequestException('入库数 / 次品数不可为负');
    }
    const sumThis = inboundThis + defectThis;
    if (sumThis <= 0) throw new BadRequestException('本次入库数 + 次品数必须大于 0');
    if (sumThis > remaining) {
      throw new BadRequestException(`本次入库数 + 次品数(${sumThis}) 超过剩余可登记数(${remaining})`);
    }
    if (mode === 'full' && sumThis !== remaining) {
      throw new BadRequestException(`「全部入库」需要填满剩余 ${remaining} 件，当前差 ${remaining - sumThis} 件`);
    }

    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const sizeHeaders = Array.isArray(ext?.colorSizeHeaders) ? ext.colorSizeHeaders : [];
    const headers = sizeHeaders.length > 0 ? [...sizeHeaders, '合计'] : ['合计'];
    const sizeCount = sizeHeaders.length || 1;
    const planColors = (Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : []).map((r) => String(r?.colorName ?? '').trim());

    // === byColor 真值优先 ===
    let inboundThisByColor: ColorSizeQuantityRow[] | null = null;
    let defectThisByColor: ColorSizeQuantityRow[] | null = null;
    // 提升到外层：transaction 内 raw UPDATE 需要访问最终待写入 DB 的 JSON 值
    // （entity 上 select:false 的 JSON 列经 typeorm save 不会真正落库，必须 raw 写）
    let mergedInboundByColorOut: ColorSizeQuantityRow[] | null = null;
    let mergedDefectByColorOut: ColorSizeQuantityRow[] | null = null;
    let tailInboundQtyRowOut: number[] | null = null;
    let defectQuantityRowOut: number[] | null = null;
    if (
      sizeHeaders.length > 0 &&
      Array.isArray(tailInboundQuantitiesThisBatchByColor) &&
      Array.isArray(defectQuantitiesThisBatchByColor)
    ) {
      inboundThisByColor = normalizeColorRows(tailInboundQuantitiesThisBatchByColor, sizeHeaders.length);
      defectThisByColor = normalizeColorRows(defectQuantitiesThisBatchByColor, sizeHeaders.length);
      if (planColors.length > 0) {
        assertColorRowsShape(inboundThisByColor, planColors, sizeHeaders.length);
        assertColorRowsShape(defectThisByColor, planColors, sizeHeaders.length);
      }
      const sumIn = sumColorRows(inboundThisByColor);
      const sumDef = sumColorRows(defectThisByColor);
      if (sumIn !== inboundThis || sumDef !== defectThis) {
        throw new BadRequestException(`按颜色×尺码填写的合计(入库 ${sumIn} / 次品 ${sumDef})与本次汇总(入库 ${inboundThis} / 次品 ${defectThis})不一致`);
      }
    } else if (planColors.length > 1 && sizeHeaders.length > 0) {
      throw new BadRequestException('多色订单必须按颜色×尺码填写本次入库/次品数');
    }

    // === 累加：写 byColor 真值字段 + 兼容写一维 row 与标量 ===
    if (inboundThisByColor && defectThisByColor) {
      const oldInboundByColor = await this.fetchJsonColorRows(orderId, 'tail_inbound_quantities_by_color');
      const oldDefectByColor = await this.fetchJsonColorRows(orderId, 'defect_quantities_by_color');
      const mergedInboundByColor = addColorRows(oldInboundByColor, inboundThisByColor, planColors, sizeHeaders.length);
      const mergedDefectByColor = addColorRows(oldDefectByColor, defectThisByColor, planColors, sizeHeaders.length);
      (finishing as { tailInboundQuantitiesByColor?: ColorSizeQuantityRow[] | null }).tailInboundQuantitiesByColor = mergedInboundByColor;
      (finishing as { defectQuantitiesByColor?: ColorSizeQuantityRow[] | null }).defectQuantitiesByColor = mergedDefectByColor;
      mergedInboundByColorOut = mergedInboundByColor;
      mergedDefectByColorOut = mergedDefectByColor;

      // 派生一维行：合计列严格等于 sum(前 N 项)（Excel SUM 语义，不引入累加标量逻辑）
      if (await this.hasPackagingQtyRows()) {
        const newInPerSize = sumColorRowsBySize(mergedInboundByColor, sizeHeaders.length);
        const newDefPerSize = sumColorRowsBySize(mergedDefectByColor, sizeHeaders.length);
        const inRowFinal = [...newInPerSize, newInPerSize.reduce((a, b) => a + b, 0)];
        const defRowFinal = [...newDefPerSize, newDefPerSize.reduce((a, b) => a + b, 0)];
        (finishing as { tailInboundQtyRow?: number[] }).tailInboundQtyRow = inRowFinal;
        (finishing as { defectQuantityRow?: number[] }).defectQuantityRow = defRowFinal;
        tailInboundQtyRowOut = inRowFinal;
        defectQuantityRowOut = defRowFinal;
      }
    } else if (await this.hasPackagingQtyRows()) {
      // 兜底：仅一维入参（单色订单或老客户端）
      const tin = tailInboundQuantitiesThisBatch;
      const tdq = defectQuantitiesThisBatch;
      if (Array.isArray(tin) && Array.isArray(tdq) && tin.length >= sizeCount && tdq.length >= sizeCount) {
        const perInThis = tin.slice(0, sizeCount).map((v) => Math.max(0, Number(v) || 0));
        const perDefThis = tdq.slice(0, sizeCount).map((v) => Math.max(0, Number(v) || 0));
        const sumIn = perInThis.reduce((a, b) => a + b, 0);
        const sumDef = perDefThis.reduce((a, b) => a + b, 0);
        if (sumIn !== inboundThis || sumDef !== defectThis) {
          throw new BadRequestException('按尺码填写的入库数 / 次品数合计与汇总不一致');
        }
        const oldInRow = await this.fetchTailInboundQtyRow(orderId);
        const oldDefRow = await this.fetchDefectQuantityRow(orderId);
        const newInRow: number[] = [];
        const newDefRow: number[] = [];
        for (let i = 0; i < sizeCount; i++) {
          newInRow.push((Number(oldInRow?.[i]) || 0) + perInThis[i]);
          newDefRow.push((Number(oldDefRow?.[i]) || 0) + perDefThis[i]);
        }
        // 合计列严格 = sum(前 N 项)（Excel SUM 语义）
        const tailInboundQtyRow = headers.length === 1
          ? [newInRow.reduce((a, b) => a + b, 0)]
          : [...newInRow, newInRow.reduce((a, b) => a + b, 0)];
        const defectQuantityRow = headers.length === 1
          ? [newDefRow.reduce((a, b) => a + b, 0)]
          : [...newDefRow, newDefRow.reduce((a, b) => a + b, 0)];
        (finishing as { tailInboundQtyRow?: number[] }).tailInboundQtyRow = tailInboundQtyRow;
        (finishing as { defectQuantityRow?: number[] }).defectQuantityRow = defectQuantityRow;
        tailInboundQtyRowOut = tailInboundQtyRow;
        defectQuantityRowOut = defectQuantityRow;

        // 单色订单兜底：把一维转单色二维存到 byColor 真值字段
        if (planColors.length === 1 && sizeHeaders.length > 0) {
          const inboundOneColor: ColorSizeQuantityRow[] = [{ colorName: planColors[0], quantities: perInThis }];
          const defectOneColor: ColorSizeQuantityRow[] = [{ colorName: planColors[0], quantities: perDefThis }];
          const oldIn = await this.fetchJsonColorRows(orderId, 'tail_inbound_quantities_by_color');
          const oldDef = await this.fetchJsonColorRows(orderId, 'defect_quantities_by_color');
          inboundThisByColor = inboundOneColor;
          defectThisByColor = defectOneColor;
          const mergedIn = addColorRows(oldIn, inboundOneColor, planColors, sizeHeaders.length);
          const mergedDef = addColorRows(oldDef, defectOneColor, planColors, sizeHeaders.length);
          (finishing as { tailInboundQuantitiesByColor?: ColorSizeQuantityRow[] | null }).tailInboundQuantitiesByColor = mergedIn;
          (finishing as { defectQuantitiesByColor?: ColorSizeQuantityRow[] | null }).defectQuantitiesByColor = mergedDef;
          mergedInboundByColorOut = mergedIn;
          mergedDefectByColorOut = mergedDef;
        }
      }
    }

    const newInboundTotal = alreadyInbound + inboundThis;
    const newDefectTotal = alreadyDefect + defectThis;
    const willComplete = newInboundTotal + newDefectTotal === received;

    let nextStatus: string | null = null;
    if (willComplete) {
      nextStatus = await this.orderWorkflowService.resolveNextStatus({
        order,
        triggerCode: 'tailing_inbound_completed',
        actorUserId: actorUserId ?? 0,
      });
      if (!nextStatus) {
        throw new BadRequestException('未匹配到“入库完成”流转规则，请先在订单设置中检查流程链路配置');
      }
    }

    finishing.tailShippedQty = 0;
    finishing.tailInboundQty = newInboundTotal;
    finishing.defectQuantity = newDefectTotal;
    if (remark !== undefined) finishing.remark = remark?.trim() || null;
    if (willComplete) {
      finishing.completedAt = new Date();
      finishing.status = 'inbound';
    }

    const opUser = (actorUsername ?? '').trim();
    const inboundSnapshot = inboundThisByColor && sizeHeaders.length > 0
      ? { headers: sizeHeaders.slice(), rows: inboundThisByColor }
      : null;
    const defectSnapshot = defectThisByColor && sizeHeaders.length > 0
      ? { headers: sizeHeaders.slice(), rows: defectThisByColor }
      : null;

    // 原子写入：finishing 累计 + order 状态 + 本次 pending 记录在同一事务内。
    // crash/重启如果落在 finishing.save 之后、pending.save 之前，会让 tail_inbound_qty
    // 涨了但 inbound_pending 没新增，产生"待仓数 < 尾部入库累计"的永久不一致
    // （用户感知为"修好后重启又坏"）。事务保证全部成功或全部回滚。
    //
    // JSON byColor/Row 字段（entity 上标了 select:false 为兼容老库）经 typeorm save
    // 不会真正写入 DB——这是 hover tooltip 看到"订单计划"而不是"本批次品/入库明细"
    // 的根因。在 save 后追加 raw UPDATE 把这些 JSON 字段显式落库。
    await this.finishingRepo.manager.transaction(async (manager) => {
      const finishingRepoTx = manager.getRepository(OrderFinishing);
      const orderRepoTx = manager.getRepository(Order);
      const inboundPendingRepoTx = manager.getRepository(InboundPending);

      await finishingRepoTx.save(finishing);

      await manager.query(
        `UPDATE order_finishing SET
          tail_inbound_quantities_by_color = ?,
          defect_quantities_by_color = ?,
          tail_inbound_qty_row = ?,
          defect_quantity_row = ?
        WHERE order_id = ?`,
        [
          mergedInboundByColorOut ? JSON.stringify(mergedInboundByColorOut) : null,
          mergedDefectByColorOut ? JSON.stringify(mergedDefectByColorOut) : null,
          tailInboundQtyRowOut ? JSON.stringify(tailInboundQtyRowOut) : null,
          defectQuantityRowOut ? JSON.stringify(defectQuantityRowOut) : null,
          order.id,
        ],
      );

      if (willComplete && nextStatus && nextStatus !== order.status) {
        order.status = nextStatus;
        order.statusTime = new Date();
        await orderRepoTx.save(order);
      }

      const batchRows = await manager.query(
        'SELECT COALESCE(MAX(batch_no), 0) AS m FROM inbound_pending WHERE order_id = ?',
        [order.id],
      );
      const nextBatchNo = (Number((batchRows as { m?: number | string }[])?.[0]?.m ?? 0) || 0) + 1;

      const pendingRows: Array<InboundPending & { _snapshot?: typeof inboundSnapshot | typeof defectSnapshot }> = [];
      if (inboundThis > 0) {
        const p = inboundPendingRepoTx.create({
          orderId: order.id,
          skuCode: order.skuCode ?? '',
          quantity: inboundThis,
          sourceType: 'normal',
          status: 'pending',
          batchNo: nextBatchNo,
          operatorUsername: opUser,
        }) as InboundPending & { _snapshot?: typeof inboundSnapshot };
        p._snapshot = inboundSnapshot;
        pendingRows.push(p);
      }
      if (defectThis > 0) {
        const p = inboundPendingRepoTx.create({
          orderId: order.id,
          skuCode: order.skuCode ?? '',
          quantity: defectThis,
          sourceType: 'defect',
          status: 'pending',
          batchNo: nextBatchNo,
          operatorUsername: opUser,
        }) as InboundPending & { _snapshot?: typeof defectSnapshot };
        p._snapshot = defectSnapshot;
        pendingRows.push(p);
      }
      if (pendingRows.length) {
        await inboundPendingRepoTx.save(pendingRows);
        for (const row of pendingRows) {
          if (row._snapshot && row.id) {
            await manager.query(
              'UPDATE inbound_pending SET color_size_snapshot = ? WHERE id = ?',
              [JSON.stringify(row._snapshot), row.id],
            );
          }
        }
      }
    });
  }

  /**
   * 修订已完成（status='inbound'）订单的尾部入库 / 次品数。
   * 此处 tailInboundQty / defectQuantity 为目标累计值（覆盖式），沿用旧的
   * 「入库数 + 次品数 === 尾部收货数」校验，不支持分批。
   */
  private async amendPackagingComplete(
    order: Order,
    finishing: OrderFinishing,
    tailInboundQty: number,
    defectQuantity: number,
    remark?: string | null,
    tailInboundQuantities?: number[] | null,
    defectQuantities?: number[] | null,
    tailInboundQuantitiesByColor?: ColorSizeQuantityRow[] | null,
    defectQuantitiesByColor?: ColorSizeQuantityRow[] | null,
  ): Promise<void> {
    const orderId = order.id;
    const received = Number(finishing.tailReceivedQty) || 0;
    const inbound = Number(tailInboundQty) || 0;
    const defect = Number(defectQuantity) || 0;
    if (inbound < 0 || defect < 0) throw new NotFoundException('入库数/次品数不可为负数');
    if (inbound + defect !== received) {
      throw new NotFoundException(`入库数(${inbound})+次品数(${defect}) 须等于尾部收货数(${received})`);
    }

    await this.assertCanAmendPackagingPending(orderId, finishing);

    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const sizeHeaders = Array.isArray(ext?.colorSizeHeaders) ? ext.colorSizeHeaders : [];
    const headers = sizeHeaders.length > 0 ? [...sizeHeaders, '合计'] : ['合计'];
    const sizeCount = sizeHeaders.length || 1;
    const planColors = (Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : []).map((r) => String(r?.colorName ?? '').trim());

    // byColor 真值优先（amend 为覆盖式，不累加）
    let amendInboundByColor: ColorSizeQuantityRow[] | null = null;
    let amendDefectByColor: ColorSizeQuantityRow[] | null = null;
    // 提升到外层：transaction 内 raw UPDATE 需要访问最终待写入 DB 的 JSON 值
    let amendInboundByColorOut: ColorSizeQuantityRow[] | null = null;
    let amendDefectByColorOut: ColorSizeQuantityRow[] | null = null;
    let amendTailInboundQtyRowOut: number[] | null = null;
    let amendDefectQuantityRowOut: number[] | null = null;
    if (
      sizeHeaders.length > 0 &&
      Array.isArray(tailInboundQuantitiesByColor) &&
      Array.isArray(defectQuantitiesByColor)
    ) {
      amendInboundByColor = normalizeColorRows(tailInboundQuantitiesByColor, sizeHeaders.length);
      amendDefectByColor = normalizeColorRows(defectQuantitiesByColor, sizeHeaders.length);
      if (planColors.length > 0) {
        assertColorRowsShape(amendInboundByColor, planColors, sizeHeaders.length);
        assertColorRowsShape(amendDefectByColor, planColors, sizeHeaders.length);
      }
      const sumIn = sumColorRows(amendInboundByColor);
      const sumDef = sumColorRows(amendDefectByColor);
      if (sumIn !== inbound || sumDef !== defect) {
        throw new BadRequestException(`按颜色×尺码合计(入库 ${sumIn} / 次品 ${sumDef})与目标累计(入库 ${inbound} / 次品 ${defect})不一致`);
      }
      (finishing as { tailInboundQuantitiesByColor?: ColorSizeQuantityRow[] | null }).tailInboundQuantitiesByColor = amendInboundByColor;
      (finishing as { defectQuantitiesByColor?: ColorSizeQuantityRow[] | null }).defectQuantitiesByColor = amendDefectByColor;
      amendInboundByColorOut = amendInboundByColor;
      amendDefectByColorOut = amendDefectByColor;
      // 派生一维行：合计列严格 = sum(前 N 项)（Excel SUM 语义）
      if (await this.hasPackagingQtyRows()) {
        const perIn = sumColorRowsBySize(amendInboundByColor, sizeHeaders.length);
        const perDef = sumColorRowsBySize(amendDefectByColor, sizeHeaders.length);
        const inRowFinal = [...perIn, perIn.reduce((a, b) => a + b, 0)];
        const defRowFinal = [...perDef, perDef.reduce((a, b) => a + b, 0)];
        (finishing as { tailInboundQtyRow?: number[] }).tailInboundQtyRow = inRowFinal;
        (finishing as { defectQuantityRow?: number[] }).defectQuantityRow = defRowFinal;
        amendTailInboundQtyRowOut = inRowFinal;
        amendDefectQuantityRowOut = defRowFinal;
      }
    } else if (planColors.length > 1 && sizeHeaders.length > 0) {
      throw new BadRequestException('多色订单必须按颜色×尺码填写入库/次品数');
    } else if (await this.hasPackagingQtyRows()) {
      const tin = tailInboundQuantities;
      const tdq = defectQuantities;
      const hasArrays = Array.isArray(tin) && Array.isArray(tdq) && tin.length >= sizeCount && tdq.length >= sizeCount;
      if (hasArrays) {
        const perIn = tin.slice(0, sizeCount).map((v) => Math.max(0, Number(v) || 0));
        const perDef = tdq.slice(0, sizeCount).map((v) => Math.max(0, Number(v) || 0));
        while (perIn.length < sizeCount) perIn.push(0);
        while (perDef.length < sizeCount) perDef.push(0);
        const sumIn = perIn.reduce((a, b) => a + b, 0);
        const sumDef = perDef.reduce((a, b) => a + b, 0);
        if (sumIn !== inbound || sumDef !== defect) {
          throw new BadRequestException('按尺码填写的入库数、次品数合计与汇总不一致');
        }
        const receivedRow = await this.fetchTailReceivedQtyRow(orderId);
        if (Array.isArray(receivedRow) && receivedRow.length === headers.length && headers.length > 1) {
          let allNumeric = true;
          for (let i = 0; i < sizeCount; i++) {
            const r = receivedRow[i];
            if (r == null || !Number.isFinite(Number(r))) {
              allNumeric = false;
              break;
            }
          }
          if (allNumeric) {
            for (let i = 0; i < sizeCount; i++) {
              const r = Number(receivedRow[i]) || 0;
              if (perIn[i] + perDef[i] !== r) {
                throw new BadRequestException(`${String(headers[i] ?? '尺码')}：入库数+次品数须等于该码尾部收货数(${r})`);
              }
            }
          }
        }
        // 合计列严格 = sum(前 N 项)（Excel SUM 语义）
        const tailInboundQtyRow = headers.length === 1
          ? [perIn.reduce((a, b) => a + b, 0)]
          : [...perIn, perIn.reduce((a, b) => a + b, 0)];
        const defectQuantityRow = headers.length === 1
          ? [perDef.reduce((a, b) => a + b, 0)]
          : [...perDef, perDef.reduce((a, b) => a + b, 0)];
        (finishing as { tailInboundQtyRow?: number[] }).tailInboundQtyRow = tailInboundQtyRow;
        (finishing as { defectQuantityRow?: number[] }).defectQuantityRow = defectQuantityRow;
        amendTailInboundQtyRowOut = tailInboundQtyRow;
        amendDefectQuantityRowOut = defectQuantityRow;
      }
    }

    finishing.tailShippedQty = 0;
    finishing.tailInboundQty = inbound;
    finishing.defectQuantity = defect;
    finishing.remark = remark?.trim() || null;

    const amendInboundSnapshot = amendInboundByColor && sizeHeaders.length > 0
      ? { headers: sizeHeaders.slice(), rows: amendInboundByColor }
      : null;
    const amendDefectSnapshot = amendDefectByColor && sizeHeaders.length > 0
      ? { headers: sizeHeaders.slice(), rows: amendDefectByColor }
      : null;

    // 原子写入：finishing 累计 + 删旧 pending + 写新 pending 在同一事务内。
    // 如果 delete 之后、save 之前 crash/重启，会让 inbound_pending 整表清空但
    // tail_inbound_qty 仍是新值，产生永久不一致（用户感知为"修好后重启又坏"）。
    // JSON byColor/Row/snapshot 字段经 typeorm save 不写入（select:false），追加 raw UPDATE。
    await this.finishingRepo.manager.transaction(async (manager) => {
      const finishingRepoTx = manager.getRepository(OrderFinishing);
      const inboundPendingRepoTx = manager.getRepository(InboundPending);

      await finishingRepoTx.save(finishing);

      await manager.query(
        `UPDATE order_finishing SET
          tail_inbound_quantities_by_color = ?,
          defect_quantities_by_color = ?,
          tail_inbound_qty_row = ?,
          defect_quantity_row = ?
        WHERE order_id = ?`,
        [
          amendInboundByColorOut ? JSON.stringify(amendInboundByColorOut) : null,
          amendDefectByColorOut ? JSON.stringify(amendDefectByColorOut) : null,
          amendTailInboundQtyRowOut ? JSON.stringify(amendTailInboundQtyRowOut) : null,
          amendDefectQuantityRowOut ? JSON.stringify(amendDefectQuantityRowOut) : null,
          order.id,
        ],
      );

      await inboundPendingRepoTx.delete({ orderId: order.id, status: 'pending' });

      const batchRows = await manager.query(
        'SELECT COALESCE(MAX(batch_no), 0) AS m FROM inbound_pending WHERE order_id = ?',
        [order.id],
      );
      const nextBatchNo = (Number((batchRows as { m?: number | string }[])?.[0]?.m ?? 0) || 0) + 1;

      const pendingRows: Array<InboundPending & { _snapshot?: typeof amendInboundSnapshot | typeof amendDefectSnapshot }> = [];
      if (inbound > 0) {
        const p = inboundPendingRepoTx.create({
          orderId: order.id,
          skuCode: order.skuCode ?? '',
          quantity: inbound,
          sourceType: 'normal',
          status: 'pending',
          batchNo: nextBatchNo,
          operatorUsername: '',
        }) as InboundPending & { _snapshot?: typeof amendInboundSnapshot };
        p._snapshot = amendInboundSnapshot;
        pendingRows.push(p);
      }
      if (defect > 0) {
        const p = inboundPendingRepoTx.create({
          orderId: order.id,
          skuCode: order.skuCode ?? '',
          quantity: defect,
          sourceType: 'defect',
          status: 'pending',
          batchNo: nextBatchNo,
          operatorUsername: '',
        }) as InboundPending & { _snapshot?: typeof amendDefectSnapshot };
        p._snapshot = amendDefectSnapshot;
        pendingRows.push(p);
      }
      if (pendingRows.length) {
        await inboundPendingRepoTx.save(pendingRows);
        for (const row of pendingRows) {
          if (row._snapshot && row.id) {
            await manager.query(
              'UPDATE inbound_pending SET color_size_snapshot = ? WHERE id = ?',
              [JSON.stringify(row._snapshot), row.id],
            );
          }
        }
      }
    });
  }

  async registerPackaging(orderId: number, tailReceivedQty: number, defectQuantity: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'pending_finishing') throw new NotFoundException('仅待尾部订单可登记包装');

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

  async inbound(orderId: number, quantity: number, actorUserId?: number, actorUsername?: string): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) throw new NotFoundException('请先登记包装完成');
    if (finishing.status !== 'shipped') throw new NotFoundException('请先执行发货后再入库');

    const qty = Number(quantity) || 0;
    if (qty <= 0) throw new NotFoundException('请填写本次入库数');
    const received = finishing.tailReceivedQty ?? 0;
    const shipped = finishing.tailShippedQty ?? 0;
    const defect = finishing.defectQuantity ?? 0;
    const prevInbound = finishing.tailInboundQty ?? 0;
    const remainingSpace = received - shipped - prevInbound - defect;
    const isPartial = remainingSpace > 0 && qty < remainingSpace;
    const newInbound = prevInbound + qty;
    if (shipped + newInbound + defect > received) {
      throw new NotFoundException(`出货数(${shipped})+入库数+次品数(${defect})不能超过尾部收货数(${received})`);
    }

    finishing.tailInboundQty = newInbound;
    const total = shipped + newInbound + defect;

    let nextStatus: string | null = null;
    if (total === received) {
      nextStatus = await this.orderWorkflowService.resolveNextStatus({
        order,
        triggerCode: 'tailing_inbound_completed',
        actorUserId: actorUserId ?? 0,
      });
      if (!nextStatus) {
        throw new BadRequestException('未匹配到“入库完成”流转规则，请先在订单设置中检查流程链路配置');
      }
      finishing.status = 'inbound';
    }

    // 原子写入：finishing 累计 + 本次 pending + 完结时的 order 状态在同一事务内,
    // 避免 crash/重启在两步之间留下永久不一致（pending 多一条但 tail_inbound_qty 未涨）。
    let nextBatchNo = 0;
    await this.finishingRepo.manager.transaction(async (manager) => {
      const finishingRepoTx = manager.getRepository(OrderFinishing);
      const orderRepoTx = manager.getRepository(Order);
      const inboundPendingRepoTx = manager.getRepository(InboundPending);

      const batchRows = await manager.query(
        'SELECT COALESCE(MAX(batch_no), 0) AS m FROM inbound_pending WHERE order_id = ?',
        [order.id],
      );
      nextBatchNo = (Number((batchRows as { m?: number | string }[])?.[0]?.m ?? 0) || 0) + 1;

      const pending = inboundPendingRepoTx.create({
        orderId: order.id,
        skuCode: order.skuCode ?? '',
        quantity: qty,
        sourceType: 'normal',
        status: 'pending',
        batchNo: nextBatchNo,
        operatorUsername: (actorUsername ?? '').trim(),
      });
      await inboundPendingRepoTx.save(pending);
      await finishingRepoTx.save(finishing);

      if (nextStatus && nextStatus !== order.status) {
        order.status = nextStatus;
        order.statusTime = new Date();
        await orderRepoTx.save(order);
      }
    });

    try {
      const operator = await resolveOperatorDisplayName(this.userRepo, {
        userId: actorUserId,
        username: actorUsername ?? '',
      });
      const detail = `尾部入库：第 ${nextBatchNo} 批次 ${qty} 件${isPartial ? '（部分入库）' : ''}`;
      await this.orderLogRepo.save(
        this.orderLogRepo.create({
          orderId,
          orderNo: order.orderNo,
          operatorUsername: operator,
          action: 'production_finishing_inbound',
          detail,
          targetType: 'order',
          targetRef: null,
        }),
      );
    } catch (err) {
      console.warn('[finishing inbound] write operation log failed:', err);
    }
  }
}
