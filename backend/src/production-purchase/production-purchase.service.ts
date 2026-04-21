import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { SuppliersService } from '../suppliers/suppliers.service';
import { SystemOptionsService } from '../system-options/system-options.service';
import { FabricStockService } from '../fabric-stock/fabric-stock.service';
import { InventoryAccessoriesService } from '../inventory-accessories/inventory-accessories.service';
import { FinishedGoodsStockService } from '../finished-goods-stock/finished-goods-stock.service';
import { User } from '../entities/user.entity';
import { OrderStatusConfigService } from '../order-status-config/order-status-config.service';

/** 已审单：非草稿、非待审单，即待纸样及之后的状态 */
const PURCHASE_ORDER_STATUSES = [
  'pending_pattern',
  'pending_purchase',
  'pending_cutting',
  'pending_sewing',
  'pending_finishing',
  'completed',
];

export interface PurchaseItemRow {
  orderId: number;
  materialIndex: number;
  orderNo: string;
  orderDate: string | null;
  /** 到待采购状态的时间（订单进入待采购时记录） */
  pendingPurchaseAt: string | null;
  imageUrl: string;
  skuCode: string;
  /** 订单类型 ID（system_options.id, option_type='order_types'） */
  orderTypeId: number | null;
  supplierName: string;
  materialTypeId: number | null;
  materialType: string;
  materialName: string;
  color: string;
  planQuantity: number | null;
  actualPurchaseQuantity: number | null;
  purchaseAmount: string | null;
  purchaseStatus: string;
  pickStatus: string;
  purchaseCompletedAt: string | null;
  pickCompletedAt: string | null;
  purchaseUnitPrice: string | null;
  purchaseOtherCost: string | null;
  purchaseRemark: string | null;
  purchaseImageUrl: string | null;
  materialSourceId: number | null;
  materialSource: string;
  processRoute: 'purchase' | 'picking';
  /** 时效判定：本行物料从到采购至采购/领料完成（与订单时效配置 pending_purchase 对比） */
  timeRating: string;
  /** 订单维度：客户 */
  customerName: string;
  /** 订单维度：跟单 */
  merchandiser: string;
  /** 订单维度：客户交期 */
  customerDueDate: string | null;
  /** 订单件数 */
  orderQuantity: number;
}

export interface PurchaseListQuery {
  /** tab: all | pending | picking | completed */
  tab?: string;
  orderNo?: string;
  skuCode?: string;
  supplier?: string;
  /** 订单类型 ID */
  orderTypeId?: number;
  orderDateStart?: string;
  orderDateEnd?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ProductionPurchaseService {
  private purchaseReconcileRunning = false;
  private purchaseReconcileLastRunAt = 0;
  private readonly purchaseReconcileIntervalMs = 5 * 60 * 1000;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(OrderStatus)
    private readonly orderStatusRepo: Repository<OrderStatus>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoryRepo: Repository<OrderStatusHistory>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly orderWorkflowService: OrderWorkflowService,
    private readonly suppliersService: SuppliersService,
    private readonly systemOptionsService: SystemOptionsService,
    private readonly fabricStockService: FabricStockService,
    private readonly inventoryAccessoriesService: InventoryAccessoriesService,
    private readonly finishedGoodsStockService: FinishedGoodsStockService,
    private readonly orderStatusConfigService: OrderStatusConfigService,
  ) {}

  private materialSourceOptionsLoadedAt = 0;
  private materialSourceLabelById = new Map<number, string>();
  private materialTypeOptionsLoadedAt = 0;
  private materialTypeLabelById = new Map<number, string>();

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

  /**
   * 采购登记金额类字段统一归一化：
   * - 空字符串 / null / undefined -> '0'
   * - 其他值去两端空格后按原样返回
   */
  private normalizeDecimalInput(v: unknown): string {
    if (v === null || v === undefined) return '0';
    if (typeof v === 'number') {
      return Number.isFinite(v) ? String(v) : '0';
    }
    if (typeof v === 'string') {
      const t = v.trim();
      return t || '0';
    }
    return '0';
  }

