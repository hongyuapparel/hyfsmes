import { Repository, SelectQueryBuilder } from 'typeorm';
import { PackingList } from '../entities/packing-list.entity';
import { PackingListBox } from '../entities/packing-list-box.entity';
import { PackingListItem } from '../entities/packing-list-item.entity';

export interface PackingListQuery {
  status?: string;
  customerName?: string;
  /** 按明细款号/SKU 模糊匹配（命中任一明细即返回该单） */
  keyword?: string;
  /** 按小满单号模糊匹配 */
  xiaomanOrderNo?: string;
  /** 按业务员精确匹配（下拉选名单） */
  serviceManager?: string;
  dateFrom?: string;
  dateTo?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface PackingListRow {
  id: number;
  code: string;
  customerId: number | null;
  customerName: string;
  serviceManager: string;
  poNo: string;
  xiaomanOrderNo: string;
  xiaomanOrderId: string;
  packDate: string | null;
  status: string;
  holdReason: string;
  shippedAt: Date | null;
  createdAt: Date;
  boxCount: number;
  totalQty: number;
  totalWeight: number;
  styleNos: string[];
}

export interface PackingListSummary {
  boxCount: number;
  totalQty: number;
}

export type PackingListTabCounts = Record<'all' | 'draft' | 'held' | 'shipped', number>;

/** 列表、页签计数及箱件汇总共用过滤规则；不修改单据。 */
export class PackingListsQuery {
  constructor(
    private readonly listRepo: Repository<PackingList>,
    private readonly boxRepo: Repository<PackingListBox>,
    private readonly itemRepo: Repository<PackingListItem>,
  ) {}

  async getList(query: PackingListQuery): Promise<{ list: PackingListRow[]; total: number; summary: PackingListSummary; tabCounts: PackingListTabCounts }> {
    const qb = this.listRepo.createQueryBuilder('pl');
    this.applyListFilters(qb, query);
    this.applyListOrdering(qb, query);

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const totalQb = qb.clone();
    const [lists, total, summary, tabCounts] = await Promise.all([
      qb
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getMany(),
      totalQb.getCount(),
      this.getListSummary(query),
      this.getTabCounts(query),
    ]);

    const ids = lists.map((l) => l.id);
    const boxAgg = new Map<number, { boxCount: number; totalWeight: number }>();
    const itemAgg = new Map<number, { totalQty: number; styleNos: string[] }>();
    if (ids.length) {
      const boxRows: Array<{ listId: string; boxCount: string; totalWeight: string | null }> = await this.boxRepo
        .createQueryBuilder('b')
        .select('b.packing_list_id', 'listId')
        .addSelect('COUNT(*)', 'boxCount')
        .addSelect('SUM(b.weight_kg)', 'totalWeight')
        .where('b.packing_list_id IN (:...ids)', { ids })
        .groupBy('b.packing_list_id')
        .getRawMany();
      for (const row of boxRows) {
        boxAgg.set(Number(row.listId), {
          boxCount: Number(row.boxCount) || 0,
          totalWeight: Number(row.totalWeight) || 0,
        });
      }
      const itemRows: Array<{ listId: string; totalQty: string | null; styleNos: string | null }> = await this.itemRepo
        .createQueryBuilder('i')
        .select('i.packing_list_id', 'listId')
        .addSelect('SUM(i.total_qty)', 'totalQty')
        .addSelect("GROUP_CONCAT(DISTINCT i.style_no SEPARATOR '\n')", 'styleNos')
        .where('i.packing_list_id IN (:...ids)', { ids })
        .groupBy('i.packing_list_id')
        .getRawMany();
      for (const row of itemRows) {
        itemAgg.set(Number(row.listId), {
          totalQty: Number(row.totalQty) || 0,
          styleNos: (row.styleNos ?? '').split('\n').map((s) => s.trim()).filter((s) => !!s),
        });
      }
    }

    const list = lists.map((l) => ({
      id: l.id,
      code: l.code,
      customerId: l.customerId,
      customerName: l.customerName,
      serviceManager: l.serviceManager,
      poNo: l.poNo,
      xiaomanOrderNo: l.xiaomanOrderNo,
      xiaomanOrderId: l.xiaomanOrderId,
      packDate: l.packDate,
      status: l.status,
      holdReason: l.holdReason ?? '',
      shippedAt: l.shippedAt,
      createdAt: l.createdAt,
      boxCount: boxAgg.get(l.id)?.boxCount ?? 0,
      totalQty: itemAgg.get(l.id)?.totalQty ?? 0,
      totalWeight: boxAgg.get(l.id)?.totalWeight ?? 0,
      styleNos: itemAgg.get(l.id)?.styleNos ?? [],
    }));
    return { list, total, summary, tabCounts };
  }

