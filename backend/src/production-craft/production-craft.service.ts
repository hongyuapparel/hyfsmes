import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderCraft } from '../entities/order-craft.entity';
import { OrderExt, type OrderMaterialRow, type ProcessRow } from '../entities/order-ext.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { OrderStatusConfigService } from '../order-status-config/order-status-config.service';

/** 列表返回：工艺项目行（与 order_ext.process_items 一致） */
export type CraftProcessItemRow = Pick<ProcessRow, 'processName' | 'supplierName' | 'part' | 'remark'>;

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
  /** 时效判定（与订单时效配置对比） */
  timeRating: string;
  customerName: string;
  merchandiser: string;
  customerDueDate: string | null;
  quantity: number;
  processItems: CraftProcessItemRow[];
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
    private readonly orderStatusConfigService: OrderStatusConfigService,
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
    return materials.every((m) => {
      const purchaseDone = (m.purchaseStatus ?? 'pending').toLowerCase() === 'completed';
      const pickDone = (m.pickStatus ?? 'pending').toLowerCase() === 'completed';
      return purchaseDone || pickDone;
    });
  }

  private buildCraftSummaryFromProcessItems(processItems: ProcessRow[] | null): { supplierName: string; processItem: string } {
    const items = this.normalizeProcessItems(processItems);
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

  private normalizeProcessItems(processItems: ProcessRow[] | null | unknown): ProcessRow[] {
    if (!processItems) return [];
    if (Array.isArray(processItems)) return processItems as ProcessRow[];
    if (typeof processItems === 'string') {
      try {
        const parsed = JSON.parse(processItems);
        return Array.isArray(parsed) ? (parsed as ProcessRow[]) : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  private async fetchProcessItemsMap(orderIds: number[]): Promise<Map<number, ProcessRow[]>> {
    const ids = Array.isArray(orderIds) ? orderIds.filter((v) => typeof v === 'number' && v > 0) : [];
    const map = new Map<number, ProcessRow[]>();
    if (!ids.length) return map;
    try {
      const rows = await this.orderExtRepo.query(
        'SELECT order_id AS orderId, process_items AS processItems FROM `order_ext` WHERE order_id IN (?)',
        [ids],
      );
      if (!Array.isArray(rows)) return map;
      for (const r of rows) {
        const orderId = Number((r as any).orderId);
        const raw = (r as any).processItems;
        if (Number.isNaN(orderId)) continue;
        const items = this.normalizeProcessItems(raw);
        map.set(orderId, items);
      }
    } catch {
      // ignore
    }
    return map;
  }

  private anyCraftSupplierMatches(processItems: ProcessRow[] | null, supplier: string): boolean {
    if (!supplier?.trim()) return true;
    const items = this.normalizeProcessItems(processItems);
    if (!items.length) return false;
    const lower = supplier.trim().toLowerCase();
    return items.some((r) => (r.supplierName ?? '').toLowerCase().includes(lower));
  }

  private anyCraftProcessMatches(processItems: ProcessRow[] | null, processItem: string): boolean {
    if (!processItem?.trim()) return true;
    const items = this.normalizeProcessItems(processItems);
    if (!items.length) return false;
    const lower = processItem.trim().toLowerCase();
    return items.some((r) => (r.processName ?? '').toLowerCase().includes(lower));
  }

  async getCraftList(query: CraftListQuery, actorUserId?: number): Promise<{
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
      .innerJoin(OrderExt, 'ext', 'ext.order_id = o.id')
      // MySQL JSON：只展示 E 区至少 1 行工艺项目的订单
      .where('IFNULL(JSON_LENGTH(ext.process_items), 0) > 0')
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

    const [crafts, extList, processItemsMap] = await Promise.all([
      this.craftRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.orderExtRepo.find({ where: orderIds.map((id) => ({ orderId: id })) }),
      this.fetchProcessItemsMap(orderIds),
    ]);
    const craftMap = new Map(crafts.map((c) => [c.orderId, c]));
    const extMap = new Map(extList.map((e) => [e.orderId, e]));
    const slaCtx = await this.orderStatusConfigService.loadProductionSlaJudgeContext();

    // 对历史“已工艺完成但订单未流转”的数据进行一次按规则补流转（无硬编码状态）。
    // 只在可识别当前操作人时执行；动作权限由 PermissionGuard + role_permissions 控制。
    if (typeof actorUserId === 'number') {
      for (const order of orders) {
        const craft = craftMap.get(order.id);
        const craftStatus = (craft?.status ?? 'pending').toLowerCase();
        if (craftStatus !== 'completed') continue;
        const nextStatus = await this.orderWorkflowService.resolveNextStatus({
          order,
          triggerCode: 'craft_completed',
          actorUserId,
        });
        if (nextStatus && nextStatus !== order.status) {
          order.status = nextStatus;
          order.statusTime = new Date();
          await this.orderRepo.save(order);
        }
      }
    }

    const rows: CraftListItem[] = [];
    for (const order of orders) {
      const ext = extMap.get(order.id);
      const materials = ext?.materials ?? null;
      const processItems = processItemsMap.get(order.id) ?? (ext?.processItems ?? null);
      if (supplier?.trim() && !this.anyCraftSupplierMatches(processItems, supplier)) continue;
      if (processItem?.trim() && !this.anyCraftProcessMatches(processItems, processItem)) continue;

      const craft = craftMap.get(order.id);
      const craftStatus = (craft?.status ?? 'pending').toLowerCase();

      // 仅按流程配置展示可执行工艺完成的订单，避免“有工艺项目就都进入工艺管理”的硬编码行为。
      if (craftStatus !== 'completed') {
        try {
          const nextByFlow = await this.orderWorkflowService.resolveNextStatus({
            order,
            triggerCode: 'craft_completed',
            actorUserId: typeof actorUserId === 'number' ? actorUserId : 0,
          });
          if (!nextByFlow) continue;
        } catch {
          // 规则不匹配时，不在工艺管理列表展示该单
          continue;
        }
      }

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
      const itemsNorm = this.normalizeProcessItems(processItems);
      const processItemsPayload: CraftProcessItemRow[] = itemsNorm.map((r) => ({
        processName: r.processName,
        supplierName: r.supplierName,
        part: r.part,
        remark: r.remark,
      }));

      let phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(craft?.arrivedAtCraft ?? null);
      if (!phaseStart && order.status === 'pending_craft') {
        phaseStart = this.orderStatusConfigService.parseProductionPhaseInstant(order.statusTime);
      }
      const phaseEnd =
        craftStatus === 'completed' && craft?.completedAt
          ? this.orderStatusConfigService.parseProductionPhaseInstant(craft.completedAt)
          : null;
      const timeRating = this.orderStatusConfigService.judgeProductionPhaseDuration(
        'pending_craft',
        phaseStart,
        phaseEnd,
        order.status ?? '',
        slaCtx,
      );

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
        timeRating,
        customerName: order.customerName ?? '',
        merchandiser: order.merchandiser ?? '',
        customerDueDate: order.customerDueDate
          ? this.toDateOnlyLocalString(order.customerDueDate)
          : null,
        quantity: order.quantity ?? 0,
        processItems: processItemsPayload,
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

    const now = new Date();
    const nextStatus = await this.orderWorkflowService.resolveNextStatus({
      order,
      triggerCode: 'craft_completed',
      actorUserId,
    });
    if (!nextStatus) {
      throw new BadRequestException('未匹配到“工艺完成(craft_completed)”流转规则，请在订单设置中检查流程链路配置');
    }

    let craft = await this.craftRepo.findOne({ where: { orderId } });
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

    if (nextStatus !== order.status) {
      order.status = nextStatus;
      order.statusTime = now;
      await this.orderRepo.save(order);
    }
  }
}
