import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt, type OrderMaterialRow, type ColorSizeRow } from '../entities/order-ext.entity';
import { OrderOperationLog } from '../entities/order-operation-log.entity';
import { OrderRemark } from '../entities/order-remark.entity';
import { User } from '../entities/user.entity';

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
  /** 订单类型（标签/大货/样品等，由前端/系统配置传入） */
  orderType?: string;
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
  /** 客户交期开始（YYYY-MM-DD） */
  customerDueStart?: string;
  /** 客户交期结束（YYYY-MM-DD） */
  customerDueEnd?: string;
  /** 加工厂 */
  factory?: string;
  /** 状态（对应状态 Tab 的内部 code，可选） */
  status?: string;
  /** 分页 */
  page?: number;
  pageSize?: number;
}

/**
 * 订单编辑表单字段（当前仅覆盖 A 区必要字段）
 * 后续 B~H 区复杂结构可在此类型上继续扩展
 */
export interface OrderEditPayload {
  skuCode?: string;
  customerId?: number | null;
  customerName?: string;
  /** 合作方式（如成品、来料等） */
  collaborationType?: string;
  /**
   * 订单类型（前端表单字段）。当前 DB 存在 orders.label 字段承载该值，
   * 这里提供 orderType 只是为了避免前后端字段名不一致导致数据丢失。
   */
  orderType?: string;
  salesperson?: string;
  merchandiser?: string;
  quantity?: number;
  exFactoryPrice?: string;
  salePrice?: string;
  /** 历史字段：等同于 orderType（DB 字段名为 label） */
  label?: string;
  /** 工艺项目（原二次工艺） */
  processItem?: string;
  orderDate?: string | null;
  customerDueDate?: string | null;
  factoryName?: string;
  imageUrl?: string;
  /** C 区物料列表（存 order_ext.materials） */
  materials?: OrderMaterialRow[];
  /** B 区尺码表头（存 order_ext.colorSizeHeaders） */
  colorSizeHeaders?: string[];
  /** B 区颜色尺码数量行（存 order_ext.colorSizeRows） */
  colorSizeRows?: ColorSizeRow[];
}

export interface OrderActor {
  userId: number;
  username: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(OrderOperationLog)
    private readonly orderLogRepo: Repository<OrderOperationLog>,
    @InjectRepository(OrderRemark)
    private readonly orderRemarkRepo: Repository<OrderRemark>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

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