  private async ensureMaterialSourceOptionCache(): Promise<void> {
    const now = Date.now();
    if (now - this.materialSourceOptionsLoadedAt < 60_000 && this.materialSourceLabelById.size > 0) return;
    const list = await this.systemOptionsService.findAllByType('material_sources');
    this.materialSourceLabelById = new Map(list.map((item) => [item.id, item.value]));
    this.materialSourceOptionsLoadedAt = now;
  }

  private async ensureMaterialTypeOptionCache(): Promise<void> {
    const now = Date.now();
    if (now - this.materialTypeOptionsLoadedAt < 60_000 && this.materialTypeLabelById.size > 0) return;
    const list = await this.systemOptionsService.findAllByType('material_types');
    this.materialTypeLabelById = new Map(list.map((item) => [item.id, item.value]));
    this.materialTypeOptionsLoadedAt = now;
  }

  private getMaterialTypeLabelById(id: number | null | undefined): string {
    if (id == null) return '';
    return this.materialTypeLabelById.get(Number(id)) ?? '';
  }

  private getMaterialSourceLabelById(id: number | null | undefined): string {
    if (id == null) return '';
    return this.materialSourceLabelById.get(Number(id)) ?? '';
  }

  private resolveMaterialRouteBySourceLabel(sourceLabel: string): 'purchase' | 'picking' {
    const label = sourceLabel.trim();
    if (label === '公司库存' || label === '客供面料') return 'picking';
    // 兼容历史数据：未配置来源时仍走原等待采购流程，避免破坏既有逻辑。
    return 'purchase';
  }

  private isMaterialFlowCompleted(material: OrderMaterialRow): boolean {
    const sourceLabel = this.getMaterialSourceLabelById(material.materialSourceId ?? null);
    const route = this.resolveMaterialRouteBySourceLabel(sourceLabel);
    if (route === 'purchase') {
      return (material.purchaseStatus ?? 'pending').toLowerCase() === 'completed';
    }
    return (material.pickStatus ?? 'pending').toLowerCase() === 'completed';
  }

  private getMaterialFlowCompletedAt(material: OrderMaterialRow): Date | null {
    const sourceLabel = this.getMaterialSourceLabelById(material.materialSourceId ?? null);
    const route = this.resolveMaterialRouteBySourceLabel(sourceLabel);
    const raw = route === 'purchase' ? material.purchaseCompletedAt : material.pickCompletedAt;
    if (raw == null || String(raw).trim() === '') return null;
    const completedAt = new Date(raw);
    return Number.isNaN(completedAt.getTime()) ? null : completedAt;
  }

  private getLatestMaterialFlowCompletedAt(materials: OrderMaterialRow[]): Date | null {
    let latest: Date | null = null;
    for (const material of materials) {
      const completedAt = this.getMaterialFlowCompletedAt(material);
      if (!completedAt) continue;
      if (!latest || completedAt.getTime() > latest.getTime()) {
        latest = completedAt;
      }
    }
    return latest;
  }

  /**
   * 自愈历史数据：采购/领料已完成但订单状态仍停留在待采购时，按 purchase_all_completed 规则补齐。
   */
  private async reconcilePurchaseCompletedOrders(actorUserId?: number): Promise<void> {
    if (typeof actorUserId !== 'number') return;
    await this.ensureMaterialSourceOptionCache();
    const orders = await this.orderRepo.find({ where: { status: 'pending_purchase' } });
    if (!orders.length) return;
    const orderIds = orders.map((order) => order.id);
    const extList = await this.orderExtRepo.find({ where: { orderId: In(orderIds) } });
    if (!extList.length) return;
    const extMap = new Map(extList.map((ext) => [ext.orderId, ext]));
    for (const order of orders) {
      const ext = extMap.get(order.id);
      const materials: OrderMaterialRow[] = Array.isArray(ext?.materials) ? ext.materials : [];
      if (!materials.length) continue;
      const allCompleted = materials.every((material) => this.isMaterialFlowCompleted(material));
      if (!allCompleted) continue;
      const next = await this.orderWorkflowService.resolveNextStatus({
        order,
        triggerCode: 'purchase_all_completed',
        actorUserId,
      });
      if (!next || next === order.status) continue;
      order.status = next;
      order.statusTime = this.getLatestMaterialFlowCompletedAt(materials) ?? new Date();
      await this.orderRepo.save(order);
    }
  }

