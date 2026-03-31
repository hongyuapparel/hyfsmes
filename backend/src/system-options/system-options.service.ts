import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, IsNull } from 'typeorm';
import { SystemOption } from '../entities/system-option.entity';

export interface SystemOptionTree extends SystemOption {
  children: SystemOptionTree[];
}

@Injectable()
export class SystemOptionsService {
  constructor(
    @InjectRepository(SystemOption)
    private repo: Repository<SystemOption>,
    private readonly dataSource: DataSource,
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

  /** 按一级节点值返回其 id（如按「加工供应商」取供应商类型 id） */
  async findRootIdByValue(optionType: string, value: string): Promise<number | null> {
    if (!value?.trim()) return null;
    const option = await this.repo.findOne({
      where: { optionType, value: value.trim(), parentId: IsNull() },
      select: ['id'],
    });
    return option?.id ?? null;
  }

  /** 按父节点值返回后代路径列表（父分组与子分组都可作为下拉选项） */
  async findChildrenValuesByParentValue(
    optionType: string,
    parentValue: string,
  ): Promise<string[]> {
    const parent = await this.repo.findOne({
      where: { optionType, value: parentValue, parentId: IsNull() },
    });
    if (!parent) return [];
    const all = await this.repo.find({
      where: { optionType },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const byParent = new Map<number, SystemOption[]>();
    for (const o of all) {
      if (o.parentId == null) continue;
      if (!byParent.has(o.parentId)) byParent.set(o.parentId, []);
      byParent.get(o.parentId)!.push(o);
    }

    const values: string[] = [];
    const stack: Array<{ node: SystemOption; path: string }> = (byParent.get(parent.id) ?? []).map((n) => ({
      node: n,
      path: n.value,
    }));
    while (stack.length) {
      const { node, path } = stack.shift()!;
      const children = byParent.get(node.id) ?? [];
      values.push(path);
      if (children.length > 0) {
        stack.unshift(
          ...children.map((c) => ({
            node: c,
            path: `${path} / ${c.value}`,
          })),
        );
      }
    }
    return values;
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
    if (!roots.length) return [];

    const childCounts: Array<{ parentId: number; cnt: string | number }> =
      await this.repo
        .createQueryBuilder('o')
        .select('o.parent_id', 'parentId')
        .addSelect('COUNT(1)', 'cnt')
        .where('o.option_type = :optionType', { optionType })
        .andWhere('o.parent_id IN (:...rootIds)', { rootIds: roots.map((r) => r.id) })
        .groupBy('o.parent_id')
        .getRawMany();
    const hasChildrenSet = new Set(
      childCounts
        .filter((x) => Number(x.cnt) > 0)
        .map((x) => Number(x.parentId))
        .filter((n) => Number.isFinite(n)),
    );

    return roots.map((r) => ({
      id: r.id,
      value: r.value,
      sortOrder: r.sortOrder,
      hasChildren: hasChildrenSet.has(r.id),
    }));
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
    if (!list.length) return [];

    const childCounts: Array<{ parentId: number; cnt: string | number }> =
      await this.repo
        .createQueryBuilder('o')
        .select('o.parent_id', 'parentId')
        .addSelect('COUNT(1)', 'cnt')
        .where('o.option_type = :optionType', { optionType })
        .andWhere('o.parent_id IN (:...ids)', { ids: list.map((x) => x.id) })
        .groupBy('o.parent_id')
        .getRawMany();
    const hasChildrenSet = new Set(
      childCounts
        .filter((x) => Number(x.cnt) > 0)
        .map((x) => Number(x.parentId))
        .filter((n) => Number.isFinite(n)),
    );

    return list.map((o) => ({
      id: o.id,
      value: o.value,
      sortOrder: o.sortOrder,
      hasChildren: hasChildrenSet.has(o.id),
    }));
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

  /**
   * 通用：按类型 + 根节点 ID，返回「根节点 + 全部子孙节点」ID。
   * 适用于父分组筛选时包含所有子分组数据。
   */
  async getSelfAndDescendantIds(optionType: string, rootId: number): Promise<number[]> {
    if (!Number.isFinite(rootId)) return [];
    const list = await this.repo.find({
      where: { optionType },
      order: { parentId: 'ASC', sortOrder: 'ASC', id: 'ASC' },
      select: ['id', 'parentId'],
    });
    const nodeIds = new Set(list.map((x) => x.id));
    if (!nodeIds.has(rootId)) return [rootId];
    const byParent = new Map<number, number[]>();
    for (const row of list) {
      if (row.parentId == null) continue;
      const children = byParent.get(row.parentId) ?? [];
      children.push(row.id);
      byParent.set(row.parentId, children);
    }
    const result: number[] = [];
    const visited = new Set<number>();
    const queue: number[] = [rootId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      result.push(current);
      const children = byParent.get(current) ?? [];
      if (children.length > 0) queue.push(...children);
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
    const oldValue = opt.value;

    if (dto.value !== undefined) opt.value = dto.value;
    if (dto.sortOrder !== undefined) opt.sortOrder = dto.sortOrder;
    if (dto.parentId !== undefined) opt.parentId = dto.parentId;
    const saved = await this.repo.save(opt);

    await this.syncHistoricalTextByOptionRename(saved, oldValue, saved.value);
    return saved;
  }

  /** 配置项改名后，回写历史文本快照字段（仅覆盖当前确有文本快照的场景） */
  private async syncHistoricalTextByOptionRename(
    option: SystemOption,
    oldValue: string,
    newValue: string,
  ): Promise<void> {
    const from = (oldValue ?? '').trim();
    const to = (newValue ?? '').trim();
    if (!from || !to || from === to) return;

    // 加工厂：历史订单仍有 factory_name 文本快照，改名后统一回写。
    if (option.optionType === 'factories') {
      await this.dataSource.query(
        'UPDATE orders SET factory_name = ? WHERE factory_name = ?',
        [to, from],
      );
      return;
    }

    // 组织部门：历史表中存在 department 文本快照，改名后统一回写。
    if (option.optionType === 'org_departments') {
      await Promise.all([
        this.dataSource.query(
          'UPDATE employees SET department = ? WHERE department = ?',
          [to, from],
        ),
        this.dataSource.query(
          'UPDATE production_processes SET department = ? WHERE department = ?',
          [to, from],
        ),
        this.dataSource.query(
          'UPDATE warehouse_inbound SET department = ? WHERE department = ?',
          [to, from],
        ),
        this.dataSource.query(
          'UPDATE finished_goods_stock SET department = ? WHERE department = ?',
          [to, from],
        ),
        this.dataSource.query(
          'UPDATE finished_goods_outbound SET department = ? WHERE department = ?',
          [to, from],
        ),
      ]);
      return;
    }

    // 供应商设置-业务范围：历史订单工艺项目是文本快照，改名后统一回写。
    if (option.optionType === 'supplier_types' && option.parentId != null) {
      await this.dataSource.query(
        'UPDATE orders SET process_item = ? WHERE process_item = ?',
        [to, from],
      );
      return;
    }

    // 订单设置-工种树：改名后同步生产工序中的 job_type 文本快照。
    if (option.optionType === 'process_job_types') {
      await this.dataSource.query(
        'UPDATE production_processes SET job_type = ? WHERE job_type = ?',
        [to, from],
      );
      return;
    }

    // 其余配置项当前以 ID 关联为主，展示会自动解析，无需文本回写。
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
