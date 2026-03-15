import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { SystemOption } from '../entities/system-option.entity';

export interface SystemOptionTree extends SystemOption {
  children: SystemOptionTree[];
}

@Injectable()
export class SystemOptionsService {
  constructor(
    @InjectRepository(SystemOption)
    private repo: Repository<SystemOption>,
  ) {}

  /** 供下拉用：扁平时子项显示为 "父级 > 子级 */
  async findByType(optionType: string): Promise<string[]> {
    const list = await this.repo.find({
      where: { optionType },
      order: { parentId: 'ASC', sortOrder: 'ASC', id: 'ASC' },
    });
    const byId = new Map(list.map((o) => [o.id, o]));
    const result: string[] = [];
    for (const o of list) {
      if (o.parentId == null) {
        result.push(o.value);
      } else {
        const path: string[] = [];
        let cur: SystemOption | undefined = o;
        while (cur) {
          path.unshift(cur.value);
          cur = cur.parentId != null ? byId.get(cur.parentId) : undefined;
        }
        result.push(path.join(' > '));
      }
    }
    return result;
  }

  /** 仅返回一级（根）节点值，供类型等单层下拉 */
  async findRootsByType(optionType: string): Promise<string[]> {
    const list = await this.repo.find({
      where: { optionType, parentId: IsNull() },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return list.map((o) => o.value);
  }

  /** 按一级节点值返回其 id（如按「生产加工厂」取供应商类型 id） */
  async findRootIdByValue(optionType: string, value: string): Promise<number | null> {
    if (!value?.trim()) return null;
    const option = await this.repo.findOne({
      where: { optionType, value: value.trim(), parentId: IsNull() },
      select: ['id'],
    });
    return option?.id ?? null;
  }

  /** 按父节点值返回直接子节点值列表（如某供应商类型下的业务范围） */
  async findChildrenValuesByParentValue(
    optionType: string,
    parentValue: string,
  ): Promise<string[]> {
    const parent = await this.repo.findOne({
      where: { optionType, value: parentValue, parentId: IsNull() },
    });
    if (!parent) return [];
    const list = await this.repo.find({
      where: { optionType, parentId: parent.id },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    return list.map((o) => o.value);
  }

  /** 按类型获取扁平列表（含 parentId），供管理页建树 */
  async findAllByType(optionType: string): Promise<SystemOption[]> {
    return this.repo.find({
      where: { optionType },
      order: { parentId: 'ASC', sortOrder: 'ASC', id: 'ASC' },
    });
  }

  /** 懒加载树：仅返回根节点，带 hasChildren 标记 */
  async findRootsForLazyTree(
    optionType: string,
  ): Promise<{ id: number; value: string; sortOrder: number; hasChildren: boolean }[]> {
    const roots = await this.repo.find({
      where: { optionType, parentId: IsNull() },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const result: { id: number; value: string; sortOrder: number; hasChildren: boolean }[] = [];
    for (const r of roots) {
      const childCount = await this.repo.count({
        where: { optionType, parentId: r.id },
      });
      result.push({
        id: r.id,
        value: r.value,
        sortOrder: r.sortOrder,
        hasChildren: childCount > 0,
      });
    }
    return result;
  }

  /** 懒加载树：按父节点 id 返回子节点，带 hasChildren 标记 */
  async findChildrenByParentId(
    optionType: string,
    parentId: number,
  ): Promise<{ id: number; value: string; sortOrder: number; hasChildren: boolean }[]> {
    const list = await this.repo.find({
      where: { optionType, parentId },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const result: { id: number; value: string; sortOrder: number; hasChildren: boolean }[] = [];
    for (const o of list) {
      const childCount = await this.repo.count({
        where: { optionType, parentId: o.id },
      });
      result.push({
        id: o.id,
        value: o.value,
        sortOrder: o.sortOrder,
        hasChildren: childCount > 0,
      });
    }
    return result;
  }

  /**
   * 产品分组：根据 system_options.id 解析完整路径（父 > 子），用于列表/详情展示，改名后自动同步
   */
  async getProductGroupPathById(id: number | null): Promise<string> {
    if (id == null) return '';
    const map = await this.getProductGroupPathsByIds([id]);
    return map[id] ?? '';
  }

  /**
   * 产品分组：批量根据 ID 解析路径，返回 id -> 路径
   */
  async getProductGroupPathsByIds(ids: number[]): Promise<Record<number, string>> {
    const set = new Set(ids.filter((n) => typeof n === 'number' && !Number.isNaN(n)));
    if (set.size === 0) return {};
    const list = await this.repo.find({
      where: { optionType: 'product_groups' },
      order: { parentId: 'ASC', sortOrder: 'ASC', id: 'ASC' },
    });
    const byId = new Map(list.map((o) => [o.id, o]));
    const cache = new Map<number, string>();
    const buildPath = (nodeId: number): string => {
      if (cache.has(nodeId)) return cache.get(nodeId)!;
      const node = byId.get(nodeId);
      if (!node) return '';
      const parts: string[] = [];
      let cur: SystemOption | undefined = node;
      while (cur) {
        parts.unshift(cur.value);
        cur = cur.parentId != null ? byId.get(cur.parentId) : undefined;
      }
      const path = parts.join(' > ');
      cache.set(nodeId, path);
      return path;
    };
    const result: Record<number, string> = {};
    for (const id of set) {
      const path = buildPath(id);
      if (path) result[id] = path;
    }
    return result;
  }

  /**
   * 通用：根据 optionType + 一组 ID 返回「id -> 当前名称」映射。
   * 用于部门、岗位等配置项按 ID 解析展示名称，改名后历史数据自动同步。
   */
  async getOptionLabelsByIds(
    optionType: string,
    ids: number[],
  ): Promise<Record<number, string>> {
    const set = new Set(
      ids.filter((n) => typeof n === 'number' && !Number.isNaN(n)),
    );
    if (set.size === 0) return {};

    const list = await this.repo.find({
      where: { optionType },
      order: { parentId: 'ASC', sortOrder: 'ASC', id: 'ASC' },
    });
    const byId = new Map(list.map((o) => [o.id, o.value]));

    const result: Record<number, string> = {};
    for (const id of set) {
      const label = byId.get(id);
      if (label) result[id] = label;
    }
    return result;
  }

  /** 按类型获取树形结构 */
  async findTreeByType(optionType: string): Promise<SystemOptionTree[]> {
    const list = await this.repo.find({
      where: { optionType },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const byParent = new Map<number | null, SystemOption[]>();
    for (const o of list) {
      const pid = o.parentId ?? null;
      if (!byParent.has(pid)) byParent.set(pid, []);
      byParent.get(pid)!.push(o);
    }
    function build(pid: number | null): SystemOptionTree[] {
      const children = byParent.get(pid) ?? [];
      return children.map((o) => ({ ...o, children: build(o.id) }));
    }
    return build(null);
  }

  async create(
    optionType: string,
    value: string,
    sortOrder = 0,
    parentId: number | null = null,
  ): Promise<SystemOption> {
    const opt = this.repo.create({ optionType, value, sortOrder, parentId });
    return this.repo.save(opt);
  }

  async update(
    id: number,
    dto: { value?: string; sortOrder?: number; parentId?: number | null },
  ): Promise<SystemOption> {
    const opt = await this.repo.findOne({ where: { id } });
    if (!opt) throw new NotFoundException('选项不存在');

    if (dto.value !== undefined) opt.value = dto.value;
    if (dto.sortOrder !== undefined) opt.sortOrder = dto.sortOrder;
    if (dto.parentId !== undefined) opt.parentId = dto.parentId;
    const saved = await this.repo.save(opt);

    // 仓库：业务表只存 warehouse_id，列表/详情展示时按 ID 查当前名称，故此处无需按名称同步更新业务表，改名即自动同步。
    return saved;
  }

  async remove(id: number): Promise<void> {
    const children = await this.repo.find({ where: { parentId: id } });
    for (const c of children) await this.remove(c.id);
    const opt = await this.repo.findOne({ where: { id } });
    if (!opt) throw new NotFoundException('选项不存在');
    await this.repo.remove(opt);
  }

  /** 同一父级下更新排序 */
  async batchUpdateOrder(
    optionType: string,
    parentId: number | null,
    items: { id: number; sortOrder: number }[],
  ): Promise<void> {
    const parentCondition = parentId === null ? IsNull() : parentId;
    for (const { id, sortOrder } of items) {
      await this.repo.update({ id, optionType, parentId: parentCondition }, { sortOrder });
    }
  }

}