  private schedulePurchaseReconcile(actorUserId?: number): void {
    if (typeof actorUserId !== 'number') return;
    if (this.purchaseReconcileRunning) return;
    const now = Date.now();
    if (now - this.purchaseReconcileLastRunAt < this.purchaseReconcileIntervalMs) return;

    this.purchaseReconcileRunning = true;
    this.purchaseReconcileLastRunAt = now;
    void this.reconcilePurchaseCompletedOrders(actorUserId)
      .catch(() => {
        // 自愈失败不影响列表主链路；下个间隔继续尝试。
      })
      .finally(() => {
        this.purchaseReconcileRunning = false;
      });
  }

  private async resolveOperatorName(userId: number | undefined, fallback = ''): Promise<string> {
    const fb = (fallback ?? '').trim();
    if (!userId) return fb;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return (user?.displayName ?? '').trim() || (user?.username ?? '').trim() || fb;
  }

  async getPurchaseItems(query: PurchaseListQuery, actorUserId?: number): Promise<{
    list: PurchaseItemRow[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      tab = 'all',
      orderNo,
      skuCode,
      supplier,
      orderTypeId,
      orderDateStart,
      orderDateEnd,
      page = 1,
      pageSize = 20,
    } = query;
    this.schedulePurchaseReconcile(actorUserId);
    await this.ensureMaterialSourceOptionCache();
    await this.ensureMaterialTypeOptionCache();

    const qb = this.orderRepo
      .createQueryBuilder('o')
      .where('o.status IN (:...statuses)', { statuses: PURCHASE_ORDER_STATUSES });

    if (orderNo?.trim()) {
      qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    }
    if (skuCode?.trim()) {
      qb.andWhere('o.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    }
    if (typeof orderTypeId === 'number') {
      qb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId });
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
      return { list: [], total: 0, page, pageSize };
    }

    // 到采购时间：从状态历史表中取进入 pending_purchase 的时间（取最新一次进入时间）
    let pendingPurchaseEnteredAtMap = new Map<number, string>();
    try {
      const pendingStatus = await this.orderStatusRepo.findOne({ where: { code: 'pending_purchase' } });
      const statusId = pendingStatus?.id;
      if (statusId) {
        const historyRows = await this.orderStatusHistoryRepo
          .createQueryBuilder('h')
          .select('h.order_id', 'orderId')
          .addSelect('MAX(h.entered_at)', 'enteredAt')
          .where('h.status_id = :statusId', { statusId })
          .andWhere('h.order_id IN (:...orderIds)', { orderIds })
          .groupBy('h.order_id')
          .getRawMany<{ orderId: number; enteredAt: string }>();
        const map = new Map<number, string>();
        for (const r of historyRows) {
          const orderId = Number((r as any)?.orderId);
          const enteredAt = (r as any)?.enteredAt as string | undefined;
          if (!Number.isFinite(orderId) || !enteredAt) continue;
          const formatted = this.toDateTimeLocalString(enteredAt);
          if (!formatted) continue;
          map.set(orderId, formatted);
        }
        pendingPurchaseEnteredAtMap = map;
      }
    } catch {
      pendingPurchaseEnteredAtMap = new Map<number, string>();
    }

    const extList = await this.orderExtRepo.find({
      where: orderIds.map((id) => ({ orderId: id })),
    });
    const extMap = new Map(extList.map((e) => [e.orderId, e]));
    const slaCtx = await this.orderStatusConfigService.loadProductionSlaJudgeContext();

    const rows: PurchaseItemRow[] = [];
    for (const order of orders) {
      const ext = extMap.get(order.id);
      const materials: OrderMaterialRow[] = ext?.materials ?? [];
      const orderDate = this.toDateOnlyLocalString(order.orderDate);
      const pendingPurchaseAt =
        pendingPurchaseEnteredAtMap.get(order.id) ||
        (order.status === 'pending_purchase' && order.statusTime
          ? this.toDateTimeLocalString(order.statusTime)
          : null);

      // 采购页仅展示“当前待采购”或“历史进入过待采购”的订单：
      // 若某条链路配置为不经过待采购（如部分成品链路），则不应出现在采购页。
      if (!pendingPurchaseAt) {
        continue;
      }

      for (let i = 0; i < materials.length; i++) {
        const m = materials[i];
        const supplierName = (m.supplierName ?? '').trim();
        if (supplier?.trim() && !supplierName.toLowerCase().includes((supplier.trim()).toLowerCase())) {
          continue;
        }
        const materialSourceId = m.materialSourceId ?? null;
        const materialSource = this.getMaterialSourceLabelById(materialSourceId);
        const processRoute = this.resolveMaterialRouteBySourceLabel(materialSource);
        const purchaseStatus = (m.purchaseStatus ?? 'pending').toLowerCase();
        const pickStatus = (m.pickStatus ?? 'pending').toLowerCase();
        const routeStatus = processRoute === 'purchase'
          ? (purchaseStatus === 'completed' ? 'completed' : 'pending')
          : (pickStatus === 'completed' ? 'completed' : 'pending');
        if (tab === 'pending' && !(processRoute === 'purchase' && routeStatus === 'pending')) continue;
        if (tab === 'picking' && !(processRoute === 'picking' && routeStatus === 'pending')) continue;
        if (tab === 'completed' && routeStatus !== 'completed') continue;

        const phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(pendingPurchaseAt);
        const materialDone = routeStatus === 'completed';
        const endRaw = processRoute === 'purchase' ? m.purchaseCompletedAt : m.pickCompletedAt;
        const phaseEnd = materialDone ? this.orderStatusConfigService.parseProductionPhaseInstant(endRaw) : null;
        const timeRating = this.orderStatusConfigService.judgeProductionPhaseDuration(
          'pending_purchase',
          phaseStart,
          phaseEnd,
          order.status ?? '',
          slaCtx,
        );

        rows.push({
          orderId: order.id,
          materialIndex: i,
          orderNo: order.orderNo ?? '',
          orderDate: orderDate,
          pendingPurchaseAt,
          imageUrl: order.imageUrl ?? '',
          skuCode: order.skuCode ?? '',
          orderTypeId: order.orderTypeId ?? null,
          supplierName: supplierName || '-',
          materialTypeId: m.materialTypeId ?? null,
          materialType: (m.materialType ?? '').trim() || this.getMaterialTypeLabelById(m.materialTypeId ?? null) || '',
          materialName: (m.materialName ?? '').trim() || '-',
          color: (m.color ?? '').trim() || '',
          planQuantity: m.purchaseQuantity ?? m.orderPieces ?? null,
          actualPurchaseQuantity: m.actualPurchaseQuantity ?? null,
          purchaseAmount: m.purchaseAmount ?? null,
          purchaseStatus: purchaseStatus === 'completed' ? 'completed' : 'pending',
          pickStatus: pickStatus === 'completed' ? 'completed' : 'pending',
          purchaseCompletedAt: m.purchaseCompletedAt ?? null,
          pickCompletedAt: m.pickCompletedAt ?? null,
          purchaseUnitPrice: m.purchaseUnitPrice ?? null,
          purchaseOtherCost: m.purchaseOtherCost ?? null,
          purchaseRemark: m.purchaseRemark ?? null,
          purchaseImageUrl: m.purchaseImageUrl ?? null,
          materialSourceId,
          materialSource,
          processRoute,
          timeRating,
          customerName: order.customerName ?? '',
          merchandiser: order.merchandiser ?? '',
          customerDueDate: this.toDateOnlyLocalString(order.customerDueDate),
          orderQuantity: order.quantity ?? 0,
        });
      }
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);

    return { list, total, page, pageSize };
  }

