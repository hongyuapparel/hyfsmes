import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderStatusTransition } from '../entities/order-status-transition.entity';
import { SystemOption } from '../entities/system-option.entity';
import { User } from '../entities/user.entity';
import { Role } from '../entities/role.entity';

type RuleConditions = {
  /** 旧版：样品/大货 粗分类（仍兼容） */
  orderType?: 'sample' | 'bulk';
  /** 新版：精确到系统配置中的订单类型 ID 列表 */
  orderTypeIds?: number[];
  /** 旧版：成品/裁片 粗分类（仍兼容） */
  productForm?: 'finished' | 'cut';
  /** 新版：精确到系统配置中的合作方式 ID 列表 */
  collaborationTypeIds?: number[];
};

@Injectable()
export class OrderWorkflowService {
  constructor(
    @InjectRepository(OrderStatusTransition)
    private readonly transitionRepo: Repository<OrderStatusTransition>,
    @InjectRepository(SystemOption)
    private readonly optionRepo: Repository<SystemOption>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  private parseAllowRoles(v: string | null | undefined): string[] {
    if (!v) return [];
    return v
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  /**
   * 获取当前操作者的角色信息。
   * 兼容历史数据：后续 allowRoles 里既可能存角色 code（如 admin），也可能存中文名（如 管理员）。
   */
  private async getActorRole(userId: number): Promise<{ code: string; name: string }> {
    const u = await this.userRepo.findOne({ where: { id: userId } });
    if (!u) return { code: '', name: '' };
    const r = await this.roleRepo.findOne({ where: { id: u.roleId } });
    return {
      code: (r?.code ?? '').trim(),
      name: (r?.name ?? '').trim(),
    };
  }

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

    return {
      orderType,
      orderTypeId: order.orderTypeId ?? null,
      productForm,
      collaborationTypeId: order.collaborationTypeId ?? null,
    };
  }

  private matchConditions(
    conditionsJson: unknown,
    tags: { orderType?: string; orderTypeId?: number | null; productForm?: string; collaborationTypeId?: number | null },
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
    return { ok: true, score };
  }

  /**
   * 根据当前状态+触发动作，从配置中匹配下一状态。未匹配到返回 null。
   * 会校验 allowRoles（若配置了）。
   */
  async resolveNextStatus(params: { order: Order; triggerCode: string; actorUserId: number }): Promise<string | null> {
    const { order, triggerCode, actorUserId } = params;
    const rules = await this.transitionRepo.find({
      where: { fromStatus: order.status, triggerCode: triggerCode.trim(), enabled: true },
      order: { id: 'ASC' },
    });
    if (!rules.length) return null;

    const tags = await this.resolveOrderTags(order);
    const actorRole = await this.getActorRole(actorUserId);
    const actorTokens = [actorRole.code, actorRole.name].filter((v) => !!v);

    const conditionMatched: OrderStatusTransition[] = [];
    const candidates: Array<{ rule: OrderStatusTransition; score: number }> = [];
    for (const r of rules) {
      const m = this.matchConditions(r.conditionsJson, tags);
      if (!m.ok) continue;
      conditionMatched.push(r);

      const allow = this.parseAllowRoles(r.allowRoles);
      if (allow.length > 0 && (!actorTokens.length || !actorTokens.some((t) => allow.includes(t)))) {
        // 条件匹配但角色不在允许列表中，先跳过，后面统一判断是否仅因角色限制导致失败
        continue;
      }

      candidates.push({ rule: r, score: m.score });
    }

    if (!candidates.length) {
      // 若存在至少一条“条件匹配、但有限制角色”的规则，则说明仅因角色不满足而失败
      const anyRoleLimited = conditionMatched.some((r) => this.parseAllowRoles(r.allowRoles).length > 0);
      if (anyRoleLimited) throw new ForbiddenException('无权限执行该操作');
      // 否则视为没有任何规则适用，返回 null 交给调用方走默认分支
      return null;
    }

    candidates.sort((a, b) => b.score - a.score || a.rule.id - b.rule.id);
    return candidates[0].rule.toStatus;
  }

  /**
   * 当未命中任何配置规则时，按默认样品/大货逻辑给出「采购完成」后的下一状态。
   * - 样品类订单：待纸样（pending_pattern）
   * - 大货类订单：待裁床（pending_cutting）
   */
  async resolveFallbackNextStatusForPurchase(order: Order): Promise<string | null> {
    const tags = await this.resolveOrderTags(order);
    if (tags.orderType === 'sample') return 'pending_pattern';
    if (tags.orderType === 'bulk') return 'pending_cutting';
    return null;
  }
}

