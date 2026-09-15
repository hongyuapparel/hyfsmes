import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EntityManager, Repository } from 'typeorm';
import { InventoryAccessory } from '../entities/inventory-accessory.entity';
import { InventoryAccessoryOperationLog } from '../entities/inventory-accessory-operation-log.entity';
import { normalizeSizeMatrix } from '../common/size-headers.util';
import { toAccessorySnapshot } from './inventory-accessory.helpers';

export interface AccessoryRestockInput {
  quantity?: number;
  isSized?: boolean;
  sizeHeaders?: string[];
  sizeQuantities?: number[];
  unit?: string;
  remark?: string;
  operatorUsername?: string;
}

function readInboundQuantity(dto: AccessoryRestockInput) {
  const isSized = !!dto.isSized;
  if (isSized && (!Array.isArray(dto.sizeHeaders) || !Array.isArray(dto.sizeQuantities)
    || dto.sizeHeaders.length !== dto.sizeQuantities.length
    || dto.sizeHeaders.some(h => !String(h ?? '').trim())
    || dto.sizeQuantities.some(q => !Number.isSafeInteger(q) || q < 0))) {
    throw new BadRequestException('分码入库明细不完整，数量必须为非负整数');
  }
  const matrix = isSized ? normalizeSizeMatrix(dto.sizeHeaders, dto.sizeQuantities) : null;
  if (isSized && (!matrix || !matrix.headers.length)) {
    throw new BadRequestException('请填写分码尺码明细');
  }
  const qty = isSized ? matrix!.total : Number(dto.quantity ?? 0);
  if (!Number.isSafeInteger(qty) || qty <= 0) {
    throw new BadRequestException(isSized ? '分码新增数量合计必须大于 0' : '新增数量必须大于 0');
  }
  return { isSized, matrix, qty };
}

/** 库存及日志共用调用方事务，禁止使用连接级全局仓库。 */
export class AccessoryStockWriter {
  private readonly repo: Repository<InventoryAccessory>;
  private readonly operationLogRepo: Repository<InventoryAccessoryOperationLog>;

  constructor(manager: EntityManager) {
    this.repo = manager.getRepository(InventoryAccessory);
    this.operationLogRepo = manager.getRepository(InventoryAccessoryOperationLog);
  }

  private normalizeName(value: unknown): string {
    return String(value ?? '').trim();
  }

  private normalizeImageUrls(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((url) => String(url ?? '').trim())
      .filter((url) => !!url);
  }

  private async findByName(name: string): Promise<InventoryAccessory | null> {
    const normalized = this.normalizeName(name);
    if (!normalized) return null;
    return this.repo
      .createQueryBuilder('a')
      .setLock('pessimistic_write')
      .where('a.name = :name', { name: normalized })
      .orderBy('a.id', 'ASC')
      .getOne();
  }

  private async addOperationLog(params: {
    accessoryId: number;
    action: string;
    operatorUsername: string;
    beforeSnapshot?: Record<string, unknown> | null;
    afterSnapshot?: Record<string, unknown> | null;
    remark?: string;
  }): Promise<void> {
    await this.operationLogRepo.save(this.operationLogRepo.create({
      ...params,
      operatorUsername: (params.operatorUsername ?? '').trim(),
      remark: (params.remark ?? '').trim(),
    }));
  }

