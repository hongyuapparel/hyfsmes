import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { PackingList } from '../entities/packing-list.entity';
import { PackingListBox } from '../entities/packing-list-box.entity';
import { PackingListItem } from '../entities/packing-list-item.entity';
import { PackingListLog } from '../entities/packing-list-log.entity';
import { User } from '../entities/user.entity';
import { resolveOperatorDisplayName } from '../common/operator.util';
import { buildPackingListUpdateSummary } from './packing-list-log-summary';
import { CopyPackingListToDraftDto, SavePackingListDto } from './dto';
import { PackingListsQuery, PackingListQuery } from './packing-lists-query';
export type { PackingListQuery, PackingListRow, PackingListSummary } from './packing-lists-query';
import {
  normalizePackingSizeHeaders,
  normalizePackingSizeQuantitiesForHeaders,
  packingQuantityTotal,
} from './packing-list-quantities';

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
  country: string;
  postalCode: string;
  xiaomanOrderNo: string;
  xiaomanOrderId: string;
  packDate: string | null;
  remark: string;
  showCompany: boolean;
  sizeHeaders: string[];
  status: string;
  holdReason: string;
  shippedAt: Date | null;
  operatorUsername: string;
  createdAt: Date;
  boxes: PackingBoxDetail[];
}

/** 操作记录条目（前端展示用） */
export interface PackingListLogRow {
  id: number;
  packingListId: number;
  operatorUsername: string;
  action: string;
  summary: string;
  createdAt: Date;
}

@Injectable()
export class PackingListsService {
  private readonly logger = new Logger(PackingListsService.name);

