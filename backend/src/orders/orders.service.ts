import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';

export interface OrderListQuery {
  /** 订单号 */
  orderNo?: string;
  /** SKU 编号 */
  skuCode?: string;
  /** 客户名称（模糊） */
  customer?: string;
  /** 订单类型（标签/大货/样品等，由前端/系统配置传入） */
  orderType?: string;
  /** 二次工艺 */
  secondaryProcess?: string;
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
  salesperson?: string;
  merchandiser?: string;
  quantity?: number;
  exFactoryPrice?: string;
  salePrice?: string;
  label?: string;
  secondaryProcess?: string;
  orderDate?: string | null;
  customerDueDate?: string | null;
  factoryName?: string;
  imageUrl?: string;
}

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  /**
   * 根据主键获取订单详情
   */
  async findOne(id: number): Promise<Order> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    return order;
  }

  /**
   * 创建草稿订单
   */
  async createDraft(payload: OrderEditPayload): Promise<Order> {
    const now = new Date();
    const entity = this.orderRepo.create({
      orderNo: await this.generateNextOrderNo(),
      skuCode: payload.skuCode?.trim() || '',
      customerId: payload.customerId ?? null,
      customerName: payload.customerName?.trim() || '',
      salesperson: payload.salesperson?.trim() || '',
      merchandiser: payload.merchandiser?.trim() || '',
      quantity: payload.quantity ?? 0,
      exFactoryPrice: payload.exFactoryPrice ?? '0',
      salePrice: payload.salePrice ?? '0',
      label: payload.label?.trim() || '',
      secondaryProcess: payload.secondaryProcess?.trim() || '',
      orderDate: payload.orderDate ? new Date(payload.orderDate) : now,
      customerDueDate: payload.customerDueDate ? new Date(payload.customerDueDate) : null,
      factoryName: payload.factoryName?.trim() || '',
      imageUrl: payload.imageUrl?.trim() || '',
      status: 'draft',
      statusTime: now,
    });
    return this.orderRepo.save(entity);
  }

  /**
   * 更新草稿订单（只更新传入字段）
   */
  async updateDraft(id: number, payload: OrderEditPayload): Promise<Order> {
    const order = await this.findOne(id);
    if (payload.skuCode !== undefined) order.skuCode = payload.skuCode.trim();
    if (payload.customerId !== undefined) order.customerId = payload.customerId;
    if (payload.customerName !== undefined) order.customerName = payload.customerName.trim();
    if (payload.salesperson !== undefined) order.salesperson = payload.salesperson.trim();
    if (payload.merchandiser !== undefined) order.merchandiser = payload.merchandiser.trim();
    if (payload.quantity !== undefined) order.quantity = payload.quantity ?? 0;
    if (payload.exFactoryPrice !== undefined) order.exFactoryPrice = payload.exFactoryPrice ?? '0';
    if (payload.salePrice !== undefined) order.salePrice = payload.salePrice ?? '0';
    if (payload.label !== undefined) order.label = payload.label.trim();
    if (payload.secondaryProcess !== undefined) order.secondaryProcess = payload.secondaryProcess.trim();
    if (payload.orderDate !== undefined) {
      order.orderDate = payload.orderDate ? new Date(payload.orderDate) : null;
    }
    if (payload.customerDueDate !== undefined) {
      order.customerDueDate = payload.customerDueDate ? new Date(payload.customerDueDate) : null;
    }
    if (payload.factoryName !== undefined) order.factoryName = payload.factoryName.trim();
    if (payload.imageUrl !== undefined) order.imageUrl = payload.imageUrl.trim();
    return this.orderRepo.save(order);
  }

  /**
   * 保存并提交：将状态从 draft 等变为 pending_review
   */
  async submit(id: number): Promise<Order> {
    const order = await this.findOne(id);
    if (!order.orderNo) {
      order.orderNo = await this.generateNextOrderNo();
    }
    order.status = 'pending_review';
    order.statusTime = new Date();
    return this.orderRepo.save(order);
  }

  /**
   * 批量删除订单
   */
  async batchDelete(ids: number[]): Promise<void> {
    if (!ids?.length) return;
    await this.orderRepo.delete(ids);
  }

  /**
   * 批量审单：仅处理当前处于 pending_review 状态的订单，
   * 审核通过后状态流转到 pending_pattern（待纸样）。
   */
  async review(ids: number[]): Promise<void> {
    if (!ids?.length) return;
    const now = new Date();
    await this.orderRepo
      .createQueryBuilder()
      .update(Order)
      .set({ status: 'pending_pattern', statusTime: now })
      .where('id IN (:...ids)', { ids })
      .andWhere('status = :status', { status: 'pending_review' })
      .execute();
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
    const {
      orderNo,
      skuCode,
      customer,
      orderType,
      secondaryProcess,
      salesperson,
      merchandiser,
      orderDateStart,
      orderDateEnd,
      customerDueStart,
      customerDueEnd,
      factory,
      status,
      page = 1,
      pageSize = 20,
    } = query;

    const qb = this.orderRepo.createQueryBuilder('o');

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
    if (secondaryProcess?.trim()) {
      qb.andWhere('o.secondary_process LIKE :secondaryProcess', { secondaryProcess: `%${secondaryProcess.trim()}%` });
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
    if (status?.trim()) {
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

    qb.orderBy('o.id', 'DESC');

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { list, total, page, pageSize };
  }
}

