import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { PackingList } from '../entities/packing-list.entity';
import { PackingListBox } from '../entities/packing-list-box.entity';
import { PackingListItem } from '../entities/packing-list-item.entity';
import { SavePackingListDto } from './dto';

export interface PackingListQuery {
  status?: string;
  customerName?: string;
  /** 按明细款号/SKU 模糊匹配（命中任一明细即返回该单） */
  keyword?: string;
  /** 按小满单号模糊匹配 */
  xiaomanOrderNo?: string;
  dateFrom?: string;
  dateTo?: string;
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
  shippedAt: Date | null;
  createdAt: Date;
  boxCount: number;
  totalQty: number;
  totalWeight: number;
  styleNos: string[];
}

export interface PackingBoxDetail {
  id: number;
  boxSeq: number;
  weightKg: number | null;
  cartonSize: string;
  remark: string;
  items: Array<{
    id: number;
    styleNo: string;
    styleName: string;
    colorName: string;
    imageUrl: string;
    sizeQuantities: Record<string, number>;
    totalQty: number;
    sourceType: string;
    sourceId: number | null;
  }>;
}

export interface PackingListDetail {
  id: number;
  code: string;
  customerId: number | null;
  customerName: string;
  serviceManager: string;
  poNo: string;
  xiaomanOrderNo: string;
  xiaomanOrderId: string;
  packDate: string | null;
  remark: string;
  showCompany: boolean;
  sizeHeaders: string[];
  status: string;
  shippedAt: Date | null;
  operatorUsername: string;
  createdAt: Date;
  boxes: PackingBoxDetail[];
}

function normalizeSizeQuantities(raw: unknown): Record<string, number> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const num = Number(value);
    if (key && Number.isFinite(num) && num > 0) out[key] = num;
  }
  return out;
}

function sumSizeQuantities(sizeQuantities: Record<string, number>): number {
  return Object.values(sizeQuantities).reduce((acc, n) => acc + n, 0);
}

@Injectable()
export class PackingListsService {
  constructor(
    @InjectRepository(PackingList) private readonly listRepo: Repository<PackingList>,
    @InjectRepository(PackingListBox) private readonly boxRepo: Repository<PackingListBox>,
    @InjectRepository(PackingListItem) private readonly itemRepo: Repository<PackingListItem>,
  ) {}

