import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCraft } from '../entities/order-craft.entity';
import { OrderExt, type OrderMaterialRow, type ProcessRow } from '../entities/order-ext.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';

export interface CraftListItem {
  orderId: number;
  orderNo: string;
  /** 到工艺时间：订单进入待工艺状态的时间 */
  arrivedAtCraft: string | null;
  /** 工艺完成时间 */
  completedAt: string | null;
  orderDate: string | null;
  skuCode: string;
  imageUrl: string;
  supplierName: string;
  processItem: string;
  /** 订单类型 ID（system_options.id, option_type='order_types'） */
  orderTypeId: number | null;
  /** 合作方式 ID（system_options.id, option_type='collaboration'） */
  collaborationTypeId: number | null;
  purchaseStatus: string;
  craftStatus: string;
}

export interface CraftListQuery {
  tab?: string;
  supplier?: string;
  processItem?: string;
  /** 订单类型 ID */
  orderTypeId?: number;
  /** 合作方式 ID */
  collaborationTypeId?: number;
  orderDateStart?: string;
  orderDateEnd?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ProductionCraftService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderCraft)
    private readonly craftRepo: Repository<OrderCraft>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    private readonly orderWorkflowService: OrderWorkflowService,
  ) {}

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
    return materials.every((m) => (m.purchaseStatus ?? 'pending').toLowerCase() === 'completed');
  }

  private buildCraftSummaryFromProcessItems(processItems: ProcessRow[] | null): { supplierName: string; processItem: string } {
    const items = Array.isArray(processItems) ? processItems : [];
    const supplierNames = items
      .map((r) => (r.supplierName ?? '').trim())
      .filter((v) => !!v);
    const processNames = items
      .map((r) => (r.processName ?? '').trim())
      .filter((v) => !!v);
    const uniq = (arr: string[]) => Array.from(new Set(arr));
    const suppliers = uniq(supplierNames);
    const processes = uniq(processNames);
    return {
      supplierName: suppliers.length ? suppliers.join(' / ') : '',
      processItem: processes.length ? processes.join(' / ') : '',
    };
  }

  private anyCraftSupplierMatches(processItems: ProcessRow[] | null, supplier: string): boolean {
    if (!supplier?.trim()) return true;
    const items = Array.isArray(processItems) ? processItems : [];
    if (!items.length) return false;
    const lower = supplier.trim().toLowerCase();
    return items.some((r) => (r.supplierName ?? '').toLowerCase().includes(lower));
  }

  private anyCraftProcessMatches(processItems: ProcessRow[] | null, processItem: string): boolean {
    if (!processItem?.trim()) return true;
    const items = Array.isArray(processItems) ? processItems : [];
    if (!items.length) return false;
    const lower = processItem.trim().toLowerCase();
    return items.some((r) => (r.processName ?? '').toLowerCase().includes(lower));
  }

  async getCraftList(query: CraftListQuery): Promise<{
    list: CraftListItem[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const {
      tab = 'all',
      supplier,
      processItem,
      orderTypeId,
      collaborationTypeId,
      orderDateStart,
      orderDateEnd,
      page = 1,
      pageSize = 20,
    } = query;

    // 工艺管理：仅展示审单通过后的订单（排除草稿、待审单），且订单编辑 E 区存在工艺项目
    const qb = this.orderRepo
      .createQueryBuilder('o')
      .innerJoin(OrderExt, 'ext', 'ext.orderId = o.id')
      // MySQL JSON：只展示 E 区至少 1 行工艺项目的订单
      .where('JSON_LENGTH(ext.process_items) > 0')
      .andWhere('o.status NOT IN (:...excluded)', { excluded: ['draft', 'pending_review'] });

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
      return { list: [], total: 0, page, pageSize };
    }

    const [crafts, extList] = await Promise.all([
      this.craftRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.orderExtRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
    ]);
    const craftMap = new Map(crafts.map((c) => [c.orderId, c]));
    const extMap = new Map(extList.map((e) => [e.orderId, e]));

    const rows: CraftListItem[] = [];
    for (const order of orders) {
      const ext = extMap.get(order.id);
      const materials = ext?.materials ?? null;
      const processItems = ext?.processItems ?? null;
      if (supplier?.trim() && !this.anyCraftSupplierMatches(processItems, supplier)) continue;
      if (processItem?.trim() && !this.anyCraftProcessMatches(processItems, processItem)) continue;

      const craft = craftMap.get(order.id);
      const craftStatus = (craft?.status ?? 'pending').toLowerCase();
      if (tab === 'pending' && craftStatus === 'completed') continue;
      if (tab === 'completed' && craftStatus !== 'completed') continue;

      const purchaseCompleted = this.isPurchaseCompleted(materials);
      const arrivedAtCraft =
        craft?.arrivedAtCraft
          ? this.toDateTimeLocalString(craft.arrivedAtCraft)
          : order.statusTime
            ? this.toDateTimeLocalString(order.statusTime)
            : null;
      const summary = this.buildCraftSummaryFromProcessItems(processItems);
      rows.push({
        orderId: order.id,
        orderNo: order.orderNo ?? '',
        arrivedAtCraft,
        completedAt: craft?.completedAt
          ? this.toDateTimeLocalString(craft.completedAt)
          : null,
        orderDate: this.toDateOnlyLocalString(order.orderDate),
        skuCode: order.skuCode ?? '',
        imageUrl: order.imageUrl ?? '',
        supplierName: summary.supplierName,
        processItem: summary.processItem,
        orderTypeId: order.orderTypeId ?? null,
        collaborationTypeId: order.collaborationTypeId ?? null,
        purchaseStatus: purchaseCompleted ? 'completed' : 'pending',
        craftStatus: craftStatus === 'completed' ? 'completed' : 'pending',
      });
    }

    const total = rows.length;
    const start = (page - 1) * pageSize;
    const list = rows.slice(start, start + pageSize);

    return { list, total, page, pageSize };
  }

  async completeCraft(orderId: number, actorUserId: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    if (!order.processItem?.trim()) {
      throw new NotFoundException('该订单无工艺项目');
    }

    let craft = await this.craftRepo.findOne({ where: { orderId } });
    const now = new Date();
    if (!craft) {
      craft = this.craftRepo.create({
        orderId,
        status: 'completed',
        // 到工艺时间：优先取订单当前状态变更时间（进入工艺环节时应已更新），兜底为当前时间
        arrivedAtCraft: order.statusTime ?? now,
        completedAt: now,
      });
    } else {
      craft.status = 'completed';
      if (!craft.arrivedAtCraft) {
        craft.arrivedAtCraft = order.statusTime ?? now;
      }
      craft.completedAt = now;
    }
    await this.craftRepo.save(craft);

    // 若订单当前为「待工艺」，按流程链路解析下一状态并更新订单
    if (order.status === 'pending_craft') {
      const nextStatus = await this.orderWorkflowService.resolveNextStatus({
        order,
        triggerCode: 'craft_completed',
        actorUserId,
      });
      if (nextStatus) {
        order.status = nextStatus;
        order.statusTime = now;
        await this.orderRepo.save(order);
      }
    }
  }
}
