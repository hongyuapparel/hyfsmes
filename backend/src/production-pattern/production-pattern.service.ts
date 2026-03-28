import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';
import { OrderPattern } from '../entities/order-pattern.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { OrderStatusConfigService } from '../order-status-config/order-status-config.service';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';

export interface PatternListItem {
  orderId: number;
  orderNo: string;
  customerName: string;
  salesperson: string;
  merchandiser: string;
  quantity: number;
  /** 到纸样时间：订单进入待纸样状态的时间 */
  arrivedAtPattern: string | null;
  /** 纸样完成时间 */
  completedAt: string | null;
  orderDate: string | null;
  /** 客户交期（货期） */
  customerDueDate: string | null;
  skuCode: string;
  imageUrl: string;
  /** 订单类型 ID（system_options.id, option_type='order_types'） */
  orderTypeId: number | null;
  /** 合作方式 ID（system_options.id, option_type='collaboration'） */
  collaborationTypeId: number | null;
  /** 采购状态：completed | pending */
  purchaseStatus: string;
  patternStatus: string;
  patternMaster: string;
  sampleMaker: string;
  sampleImageUrl: string;
  /** 时效判定（与订单时效配置对比） */
  timeRating: string;
}

export interface PatternListQuery {
  tab?: string;
  orderNo?: string;
  skuCode?: string;
  /** 订单类型 ID */
  orderTypeId?: number;
  /** 合作方式 ID */
  collaborationTypeId?: number;
  purchaseStatus?: string;
  orderDateStart?: string;
  orderDateEnd?: string;
  page?: number;
  pageSize?: number;
}

export interface PatternMaterialRow {
  materialTypeId?: number | null;
  materialName?: string;
  fabricWidth?: string;
  usagePerPiece?: number | null;
  cuttingQuantity?: number | null;
  remark?: string;
}

