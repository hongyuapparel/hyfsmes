import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
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
import { OrderCostSnapshot } from '../entities/order-cost-snapshot.entity';
import { User } from '../entities/user.entity';
import { OrderCutting, type ActualCutRow } from '../entities/order-cutting.entity';
import { OrderSewing } from '../entities/order-sewing.entity';
import { OrderFinishing } from '../entities/order-finishing.entity';
import { OrderCraft } from '../entities/order-craft.entity';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { Product } from '../entities/product.entity';
import { RoleOrderPolicy } from '../entities/role-order-policy.entity';
import { Role } from '../entities/role.entity';
import { InventoryAccessoriesService } from '../inventory-accessories/inventory-accessories.service';
import { SystemOptionsService } from '../system-options/system-options.service';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { SuppliersService } from '../suppliers/suppliers.service';

const ORDER_STATUS_LABEL_MAP: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审单',
  pending_pattern: '待纸样',
  pending_purchase: '待采购',
  pending_cutting: '待裁床',
  pending_sewing: '待车缝',
  pending_finishing: '待尾部',
  completed: '订单完成',
};

export interface OrderListQuery {
  /** 订单号 */
  orderNo?: string;
  /** SKU 编号 */
  skuCode?: string;
  /** 客户名称（模糊） */
  customer?: string;
  /** 工艺项目（原二次工艺） */
  processItem?: string;
  /** 业务员 */
  salesperson?: string;
  /** 跟单员 */
  merchandiser?: string;
  /** 下单时间开始（YYYY-MM-DD） */
  orderDateStart?: string;
  /** 下单时间结束（YYYY-MM-DD） */
  orderDateEnd?: string;
  /** 完成时间开始（YYYY-MM-DD，仅对已完成订单生效，取 status_time） */
  completedStart?: string;
  /** 完成时间结束（YYYY-MM-DD，仅对已完成订单生效，取 status_time） */
  completedEnd?: string;
  /** 客户交期开始（YYYY-MM-DD） */
  customerDueStart?: string;
  /** 客户交期结束（YYYY-MM-DD） */
  customerDueEnd?: string;
  /** 加工厂 */
  factory?: string;
  /** 状态（对应状态 Tab 的内部 code，可选） */
  status?: string;
  /** 订单类型 ID（system_options.id, option_type='order_types'） */
  orderTypeId?: number | null;
  /** 合作方式 ID（system_options.id, option_type='collaboration'） */
  collaborationTypeId?: number | null;
  /** 分页 */
  page?: number;
  pageSize?: number;
}

export interface OrderEditPayload {
  skuCode?: string;
  customerId?: number | null;
  customerName?: string;
  /** 合作方式 ID（system_options.id, option_type='collaboration'） */
  collaborationTypeId?: number | null;
  /** 订单类型 ID（system_options.id, option_type='order_types'） */
  orderTypeId?: number | null;
  salesperson?: string;
  merchandiser?: string;
  quantity?: number;
  exFactoryPrice?: string;
  salePrice?: string;
  /** 工艺项目（原二次工艺） */
  processItem?: string;
  orderDate?: string | null;
  customerDueDate?: string | null;
  factoryName?: string;
  imageUrl?: string;
  /** B 区尺码表头（存 order_ext.colorSizeHeaders） */
  colorSizeHeaders?: string[];
  /** B 区颜色尺码数量行（存 order_ext.colorSizeRows） */
  colorSizeRows?: ColorSizeRow[];
  /** C 区物料列表（存 order_ext.materials） */
  materials?: OrderMaterialRow[];
  /** D 区：尺寸信息表头（存 order_ext.sizeInfoMetaHeaders） */
  sizeInfoMetaHeaders?: string[];
  /** D 区：尺寸信息行（存 order_ext.sizeInfoRows） */
  sizeInfoRows?: SizeInfoRow[];
  /** E 区：工艺项目（存 order_ext.processItems） */
  processItems?: ProcessRow[];
  /** F 区：生产要求（存 order_ext.productionRequirement） */
  productionRequirement?: string;
  /** G 区：包装表头（存 order_ext.packagingHeaders） */
  packagingHeaders?: string[];
  /** G 区：包装单元格（存 order_ext.packagingCells） */
  packagingCells?: PackagingCell[];
  /** G 区：包装方式（存 order_ext.packagingMethod） */
  packagingMethod?: string;
  /** H 区：图片附件（存 order_ext.attachments） */
  attachments?: string[];
}

export interface OrderActor {
  userId: number;
  username: string;
}