  async registerPurchase(
    orderId: number,
    materialIndex: number,
    actualPurchaseQuantity: number,
    unitPrice: string,
    otherCost: string,
    remark: string | null | undefined,
    imageUrl: string | null | undefined,
    actorUserId?: number,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    let ext = await this.orderExtRepo.findOne({ where: { orderId } });
    if (!ext || !Array.isArray(ext.materials)) {
      throw new NotFoundException('该订单无物料数据');
    }
    if (materialIndex < 0 || materialIndex >= ext.materials.length) {
      throw new NotFoundException('物料索引无效');
    }

    const materials = [...ext.materials];
    const row = materials[materialIndex] as OrderMaterialRow;
    await this.ensureMaterialSourceOptionCache();
    const sourceLabel = this.getMaterialSourceLabelById(row.materialSourceId ?? null);
    if (this.resolveMaterialRouteBySourceLabel(sourceLabel) !== 'purchase') {
      throw new NotFoundException('该物料来源不在等待采购流程，请使用领料处理');
    }

    const normalizedQty = Number.isFinite(actualPurchaseQuantity) ? actualPurchaseQuantity : 0;
    const normalizedUnit = Number(this.normalizeDecimalInput(unitPrice)) || 0;
    const normalizedOther = Number(this.normalizeDecimalInput(otherCost)) || 0;
    const total = normalizedQty * normalizedUnit + normalizedOther;
    const totalStr = Number.isFinite(total) ? total.toFixed(2) : '0';

    materials[materialIndex] = {
      ...row,
      purchaseStatus: 'completed',
      actualPurchaseQuantity: normalizedQty,
      purchaseUnitPrice: this.normalizeDecimalInput(unitPrice),
      purchaseOtherCost: this.normalizeDecimalInput(otherCost),
      purchaseAmount: totalStr,
      purchaseCompletedAt: this.toDateTimeLocalString(new Date()),
      purchaseRemark: (remark ?? '').trim() || null,
      purchaseImageUrl: (imageUrl ?? '').trim() || null,
    };
    ext.materials = materials;
    await this.orderExtRepo.save(ext);
    await this.suppliersService.touchLastActiveByNames([row?.supplierName ?? '']);

    // 若该订单全部物料采购完成，则按配置规则流转
    if (order.status === 'pending_purchase') {
      const allCompleted = materials.length > 0 && materials.every((m) => this.isMaterialFlowCompleted(m));
      if (allCompleted) {
        let next: string | null = await this.orderWorkflowService.resolveNextStatus({
          order,
          triggerCode: 'purchase_all_completed',
          actorUserId: actorUserId ?? 0,
        });
        if (next && next !== order.status) {
          order.status = next;
          order.statusTime = new Date();
          await this.orderRepo.save(order);
        }
      }
    }
  }

