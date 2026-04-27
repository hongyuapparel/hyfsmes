import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderStatusTransition } from '../entities/order-status-transition.entity';
import { SystemOption } from '../entities/system-option.entity';

type RuleConditions = {
  /** 旧版：样品/大货 粗分类（仍兼容） */
  orderType?: 'sample' | 'bulk';
  /** 新版：精确到系统配置中的订单类型 ID 列表 */
  orderTypeIds?: number[];
  /** 旧版：成品/裁片 粗分类（仍兼容） */
  productForm?: 'finished' | 'cut';
  /** 新版：精确到系统配置中的合作方式 ID 列表 */
  collaborationTypeIds?: number[];
  /** 是否限定「仅有工艺项目」或「仅无工艺项目」；不传则不限制 */
  hasProcessItem?: boolean;
};

@Injectable()
export class OrderWorkflowService {
  constructor(
    @InjectRepository(OrderStatusTransition)
    private readonly transitionRepo: Repository<OrderStatusTransition>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(SystemOption)
    private readonly optionRepo: Repository<SystemOption>,
  ) {}

  private async getOptionValueById(id: number | null): Promise<string> {
    if (id == null) return '';
    const o = await this.optionRepo.findOne({ where: { id } });
    return (o?.value ?? '').trim();
  }

  private async resolveOrderTags(order: Order): Promise<{
    orderType?: 'sample' | 'bulk';
    orderTypeId?: number | null;
    productForm?: 'finished' | 'cut';
    collaborationTypeId?: number | null;
    hasProcessItem?: boolean;
  }> {
    const orderTypeValue = await this.getOptionValueById(order.orderTypeId ?? null);
    const collaborationValue = await this.getOptionValueById(order.collaborationTypeId ?? null);

    // 订单类型：将「样品系列」统一视为 sample，其余（如大货）视为 bulk。
    // 当前约定：样品 / 修改版 / 产前版 / 试销款 都走样品链路，大货走大货链路。
    let orderType: 'sample' | 'bulk' | undefined;
    if (orderTypeValue) {
      const v = orderTypeValue.trim();
      const sampleKeywords = ['样品', '样板', '修改版', '产前版', '试销款'];
      if (v.includes('大货')) {
        orderType = 'bulk';
      } else if (sampleKeywords.some((k) => v.includes(k))) {
        orderType = 'sample';
      } else {
        orderType = undefined;
      }
    } else {
      orderType = undefined;
    }
    const productForm =
      collaborationValue.includes('成品') ? 'finished' : collaborationValue.includes('裁片') ? 'cut' : undefined;

    // hasProcessItem 以 E 区 order_ext.process_items 为准，兼容回退到旧字段 orders.process_item。
    let hasProcessItem = !!(order.processItem && String(order.processItem).trim());
    try {
      const ext = await this.orderExtRepo.findOne({ where: { orderId: order.id } });
      const extItems = ext?.processItems;
      if (Array.isArray(extItems)) {
        hasProcessItem = extItems.some((it) => {
          if (!it || typeof it !== 'object') return false;
          const processName = String((it as any).processName ?? '').trim();
          const supplierName = String((it as any).supplierName ?? '').trim();
          const part = String((it as any).part ?? '').trim();
          const remark = String((it as any).remark ?? '').trim();
          return !!(processName || supplierName || part || remark);
        });
      }
    } catch {
      // 查询扩展表失败时，回退旧字段判断，避免影响主流程
    }
    return {
      orderType,
      orderTypeId: order.orderTypeId ?? null,
      productForm,
      collaborationTypeId: order.collaborationTypeId ?? null,
      hasProcessItem,
    };
  }

  private matchConditions(
    conditionsJson: unknown,
    tags: {
      orderType?: string;
      orderTypeId?: number | null;
      productForm?: string;
      collaborationTypeId?: number | null;
      hasProcessItem?: boolean;
    },
  ): { ok: boolean; score: number } {
    if (!conditionsJson || typeof conditionsJson !== 'object') return { ok: true, score: 0 };
    const c = conditionsJson as RuleConditions;
    let score = 0;

    if (c.orderType) {
      if (tags.orderType !== c.orderType) return { ok: false, score: 0 };
      score += 1;
    }

    if (Array.isArray(c.orderTypeIds) && c.orderTypeIds.length > 0) {
      const id = tags.orderTypeId ?? null;
      if (id == null || !c.orderTypeIds.includes(id)) return { ok: false, score: 0 };
      score += 1;
    }

    if (c.productForm) {
      if (tags.productForm !== c.productForm) return { ok: false, score: 0 };
      score += 1;
    }
    if (Array.isArray(c.collaborationTypeIds) && c.collaborationTypeIds.length > 0) {
      const id = tags.collaborationTypeId ?? null;
      if (id == null || !c.collaborationTypeIds.includes(id)) return { ok: false, score: 0 };
      score += 1;
    }
    if (c.hasProcessItem !== undefined) {
      if (tags.hasProcessItem !== c.hasProcessItem) return { ok: false, score: 0 };
      score += 1;
    }
    return { ok: true, score };
  }

  /**
   * 根据当前状态+触发动作，从配置中匹配下一状态。未匹配到返回 null。
   * 操作权限由 PermissionGuard + role_permissions 控制；流程规则只负责匹配下一状态。
   */
  async resolveNextStatus(params: { order: Order; triggerCode: string; actorUserId: number }): Promise<string | null> {
    const { order, triggerCode } = params;
    const rules = await this.transitionRepo.find({
      where: { fromStatus: order.status, triggerCode: triggerCode.trim(), enabled: true },
      order: { id: 'ASC' },
    });
    if (!rules.length) return null;

    const tags = await this.resolveOrderTags(order);
    const candidates: Array<{ rule: OrderStatusTransition; score: number }> = [];
    for (const r of rules) {
      const m = this.matchConditions(r.conditionsJson, tags);
      if (!m.ok) continue;
      candidates.push({ rule: r, score: m.score });
    }

    if (!candidates.length) {
      // 没有任何规则适用，返回 null 交给调用方走默认分支。
      return null;
    }

    // 冲突规则优先级：
    // 1) 条件命中更具体（score 更高）优先
    // 2) 链路规则（chainId 非空）优先于独立旧规则
    // 3) 同优先级下使用最新规则（id 更大）优先，避免历史旧规则覆盖新配置
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aHasChain = a.rule.chainId != null ? 1 : 0;
      const bHasChain = b.rule.chainId != null ? 1 : 0;
      if (bHasChain !== aHasChain) return bHasChain - aHasChain;
      return b.rule.id - a.rule.id;
    });
    return candidates[0].rule.toStatus;
  }

}