  private applyListFilters(qb: SelectQueryBuilder<PackingList>, query: PackingListQuery): void {
    if (query.status?.trim()) qb.andWhere('pl.status = :status', { status: query.status.trim() });
    if (query.customerName?.trim()) {
      qb.andWhere('pl.customer_name LIKE :customerName', { customerName: `%${query.customerName.trim()}%` });
    }
    if (query.keyword?.trim()) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM packing_list_items pli WHERE pli.packing_list_id = pl.id AND pli.style_no LIKE :keyword)',
        { keyword: `%${query.keyword.trim()}%` },
      );
    }
    if (query.xiaomanOrderNo?.trim()) {
      qb.andWhere('pl.xiaoman_order_no LIKE :xom', { xom: `%${query.xiaomanOrderNo.trim()}%` });
    }
    if (query.serviceManager?.trim()) {
      qb.andWhere('pl.service_manager = :serviceManager', { serviceManager: query.serviceManager.trim() });
    }
    if (query.dateFrom?.trim()) qb.andWhere('pl.pack_date >= :dateFrom', { dateFrom: query.dateFrom.trim() });
    if (query.dateTo?.trim()) qb.andWhere('pl.pack_date <= :dateTo', { dateTo: query.dateTo.trim() });
  }

  private applyListOrdering(qb: SelectQueryBuilder<PackingList>, query: PackingListQuery): void {
    if (query.sortField === 'packDate' && (query.sortOrder === 'asc' || query.sortOrder === 'desc')) {
      const direction = query.sortOrder === 'asc' ? 'ASC' : 'DESC';
      qb.orderBy('pl.pack_date', direction).addOrderBy('pl.id', 'DESC');
      return;
    }
    qb.orderBy('pl.id', 'DESC');
  }

  private async getListSummary(query: PackingListQuery): Promise<PackingListSummary> {
    const qb = this.listRepo.createQueryBuilder('pl');
    this.applyListFilters(qb, query);
    const row: { boxCount: string | null; totalQty: string | null } | undefined = await qb
      .select('COALESCE(SUM((SELECT COUNT(*) FROM packing_list_boxes b WHERE b.packing_list_id = pl.id)), 0)', 'boxCount')
      .addSelect(
        'COALESCE(SUM((SELECT COALESCE(SUM(i.total_qty), 0) FROM packing_list_items i WHERE i.packing_list_id = pl.id)), 0)',
        'totalQty',
      )
      .getRawOne();
    return {
      boxCount: Number(row?.boxCount) || 0,
      totalQty: Number(row?.totalQty) || 0,
    };
  }

  private async getTabCounts(query: PackingListQuery): Promise<PackingListTabCounts> {
    const qb = this.listRepo.createQueryBuilder('pl');
    // 页签只排除当前状态条件，保留客户、SKU、业务员和日期等条件；不分页、不联表重复计数。
    this.applyListFilters(qb, { ...query, status: undefined });
    const rows: Array<{ status: string; count: string }> = await qb
      .select('pl.status', 'status').addSelect('COUNT(*)', 'count')
      .groupBy('pl.status').getRawMany();
    const counts: PackingListTabCounts = { all: 0, draft: 0, held: 0, shipped: 0 };
    for (const row of rows) {
      const count = Number(row.count) || 0;
      counts.all += count;
      if (row.status === 'draft' || row.status === 'held' || row.status === 'shipped') counts[row.status] = count;
    }
    return counts;
  }
}