  async create(dto: {
    name: string;
    category?: string;
    quantity?: number;
    isSized?: boolean;
    sizeHeaders?: string[];
    sizeQuantities?: number[];
    unit?: string;
    warehouseId?: number | null;
    location?: string;
    remark?: string;
    imageUrl?: string;
    imageUrls?: string[];
    customerName?: string;
    salesperson?: string;
    operatorUsername?: string;
  }): Promise<InventoryAccessory> {
    const name = this.normalizeName(dto.name);
    if (!name) throw new BadRequestException('辅料名称不能为空');
    const { isSized, matrix, qty } = readInboundQuantity(dto);
    const salesperson = (dto.salesperson ?? '').trim();
    if (!salesperson) throw new BadRequestException('业务员不能为空');
    const imageUrls = this.normalizeImageUrls(dto.imageUrls);
    const mainImageUrl = imageUrls[0] ?? this.normalizeName(dto.imageUrl);
    const existing = await this.findByName(name);
    if (existing) throw new BadRequestException('辅料名称已存在，请选择原记录使用「补货入库」');
    const entity = this.repo.create({
      name,
      category: dto.category?.trim() ?? '',
      quantity: qty,
      isSized,
      sizeHeaders: isSized ? matrix!.headers : null,
      sizeQuantities: isSized ? matrix!.quantities : null,
      unit: dto.unit?.trim() ?? '个',
      warehouseId: dto.warehouseId ?? null,
      location: dto.location?.trim() ?? '',
      remark: dto.remark?.trim() ?? '',
      imageUrl: mainImageUrl || '',
      imageUrls: imageUrls.length ? imageUrls : null,
      customerName: dto.customerName?.trim() ?? '',
      salesperson,
    });
    const saved = await this.repo.save(entity);
    const beforeSnapshot = toAccessorySnapshot(saved);
    beforeSnapshot.quantity = 0;
    if (saved.isSized) {
      beforeSnapshot.sizeQuantities = (saved.sizeQuantities ?? []).map(() => 0);
    }
    await this.addOperationLog({
      accessoryId: saved.id,
      action: 'create',
      operatorUsername: dto.operatorUsername ?? '',
      beforeSnapshot,
      afterSnapshot: toAccessorySnapshot(saved),
      remark: dto.remark ?? '',
    });
    return saved;
  }

  async restock(id: number, dto: AccessoryRestockInput): Promise<InventoryAccessory> {
    if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('辅料记录编号不合法');
    const existing = await this.repo.createQueryBuilder('a').setLock('pessimistic_write').where('a.id = :id', { id }).getOne();
    if (!existing) throw new NotFoundException('辅料记录不存在，请刷新后重新选择');
    const { isSized, matrix, qty } = readInboundQuantity(dto);
    const incomingUnit = dto.unit === undefined ? this.normalizeName(existing.unit) : this.normalizeName(dto.unit);
    if (incomingUnit !== this.normalizeName(existing.unit)) {
      throw new BadRequestException(`辅料单位不一致（库存：${existing.unit || '未记录'}，本次：${incomingUnit || '未填写'}），不能合并入库，请核对单位`);
    }
    const before = toAccessorySnapshot(existing);
    if (existing.isSized) {
      if (!matrix) {
        throw new BadRequestException('该辅料为分码辅料，请按尺码录入入库数量');
      }
      const merged = normalizeSizeMatrix(
        [...(existing.sizeHeaders ?? []), ...matrix.headers],
        [...(existing.sizeQuantities ?? []), ...matrix.quantities],
      );
      existing.sizeHeaders = merged.headers;
      existing.sizeQuantities = merged.quantities;
      existing.quantity = merged.total;
    } else {
      if (isSized) {
        throw new BadRequestException(
          '该记录为非分码辅料，请刷新后按普通数量补货；如需分码，请先在编辑中设置',
        );
      }
      existing.quantity = (Number(existing.quantity) || 0) + qty;
    }
    const savedExisting = await this.repo.save(existing);
    await this.addOperationLog({
      accessoryId: savedExisting.id,
      action: 'inbound',
      operatorUsername: dto.operatorUsername ?? '',
      beforeSnapshot: before,
      afterSnapshot: toAccessorySnapshot(savedExisting),
      remark: dto.remark ?? '',
    });
    return savedExisting;
  }