    const log = this.orderLogRepo.create({
      orderId: order.id,
      orderNo: order.orderNo,
      operatorUsername,
      action,
      detail: this.formatLogDetail(detail),
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
    if (payload.collaborationType !== undefined && trim(payload.collaborationType) !== before.collaborationType) {
      changes.push(`合作方式: ${before.collaborationType || '-'} -> ${trim(payload.collaborationType) || '-'}`);
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
    if (payload.orderType !== undefined || payload.label !== undefined) {
      const nextLabel = trim(payload.orderType) || trim(payload.label) || '';
      if (nextLabel !== before.label) {
        changes.push(`订单类型: ${before.label || '-'} -> ${nextLabel || '-'}`);
      }
    }
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
      orderType,
      processItem,
      salesperson,
      merchandiser,
      orderDateStart,
      orderDateEnd,
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
    if (orderType?.trim()) {
      qb.andWhere('o.label = :orderType', { orderType: orderType.trim() });
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
   * 根据主键获取订单详情（含 order_ext.materials）
   */
  async findOne(id: number): Promise<Order & { materials?: OrderMaterialRow[]; colorSizeHeaders?: string[]; colorSizeRows?: ColorSizeRow[] }> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const ext = await this.orderExtRepo.findOne({ where: { orderId: id } });
    const materials = ext?.materials ?? [];
    const colorSizeHeaders = ext?.colorSizeHeaders ?? [];
    const colorSizeRows = ext?.colorSizeRows ?? [];
    return { ...order, materials, colorSizeHeaders, colorSizeRows };
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
      collaborationType: payload.collaborationType?.trim() || '',
      salesperson: payload.salesperson?.trim() || '',
      merchandiser: payload.merchandiser?.trim() || '',
      quantity: payload.quantity ?? 0,
      exFactoryPrice: this.normalizeDecimalInput(payload.exFactoryPrice),
      salePrice: this.normalizeDecimalInput(payload.salePrice),
      label: payload.orderType?.trim() || payload.label?.trim() || '',
      processItem: payload.processItem?.trim() || '',
      orderDate: payload.orderDate ? new Date(payload.orderDate) : now,
      customerDueDate: payload.customerDueDate ? new Date(payload.customerDueDate) : null,
      factoryName: payload.factoryName?.trim() || '',
      imageUrl: payload.imageUrl?.trim() || '',
      status: 'draft',
      statusTime: now,
    });
    const saved = await this.orderRepo.save(entity);
    const extPayload: Partial<{ orderId: number; materials: OrderMaterialRow[]; colorSizeHeaders: string[]; colorSizeRows: ColorSizeRow[] }> = { orderId: saved.id };
    if (payload.materials && Array.isArray(payload.materials)) extPayload.materials = payload.materials;
    if (payload.colorSizeHeaders && Array.isArray(payload.colorSizeHeaders)) extPayload.colorSizeHeaders = payload.colorSizeHeaders;
    if (payload.colorSizeRows && Array.isArray(payload.colorSizeRows)) extPayload.colorSizeRows = payload.colorSizeRows;
    if (extPayload.materials || extPayload.colorSizeHeaders || extPayload.colorSizeRows) {
      await this.orderExtRepo.save(this.orderExtRepo.create(extPayload as { orderId: number; materials?: OrderMaterialRow[]; colorSizeHeaders?: string[]; colorSizeRows?: ColorSizeRow[] }));
    }
    await this.addLog(saved, actor, 'create', '创建订单草稿');
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
    if (payload.collaborationType !== undefined) order.collaborationType = payload.collaborationType.trim();
    if (payload.salesperson !== undefined) order.salesperson = payload.salesperson.trim();
    if (payload.merchandiser !== undefined) order.merchandiser = payload.merchandiser.trim();
    if (payload.quantity !== undefined) order.quantity = payload.quantity ?? 0;
    if (payload.exFactoryPrice !== undefined) order.exFactoryPrice = this.normalizeDecimalInput(payload.exFactoryPrice);
    if (payload.salePrice !== undefined) order.salePrice = this.normalizeDecimalInput(payload.salePrice);
    if (payload.orderType !== undefined) order.label = payload.orderType.trim();
    else if (payload.label !== undefined) order.label = payload.label.trim();
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
    if (payload.materials !== undefined || payload.colorSizeHeaders !== undefined || payload.colorSizeRows !== undefined) {
      let ext = await this.orderExtRepo.findOne({ where: { orderId: id } });
      if (!ext) {
        ext = this.orderExtRepo.create({
          orderId: id,
          materials: payload.materials ?? null,
          colorSizeHeaders: payload.colorSizeHeaders ?? null,
          colorSizeRows: payload.colorSizeRows ?? null,
        });
      } else {
        if (payload.materials !== undefined) ext.materials = payload.materials;
        if (payload.colorSizeHeaders !== undefined) ext.colorSizeHeaders = payload.colorSizeHeaders;
        if (payload.colorSizeRows !== undefined) ext.colorSizeRows = payload.colorSizeRows;
      }
      await this.orderExtRepo.save(ext);
    }
    const detail = this.buildUpdateChangesDescription(before, payload);
    await this.addLog(saved, actor, 'update', detail);
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
    order.status = 'pending_review';
    order.statusTime = new Date();
    const saved = await this.orderRepo.save(order);
    await this.addLog(saved, actor, 'submit', `状态: ${beforeStatus || '-'} -> ${saved.status}`);
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
   * 待审单批量审核 -> 待纸样
   */
  async reviewMany(ids: number[], actor: OrderActor): Promise<void> {
    if (!ids?.length) return;
    const now = new Date();
    const orders = await this.orderRepo.findByIds(ids);
    await this.orderRepo
      .createQueryBuilder()
      .update(Order)
      .set({ status: 'pending_pattern', statusTime: now })
      .where('id IN (:...ids)', { ids })
      .andWhere('status = :status', { status: 'pending_review' })
      .execute();
    for (const o of orders) {
      await this.addLog(
        { ...o, status: 'pending_pattern', statusTime: now } as Order,
        actor,
        'review',
        '审核订单：pending_review -> pending_pattern',
      );
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
        collaborationType: src.collaborationType?.trim() || '',
        salesperson: src.salesperson?.trim() || '',
        merchandiser: src.merchandiser?.trim() || '',
        quantity: src.quantity ?? 0,
        exFactoryPrice: this.normalizeDecimalInput(src.exFactoryPrice),
        salePrice: this.normalizeDecimalInput(src.salePrice),
        label: src.label?.trim() || '',
        processItem: src.processItem?.trim() || '',
        orderDate: src.orderDate ?? now,
        customerDueDate: src.customerDueDate ?? null,
        factoryName: src.factoryName?.trim() || '',
        imageUrl: src.imageUrl?.trim() || '',
        status: 'draft',
        statusTime: now,
      });
      const saved = await this.orderRepo.save(draft);
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

  async findAll(query: OrderListQuery) {
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
    if (ids.length > 0) {
      const rows = await this.orderRemarkRepo
        .createQueryBuilder('r')
        .select('r.order_id', 'orderId')
        .addSelect('COUNT(1)', 'count')
        .where('r.order_id IN (:...ids)', { ids })
        .groupBy('r.order_id')
        .getRawMany<{ orderId: number; count: string }>();
      rows.forEach((r) => {
        remarkCountMap[r.orderId] = Number(r.count) || 0;
      });
    }
    const listWithCount = list.map((o) => ({
      ...o,
      remarkCount: remarkCountMap[o.id] ?? 0,
    }));

    return { list: listWithCount, total, page, pageSize };
  }

  async countByStatus(query: OrderListQuery) {
    const baseQuery = { ...query, page: undefined, pageSize: undefined };

    const totalQb = this.orderRepo.createQueryBuilder('o');
    this.applyListFilters(totalQb, baseQuery, { includeStatus: false });
    const total = await totalQb.getCount();

    const groupQb = this.orderRepo.createQueryBuilder('o');
    this.applyListFilters(groupQb, baseQuery, { includeStatus: false });
    const rows = await groupQb
      .select('o.status', 'status')
      .addSelect('COUNT(1)', 'count')
      .groupBy('o.status')
      .getRawMany<{ status: string; count: string }>();

    const byStatus: Record<string, number> = {};
    rows.forEach((r) => {
      const key = r?.status ?? '';
      if (!key) return;
      const n = Number(r.count);
      byStatus[key] = Number.isNaN(n) ? 0 : n;
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
}