  async registerPicking(params: {
    orderId: number;
    materialIndex: number;
    inventorySourceType?: 'fabric' | 'accessory' | 'finished' | null;
    inventoryId?: number | null;
    quantity?: number | null;
    stockBatch?: string | null;
    stockColorCode?: string | null;
    stockSpec?: string | null;
    remark?: string | null;
    actorUserId?: number;
    actorUsername?: string;
  }): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: params.orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const ext = await this.orderExtRepo.findOne({ where: { orderId: params.orderId } });
    if (!ext || !Array.isArray(ext.materials)) throw new NotFoundException('该订单无物料数据');
    if (params.materialIndex < 0 || params.materialIndex >= ext.materials.length) throw new NotFoundException('物料索引无效');
    await this.ensureMaterialSourceOptionCache();

    const materials = [...ext.materials];
    const row = { ...(materials[params.materialIndex] as OrderMaterialRow) };
    const sourceLabel = this.getMaterialSourceLabelById(row.materialSourceId ?? null);
    if (this.resolveMaterialRouteBySourceLabel(sourceLabel) !== 'picking') {
      throw new NotFoundException('该物料来源不在待领料流程，请使用采购登记');
    }

    const operatorName = await this.resolveOperatorName(params.actorUserId, params.actorUsername ?? '');
    const remark = (params.remark ?? '').trim();
    const inventorySourceType = params.inventorySourceType ?? null;
    const inventoryId = params.inventoryId != null ? Number(params.inventoryId) : null;
    const quantity = params.quantity != null ? Number(params.quantity) : null;
    const shouldUseStock = !!(inventorySourceType && inventoryId && quantity && quantity > 0);
    let inventoryName: string | null = null;