@Injectable()
export class OrdersService {
  private craftReconcileRunning = false;
  private craftReconcileLastRunAt = 0;
  private readonly craftReconcileIntervalMs = 5 * 60 * 1000;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(OrderOperationLog)
    private readonly orderLogRepo: Repository<OrderOperationLog>,
    @InjectRepository(OrderRemark)
    private readonly orderRemarkRepo: Repository<OrderRemark>,
    @InjectRepository(OrderCostSnapshot)
    private readonly orderCostSnapshotRepo: Repository<OrderCostSnapshot>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(OrderCutting)
    private readonly orderCuttingRepo: Repository<OrderCutting>,
    @InjectRepository(OrderSewing)
    private readonly orderSewingRepo: Repository<OrderSewing>,
    @InjectRepository(OrderFinishing)
    private readonly orderFinishingRepo: Repository<OrderFinishing>,
    @InjectRepository(OrderCraft)
    private readonly orderCraftRepo: Repository<OrderCraft>,
    @InjectRepository(OrderStatus)
    private readonly orderStatusRepo: Repository<OrderStatus>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoryRepo: Repository<OrderStatusHistory>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(RoleOrderPolicy)
    private readonly roleOrderPolicyRepo: Repository<RoleOrderPolicy>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly inventoryAccessoriesService: InventoryAccessoriesService,
    private readonly systemOptionsService: SystemOptionsService,
    private readonly orderWorkflowService: OrderWorkflowService,
    private readonly suppliersService: SuppliersService,
  ) {}

  private collectSupplierNamesFromOrderExt(ext: OrderExt | null | undefined): string[] {
    if (!ext) return [];
    const names: string[] = [];
    const materials = Array.isArray(ext.materials) ? ext.materials : [];
    for (const m of materials) {
      const name = (m?.supplierName ?? '').trim();
      if (name) names.push(name);
    }
    const processItems = Array.isArray(ext.processItems) ? ext.processItems : [];
    for (const p of processItems) {
      const name = (p?.supplierName ?? '').trim();
      if (name) names.push(name);
    }
    return names;
  }

  private async touchSuppliersActiveByOrderId(orderId: number): Promise<void> {
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const names = this.collectSupplierNamesFromOrderExt(ext);
    await this.suppliersService.touchLastActiveByNames(names);
  }

  /**
   * 自愈历史数据：工艺已完成但订单状态未按链路流转时，按 craft_completed 规则补齐。
   */
  private async reconcileCraftCompletedOrders(actorUserId?: number): Promise<void> {
    if (typeof actorUserId !== 'number') return;
    const crafts = await this.orderCraftRepo.find({ where: { status: 'completed' } });
    if (!crafts.length) return;
    const orderIds = crafts.map((c) => c.orderId);
    const orders = await this.orderRepo.find({ where: { id: In(orderIds) } });
    if (!orders.length) return;
    const craftMap = new Map(crafts.map((c) => [c.orderId, c]));
    for (const order of orders) {
      const next = await this.orderWorkflowService.resolveNextStatus({
        order,
        triggerCode: 'craft_completed',
        actorUserId,
      });
      if (!next || next === order.status) continue;
      const craft = craftMap.get(order.id);
      order.status = next;
      order.statusTime = craft?.completedAt ?? new Date();
      await this.orderRepo.save(order);
    }
  }

  /**
   * 列表接口不应被“自愈任务”阻塞：
   * - 改为后台异步执行
   * - 增加并发锁 + 最小间隔，避免列表与状态统计并发时重复全量扫描
   */
  private scheduleCraftReconcile(actorUserId?: number): void {
    if (typeof actorUserId !== 'number') return;
    if (this.craftReconcileRunning) return;
    const now = Date.now();
    if (now - this.craftReconcileLastRunAt < this.craftReconcileIntervalMs) return;

    this.craftReconcileRunning = true;
    this.craftReconcileLastRunAt = now;
    void this.reconcileCraftCompletedOrders(actorUserId)
      .catch(() => {
        // 自愈失败不影响列表主链路；下个间隔继续尝试。
      })
      .finally(() => {
        this.craftReconcileRunning = false;
      });
  }

  /** 持久化时只存 materialTypeId，不存 materialType（改名历史同步） */
  private normalizeMaterialRows(rows: OrderMaterialRow[]): OrderMaterialRow[] {
    return rows.map((row) => {
      const { materialType: _drop, ...rest } = row;
      return rest as OrderMaterialRow;
    });
  }

  /** 按 materialTypeId 解析物料类型名称，供前端展示 */
  private async enrichMaterialsWithMaterialTypeLabel(materials: OrderMaterialRow[]): Promise<OrderMaterialRow[]> {
    if (!materials.length) return materials;
    const options = await this.systemOptionsService.findAllByType('material_types');
    const idToValue = new Map(options.map((o) => [o.id, o.value]));
    return materials.map((row) => ({
      ...row,
      materialType: row.materialTypeId != null ? (idToValue.get(row.materialTypeId) ?? '') : '',
    }));
  }

  /** 裁床明细行求和，供列表展示裁床总数 */
  private sumActualCut(rows: ActualCutRow[] | null | undefined): number | null {
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

  private async autoOutboundAccessoriesByPackagingCells(
    order: Order & { packagingCells?: PackagingCell[] },
    actor: OrderActor,
  ): Promise<void> {
    const cells = Array.isArray((order as any).packagingCells) ? ((order as any).packagingCells as PackagingCell[]) : [];
    if (!cells.length) return;
    const orderQty = Number(order.quantity) || 0;
    if (orderQty <= 0) return;

    // 每个包装项默认按“1 个/件”出库；若同一辅料被选择多次，则按次数累计
    const countById = new Map<number, number>();
    cells.forEach((c) => {
      const id = Number((c as any).accessoryId);
      if (!id || Number.isNaN(id)) return;
      countById.set(id, (countById.get(id) ?? 0) + 1);
    });
    if (!countById.size) return;

    for (const [accessoryId, times] of countById.entries()) {
      const qty = orderQty * (times || 1);
      await this.inventoryAccessoriesService.outbound({
        accessoryId,
        quantity: qty,
        outboundType: 'order_auto',
        operatorUsername: actor.username,
        remark: `订单自动出库：${order.orderNo}（${orderQty} * ${times}）`,
        orderId: order.id,
        orderNo: order.orderNo,
      });
    }
  }

  private formatLogDetail(detail: string): string {
    if (!detail) return '';
    let result = detail;

    // 统一裁剪日期时间，只保留 YYYY-MM-DD
    result = result.replace(/(\d{4}-\d{2}-\d{2})T[0-9:.Z+-]*/g, '$1');

    // 将英文状态码替换为中文状态名
    Object.entries(ORDER_STATUS_LABEL_MAP).forEach(([code, label]) => {
      const reg = new RegExp(`\\b${code}\\b`, 'g');
      result = result.replace(reg, label);
    });

    return result;
  }

  /** 订单状态变更时写入流转历史，供时效报表统计 */
  private async appendStatusHistory(orderId: number, statusCode: string): Promise<void> {
    const code = (statusCode ?? '').trim();
    if (!code) return;
    const status = await this.orderStatusRepo.findOne({ where: { code } });
    if (!status) return;
    await this.orderStatusHistoryRepo.save(
      this.orderStatusHistoryRepo.create({ orderId, statusId: status.id }),
    );
  }

  private async addLog(order: Order, actor: OrderActor, action: string, detail: string): Promise<void> {
    let operatorUsername = actor.username;
    try {
      const user = await this.userRepo.findOne({ where: { id: actor.userId } });
      if (user) {
        operatorUsername = (user.displayName && user.displayName.trim()) || user.username || actor.username;
      }
    } catch {
      // 读取用户信息失败时，回退为 JWT 中的 username
      operatorUsername = actor.username;
    }

    const normalizedDetail = this.formatLogDetail(detail);
    if (!normalizedDetail?.trim()) return;

    // 合并策略：同一订单 + 同一操作者 + 同一操作类型，在短时间内连续产生的记录合并为一条，避免刷屏
    const MERGE_WINDOW_MS = 3000;
    const since = new Date(Date.now() - MERGE_WINDOW_MS);
    const latest = await this.orderLogRepo
      .createQueryBuilder('l')
      .where('l.order_id = :orderId', { orderId: order.id })
      .andWhere('l.operator_username = :operatorUsername', { operatorUsername })
      .andWhere('l.action = :action', { action })
      .andWhere('l.created_at >= :since', { since })
      .orderBy('l.created_at', 'DESC')
      .getOne();

    if (latest) {
      const prev = this.formatLogDetail(latest.detail || '').trim();
      const next = normalizedDetail.trim();
      if (prev && prev !== next) {
        latest.detail = this.formatLogDetail(`${prev}; ${next}`);
        await this.orderLogRepo.save(latest);
      }
      return;
    }

    const log = this.orderLogRepo.create({
      orderId: order.id,
      orderNo: order.orderNo,
      operatorUsername,
      action,
      detail: normalizedDetail,
    });
    await this.orderLogRepo.save(log);
  }

  private buildUpdateChangesDescription(before: Order, payload: OrderEditPayload): string {
    const changes: string[] = [];

    const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v);
    const toDateOnly = (v: string | null | undefined): string => {
      if (!v) return '';
      const s = v.trim();
      if (!s) return '';
      return s.length > 10 ? s.slice(0, 10) : s;
    };

    if (payload.skuCode !== undefined && trim(payload.skuCode) !== before.skuCode) {
      changes.push(`SKU: ${before.skuCode || '-'} -> ${trim(payload.skuCode) || '-'}`);
    }
    if (payload.customerName !== undefined && trim(payload.customerName) !== before.customerName) {
      changes.push(`客户名称: ${before.customerName || '-'} -> ${trim(payload.customerName) || '-'}`);
    }
    if (payload.salesperson !== undefined && trim(payload.salesperson) !== before.salesperson) {
      changes.push(`业务员: ${before.salesperson || '-'} -> ${trim(payload.salesperson) || '-'}`);
    }
    if (payload.merchandiser !== undefined && trim(payload.merchandiser) !== before.merchandiser) {
      changes.push(`跟单员: ${before.merchandiser || '-'} -> ${trim(payload.merchandiser) || '-'}`);
    }
    if (payload.quantity !== undefined && payload.quantity !== before.quantity) {
      changes.push(`数量: ${before.quantity} -> ${payload.quantity ?? 0}`);
    }
    if (payload.exFactoryPrice !== undefined && this.normalizeDecimalInput(payload.exFactoryPrice) !== before.exFactoryPrice) {
      changes.push(`出厂价: ${before.exFactoryPrice} -> ${this.normalizeDecimalInput(payload.exFactoryPrice)}`);
    }
    if (payload.salePrice !== undefined && this.normalizeDecimalInput(payload.salePrice) !== before.salePrice) {
      changes.push(`销售价: ${before.salePrice} -> ${this.normalizeDecimalInput(payload.salePrice)}`);
    }
    // 订单类型改动的文字描述后续可根据 orderTypeId 映射 system_options 生成；
    // 这里先不记录具体值，避免依赖已删除的 label 字段。
    if (payload.processItem !== undefined && trim(payload.processItem) !== before.processItem) {
      changes.push(`工艺项目: ${before.processItem || '-'} -> ${trim(payload.processItem) || '-'}`);
    }
    if (payload.orderDate !== undefined) {
      const beforeVal = before.orderDate ? before.orderDate.toISOString().slice(0, 10) : '';
      const nextVal = toDateOnly(payload.orderDate ?? null);
      if (nextVal !== beforeVal) {
        changes.push(`下单日期: ${beforeVal || '-'} -> ${nextVal || '-'}`);
      }
    }
    if (payload.customerDueDate !== undefined) {
      const beforeVal = before.customerDueDate ? before.customerDueDate.toISOString().slice(0, 10) : '';
      const nextVal = toDateOnly(payload.customerDueDate ?? null);
      if (nextVal !== beforeVal) {
        changes.push(`客户交期: ${beforeVal || '-'} -> ${nextVal || '-'}`);
      }
    }
    if (payload.factoryName !== undefined && trim(payload.factoryName) !== before.factoryName) {
      changes.push(`加工厂: ${before.factoryName || '-'} -> ${trim(payload.factoryName) || '-'}`);
    }

    return changes.length ? changes.join('; ') : '无关键字段变更';
  }

  private applyListFilters(qb: SelectQueryBuilder<Order>, query: OrderListQuery, options?: { includeStatus?: boolean }) {
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
    } = query;
    const includeStatus = options?.includeStatus ?? true;

    if (orderNo?.trim()) {
      qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    }
    if (skuCode?.trim()) {
      qb.andWhere('o.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    }
    if (customer?.trim()) {
      qb.andWhere('o.customer_name LIKE :customer', { customer: `%${customer.trim()}%` });
    }
    if (typeof query.orderTypeId === 'number') {
      qb.andWhere('o.order_type_id = :orderTypeId', { orderTypeId: query.orderTypeId });
    }
    if (typeof query.collaborationTypeId === 'number') {
      qb.andWhere('o.collaboration_type_id = :collaborationTypeId', {
        collaborationTypeId: query.collaborationTypeId,
      });
    }
    if (processItem?.trim()) {
      qb.andWhere('o.process_item LIKE :processItem', { processItem: `%${processItem.trim()}%` });
    }
    if (salesperson?.trim()) {
      qb.andWhere('o.salesperson = :salesperson', { salesperson: salesperson.trim() });
    }
    if (merchandiser?.trim()) {
      qb.andWhere('o.merchandiser = :merchandiser', { merchandiser: merchandiser.trim() });
    }
    if (factory?.trim()) {
      qb.andWhere('o.factory_name LIKE :factory', { factory: `%${factory.trim()}%` });
    }
    if (includeStatus && status?.trim()) {
      qb.andWhere('o.status = :status', { status: status.trim() });
    }
    if (orderDateStart) {
      qb.andWhere('o.order_date >= :orderDateStart', { orderDateStart: `${orderDateStart} 00:00:00` });
    }
    if (orderDateEnd) {
      qb.andWhere('o.order_date <= :orderDateEnd', { orderDateEnd: `${orderDateEnd} 23:59:59` });
    }
    if (completedStart || completedEnd) {
      // 完成时间：取订单状态为 completed 时的 status_time
      qb.andWhere('o.status = :completedStatus', { completedStatus: 'completed' });
      if (completedStart) {
        qb.andWhere('o.status_time >= :completedStart', { completedStart: `${completedStart} 00:00:00` });
      }
      if (completedEnd) {
        qb.andWhere('o.status_time <= :completedEnd', { completedEnd: `${completedEnd} 23:59:59` });
      }
    }
    if (customerDueStart) {
      qb.andWhere('o.customer_due_date >= :customerDueStart', { customerDueStart: `${customerDueStart} 00:00:00` });
    }
    if (customerDueEnd) {
      qb.andWhere('o.customer_due_date <= :customerDueEnd', { customerDueEnd: `${customerDueEnd} 23:59:59` });
    }
  }

  /**
   * MySQL decimal 字段不接受空字符串。
   * 表单未填写时前端可能传 ''，这里统一归一为 '0'（与实体 default=0 一致）。
   */
  private normalizeDecimalInput(v: unknown): string {
    if (v === null || v === undefined) return '0';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
    if (typeof v === 'string') {
      const t = v.trim();
      return t ? t : '0';
    }
    return '0';
  }

  /**
   * 根据主键获取订单详情（含 order_ext 扩展字段）
   */
  async findOne(
    id: number,
  ): Promise<
    Order & {
      materials?: OrderMaterialRow[];
      colorSizeHeaders?: string[];
      colorSizeRows?: ColorSizeRow[];
      sizeInfoMetaHeaders?: string[];
      sizeInfoRows?: SizeInfoRow[];
      processItems?: ProcessRow[];
      productionRequirement?: string;
      packagingHeaders?: string[];
      packagingCells?: PackagingCell[];
      packagingMethod?: string;
      attachments?: string[];
      productGroupId?: number | null;
      productGroupName?: string;
      applicablePeopleId?: number | null;
      applicablePeopleName?: string;
    }
  > {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const ext = await this.orderExtRepo.findOne({ where: { orderId: id } });
    const rawMaterials = ext?.materials ?? [];
    const materials = await this.enrichMaterialsWithMaterialTypeLabel(rawMaterials);
    const colorSizeHeaders = ext?.colorSizeHeaders ?? [];
    const colorSizeRows = ext?.colorSizeRows ?? [];
    const sizeInfoMetaHeaders = ext?.sizeInfoMetaHeaders ?? [];
    const sizeInfoRows = ext?.sizeInfoRows ?? [];
    const processItems = ext?.processItems ?? [];
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
      const product = await this.productRepo.findOne({
        where: { skuCode },
      });
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

  /**
   * 创建草稿订单
   */
  async createDraft(payload: OrderEditPayload, actor: OrderActor): Promise<Order> {
    const now = new Date();
    const entity = this.orderRepo.create({
      orderNo: await this.generateNextOrderNo(),
      skuCode: payload.skuCode?.trim() || '',
      customerId: payload.customerId ?? null,
      customerName: payload.customerName?.trim() || '',
      collaborationTypeId:
        typeof payload.collaborationTypeId === 'number' ? payload.collaborationTypeId : null,
      salesperson: payload.salesperson?.trim() || '',
      merchandiser: payload.merchandiser?.trim() || '',
      quantity: payload.quantity ?? 0,
      exFactoryPrice: this.normalizeDecimalInput(payload.exFactoryPrice),
      salePrice: this.normalizeDecimalInput(payload.salePrice),
      orderTypeId:
        typeof payload.orderTypeId === 'number' ? payload.orderTypeId : null,
      processItem: payload.processItem?.trim() || '',
      orderDate: payload.orderDate ? new Date(payload.orderDate) : now,
      customerDueDate: payload.customerDueDate ? new Date(payload.customerDueDate) : null,
      factoryName: payload.factoryName?.trim() || '',
      imageUrl: payload.imageUrl?.trim() || '',
      status: 'draft',
      statusTime: now,
    });
    const saved = await this.orderRepo.save(entity);
    const extPayload: Partial<OrderExt> = { orderId: saved.id };
    if (payload.materials && Array.isArray(payload.materials)) extPayload.materials = this.normalizeMaterialRows(payload.materials);
    if (payload.colorSizeHeaders && Array.isArray(payload.colorSizeHeaders)) extPayload.colorSizeHeaders = payload.colorSizeHeaders;
    if (payload.colorSizeRows && Array.isArray(payload.colorSizeRows)) extPayload.colorSizeRows = payload.colorSizeRows;
    if (payload.sizeInfoMetaHeaders && Array.isArray(payload.sizeInfoMetaHeaders)) {
      extPayload.sizeInfoMetaHeaders = payload.sizeInfoMetaHeaders;
    }
    if (payload.sizeInfoRows && Array.isArray(payload.sizeInfoRows)) {
      extPayload.sizeInfoRows = payload.sizeInfoRows;
    }
    if (payload.processItems && Array.isArray(payload.processItems)) {
      extPayload.processItems = payload.processItems;
    }
    if (typeof payload.productionRequirement === 'string') {
      extPayload.productionRequirement = payload.productionRequirement;
    }
    if (payload.packagingHeaders && Array.isArray(payload.packagingHeaders)) {
      extPayload.packagingHeaders = payload.packagingHeaders;
    }
    if (payload.packagingCells && Array.isArray(payload.packagingCells)) {
      extPayload.packagingCells = payload.packagingCells;
    }
    if (typeof payload.packagingMethod === 'string') {
      extPayload.packagingMethod = payload.packagingMethod;
    }
    if (payload.attachments && Array.isArray(payload.attachments)) {
      extPayload.attachments = payload.attachments;
    }
    if (
      extPayload.materials ||
      extPayload.colorSizeHeaders ||
      extPayload.colorSizeRows ||
      extPayload.sizeInfoMetaHeaders ||
      extPayload.sizeInfoRows ||
      extPayload.processItems ||
      extPayload.productionRequirement ||
      extPayload.packagingHeaders ||
      extPayload.packagingCells ||
      extPayload.packagingMethod ||
      extPayload.attachments
    ) {
      await this.orderExtRepo.save(this.orderExtRepo.create(extPayload));
    }
    await this.addLog(saved, actor, 'create', '创建订单草稿');
    await this.appendStatusHistory(saved.id, 'draft');
    return saved;
  }

  /**
   * 更新草稿订单（只更新传入字段）
   */
  async updateDraft(id: number, payload: OrderEditPayload, actor: OrderActor): Promise<Order> {
    const order = await this.findOne(id);
    const before = { ...order };
    if (payload.skuCode !== undefined) order.skuCode = payload.skuCode.trim();
    if (payload.customerId !== undefined) order.customerId = payload.customerId;
    if (payload.customerName !== undefined) order.customerName = payload.customerName.trim();
    if (payload.collaborationTypeId !== undefined) {
      order.collaborationTypeId =
        typeof payload.collaborationTypeId === 'number' ? payload.collaborationTypeId : null;
    }
    if (payload.salesperson !== undefined) order.salesperson = payload.salesperson.trim();
    if (payload.merchandiser !== undefined) order.merchandiser = payload.merchandiser.trim();
    if (payload.quantity !== undefined) order.quantity = payload.quantity ?? 0;
    if (payload.exFactoryPrice !== undefined) order.exFactoryPrice = this.normalizeDecimalInput(payload.exFactoryPrice);
    if (payload.salePrice !== undefined) order.salePrice = this.normalizeDecimalInput(payload.salePrice);
    if (payload.orderTypeId !== undefined) {
      order.orderTypeId =
        typeof payload.orderTypeId === 'number' ? payload.orderTypeId : null;
    }
    if (payload.processItem !== undefined) order.processItem = payload.processItem.trim();
    if (payload.orderDate !== undefined) {
      order.orderDate = payload.orderDate ? new Date(payload.orderDate) : null;
    }
    if (payload.customerDueDate !== undefined) {
      order.customerDueDate = payload.customerDueDate ? new Date(payload.customerDueDate) : null;
    }
    if (payload.factoryName !== undefined) order.factoryName = payload.factoryName.trim();
    if (payload.imageUrl !== undefined) order.imageUrl = payload.imageUrl.trim();
    const saved = await this.orderRepo.save(order);
    if (
      payload.materials !== undefined ||
      payload.colorSizeHeaders !== undefined ||
      payload.colorSizeRows !== undefined ||
      payload.sizeInfoMetaHeaders !== undefined ||
      payload.sizeInfoRows !== undefined ||
      payload.processItems !== undefined ||
      payload.productionRequirement !== undefined ||
      payload.packagingHeaders !== undefined ||
      payload.packagingCells !== undefined ||
      payload.packagingMethod !== undefined ||
      payload.attachments !== undefined
    ) {
      let ext = await this.orderExtRepo.findOne({ where: { orderId: id } });
      if (!ext) {
        ext = this.orderExtRepo.create({
          orderId: id,
          materials: payload.materials && Array.isArray(payload.materials) ? this.normalizeMaterialRows(payload.materials) : null,
          colorSizeHeaders: payload.colorSizeHeaders ?? null,
          colorSizeRows: payload.colorSizeRows ?? null,
          sizeInfoMetaHeaders: payload.sizeInfoMetaHeaders ?? null,
          sizeInfoRows: payload.sizeInfoRows ?? null,
          processItems: payload.processItems ?? null,
          productionRequirement: payload.productionRequirement ?? null,
          packagingHeaders: payload.packagingHeaders ?? null,
          packagingCells: payload.packagingCells ?? null,
          packagingMethod: payload.packagingMethod ?? null,
          attachments: payload.attachments ?? null,
        });
      } else {
        if (payload.materials !== undefined) ext.materials = Array.isArray(payload.materials) ? this.normalizeMaterialRows(payload.materials) : payload.materials;
        if (payload.colorSizeHeaders !== undefined) ext.colorSizeHeaders = payload.colorSizeHeaders;
        if (payload.colorSizeRows !== undefined) ext.colorSizeRows = payload.colorSizeRows;
        if (payload.sizeInfoMetaHeaders !== undefined) ext.sizeInfoMetaHeaders = payload.sizeInfoMetaHeaders;
        if (payload.sizeInfoRows !== undefined) ext.sizeInfoRows = payload.sizeInfoRows;
        if (payload.processItems !== undefined) ext.processItems = payload.processItems;
        if (payload.productionRequirement !== undefined) ext.productionRequirement = payload.productionRequirement ?? null;
        if (payload.packagingHeaders !== undefined) ext.packagingHeaders = payload.packagingHeaders;
        if (payload.packagingCells !== undefined) ext.packagingCells = payload.packagingCells;
        if (payload.packagingMethod !== undefined) ext.packagingMethod = payload.packagingMethod ?? null;
        if (payload.attachments !== undefined) ext.attachments = payload.attachments;
      }
      await this.orderExtRepo.save(ext);
    }
    const detail = this.buildUpdateChangesDescription(before, payload);
    // 若无关键字段变更，则不记录操作日志，避免产生冗余记录
    if (detail && detail !== '无关键字段变更') {
      await this.addLog(saved, actor, 'update', detail);
    }

    // 编辑保存后：按订单最新物料/工艺同步成本快照（保留成本页人工维护的单价/利润率/工序等信息）
    await this.syncCostSnapshotFromOrder(id, { keepExistingPricing: true });
    return saved;
  }

  /**
   * 保存并提交：将状态从 draft 等变为 pending_review
   */
  async submit(id: number, actor: OrderActor): Promise<Order> {
    const order = await this.findOne(id);
    const beforeStatus = order.status;
    if (!order.orderNo) {
      order.orderNo = await this.generateNextOrderNo();
    }
    // 下单时间定义为“保存并提交”的时间
    order.orderDate = new Date();
    const next = await this.orderWorkflowService.resolveNextStatus({
      order,
      triggerCode: 'submit',
      actorUserId: actor.userId,
    });
    order.status = next ?? 'pending_review';
    order.statusTime = new Date();
    const saved = await this.orderRepo.save(order);
    // 状态未变化时不记录提交日志（例如：待审单 -> 待审单），避免冗余
    if ((beforeStatus || '') !== (saved.status || '')) {
      await this.addLog(saved, actor, 'submit', `状态: ${beforeStatus || '-'} -> ${saved.status}`);
      await this.appendStatusHistory(saved.id, saved.status);
    }

    // 提交订单时，按订单引用的供应商刷新活跃时间（系统自动维护）
    await this.touchSuppliersActiveByOrderId(saved.id);

    // 订单从草稿首次提交时，按包装辅料自动出库，避免重复提交导致重复扣减
    if (beforeStatus === 'draft') {
      await this.autoOutboundAccessoriesByPackagingCells(order as any, actor);
    }

    // 提交后：仍按订单最新信息同步成本快照，避免“先改订单再提交”导致成本页结构滞后
    await this.syncCostSnapshotFromOrder(id, { keepExistingPricing: true });
    return saved;
  }

  /**
   * 批量删除订单
   */
  async deleteMany(ids: number[], actor: OrderActor): Promise<void> {
    if (!ids?.length) return;
    const orders = await this.orderRepo.findByIds(ids);
    if (!orders.length) return;
    for (const o of orders) {
      await this.addLog(o, actor, 'delete', '删除订单');
    }
    await this.orderRepo.delete(ids);
  }

  /**
   * 待审单批量审核通过（按配置规则流转）
   */
  async reviewMany(ids: number[], actor: OrderActor): Promise<void> {
    if (!ids?.length) return;
    const orders = await this.orderRepo.findByIds(ids);
    for (const o of orders) {
      if (o.status !== 'pending_review') continue;
      const before = o.status;
      const next = await this.orderWorkflowService.resolveNextStatus({
        order: o as Order,
        triggerCode: 'review_approve',
        actorUserId: actor.userId,
      });
      const to = next ?? 'pending_purchase';
      o.status = to;
      o.statusTime = new Date();
      await this.orderRepo.save(o as any);
      if (before !== to) {
        await this.addLog(o as any, actor, 'review', `审核订单：${before} -> ${to}`);
        await this.appendStatusHistory(o.id, to);
      }
    }
  }

  /**
   * 审核退回：待审单 -> 草稿（或按工作流配置回退）
   * 同时自动新增一条备注记录退回原因。
   */
  async reviewRejectMany(ids: number[], reason: string, actor: OrderActor): Promise<void> {
    if (!ids?.length) return;
    const trimmedReason = (reason ?? '').trim();
    if (!trimmedReason) {
      throw new Error('退回原因不能为空');
    }
    const orders = await this.orderRepo.findByIds(ids);
    for (const o of orders) {
      if (o.status !== 'pending_review') continue;
      const before = o.status;
      const next = await this.orderWorkflowService.resolveNextStatus({
        order: o as Order,
        triggerCode: 'review_reject',
        actorUserId: actor.userId,
      });
      const to = next ?? 'draft';
      o.status = to;
      o.statusTime = new Date();
      await this.orderRepo.save(o as any);
      await this.addRemark(o.id, actor, `审核退回原因：${trimmedReason}`);
      if (before !== to) {
        await this.addLog(
          o as any,
          actor,
          'review',
          `审核退回：${before} -> ${to}；原因：${trimmedReason}`,
        );
        await this.appendStatusHistory(o.id, to);
      }
    }
  }

  async copyManyToDraft(ids: number[], actor: OrderActor): Promise<Order[]> {
    if (!ids?.length) return [];
    const now = new Date();
    const sourceOrders = await this.orderRepo.findByIds(ids);
    const created: Order[] = [];

    for (const src of sourceOrders) {
      const draft = this.orderRepo.create({
        orderNo: await this.generateNextOrderNo(),
        skuCode: src.skuCode?.trim() || '',
        customerId: src.customerId ?? null,
        customerName: src.customerName?.trim() || '',
        collaborationTypeId: src.collaborationTypeId ?? null,
        salesperson: src.salesperson?.trim() || '',
        merchandiser: src.merchandiser?.trim() || '',
        quantity: src.quantity ?? 0,
        exFactoryPrice: this.normalizeDecimalInput(src.exFactoryPrice),
        salePrice: this.normalizeDecimalInput(src.salePrice),
        orderTypeId: src.orderTypeId ?? null,
        processItem: src.processItem?.trim() || '',
        orderDate: src.orderDate ?? now,
        customerDueDate: src.customerDueDate ?? null,
        factoryName: src.factoryName?.trim() || '',
        imageUrl: src.imageUrl?.trim() || '',
        status: 'draft',
        statusTime: now,
      });
      const saved = await this.orderRepo.save(draft);
      await this.appendStatusHistory(saved.id, 'draft');

      // 复制扩展表 order_ext：B~H 区所有内容一并带入新草稿，方便在完整基础上修改
      const srcExt = await this.orderExtRepo.findOne({ where: { orderId: src.id } });
      if (srcExt) {
        const newExt = this.orderExtRepo.create({
          orderId: saved.id,
          materials: srcExt.materials ?? null,
          colorSizeHeaders: srcExt.colorSizeHeaders ?? null,
          colorSizeRows: srcExt.colorSizeRows ?? null,
          sizeInfoMetaHeaders: srcExt.sizeInfoMetaHeaders ?? null,
          sizeInfoRows: srcExt.sizeInfoRows ?? null,
          processItems: srcExt.processItems ?? null,
          productionRequirement: srcExt.productionRequirement ?? null,
          packagingHeaders: srcExt.packagingHeaders ?? null,
          packagingCells: srcExt.packagingCells ?? null,
          packagingMethod: srcExt.packagingMethod ?? null,
          attachments: srcExt.attachments ?? null,
        });
        await this.orderExtRepo.save(newExt);
      }

      // 复制订单成本快照（成本页的物料/工艺/工序及利润率），新草稿可沿用原单成本信息
      const srcCost = await this.orderCostSnapshotRepo.findOne({ where: { orderId: src.id } });
      if (srcCost?.snapshot != null) {
        const srcSnapshot =
          srcCost.snapshot && typeof srcCost.snapshot === 'object' ? ({ ...(srcCost.snapshot as any) } as any) : null;
        if (srcSnapshot && Object.prototype.hasOwnProperty.call(srcSnapshot, 'profitMargin')) {
          srcSnapshot.profitMargin = this.normalizeProfitMargin(srcSnapshot.profitMargin);
        }
        const newCost = this.orderCostSnapshotRepo.create({
          orderId: saved.id,
          snapshot: srcSnapshot ?? srcCost.snapshot,
        });
        await this.orderCostSnapshotRepo.save(newCost);
      } else {
        // 源订单未维护成本快照：为新草稿按订单最新物料/工艺生成一份“种子快照”
        await this.syncCostSnapshotFromOrder(saved.id, { keepExistingPricing: true });
      }

      created.push(saved);
      await this.addLog(saved, actor, 'copy_to_draft', `从订单 ${src.orderNo} 复制为草稿`);
    }

    return created;
  }

  /**
   * 订单号生成规则：{年份}{三位流水}
   * 例如：2026 年第一单为 2026001，第二单为 2026002
   */
  private async generateNextOrderNo(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = String(year);
    const last = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.order_no LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('o.order_no', 'DESC')
      .getOne();

    let nextSeq = 1;
    if (last?.orderNo?.startsWith(prefix)) {
      const suffix = last.orderNo.slice(prefix.length);
      const n = parseInt(suffix, 10);
      if (!Number.isNaN(n)) nextSeq = n + 1;
    }
    const seqStr = String(nextSeq).padStart(3, '0');
    return `${prefix}${seqStr}`;
  }

  async findAll(query: OrderListQuery, actorUserId?: number) {
    this.scheduleCraftReconcile(actorUserId);
    const { page = 1, pageSize = 20 } = query;

    const qb = this.orderRepo.createQueryBuilder('o');
    this.applyListFilters(qb, query, { includeStatus: true });

    qb.orderBy('o.id', 'DESC');

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

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
        this.orderCuttingRepo.find({ where: { orderId: In(ids) } }),
        this.orderSewingRepo.find({ where: { orderId: In(ids) } }),
        this.orderFinishingRepo.find({ where: { orderId: In(ids) } }),
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
      // 数量追踪字段：供前端在数量气泡中展示
      actualCutTotal: cutTotalMap[o.id] ?? null,
      sewingQuantity: sewingQtyMap[o.id] ?? null,
      tailReceivedQty: tailReceivedMap[o.id] ?? null,
      tailShippedQty: tailShippedMap[o.id] ?? null,
    }));

    return { list: listWithCount, total, page, pageSize };
  }

  async getSizeBreakdown(orderId: number) {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    const [ext, cutting, sewing, finishing] = await Promise.all([
      this.orderExtRepo.findOne({ where: { orderId } }),
      this.orderCuttingRepo.findOne({ where: { orderId } }),
      this.orderSewingRepo.findOne({ where: { orderId } }),
      this.orderFinishingRepo.findOne({ where: { orderId } }),
    ]);

    const headers = Array.isArray(ext?.colorSizeHeaders) && ext.colorSizeHeaders.length > 0
      ? [...ext.colorSizeHeaders, '合计']
      : ['合计'];
    const sizeLen = Math.max(0, headers.length - 1);

    const buildPerSizeFromRows = (rows: ColorSizeRow[] | ActualCutRow[] | null | undefined): number[] | null => {
      if (!rows || rows.length === 0 || headers.length <= 1) return null;
      const sizeLen = headers.length - 1;
      const sums = Array(sizeLen).fill(0) as number[];
      rows.forEach((row: any) => {
        if (Array.isArray(row.quantities)) {
          row.quantities.forEach((q: any, idx: number) => {
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

    // 1）订单下单件数：来自 order_ext.colorSizeRows
    const orderPerSize = buildPerSizeFromRows((ext as any)?.colorSizeRows ?? null);

    // 2）裁床数量：来自 order_cutting.actualCutRows
    const cutPerSize = buildPerSizeFromRows(cutting?.actualCutRows ?? null);

    // 3）车缝数量：优先使用按尺码明细（sewing_quantity_row），否则回退为总件数
    let sewingRow: (number | null)[] | null = null;
    const sewingQtyRow = sewing?.sewingQuantityRow ?? null;
    if (Array.isArray(sewingQtyRow) && sewingQtyRow.length === headers.length) {
      sewingRow = sewingQtyRow.map((n) => (typeof n === 'number' && Number.isFinite(n) ? n : null));
    } else if (Array.isArray(sewingQtyRow) && sewingQtyRow.length > 0) {
      const sizeLen = Math.max(0, headers.length - 1);
      const total = sewingQtyRow.reduce((a, b) => a + (Number(b) || 0), 0);
      sewingRow = headers.length === 1 ? [total] : [...sewingQtyRow.slice(0, sizeLen), total];
      while (sewingRow.length < headers.length) sewingRow.push(null);
    } else {
      const sewingTotal = sewing?.sewingQuantity ?? null;
      sewingRow =
        sewingTotal != null
          ? [
              ...(headers.length > 1 ? Array(headers.length - 1).fill(null) : []),
              sewingTotal,
            ]
          : null;
    }

    // 4）尾部入库数：优先按尺码明细推导；无明细时回退仅显示总件数
    const inboundTotal = finishing?.tailInboundQty ?? null;
    let inboundRow: (number | null)[] | null = null;
    if (inboundTotal != null) {
      let receivedQtyRow: number[] | null = null;
      try {
        // tail_received_qty_row 在实体中 select=false，这里按需读取；缺列环境下会自动回退。
        const rows = await this.orderFinishingRepo.query(
          'SELECT tail_received_qty_row AS tailReceivedQtyRow FROM `order_finishing` WHERE order_id = ? LIMIT 1',
          [orderId],
        );
        const raw = Array.isArray(rows) && rows.length > 0 ? (rows[0] as any).tailReceivedQtyRow : null;
        if (raw != null) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (Array.isArray(parsed)) {
            receivedQtyRow = parsed.map((n: any) => Number(n) || 0);
          }
        }
      } catch {
        // 忽略明细读取失败，走总数回退展示。
      }

      if (receivedQtyRow && sizeLen > 0) {
        const base = receivedQtyRow.slice(0, sizeLen).map((n) => Math.max(0, Number(n) || 0));
        while (base.length < sizeLen) base.push(0);
        const receivedTotal = Number(finishing?.tailReceivedQty) || base.reduce((a, b) => a + b, 0);
        if (receivedTotal > 0) {
          const exact = base.map((n) => (n * Number(inboundTotal)) / receivedTotal);
          const floorVals = exact.map((v) => Math.floor(v));
          let remain = Number(inboundTotal) - floorVals.reduce((a, b) => a + b, 0);
          const idxByFrac = exact
            .map((v, i) => ({ i, frac: v - Math.floor(v) }))
            .sort((a, b) => b.frac - a.frac);
          for (const item of idxByFrac) {
            if (remain <= 0) break;
            floorVals[item.i] += 1;
            remain -= 1;
          }
          inboundRow = [...floorVals, Number(inboundTotal)];
        }
      }

      if (!inboundRow) {
        inboundRow = [
          ...(headers.length > 1 ? Array(headers.length - 1).fill(null) : []),
          Number(inboundTotal),
        ];
      }
    }

    const rows: Array<{ label: string; values: (number | null)[] }> = [];
    if (orderPerSize) {
      rows.push({ label: '订单数量', values: orderPerSize });
    }
    if (cutPerSize) {
      rows.push({ label: '裁床数量', values: cutPerSize });
    }
    if (sewingRow) {
      rows.push({ label: '车缝数量', values: sewingRow });
    }
    if (inboundRow) {
      rows.push({ label: '尾部入库数', values: inboundRow });
    }

    return { headers, rows };
  }

  /** 颜色×尺码明细（用于待入库数量悬停展示） */
  async getColorSizeBreakdown(orderId: number): Promise<{
    headers: string[];
    rows: Array<{ colorName: string; values: number[] }>;
  }> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const headers = Array.isArray(ext?.colorSizeHeaders) && ext.colorSizeHeaders.length > 0 ? ext.colorSizeHeaders : [];
    const baseRows = Array.isArray(ext?.colorSizeRows) ? ext!.colorSizeRows! : [];
    if (!headers.length || !baseRows.length) {
      return { headers: [], rows: [] };
    }
    const rows = baseRows.map((r: any) => {
      const quantities = Array.isArray(r?.quantities) ? r.quantities : [];
      const values = headers.map((_, idx) => Math.max(0, Number(quantities[idx]) || 0));
      const total = values.reduce((a, b) => a + b, 0);
      return { colorName: String(r?.colorName ?? ''), values: [...values, total] };
    });
    return { headers: [...headers, '合计'], rows };
  }

  async countByStatus(query: OrderListQuery, actorUserId?: number) {
    this.scheduleCraftReconcile(actorUserId);
    const baseQuery = { ...query, page: undefined, pageSize: undefined };

    const groupQb = this.orderRepo.createQueryBuilder('o');
    this.applyListFilters(groupQb, baseQuery, { includeStatus: false });
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
      const n = Number(r.count);
      const count = Number.isNaN(n) ? 0 : n;
      byStatus[key] = count;
      total += count;
    });

    return { total, byStatus };
  }

  async getLogs(orderId: number) {
    const logs = await this.orderLogRepo.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
    return logs.map((log) => ({
      ...log,
      detail: this.formatLogDetail(log.detail),
    }));
  }

  async getRemarks(orderId: number) {
    await this.findOne(orderId);
    const list = await this.orderRemarkRepo.find({
      where: { orderId },
      order: { createdAt: 'DESC' },
    });
    return list;
  }

  async addRemark(orderId: number, actor: OrderActor, content: string) {
    const order = await this.findOne(orderId);

    let operatorUsername = actor.username;
    try {
      const user = await this.userRepo.findOne({ where: { id: actor.userId } });
      if (user) {
        operatorUsername = (user.displayName && user.displayName.trim()) || user.username || actor.username;
      }
    } catch {
      operatorUsername = actor.username;
    }

    const trimmed = (content ?? '').trim();
    if (!trimmed) {
      throw new Error('备注内容不能为空');
    }

    const remark = this.orderRemarkRepo.create({
      orderId: order.id,
      order,
      operatorUsername,
      content: trimmed,
    });
    return this.orderRemarkRepo.save(remark);
  }

  /**
   * 按订单最新物料/工艺信息同步成本快照：
   * - 以 order_ext.materials / processItems 作为结构源
   * - 默认保留既有成本中的单价/利润率/生产工序等人工维护字段
   */
  private async syncCostSnapshotFromOrder(
    orderId: number,
    options?: { keepExistingPricing?: boolean },
  ): Promise<void> {
    const keepPricing = options?.keepExistingPricing !== false;
    const [order, ext] = await Promise.all([
      this.orderRepo.findOne({ where: { id: orderId } }),
      this.orderExtRepo.findOne({ where: { orderId } }),
    ]);
    if (!order) return;

    const sourceMaterials = Array.isArray((ext as any)?.materials) ? ((ext as any).materials as any[]) : [];
    const sourceProcessItems = Array.isArray((ext as any)?.processItems) ? ((ext as any).processItems as any[]) : [];

    const nextMaterialRows = sourceMaterials.map((m) => ({
      materialTypeId: m?.materialTypeId ?? null,
      supplierName: m?.supplierName ?? '',
      materialName: m?.materialName ?? '',
      color: m?.color ?? '',
      fabricWidth: m?.fabricWidth ?? '',
      usagePerPiece: m?.usagePerPiece ?? null,
      lossPercent: m?.lossPercent ?? null,
      orderPieces: m?.orderPieces ?? null,
      purchaseQuantity: m?.purchaseQuantity ?? null,
      cuttingQuantity: m?.cuttingQuantity ?? null,
      remark: m?.remark ?? '',
      unitPrice: 0,
    }));

    // 工艺项目成本「数量」与订单件数脱钩，默认 1，由成本页按工艺填写；合并快照时保留已保存数量
    const defaultProcessItemQty = 1;
    const nextProcessItemRows = sourceProcessItems.map((p) => ({
      processName: p?.processName ?? '',
      supplierName: p?.supplierName ?? '',
      part: p?.part ?? '',
      remark: p?.remark ?? '',
      unitPrice: 0,
      quantity: defaultProcessItemQty,
    }));

    const existing = await this.orderCostSnapshotRepo.findOne({ where: { orderId } });
    const existingSnapshot =
      existing?.snapshot && typeof existing.snapshot === 'object' ? (existing.snapshot as any) : null;

    const mergedMaterialRows = keepPricing
      ? nextMaterialRows.map((row) => {
          const found = Array.isArray(existingSnapshot?.materialRows)
            ? (existingSnapshot.materialRows as any[]).find((r) => this.isSameMaterialCostRow(r, row))
            : null;
          return found ? { ...row, unitPrice: Number(found.unitPrice) || 0 } : row;
        })
      : nextMaterialRows;

    const mergedProcessItemRows = keepPricing
      ? nextProcessItemRows.map((row) => {
          const found = Array.isArray(existingSnapshot?.processItemRows)
            ? (existingSnapshot.processItemRows as any[]).find((r) => this.isSameProcessItemCostRow(r, row))
            : null;
          return found
            ? {
                ...row,
                unitPrice: Number(found.unitPrice) || 0,
                // 若成本页已保存数量则沿用；否则用行默认数量
                quantity:
                  typeof found.quantity === 'number' && Number.isFinite(found.quantity) ? found.quantity : row.quantity,
              }
            : row;
        })
      : nextProcessItemRows;

    const nextSnapshot: Record<string, unknown> = {
      materialRows: mergedMaterialRows.length ? mergedMaterialRows : [{ unitPrice: 0 } as any],
      processItemRows: mergedProcessItemRows.length
        ? mergedProcessItemRows
        : [{ unitPrice: 0, quantity: defaultProcessItemQty } as any],
      productionRows: Array.isArray(existingSnapshot?.productionRows) ? existingSnapshot.productionRows : [],
      profitMargin: this.normalizeProfitMargin(existingSnapshot?.profitMargin),
    };

    if (existing) {
      existing.snapshot = nextSnapshot;
      await this.orderCostSnapshotRepo.save(existing);
    } else {
      await this.orderCostSnapshotRepo.save(this.orderCostSnapshotRepo.create({ orderId, snapshot: nextSnapshot }));
    }
  }

  private isSameMaterialCostRow(a: any, b: any): boolean {
    const key = (r: any) =>
      [
        String(r?.materialTypeId ?? ''),
        String(r?.supplierName ?? ''),
        String(r?.materialName ?? ''),
        String(r?.color ?? ''),
        String(r?.fabricWidth ?? ''),
      ].join('|');
    return key(a) === key(b);
  }

  private isSameProcessItemCostRow(a: any, b: any): boolean {
    const key = (r: any) => [String(r?.processName ?? ''), String(r?.supplierName ?? ''), String(r?.part ?? '')].join('|');
    return key(a) === key(b);
  }

  private normalizeProfitMargin(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n < 0) return 0.1;
    // 历史默认值兼容：旧数据中的 0.15 视为默认，统一迁移到 0.1
    if (Math.abs(n - 0.15) < 1e-9) return 0.1;
    return n;
  }

  private calculateExFactoryPriceFromSnapshot(snapshot: Record<string, unknown> | null | undefined): number {
    if (!snapshot || typeof snapshot !== 'object') return 0;
    const materialRows = Array.isArray(snapshot.materialRows) ? (snapshot.materialRows as any[]) : [];
    const processItemRows = Array.isArray(snapshot.processItemRows) ? (snapshot.processItemRows as any[]) : [];
    const productionRows = Array.isArray(snapshot.productionRows) ? (snapshot.productionRows as any[]) : [];

    const materialTotal = materialRows.reduce((sum, row) => {
      const usage = Number(row?.usagePerPiece) || 0;
      const lossPercent = Number(row?.lossPercent) || 0;
      const unitPrice = Number(row?.unitPrice) || 0;
      return sum + usage * (1 + lossPercent / 100) * unitPrice;
    }, 0);
    const processItemTotal = processItemRows.reduce((sum, row) => {
      const qty = Number(row?.quantity) || 0;
      const unitPrice = Number(row?.unitPrice) || 0;
      return sum + qty * unitPrice;
    }, 0);
    const productionTotal = productionRows.reduce((sum, row) => sum + (Number(row?.unitPrice) || 0), 0);

    const totalCost = materialTotal + processItemTotal + productionTotal;
    const margin = this.normalizeProfitMargin(snapshot.profitMargin);
    const exFactory = margin >= 1 ? totalCost : totalCost / (1 - margin);
    return Number.isFinite(exFactory) ? Number(exFactory.toFixed(2)) : 0;
  }

  private withDraftMetadata(snapshot: Record<string, unknown>, actor: OrderActor): Record<string, unknown> {
    const prev = snapshot ?? {};
    return {
      ...prev,
      quoteNeedsReconfirm: true,
      quoteDraftUpdatedAt: new Date().toISOString(),
      quoteDraftUpdatedBy: actor.username,
    };
  }

  private withConfirmedMetadata(
    snapshot: Record<string, unknown>,
    actor: OrderActor,
    exFactoryPrice: string,
  ): Record<string, unknown> {
    const prev = snapshot ?? {};
    return {
      ...prev,
      quoteNeedsReconfirm: false,
      quoteConfirmedAt: new Date().toISOString(),
      quoteConfirmedBy: actor.username,
      quoteConfirmedExFactoryPrice: exFactoryPrice,
      quoteDraftUpdatedAt: new Date().toISOString(),
      quoteDraftUpdatedBy: actor.username,
    };
  }

  /** 获取订单成本快照（成本页回显） */
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

  /** 保存订单成本草稿：仅写快照，不同步订单卡片出厂价 */
  async saveCostSnapshot(
    orderId: number,
    payload: { snapshot: Record<string, unknown> },
    actor?: OrderActor,
  ): Promise<OrderCostSnapshot> {
    const order = await this.findOne(orderId);
    const snapshot = this.withDraftMetadata(payload.snapshot ?? {}, actor ?? { userId: 0, username: '系统' });
    let row = await this.orderCostSnapshotRepo.findOne({ where: { orderId } });
    if (row) {
      row.snapshot = snapshot;
    } else {
      row = this.orderCostSnapshotRepo.create({ orderId, snapshot });
    }
    const saved = await this.orderCostSnapshotRepo.save(row);
    if (actor) {
      await this.addLog(order, actor, 'cost_draft', '保存成本草稿（未同步订单卡片出厂价）');
    }
    return saved;
  }

  /** 确认报价：保存快照并同步订单卡片出厂价 */
  async confirmCostQuote(
    orderId: number,
    payload: { snapshot: Record<string, unknown> },
    actor: OrderActor,
  ): Promise<OrderCostSnapshot> {
    const order = await this.findOne(orderId);
    const oldExFactory = this.normalizeDecimalInput(order.exFactoryPrice);
    const computed = this.calculateExFactoryPriceFromSnapshot(payload.snapshot ?? {});
    const nextExFactory = this.normalizeDecimalInput(computed.toFixed(2));
    const snapshot = this.withConfirmedMetadata(payload.snapshot ?? {}, actor, nextExFactory);

    let row = await this.orderCostSnapshotRepo.findOne({ where: { orderId } });
    if (row) {
      row.snapshot = snapshot;
    } else {
      row = this.orderCostSnapshotRepo.create({ orderId, snapshot });
    }
    const saved = await this.orderCostSnapshotRepo.save(row);

    order.exFactoryPrice = nextExFactory;
    await this.orderRepo.save(order);

    await this.addLog(order, actor, 'cost_confirm', `确认报价并同步出厂价: ${oldExFactory} -> ${nextExFactory}`);
    return saved;
  }

  /**
   * 兼容旧调用：按订单 ID 校验动作可执行性。
   * 当前至少保证订单存在，后续如需更严格校验可在此扩展。
   */
  async assertOrderActionById(orderId: number, _userId: number, _action: string): Promise<void> {
    const order = await this.findOne(orderId);
    await this.assertOrderActionByStatuses([order.status], _userId, _action);
  }

  async assertOrderActionByIds(orderIds: number[], userId: number, action: string): Promise<void> {
    const ids = [...new Set((orderIds ?? []).filter((id) => typeof id === 'number' && id > 0))];
    if (!ids.length) return;
    const rows = await this.orderRepo.find({ where: { id: In(ids) }, select: ['id', 'status'] });
    await this.assertOrderActionByStatuses(rows.map((r) => r.status), userId, action);
  }

  private async assertOrderActionByStatuses(statuses: string[], userId: number, action: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'roleId'] });
    if (!user?.roleId) throw new ForbiddenException('无权限访问');
    const role = await this.roleRepo.findOne({ where: { id: user.roleId }, select: ['code'] });
    if (role?.code === 'admin') return;

    const normalized = [...new Set((statuses ?? []).map((s) => (s ?? '').trim()).filter(Boolean))];
    if (!normalized.length) return;

    const actionKey = (action ?? '').trim();
    if (!['edit', 'review', 'delete'].includes(actionKey)) return;

    const rows = await this.roleOrderPolicyRepo.find({
      where: { roleId: user.roleId, action: actionKey as any },
      select: ['statusCode'],
    });
    if (!rows.length) {
      throw new ForbiddenException('该操作未配置可操作状态');
    }
    const allowSet = new Set(rows.map((r) => (r.statusCode ?? '').trim()).filter(Boolean));
    const denied = normalized.filter((s) => !allowSet.has(s));
    if (denied.length) {
      throw new ForbiddenException(`当前状态不允许该操作: ${denied.join('、')}`);
    }
  }
}