  async update(
    id: number,
    dto: {
      name?: string;
      category?: string;
      quantity?: number;
      isSized?: boolean;
      sizeHeaders?: string[];
      sizeQuantities?: number[];
      unit?: string;
      warehouseId?: number | null;
      location?: string;
      remark?: string;
      imageUrl?: string;
      imageUrls?: string[];
      customerName?: string;
      salesperson?: string;
      operatorUsername?: string;
    },
  ): Promise<InventoryAccessory> {
    const item = await this.repo.createQueryBuilder('a').setLock('pessimistic_write').where('a.id = :id', { id }).getOne();
    if (!item) throw new NotFoundException('辅料记录不存在');
    const before = toAccessorySnapshot(item);
    if (dto.isSized !== undefined) {
      if (dto.isSized) {
        const matrix = normalizeSizeMatrix(dto.sizeHeaders, dto.sizeQuantities);
        if (!matrix || !matrix.headers.length) {
          throw new BadRequestException('请填写分码尺码明细');
        }
        item.isSized = true;
        item.sizeHeaders = matrix.headers;
        item.sizeQuantities = matrix.quantities;
        item.quantity = matrix.total;
      } else {
        item.isSized = false;
        item.sizeHeaders = null;
        item.sizeQuantities = null;
      }
    }
    if (dto.name !== undefined) {
      const nextName = this.normalizeName(dto.name);
      if (!nextName) throw new BadRequestException('辅料名称不能为空');
      const existing = nextName === item.name ? null : await this.findByName(nextName);
      if (existing && existing.id !== id) {
        throw new BadRequestException('辅料名称已存在，不能改成重复名称');
      }
      item.name = nextName;
    }
    if (dto.category !== undefined) item.category = dto.category?.trim() ?? '';
    if (dto.unit !== undefined) item.unit = dto.unit?.trim() ?? '个';
    if (dto.warehouseId !== undefined) item.warehouseId = dto.warehouseId ?? null;
    if (dto.location !== undefined) item.location = dto.location?.trim() ?? '';
    if (dto.remark !== undefined) item.remark = dto.remark?.trim() ?? '';
    if (dto.imageUrls !== undefined) {
      const imageUrls = this.normalizeImageUrls(dto.imageUrls);
      item.imageUrls = imageUrls.length ? imageUrls : null;
      item.imageUrl = imageUrls[0] ?? '';
    } else if (dto.imageUrl !== undefined) {
      const imageUrl = dto.imageUrl?.trim() ?? '';
      item.imageUrl = imageUrl;
      item.imageUrls = imageUrl ? [imageUrl] : null;
    }
    if (dto.customerName !== undefined) item.customerName = dto.customerName?.trim() ?? '';
    if (dto.salesperson !== undefined) {
      const salesperson = dto.salesperson?.trim() ?? '';
      if (!salesperson) throw new BadRequestException('业务员不能为空');
      item.salesperson = salesperson;
    }
    const saved = await this.repo.save(item);
    await this.addOperationLog({
      accessoryId: saved.id,
      action: 'update',
      operatorUsername: dto.operatorUsername ?? '',
      beforeSnapshot: before,
      afterSnapshot: toAccessorySnapshot(saved),
    });
    return saved;
  }

  async remove(id: number, operatorUsername = ''): Promise<void> {
    const item = await this.repo.createQueryBuilder('a').setLock('pessimistic_write').where('a.id = :id', { id }).getOne();
    if (!item) throw new NotFoundException('辅料记录不存在');
    const before = toAccessorySnapshot(item);
    await this.repo.remove(item);
    await this.addOperationLog({
      accessoryId: id,
      action: 'delete',
      operatorUsername,
      beforeSnapshot: before,
      afterSnapshot: null,
    });
  }

}

/** 只重试已经整体回滚的死锁；连接异常、提交失败等不明结果不能盲目重试。 */
export async function runAccessoryWrite<T>(
  manager: EntityManager,
  write: (writer: AccessoryStockWriter) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      // RR 下的名称锁定读同时保护不存在的名称，防止首次创建竞争。
      return await manager.transaction('REPEATABLE READ', (transaction) => write(new AccessoryStockWriter(transaction)));
    } catch (error) {
      const code = (error as { code?: string; driverError?: { code?: string } })?.driverError?.code
        ?? (error as { code?: string })?.code;
      if (code !== 'ER_LOCK_DEADLOCK' || attempt >= 2) throw error;
    }
  }
}