    if (!shouldUseStock && !remark) {
      throw new NotFoundException('请选择库存并填写调取数量，或至少填写备注说明');
    }

    if (shouldUseStock) {
      if (inventorySourceType === 'fabric') {
        const stock = await this.fabricStockService.getOne(inventoryId!);
        inventoryName = stock.name ?? '';
        await this.fabricStockService.outbound(
          inventoryId!,
          quantity!,
          '',
          `领料出库 订单:${order.orderNo} SKU:${order.skuCode ?? ''} 物料:${row.materialName ?? ''} 来源:${sourceLabel} 批次:${params.stockBatch ?? ''} 色号:${params.stockColorCode ?? ''} 规格:${params.stockSpec ?? ''} 备注:${remark}`,
          operatorName,
          params.actorUserId != null && Number.isFinite(Number(params.actorUserId))
            ? Number(params.actorUserId)
            : null,
        );
      } else if (inventorySourceType === 'accessory') {
        const stock = await this.inventoryAccessoriesService.getOne(inventoryId!);
        inventoryName = stock.name ?? '';
        await this.inventoryAccessoriesService.outbound({
          accessoryId: inventoryId!,
          quantity: quantity!,
          outboundType: 'manual',
          operatorUsername: operatorName,
          remark: `领料出库 订单:${order.orderNo} SKU:${order.skuCode ?? ''} 物料:${row.materialName ?? ''} 来源:${sourceLabel} 批次:${params.stockBatch ?? ''} 色号:${params.stockColorCode ?? ''} 规格:${params.stockSpec ?? ''} ${remark}`,
          orderId: order.id,
          orderNo: order.orderNo,
        });
      } else if (inventorySourceType === 'finished') {
        const detail = await this.finishedGoodsStockService.getDetail(inventoryId!);
        inventoryName = detail.stock.skuCode ?? '';
        await this.finishedGoodsStockService.outbound(
          [{ id: inventoryId!, quantity: quantity!, sizeBreakdown: null }],
          operatorName,
          `领料出库 订单:${order.orderNo} SKU:${order.skuCode ?? ''} 物料:${row.materialName ?? ''} 来源:${sourceLabel} 批次:${params.stockBatch ?? ''} 色号:${params.stockColorCode ?? ''} 规格:${params.stockSpec ?? ''} ${remark}`,
          null,
        );
      } else {
        throw new NotFoundException('不支持的库存来源类型');
      }
    }

    const now = this.toDateTimeLocalString(new Date()) ?? '';
    const nextLogs = Array.isArray(row.pickLogs) ? [...row.pickLogs] : [];
    nextLogs.push({
      handledAt: now,
      handledBy: operatorName,
      mode: shouldUseStock ? 'with_stock' : 'remark_only',
      inventorySourceType,
      inventoryId,
      inventoryName,
      stockBatch: (params.stockBatch ?? '').trim() || null,
      stockColorCode: (params.stockColorCode ?? '').trim() || null,
      stockSpec: (params.stockSpec ?? '').trim() || null,
      quantity: shouldUseStock ? quantity : null,
      remark: remark || null,
    });

    materials[params.materialIndex] = {
      ...row,
      pickStatus: 'completed',
      pickCompletedAt: now,
      pickRemark: remark || null,
      pickLogs: nextLogs,
    };
    ext.materials = materials;
    await this.orderExtRepo.save(ext);

    if (order.status === 'pending_purchase') {
      const allCompleted = materials.length > 0 && materials.every((m) => this.isMaterialFlowCompleted(m));
      if (allCompleted) {
        const next = await this.orderWorkflowService.resolveNextStatus({
          order,
          triggerCode: 'purchase_all_completed',
          actorUserId: params.actorUserId ?? 0,
        });
        if (next && next !== order.status) {
          order.status = next;
          order.statusTime = new Date();
          await this.orderRepo.save(order);
        }
      }
    }
  }
}