  constructor(
    @InjectRepository(PackingList) private readonly listRepo: Repository<PackingList>,
    @InjectRepository(PackingListBox) private readonly boxRepo: Repository<PackingListBox>,
    @InjectRepository(PackingListItem) private readonly itemRepo: Repository<PackingListItem>,
    @InjectRepository(PackingListLog) private readonly logRepo: Repository<PackingListLog>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  resolveOperatorName(actor?: { userId?: number; username?: string }): Promise<string> {
    return resolveOperatorDisplayName(this.userRepo, actor ?? {});
  }

  getList(query: PackingListQuery) {
    return new PackingListsQuery(this.listRepo, this.boxRepo, this.itemRepo).getList(query);
  }

  async getDetail(id: number): Promise<PackingListDetail> {
    const list = await this.listRepo.findOne({ where: { id } });
    if (!list) throw new NotFoundException('装箱单不存在');
    const [boxes, items, operatorName] = await Promise.all([
      this.boxRepo.find({ where: { packingListId: id }, order: { boxSeq: 'ASC' } }),
      this.itemRepo.find({ where: { packingListId: id }, order: { id: 'ASC' } }),
      this.resolveStoredOperatorName(list.operatorUsername),
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
      country: list.country,
      postalCode: list.postalCode,
      xiaomanOrderNo: list.xiaomanOrderNo,
      xiaomanOrderId: list.xiaomanOrderId,
      packDate: list.packDate,
      remark: list.remark,
      showCompany: !!list.showCompany,
      sizeHeaders: Array.isArray(list.sizeHeaders) ? list.sizeHeaders : [],
      status: list.status,
      holdReason: list.holdReason ?? '',
      shippedAt: list.shippedAt,
      operatorUsername: operatorName,
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
          sizeQuantities: normalizePackingSizeQuantitiesForHeaders(item.sizeQuantities, list.sizeHeaders ?? []),
          totalQty: packingQuantityTotal(item.sizeQuantities, item.totalQty, list.sizeHeaders ?? []),
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
        const result = await this.listRepo.manager.transaction(async (manager) => {
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
        const counts = this.payloadCounts(payload);
        const cols = this.buildListColumns(payload);
        await this.recordLog(result.id, 'create', operatorUsername, `新建：客户 ${cols.customerName || '-'}，箱数 ${counts.boxCount}，件数 ${counts.totalQty}`);
        return result;
      } catch (e) {
        if (this.isDuplicateCodeError(e) && attempt < 4) continue;
        throw e;
      }
    }
    throw new BadRequestException('生成装箱单号失败，请重试');
  }

  async copyToDraft(id: number, payload: CopyPackingListToDraftDto, operatorUsername = ''): Promise<{ id: number; code: string }> {
    const list = await this.listRepo.findOne({ where: { id } });
    if (!list) throw new NotFoundException('装箱单不存在');
    if (list.status !== 'draft') throw new BadRequestException('仅草稿装箱单可拆分/复制');

    const sourceBoxes = await this.boxRepo.find({
      where: { packingListId: id },
      order: { boxSeq: 'ASC' },
    });
    if (!sourceBoxes.length) throw new BadRequestException('源单暂无箱子');

    const boxSeqs = this.resolveCopyBoxSeqs(payload, sourceBoxes);
    const boxBySeq = new Map(sourceBoxes.map((box) => [box.boxSeq, box]));
    const boxes: PackingListBox[] = [];
    for (const seq of boxSeqs) {
      const box = boxBySeq.get(seq);
      if (box) boxes.push(box);
    }

    const items = await this.itemRepo.find({
      where: { packingListId: id, boxId: In(boxes.map((box) => box.id)) },
      order: { id: 'ASC' },
    });
    const itemsByBox = new Map<number, PackingListItem[]>();
    for (const item of items) {
      const arr = itemsByBox.get(item.boxId) ?? [];
      arr.push(item);
      itemsByBox.set(item.boxId, arr);
    }

    const remarkOverride = payload.remark?.trim();
    const copyPayload: SavePackingListDto = {
      customerId: list.customerId,
      customerName: list.customerName,
      serviceManager: list.serviceManager,
      poNo: list.poNo,
      country: list.country,
      postalCode: list.postalCode,
      xiaomanOrderNo: list.xiaomanOrderNo,
      xiaomanOrderId: list.xiaomanOrderId,
      packDate: list.packDate,
      remark: remarkOverride || list.remark,
      showCompany: !!list.showCompany,
      sizeHeaders: Array.isArray(list.sizeHeaders) ? list.sizeHeaders : [],
      boxes: boxes.map((box) => ({
        weightKg: box.weightKg != null ? Number(box.weightKg) : null,
        cartonSize: box.cartonSize,
        remark: box.remark,
        items: (itemsByBox.get(box.id) ?? []).map((item) => ({
          styleNo: item.styleNo,
          styleName: item.styleName,
          colorName: item.colorName,
          imageUrl: item.imageUrl,
          sizeQuantities: normalizePackingSizeQuantitiesForHeaders(item.sizeQuantities, list.sizeHeaders ?? []),
          totalQty: packingQuantityTotal(item.sizeQuantities, item.totalQty, list.sizeHeaders ?? []),
          sourceType: item.sourceType,
          sourceId: item.sourceId,
        })),
      })),
    };

    const result = await this.create(copyPayload, operatorUsername);
    const boxSeqLabel = this.formatBoxSeqs(boxSeqs);
    await this.recordLog(id, 'copy_to_draft', operatorUsername, `复制箱 ${boxSeqLabel} 生成 ${result.code}（新单 ${boxes.length} 箱，箱号从 1 重新编号）`);
    await this.recordLog(result.id, 'copy_from', operatorUsername, `由 ${list.code} 复制箱 ${boxSeqLabel} 生成`);
    return result;
  }

  private resolveCopyBoxSeqs(payload: CopyPackingListToDraftDto, sourceBoxes: PackingListBox[]): number[] {
    const maxBoxSeq = sourceBoxes.reduce((max, box) => Math.max(max, box.boxSeq), 0);
    const boxBySeq = new Map(sourceBoxes.map((box) => [box.boxSeq, box]));
    const requestedSeqs = this.normalizeRequestedBoxSeqs(payload);
    if (!requestedSeqs.length) throw new BadRequestException('箱号范围不正确');
    if (requestedSeqs.some((seq) => seq > maxBoxSeq)) throw new BadRequestException(`箱号超出源单箱数：最多 ${maxBoxSeq} 箱`);

    const missingSeqs = requestedSeqs.filter((seq) => !boxBySeq.has(seq));
    if (missingSeqs.length) {
      const shownMissingSeqs = missingSeqs.slice(0, 20).join(', ');
      const suffix = missingSeqs.length > 20 ? ` 等 ${missingSeqs.length} 个箱号` : '';
      throw new BadRequestException(`箱号范围包含源单不存在的箱号：${shownMissingSeqs}${suffix}`);
    }
    return requestedSeqs;
  }

  private normalizeRequestedBoxSeqs(payload: CopyPackingListToDraftDto): number[] {
    const hasExplicitSeqs = Array.isArray(payload.boxSeqs) && payload.boxSeqs.length > 0;
    if (hasExplicitSeqs) {
      if ((payload.boxSeqs ?? []).length > 1000) throw new BadRequestException('一次最多拆分/复制 1000 箱');
      const uniqueSeqs = new Set<number>();
      for (const rawSeq of payload.boxSeqs ?? []) {
        const seq = Number(rawSeq);
        if (!Number.isSafeInteger(seq) || seq < 1) throw new BadRequestException('箱号范围不正确');
        uniqueSeqs.add(seq);
      }
      return [...uniqueSeqs].sort((a, b) => a - b);
    }

    const rawFrom = Number(payload.boxFrom);
    const rawTo = Number(payload.boxTo);
    if (!Number.isSafeInteger(rawFrom) || !Number.isSafeInteger(rawTo)) throw new BadRequestException('箱号范围不正确');
    const boxFrom = Math.max(1, Math.floor(Math.min(rawFrom, rawTo)));
    const boxTo = Math.max(1, Math.floor(Math.max(rawFrom, rawTo)));
    const count = boxTo - boxFrom + 1;
    if (count > 1000) throw new BadRequestException('一次最多拆分/复制 1000 箱');
    return Array.from({ length: count }, (_, index) => boxFrom + index);
  }

  private formatBoxSeqs(seqs: number[]): string {
    if (!seqs.length) return '-';
    const isContinuous = seqs.every((seq, index) => index === 0 || seq === seqs[index - 1] + 1);
    if (isContinuous) return seqs.length === 1 ? `${seqs[0]}` : `${seqs[0]}-${seqs[seqs.length - 1]}`;
    const shownSeqs = seqs.slice(0, 20).join(', ');
    return seqs.length > 20 ? `${shownSeqs} 等 ${seqs.length} 箱` : shownSeqs;
  }

  // 已发货单也允许修改：发货后客户常要求改装箱方式（返箱/调箱/补录）。本方法只改单据本身
  // （表头 + 箱 + 明细），不触碰任何库存——库存只在 /ship 时扣减一次，已发货单的二次编辑不影响库存账。
  async update(id: number, payload: SavePackingListDto, operatorUsername = ''): Promise<void> {
    const before = await this.getDetail(id);
    await this.listRepo.manager.transaction(async (manager) => {
      await manager.getRepository(PackingList).update({ id }, this.buildListColumns(payload));
      await manager.getRepository(PackingListItem).delete({ packingListId: id });
      await manager.getRepository(PackingListBox).delete({ packingListId: id });
      await this.insertBoxesAndItems(manager.getRepository(PackingListBox), manager.getRepository(PackingListItem), id, payload);
    });
    await this.recordLog(id, 'update', operatorUsername, buildPackingListUpdateSummary(before, payload));
  }

  async remove(id: number, operatorUsername = ''): Promise<void> {
    const list = await this.listRepo.findOne({ where: { id } });
    if (!list) throw new NotFoundException('装箱单不存在');
    if (list.status !== 'draft') throw new BadRequestException('仅草稿装箱单可删除，滞留单请先移回草稿');
    await this.listRepo.manager.transaction(async (manager) => {
      await manager.getRepository(PackingListItem).delete({ packingListId: id });
      await manager.getRepository(PackingListBox).delete({ packingListId: id });
      await manager.getRepository(PackingList).delete({ id });
    });
    await this.recordLog(id, 'delete', operatorUsername, `删除装箱单 ${list.code}`);
  }

  async markShipped(ids: number[]): Promise<void> {
    if (!ids.length) return;
    await this.listRepo.update({ id: In(ids) }, { status: 'shipped', shippedAt: new Date() });
  }

  /** 写一条操作记录。在主事务提交后调用，任何写入失败都只告警、绝不冒泡，避免审计日志拖垮已成功的业务操作。 */
  async recordLog(packingListId: number, action: string, operatorUsername: string, summary: string): Promise<void> {
    try {
      await this.logRepo.save(
        this.logRepo.create({
          packingListId,
          action,
          operatorUsername: (operatorUsername ?? '').trim(),
          summary: (summary ?? '').slice(0, 1000),
        }),
      );
    } catch (e) {
      this.logger.warn(`写入装箱单操作记录失败（已忽略，不影响主操作）：${(e as Error)?.message ?? e}`);
    }
  }

  async getLogs(packingListId: number): Promise<PackingListLogRow[]> {
    try {
      const rows = await this.logRepo.find({ where: { packingListId }, order: { createdAt: 'DESC', id: 'DESC' } });
      const operatorDisplayNameMap = await this.getOperatorDisplayNameMap(rows.map((row) => row.operatorUsername));
      return rows.map((r) => ({
        id: r.id,
        packingListId: r.packingListId,
        operatorUsername: operatorDisplayNameMap.get(String(r.operatorUsername ?? '').trim()) ?? r.operatorUsername,
        action: r.action,
        summary: r.summary,
        createdAt: r.createdAt,
      }));
    } catch (e) {
      if (this.isMissingTableError(e)) {
        this.logger.warn('packing_list_logs 表不存在，已返回空操作记录');
        return [];
      }
      throw e;
    }
  }

  private async resolveStoredOperatorName(operatorUsername: string): Promise<string> {
    const raw = String(operatorUsername ?? '').trim();
    if (!raw) return '';
    const map = await this.getOperatorDisplayNameMap([raw]);
    return map.get(raw) ?? raw;
  }

  private async getOperatorDisplayNameMap(operatorUsernames: string[]): Promise<Map<string, string>> {
    const names = Array.from(new Set(operatorUsernames.map((item) => String(item ?? '').trim()).filter(Boolean)));
    if (!names.length) return new Map();
    const users = await this.userRepo.find({
      where: { username: In(names) },
      select: ['username', 'displayName'],
    });
    return new Map(users.map((user) => [user.username, (user.displayName?.trim() || user.username || '').trim()]));
  }

  private isMissingTableError(error: unknown): boolean {
    const e = error as { code?: string; errno?: number; message?: string } | undefined;
    const msg = String(e?.message ?? '').toLowerCase();
    return e?.code === 'ER_NO_SUCH_TABLE' || e?.errno === 1146 || msg.includes("doesn't exist");
  }

  /** 提交载荷的箱数/件数（与 insertBoxesAndItems 同口径） */
  private payloadCounts(payload: SavePackingListDto): { boxCount: number; totalQty: number } {
    const boxes = Array.isArray(payload.boxes) ? payload.boxes : [];
    let totalQty = 0;
    for (const box of boxes) {
      const items = Array.isArray(box.items) ? box.items : [];
      for (const item of items) {
        totalQty += packingQuantityTotal(item.sizeQuantities, item.totalQty, payload.sizeHeaders ?? []);
      }
    }
    return { boxCount: boxes.length, totalQty };
  }

  private buildListColumns(payload: SavePackingListDto): Partial<PackingList> {
    return {
      customerId: payload.customerId ?? null,
      customerName: (payload.customerName ?? '').trim(),
      serviceManager: (payload.serviceManager ?? '').trim(),
      poNo: (payload.poNo ?? '').trim(),
      country: (payload.country ?? '').trim(),
      postalCode: (payload.postalCode ?? '').trim(),
      xiaomanOrderNo: (payload.xiaomanOrderNo ?? '').trim(),
      xiaomanOrderId: (payload.xiaomanOrderId ?? '').trim(),
      packDate: payload.packDate?.trim() || null,
      remark: (payload.remark ?? '').trim(),
      showCompany: payload.showCompany === false ? 0 : 1,
      sizeHeaders: normalizePackingSizeHeaders(payload.sizeHeaders),
    };
  }

  private async insertBoxesAndItems(
    boxRepo: Repository<PackingListBox>,
    itemRepo: Repository<PackingListItem>,
    packingListId: number,
    payload: SavePackingListDto,
  ): Promise<void> {
    const boxes = Array.isArray(payload.boxes) ? payload.boxes : [];
    const sizeHeaders = normalizePackingSizeHeaders(payload.sizeHeaders);
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
          const sizeQuantities = normalizePackingSizeQuantitiesForHeaders(item.sizeQuantities, sizeHeaders);
          return itemRepo.create({
            packingListId,
            boxId: box.id,
            styleNo: (item.styleNo ?? '').trim(),
            styleName: (item.styleName ?? '').trim(),
            colorName: (item.colorName ?? '').trim(),
            imageUrl: (item.imageUrl ?? '').trim(),
            sizeQuantities,
            totalQty: packingQuantityTotal(item.sizeQuantities, item.totalQty, sizeHeaders),
            sourceType: item.sourceType === 'pending' || item.sourceType === 'finished' ? item.sourceType : 'manual',
            sourceId: item.sourceId != null && Number.isInteger(Number(item.sourceId)) ? Number(item.sourceId) : null,
          });
        }),
      );
    }
  }

}