  async getList(query: PackingListQuery): Promise<{ list: PackingListRow[]; total: number }> {
    const qb = this.listRepo.createQueryBuilder('pl');
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
    if (query.dateFrom?.trim()) qb.andWhere('pl.pack_date >= :dateFrom', { dateFrom: query.dateFrom.trim() });
    if (query.dateTo?.trim()) qb.andWhere('pl.pack_date <= :dateTo', { dateTo: query.dateTo.trim() });
    qb.orderBy('pl.id', 'DESC');

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const [lists, total] = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

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
      shippedAt: l.shippedAt,
      createdAt: l.createdAt,
      boxCount: boxAgg.get(l.id)?.boxCount ?? 0,
      totalQty: itemAgg.get(l.id)?.totalQty ?? 0,
      totalWeight: boxAgg.get(l.id)?.totalWeight ?? 0,
      styleNos: itemAgg.get(l.id)?.styleNos ?? [],
    }));
    return { list, total };
  }

  async getDetail(id: number): Promise<PackingListDetail> {
    const list = await this.listRepo.findOne({ where: { id } });
    if (!list) throw new NotFoundException('装箱单不存在');
    const [boxes, items] = await Promise.all([
      this.boxRepo.find({ where: { packingListId: id }, order: { boxSeq: 'ASC' } }),
      this.itemRepo.find({ where: { packingListId: id }, order: { id: 'ASC' } }),
    ]);
    const itemsByBox = new Map<number, PackingListItem[]>();
    for (const item of items) {
      const arr = itemsByBox.get(item.boxId) ?? [];
      arr.push(item);
      itemsByBox.set(item.boxId, arr);
    }
    return {
      id: list.id,
      code: list.code,
      customerId: list.customerId,
      customerName: list.customerName,
      serviceManager: list.serviceManager,
      poNo: list.poNo,
      xiaomanOrderNo: list.xiaomanOrderNo,
      xiaomanOrderId: list.xiaomanOrderId,
      packDate: list.packDate,
      remark: list.remark,
      showCompany: !!list.showCompany,
      sizeHeaders: Array.isArray(list.sizeHeaders) ? list.sizeHeaders : [],
      status: list.status,
      shippedAt: list.shippedAt,
      operatorUsername: list.operatorUsername,
      createdAt: list.createdAt,
      boxes: boxes.map((box) => ({
        id: box.id,
        boxSeq: box.boxSeq,
        weightKg: box.weightKg != null ? Number(box.weightKg) : null,
        cartonSize: box.cartonSize,
        remark: box.remark,
        items: (itemsByBox.get(box.id) ?? []).map((item) => ({
          id: item.id,
          styleNo: item.styleNo,
          styleName: item.styleName,
          colorName: item.colorName,
          imageUrl: item.imageUrl,
          sizeQuantities: normalizeSizeQuantities(item.sizeQuantities),
          totalQty: item.totalQty,
          sourceType: item.sourceType,
          sourceId: item.sourceId,
        })),
      })),
    };
  }

  /** 当天最大序号+1 生成单号。用 MAX(序号) 而非 COUNT：删除草稿后 COUNT 会回退导致与现存单号撞号。 */
  private async nextCode(manager: EntityManager, ymd: string): Promise<string> {
    const rows: Array<{ code: string }> = await manager.query(
      `SELECT code FROM packing_lists WHERE code LIKE ? ORDER BY code DESC LIMIT 1`,
      [`PL-${ymd}-%`],
    );
    const matched = (rows?.[0]?.code ?? '').match(/-(\d+)$/);
    const seq = (matched ? Number(matched[1]) : 0) + 1;
    return `PL-${ymd}-${String(seq).padStart(2, '0')}`;
  }

  private isDuplicateCodeError(e: unknown): boolean {
    return String((e as { message?: unknown })?.message ?? '').includes('Duplicate entry');
  }

  async create(payload: SavePackingListDto, operatorUsername: string): Promise<{ id: number; code: string }> {
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    // 并发下两个请求可能算出同一序号；靠 uniq_packing_lists_code 唯一索引报重复，捕获后重算重试。
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.listRepo.manager.transaction(async (manager) => {
          const code = await this.nextCode(manager, ymd);
          const list = manager.getRepository(PackingList).create({
            code,
            ...this.buildListColumns(payload),
            status: 'draft',
            operatorUsername: (operatorUsername ?? '').trim(),
          });
          const saved = await manager.getRepository(PackingList).save(list);
          await this.insertBoxesAndItems(manager.getRepository(PackingListBox), manager.getRepository(PackingListItem), saved.id, payload);
          return { id: saved.id, code };
        });
      } catch (e) {
        if (this.isDuplicateCodeError(e) && attempt < 4) continue;
        throw e;
      }
    }
    throw new BadRequestException('生成装箱单号失败，请重试');
  }

  // 已发货单也允许修改：发货后客户常要求改装箱方式（返箱/调箱/补录）。本方法只改单据本身
  // （表头 + 箱 + 明细），不触碰任何库存——库存只在 /ship 时扣减一次，已发货单的二次编辑不影响库存账。
  async update(id: number, payload: SavePackingListDto): Promise<void> {
    const list = await this.listRepo.findOne({ where: { id } });
    if (!list) throw new NotFoundException('装箱单不存在');
    await this.listRepo.manager.transaction(async (manager) => {
      await manager.getRepository(PackingList).update({ id }, this.buildListColumns(payload));
      await manager.getRepository(PackingListItem).delete({ packingListId: id });
      await manager.getRepository(PackingListBox).delete({ packingListId: id });
      await this.insertBoxesAndItems(manager.getRepository(PackingListBox), manager.getRepository(PackingListItem), id, payload);
    });
  }

  async remove(id: number): Promise<void> {
    const list = await this.listRepo.findOne({ where: { id } });
    if (!list) throw new NotFoundException('装箱单不存在');
    if (list.status !== 'draft') throw new BadRequestException('已发货的装箱单不可删除');
    await this.listRepo.manager.transaction(async (manager) => {
      await manager.getRepository(PackingListItem).delete({ packingListId: id });
      await manager.getRepository(PackingListBox).delete({ packingListId: id });
      await manager.getRepository(PackingList).delete({ id });
    });
  }

  async markShipped(ids: number[]): Promise<void> {
    if (!ids.length) return;
    await this.listRepo.update({ id: In(ids) }, { status: 'shipped', shippedAt: new Date() });
  }

  private buildListColumns(payload: SavePackingListDto): Partial<PackingList> {
    return {
      customerId: payload.customerId ?? null,
      customerName: (payload.customerName ?? '').trim(),
      serviceManager: (payload.serviceManager ?? '').trim(),
      poNo: (payload.poNo ?? '').trim(),
      xiaomanOrderNo: (payload.xiaomanOrderNo ?? '').trim(),
      xiaomanOrderId: (payload.xiaomanOrderId ?? '').trim(),
      packDate: payload.packDate?.trim() || null,
      remark: (payload.remark ?? '').trim(),
      showCompany: payload.showCompany === false ? 0 : 1,
      sizeHeaders: Array.isArray(payload.sizeHeaders) ? payload.sizeHeaders.map((h) => h.trim()).filter((h) => !!h) : [],
    };
  }

  private async insertBoxesAndItems(
    boxRepo: Repository<PackingListBox>,
    itemRepo: Repository<PackingListItem>,
    packingListId: number,
    payload: SavePackingListDto,
  ): Promise<void> {
    const boxes = Array.isArray(payload.boxes) ? payload.boxes : [];
    for (let i = 0; i < boxes.length; i++) {
      const boxPayload = boxes[i];
      const box = await boxRepo.save(
        boxRepo.create({
          packingListId,
          boxSeq: i + 1,
          weightKg: boxPayload.weightKg != null && Number.isFinite(Number(boxPayload.weightKg)) ? String(boxPayload.weightKg) : null,
          cartonSize: (boxPayload.cartonSize ?? '').trim(),
          remark: (boxPayload.remark ?? '').trim(),
        }),
      );
      const items = Array.isArray(boxPayload.items) ? boxPayload.items : [];
      if (!items.length) continue;
      await itemRepo.save(
        items.map((item) => {
          const sizeQuantities = normalizeSizeQuantities(item.sizeQuantities);
          const sizeTotal = sumSizeQuantities(sizeQuantities);
          return itemRepo.create({
            packingListId,
            boxId: box.id,
            styleNo: (item.styleNo ?? '').trim(),
            styleName: (item.styleName ?? '').trim(),
            colorName: (item.colorName ?? '').trim(),
            imageUrl: (item.imageUrl ?? '').trim(),
            sizeQuantities,
            totalQty: sizeTotal > 0 ? sizeTotal : Math.max(0, Number(item.totalQty) || 0),
            sourceType: item.sourceType === 'pending' || item.sourceType === 'finished' ? item.sourceType : 'manual',
            sourceId: item.sourceId != null && Number.isInteger(Number(item.sourceId)) ? Number(item.sourceId) : null,
          });
        }),
      );
    }
  }
}