@Injectable()
export class ProductionPatternService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderPattern)
    private readonly patternRepo: Repository<OrderPattern>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(OrderStatus)
    private readonly orderStatusRepo: Repository<OrderStatus>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoryRepo: Repository<OrderStatusHistory>,
    private readonly orderWorkflowService: OrderWorkflowService,
    private readonly orderStatusConfigService: OrderStatusConfigService,
  ) {}

  private async hasPatternMaterialsColumns(): Promise<boolean> {
    try {
      const runner = this.patternRepo.manager.connection.createQueryRunner();
      try {
        const rows = await runner.query(
          `
          SELECT COUNT(*) as cnt
          FROM information_schema.columns
          WHERE table_schema = DATABASE()
            AND table_name = 'order_pattern'
            AND column_name IN ('materials_json', 'materials_remark')
        `,
        );
        const cnt = Number(rows?.[0]?.cnt ?? 0);
        return cnt >= 2;
      } finally {
        await runner.release();
      }
    } catch {
      return false;
    }
  }

  /** 状态变更时写入流转历史，供各模块读取进入时间 */
  private async appendStatusHistory(orderId: number, statusCode: string): Promise<void> {
    const code = (statusCode ?? '').trim();
    if (!code) return;
    const status = await this.orderStatusRepo.findOne({ where: { code } });
    if (!status) return;
    await this.orderStatusHistoryRepo.save(
      this.orderStatusHistoryRepo.create({ orderId, statusId: status.id }),
    );
  }

  private async getEnteredAtMap(orderIds: number[], statusCode: string): Promise<Map<number, string>> {
    const ids = Array.isArray(orderIds) ? orderIds.filter((v) => typeof v === 'number' && v > 0) : [];
    const code = (statusCode ?? '').trim();
    const map = new Map<number, string>();
    if (!ids.length || !code) return map;
    const rows = await this.orderStatusHistoryRepo
      .createQueryBuilder('h')
      .innerJoin(OrderStatus, 's', 's.id = h.statusId')
      .select('h.orderId', 'orderId')
      .addSelect('MIN(h.enteredAt)', 'enteredAt')
      .where('h.orderId IN (:...ids)', { ids })
      .andWhere('s.code = :code', { code })
      .groupBy('h.orderId')
      .getRawMany<{ orderId: number; enteredAt: string }>();
    for (const r of rows) {
      const orderId = Number((r as any).orderId);
      const enteredAt = (r as any).enteredAt as string | undefined;
      if (!Number.isNaN(orderId) && enteredAt) {
        map.set(orderId, this.toDateTimeLocalString(enteredAt) ?? enteredAt);
      }
    }
    return map;
  }

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

  private isPurchaseCompleted(materials: OrderMaterialRow[] | null): boolean {
    if (!materials || materials.length === 0) return false;
    return materials.every((m) => {
      const purchaseDone = (m.purchaseStatus ?? 'pending').toLowerCase() === 'completed';
      const pickDone = (m.pickStatus ?? 'pending').toLowerCase() === 'completed';
      return purchaseDone || pickDone;
    });
  }

  private mapOrderMaterialsToPatternMaterials(materials: OrderMaterialRow[] | null | undefined): PatternMaterialRow[] {
    const list = Array.isArray(materials) ? materials : [];
    return list.map((m) => ({
      materialTypeId: m.materialTypeId ?? null,
      materialName: (m.materialName ?? '').trim(),
      fabricWidth: (((m as any).fabricWidth ?? '') as string).trim(),
      usagePerPiece: m.usagePerPiece ?? null,
      cuttingQuantity: m.cuttingQuantity ?? null,
      remark: (m.remark ?? '').trim(),
    }));
  }

  async getPatternMaterials(orderId: number): Promise<{ materials: PatternMaterialRow[]; remark: string | null }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const colsReady = await this.hasPatternMaterialsColumns();
    if (!colsReady) {
      const materials = this.mapOrderMaterialsToPatternMaterials(ext?.materials ?? null);
      return { materials, remark: null };
    }
    const pattern = await this.patternRepo
      .createQueryBuilder('p')
      .addSelect(['p.materialsJson', 'p.materialsRemark'])
      .where('p.orderId = :orderId', { orderId })
      .getOne();
    const saved = pattern?.materialsJson;
    const materials = Array.isArray(saved) ? (saved as PatternMaterialRow[]) : this.mapOrderMaterialsToPatternMaterials(ext?.materials ?? null);
    const remark = pattern?.materialsRemark ?? null;
    return { materials, remark };
  }

  async savePatternMaterials(orderId: number, materials: PatternMaterialRow[], remark?: string | null): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const colsReady = await this.hasPatternMaterialsColumns();
    if (!colsReady) {
      throw new BadRequestException('数据库缺少纸样物料字段，请先执行脚本：backend/scripts/add-order-pattern-materials-json.sql');
    }
    let pattern = await this.patternRepo.findOne({ where: { orderId } });
    if (!pattern) {
      pattern = this.patternRepo.create({ orderId, status: 'pending_assign' });
    }
    pattern.materialsJson = Array.isArray(materials) ? materials : [];
    pattern.materialsRemark = remark?.trim() || null;
    await this.patternRepo.save(pattern);
  }

  private async buildPatternRows(baseQuery: PatternListQuery): Promise<PatternListItem[]> {
    const {
      tab = 'all',
      orderNo,
      skuCode,
      orderTypeId,
      collaborationTypeId,
      purchaseStatus,
      orderDateStart,
      orderDateEnd,
    } = baseQuery;

    const completedPatterns = await this.patternRepo.find({
      where: { status: 'completed' },
      select: ['orderId'],
    });
    const completedOrderIds = completedPatterns.map((p) => p.orderId);

    // 纸样页视角：始终关心「待纸样」和「纸样已完成」的订单，
    // 不再限制纸样已完成订单必须仍处于 pending_purchase 阶段，
    // 否则订单后续流程推进后会在本页消失。
    const qb = this.orderRepo.createQueryBuilder('o').where(
      'o.status = :pendingPattern OR (o.id IN (:...completedIds))',
      { pendingPattern: 'pending_pattern', completedIds: completedOrderIds.length ? completedOrderIds : [0] },
    );

    if (orderNo?.trim()) {
      qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    }
    if (skuCode?.trim()) {
      qb.andWhere('o.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    }
    if (typeof orderTypeId === 'number') {
      qb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId });
    }
    if (typeof collaborationTypeId === 'number') {
      qb.andWhere('o.collaboration_type_id = :collaborationTypeId', {
        collaborationTypeId,
      });
    }
    if (orderDateStart) {
      qb.andWhere('o.order_date >= :orderDateStart', { orderDateStart: `${orderDateStart} 00:00:00` });
    }
    if (orderDateEnd) {
      qb.andWhere('o.order_date <= :orderDateEnd', { orderDateEnd: `${orderDateEnd} 23:59:59` });
    }

    qb.orderBy('o.order_date', 'DESC').addOrderBy('o.id', 'DESC');

    const orders = await qb.getMany();
    const orderIds = orders.map((o) => o.id);
    if (orderIds.length === 0) {
      return [];
    }

    const [patterns, extList, arrivedAtPatternMap] = await Promise.all([
      this.patternRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.orderExtRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.getEnteredAtMap(orderIds, 'pending_pattern'),
    ]);
    const patternMap = new Map(patterns.map((p) => [p.orderId, p]));
    const extMap = new Map(extList.map((e) => [e.orderId, e]));
    const slaCtx = await this.orderStatusConfigService.loadProductionSlaJudgeContext();

    const rows: PatternListItem[] = [];
    for (const order of orders) {
      const pattern = patternMap.get(order.id);
      const ext = extMap.get(order.id);
      const materials = ext?.materials ?? null;
      const purchaseCompleted = this.isPurchaseCompleted(materials);
      const purchaseStatusStr = purchaseCompleted ? 'completed' : 'pending';
      if (purchaseStatus === 'completed' && !purchaseCompleted) continue;
      if (purchaseStatus === 'pending' && purchaseStatusStr === 'completed') continue;

      const pStatus = pattern?.status ?? 'pending_assign';
      if (tab === 'pending_assign' && pStatus !== 'pending_assign') continue;
      if (tab === 'in_progress' && pStatus !== 'in_progress') continue;
      if (tab === 'completed' && pStatus !== 'completed') continue;

      const arrivedAtPattern =
        arrivedAtPatternMap.get(order.id) ??
        this.toDateTimeLocalString(order.statusTime) ??
        this.toDateTimeLocalString(pattern?.completedAt ?? null);

      let phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(arrivedAtPatternMap.get(order.id));
      if (!phaseStart && order.status === 'pending_pattern') {
        phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(order.statusTime);
      }
      const phaseEnd =
        pStatus === 'completed' && pattern?.completedAt
          ? this.orderStatusConfigService.parseProductionPhaseInstant(pattern.completedAt)
          : null;
      const timeRating = this.orderStatusConfigService.judgeProductionPhaseDuration(
        'pending_pattern',
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
        quantity: order.quantity ?? 0,
        arrivedAtPattern,
        completedAt: pattern?.completedAt
          ? this.toDateTimeLocalString(pattern.completedAt)
          : null,
        orderDate: this.toDateOnlyLocalString(order.orderDate),
        customerDueDate: order.customerDueDate
          ? this.toDateOnlyLocalString(order.customerDueDate)
          : null,
        skuCode: order.skuCode ?? '',
        imageUrl: order.imageUrl ?? '',
        orderTypeId: order.orderTypeId ?? null,
        collaborationTypeId: order.collaborationTypeId ?? null,
        purchaseStatus: purchaseStatusStr,
        patternStatus: pStatus,
        patternMaster: pattern?.patternMaster ?? '',
        sampleMaker: pattern?.sampleMaker ?? '',
        sampleImageUrl: pattern?.sampleImageUrl ?? '',
        timeRating,
      });
    }

    return rows;
  }

  async getPatternList(query: PatternListQuery): Promise<{
    list: PatternListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { page = 1, pageSize = 20 } = query;
    const rows = await this.buildPatternRows(query);
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);
    return { list, total, page, pageSize };
  }

  async getPatternExportRows(query: PatternListQuery): Promise<PatternListItem[]> {
    return this.buildPatternRows(query);
  }

  async assignPattern(orderId: number, patternMaster: string, sampleMaker: string): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending_pattern') {
      throw new NotFoundException('仅待纸样订单可分配');
    }

    let pattern = await this.patternRepo.findOne({ where: { orderId } });
    if (!pattern) {
      pattern = this.patternRepo.create({
        orderId,
        patternMaster: patternMaster.trim(),
        sampleMaker: sampleMaker.trim(),
        status: 'in_progress',
      });
    } else {
      pattern.patternMaster = patternMaster.trim();
      pattern.sampleMaker = sampleMaker.trim();
      pattern.status = 'in_progress';
    }
    await this.patternRepo.save(pattern);
  }

  async completePattern(orderId: number, sampleImageUrl: string, actorUserId?: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (order.status !== 'pending_pattern') {
      throw new NotFoundException('仅待纸样订单可确认完成');
    }

    let pattern = await this.patternRepo.findOne({ where: { orderId } });
    if (!pattern) {
      pattern = this.patternRepo.create({
        orderId,
        patternMaster: '',
        sampleMaker: '',
        status: 'completed',
        completedAt: new Date(),
        sampleImageUrl: (sampleImageUrl ?? '').trim(),
      });
    } else {
      pattern.status = 'completed';
      pattern.completedAt = new Date();
      pattern.sampleImageUrl = (sampleImageUrl ?? '').trim();
    }
    await this.patternRepo.save(pattern);

    const next = await this.orderWorkflowService.resolveNextStatus({
      order,
      triggerCode: 'pattern_completed',
      actorUserId: actorUserId ?? 0,
    });
    if (next && next !== order.status) {
      order.status = next;
      order.statusTime = new Date();
      await this.orderRepo.save(order);
      await this.appendStatusHistory(order.id, next);
    }
  }
}
