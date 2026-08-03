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
    const planColors = (Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : []).map((r) => String(r?.colorName ?? '').trim());

    let byColor: ColorSizeQuantityRow[] | null = null;
    let normalizedTotal: number;
    let tailReceivedQtyRow: number[] | null = null;

    if (sizeHeaders.length > 0) {
      if (!Array.isArray(tailReceivedQuantitiesByColor) || tailReceivedQuantitiesByColor.length === 0) {
        throw new BadRequestException('该订单有尺码明细，必须按实际颜色×尺码填写尾部收货数');
      }
      if (planColors.length > 0) assertColorRowsShape(tailReceivedQuantitiesByColor, planColors, sizeHeaders.length);
      byColor = normalizeColorRows(tailReceivedQuantitiesByColor, sizeHeaders.length);
      const perSize = sumColorRowsBySize(byColor, sizeHeaders.length);
      normalizedTotal = sumColorRows(byColor);
      tailReceivedQtyRow = [...perSize, normalizedTotal];
      if (normalizedTotal !== (Number(tailReceivedQty) || 0)) {
        throw new BadRequestException(`尾部收货数合计(${normalizedTotal})须等于尾部收货数(${Number(tailReceivedQty) || 0})`);
      }
    } else {
      normalizedTotal = Number(tailReceivedQty) || 0;
      if (normalizedTotal <= 0) throw new NotFoundException('请填写尾部收货数');
      tailReceivedQtyRow = [normalizedTotal];
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
    const finishing = this.finishingRepo.create(payload);
    // 总数与颜色×尺码 JSON 必须原子落库，禁止留下“有总数、无明细”的半写入记录。
    await this.finishingRepo.manager.transaction(async (manager) => {
      const orderRepoTx = manager.getRepository(Order);
      const finishingRepoTx = manager.getRepository(OrderFinishing);
      const lockedOrder = await orderRepoTx
        .createQueryBuilder('order')
        .where('order.id = :orderId', { orderId })
        .setLock('pessimistic_write')
        .getOne();
      if (!lockedOrder || lockedOrder.status !== 'pending_finishing') {
        throw new BadRequestException('订单状态已变化，请刷新后重试');
      }
      const concurrentExisting = await finishingRepoTx.findOne({ where: { orderId } });
      if (concurrentExisting) throw new BadRequestException('该订单已登记收货，请刷新后重试');

      await finishingRepoTx.save(finishing);
      await manager.query(
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
    });
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

    // 已完成入库的修订请走 amendCompletedPackaging（需 production_admin_edit）
    if (finishing.status === 'inbound') {
      throw new BadRequestException(
        '该订单尾部已完成，修改入库/次品请使用纠错接口（需「编辑已提交生产数据」权限）',
      );
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
    if (sizeHeaders.length > 0) {
      if (
        !Array.isArray(tailInboundQuantitiesThisBatchByColor) ||
        !Array.isArray(defectQuantitiesThisBatchByColor)
      ) {
        throw new BadRequestException('该订单有尺码明细，必须按实际颜色×尺码填写本次入库和次品数');
      }
      if (planColors.length > 0) {
        assertColorRowsShape(tailInboundQuantitiesThisBatchByColor, planColors, sizeHeaders.length);
        assertColorRowsShape(defectQuantitiesThisBatchByColor, planColors, sizeHeaders.length);
      }
      inboundThisByColor = normalizeColorRows(tailInboundQuantitiesThisBatchByColor, sizeHeaders.length);
      defectThisByColor = normalizeColorRows(defectQuantitiesThisBatchByColor, sizeHeaders.length);
      const sumIn = sumColorRows(inboundThisByColor);
      const sumDef = sumColorRows(defectThisByColor);
      if (sumIn !== inboundThis || sumDef !== defectThis) {
        throw new BadRequestException(`按颜色×尺码填写的合计(入库 ${sumIn} / 次品 ${sumDef})与本次汇总(入库 ${inboundThis} / 次品 ${defectThis})不一致`);
      }
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

      const lockedFinishing = await finishingRepoTx
        .createQueryBuilder('finishing')
        .where('finishing.order_id = :orderId', { orderId: order.id })
        .setLock('pessimistic_write')
        .getOne();
      if (
        !lockedFinishing ||
        lockedFinishing.status !== 'pending_assign' ||
        Number(lockedFinishing.tailInboundQty || 0) !== alreadyInbound ||
        Number(lockedFinishing.defectQuantity || 0) !== alreadyDefect
      ) {
        throw new BadRequestException('尾部登记数据已变化，请刷新后重试');
      }
      const lockedOrder = await orderRepoTx
        .createQueryBuilder('order')
        .where('order.id = :orderId', { orderId: order.id })
        .setLock('pessimistic_write')
        .getOne();
      if (!lockedOrder || lockedOrder.status !== order.status) {
        throw new BadRequestException('订单状态已变化，请刷新后重试');
      }

      finishing.id = lockedFinishing.id;
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

      if (willComplete && nextStatus && nextStatus !== lockedOrder.status) {
        lockedOrder.status = nextStatus;
        lockedOrder.statusTime = new Date();
        await orderRepoTx.save(lockedOrder);
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
    const planColors = (Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : []).map((r) => String(r?.colorName ?? '').trim());

    // byColor 真值优先（amend 为覆盖式，不累加）
    let amendInboundByColor: ColorSizeQuantityRow[] | null = null;
    let amendDefectByColor: ColorSizeQuantityRow[] | null = null;
    // 提升到外层：transaction 内 raw UPDATE 需要访问最终待写入 DB 的 JSON 值
    let amendInboundByColorOut: ColorSizeQuantityRow[] | null = null;
    let amendDefectByColorOut: ColorSizeQuantityRow[] | null = null;
    let amendTailInboundQtyRowOut: number[] | null = null;
    let amendDefectQuantityRowOut: number[] | null = null;
    if (sizeHeaders.length > 0) {
      if (!Array.isArray(tailInboundQuantitiesByColor) || !Array.isArray(defectQuantitiesByColor)) {
        throw new BadRequestException('该订单有尺码明细，纠错时必须按实际颜色×尺码填写入库和次品数');
      }
      if (planColors.length > 0) {
        assertColorRowsShape(tailInboundQuantitiesByColor, planColors, sizeHeaders.length);
        assertColorRowsShape(defectQuantitiesByColor, planColors, sizeHeaders.length);
      }
      amendInboundByColor = normalizeColorRows(tailInboundQuantitiesByColor, sizeHeaders.length);
      amendDefectByColor = normalizeColorRows(defectQuantitiesByColor, sizeHeaders.length);
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

    // 原子写入并原位修订待仓批次；保留既有 ID / batch_no，避免外部引用失效。
    await this.finishingRepo.manager.transaction(async (manager) => {
      const finishingRepoTx = manager.getRepository(OrderFinishing);
      const inboundPendingRepoTx = manager.getRepository(InboundPending);

      const lockedFinishing = await finishingRepoTx
        .createQueryBuilder('finishing')
        .where('finishing.order_id = :orderId', { orderId: order.id })
        .setLock('pessimistic_write')
        .getOne();
      if (!lockedFinishing || lockedFinishing.status !== 'inbound') {
        throw new BadRequestException('尾部状态已变化，请刷新后重试');
      }

      const existingPendings = await inboundPendingRepoTx
        .createQueryBuilder('pending')
        .where('pending.order_id = :orderId AND pending.status = :status', { orderId: order.id, status: 'pending' })
        .addSelect('pending.color_size_snapshot')
        .setLock('pessimistic_write')
        .getMany();
      const currentTotal = existingPendings.reduce((sum, row) => sum + Math.max(0, Number(row.quantity) || 0), 0);
      const expectedCurrentTotal = (Number(lockedFinishing.tailInboundQty) || 0) + (Number(lockedFinishing.defectQuantity) || 0);
      if (currentTotal !== expectedCurrentTotal) {
        throw new BadRequestException('待仓处理数量已变化，无法在尾部纠错，请刷新并核对仓库处理记录');
      }
      for (const sourceType of ['normal', 'defect']) {
        if (existingPendings.filter((row) => (row.sourceType ?? 'normal') === sourceType).length > 1) {
          throw new BadRequestException('该订单存在多个待仓批次，无法用累计值安全覆盖，请逐批核对');
        }
      }
      if (existingPendings.length) {
        const refs = (await manager.query(
          `SELECT COUNT(*) AS count FROM packing_list_items
           WHERE source_type = 'pending' AND source_id IN (${existingPendings.map(() => '?').join(',')})`,
          existingPendings.map((row) => row.id),
        )) as Array<{ count?: number | string }>;
        if ((Number(refs[0]?.count) || 0) > 0) {
          throw new BadRequestException('待仓记录已被装箱单引用，请先从装箱单移除后再纠错');
        }
      }

      lockedFinishing.tailShippedQty = 0;
      lockedFinishing.tailInboundQty = inbound;
      lockedFinishing.defectQuantity = defect;
      lockedFinishing.remark = remark?.trim() || null;
      await finishingRepoTx.save(lockedFinishing);

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

      const batchRows = await manager.query(
        'SELECT COALESCE(MAX(batch_no), 0) AS m FROM inbound_pending WHERE order_id = ?',
        [order.id],
      );
      const nextBatchNo = (Number((batchRows as { m?: number | string }[])?.[0]?.m ?? 0) || 0) + 1;

      const updatePending = async (
        sourceType: 'normal' | 'defect',
        quantity: number,
        snapshot: typeof amendInboundSnapshot | typeof amendDefectSnapshot,
      ): Promise<void> => {
        const existing = existingPendings.find((row) => (row.sourceType ?? 'normal') === sourceType);
        if (quantity <= 0) {
          if (existing) await inboundPendingRepoTx.delete(existing.id);
          return;
        }
        if (existing) {
          await manager.query(
            'UPDATE inbound_pending SET quantity = ?, color_size_snapshot = ? WHERE id = ?',
            [quantity, snapshot ? JSON.stringify(snapshot) : null, existing.id],
          );
          return;
        }
        const created = await inboundPendingRepoTx.save(inboundPendingRepoTx.create({
          orderId: order.id,
          skuCode: order.skuCode ?? '',
          quantity,
          sourceType,
          status: 'pending',
          batchNo: nextBatchNo,
          operatorUsername: '',
        }));
        await manager.query(
          'UPDATE inbound_pending SET color_size_snapshot = ? WHERE id = ?',
          [snapshot ? JSON.stringify(snapshot) : null, created.id],
        );
      };

      await updatePending('normal', inbound, amendInboundSnapshot);
      await updatePending('defect', defect, amendDefectSnapshot);
    });
  }

  /** 纠错：修订已完成（inbound）尾部入库/次品，不推进主状态 */
  async amendCompletedPackaging(
    orderId: number,
    tailInboundQty: number,
    defectQuantity: number,
    remark?: string | null,
    actorUserId?: number,
    actorUsername?: string,
    tailInboundQuantities?: number[] | null,
    defectQuantities?: number[] | null,
    tailInboundQuantitiesByColor?: ColorSizeQuantityRow[] | null,
    defectQuantitiesByColor?: ColorSizeQuantityRow[] | null,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) throw new NotFoundException('请先登记收货');
    if (finishing.status !== 'inbound') {
      throw new BadRequestException('仅尾部已完成订单可纠错修订入库/次品');
    }
    const beforeInbound = Number(finishing.tailInboundQty) || 0;
    const beforeDefect = Number(finishing.defectQuantity) || 0;
    await this.amendPackagingComplete(
      order,
      finishing,
      tailInboundQty,
      defectQuantity,
      remark,
      tailInboundQuantities,
      defectQuantities,
      tailInboundQuantitiesByColor,
      defectQuantitiesByColor,
    );
    try {
      const operator = await resolveOperatorDisplayName(this.userRepo, {
        userId: actorUserId,
        username: actorUsername ?? '',
      });
      await this.orderLogRepo.save(
        this.orderLogRepo.create({
          orderId,
          orderNo: order.orderNo,
          operatorUsername: operator,
          action: 'production_finishing_admin_edit',
          detail: `尾部纠错修订入库/次品：入库 ${beforeInbound}→${Number(tailInboundQty) || 0}，次品 ${beforeDefect}→${Number(defectQuantity) || 0}`,
          targetType: 'order',
          targetRef: null,
        }),
      );
    } catch (err) {
      console.warn('[finishing amend] write operation log failed:', err);
    }
  }

  async registerPackaging(orderId: number, tailReceivedQty: number, defectQuantity: number): Promise<void> {
    void orderId;
    void tailReceivedQty;
    void defectQuantity;
    throw new BadRequestException('旧版尾部包装接口已停用，请刷新页面后按颜色×尺码登记');
  }

  async inbound(orderId: number, quantity: number, actorUserId?: number, actorUsername?: string): Promise<void> {
    void orderId;
    void quantity;
    void actorUserId;
    void actorUsername;
    throw new BadRequestException('旧版尾部入库接口已停用，请刷新页面后按颜色×尺码登记');
  }
}
