import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InventoryAccessory } from '../entities/inventory-accessory.entity';
import { InventoryAccessoryOutbound } from '../entities/inventory-accessory-outbound.entity';
import { InventoryAccessoryOperationLog } from '../entities/inventory-accessory-operation-log.entity';
import { User, UserStatus } from '../entities/user.entity';

@Injectable()
export class InventoryAccessoriesService {
  constructor(
    @InjectRepository(InventoryAccessory)
    private readonly repo: Repository<InventoryAccessory>,
    @InjectRepository(InventoryAccessoryOutbound)
    private readonly outboundRepo: Repository<InventoryAccessoryOutbound>,
    @InjectRepository(InventoryAccessoryOperationLog)
    private readonly operationLogRepo: Repository<InventoryAccessoryOperationLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private toSnapshot(item: InventoryAccessory): Record<string, unknown> {
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      customerName: item.customerName,
      salesperson: item.salesperson,
      imageUrl: item.imageUrl,
      remark: item.remark,
    };
  }

  private async addOperationLog(params: {
    accessoryId: number;
    action: string;
    operatorUsername: string;
    beforeSnapshot?: Record<string, unknown> | null;
    afterSnapshot?: Record<string, unknown> | null;
    remark?: string;
  }) {
    const row = this.operationLogRepo.create({
      accessoryId: params.accessoryId,
      action: params.action,
      operatorUsername: (params.operatorUsername ?? '').trim(),
      beforeSnapshot: params.beforeSnapshot ?? null,
      afterSnapshot: params.afterSnapshot ?? null,
      remark: (params.remark ?? '').trim(),
    });
    await this.operationLogRepo.save(row);
  }

  async getList(params: {
    name?: string;
    category?: string;
    customerName?: string;
    salesperson?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: InventoryAccessory[]; total: number; page: number; pageSize: number }> {
    const { name, category, customerName, salesperson, page = 1, pageSize = 20 } = params;
    const qb = this.repo.createQueryBuilder('a');

    if (name?.trim()) {
      qb.andWhere('a.name LIKE :name', { name: `%${name.trim()}%` });
    }
    if (category?.trim()) {
      qb.andWhere('a.category = :category', { category: category.trim() });
    }
    if (customerName?.trim()) {
      qb.andWhere('a.customer_name LIKE :customerName', {
        customerName: `%${customerName.trim()}%`,
      });
    }
    if (salesperson?.trim()) {
      qb.andWhere('a.salesperson = :salesperson', { salesperson: salesperson.trim() });
    }
    qb.orderBy('a.created_at', 'DESC');

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();

    return { list, total, page, pageSize };
  }

  async getOne(id: number): Promise<InventoryAccessory> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('辅料记录不存在');
    return item;
  }

  async create(dto: {
    name: string;
    category?: string;
    quantity?: number;
    unit?: string;
    remark?: string;
    imageUrl?: string;
    customerName?: string;
    salesperson?: string;
    operatorUsername?: string;
  }): Promise<InventoryAccessory> {
    const salesperson = (dto.salesperson ?? '').trim();
    if (!salesperson) throw new BadRequestException('业务员不能为空');
    const entity = this.repo.create({
      name: dto.name?.trim() ?? '',
      category: dto.category?.trim() ?? '',
      quantity: dto.quantity ?? 0,
      unit: dto.unit?.trim() ?? '个',
      remark: dto.remark?.trim() ?? '',
      imageUrl: dto.imageUrl?.trim() ?? '',
      customerName: dto.customerName?.trim() ?? '',
      salesperson,
    });
    const saved = await this.repo.save(entity);
    await this.addOperationLog({
      accessoryId: saved.id,
      action: 'create',
      operatorUsername: dto.operatorUsername ?? '',
      beforeSnapshot: null,
      afterSnapshot: this.toSnapshot(saved),
    });
    return saved;
  }

  async update(
    id: number,
    dto: {
      name?: string;
      category?: string;
      quantity?: number;
      unit?: string;
      remark?: string;
      imageUrl?: string;
      customerName?: string;
      salesperson?: string;
      operatorUsername?: string;
    },
  ): Promise<InventoryAccessory> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('辅料记录不存在');
    const before = this.toSnapshot(item);
    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.category !== undefined) item.category = dto.category?.trim() ?? '';
    if (dto.quantity !== undefined) item.quantity = dto.quantity;
    if (dto.unit !== undefined) item.unit = dto.unit?.trim() ?? '个';
    if (dto.remark !== undefined) item.remark = dto.remark?.trim() ?? '';
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl?.trim() ?? '';
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
      afterSnapshot: this.toSnapshot(saved),
    });
    return saved;
  }

  async remove(id: number, operatorUsername = ''): Promise<void> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('辅料记录不存在');
    const before = this.toSnapshot(item);
    await this.repo.remove(item);
    await this.addOperationLog({
      accessoryId: id,
      action: 'delete',
      operatorUsername,
      beforeSnapshot: before,
      afterSnapshot: null,
    });
  }

  /** 出库弹窗「领用人」下拉：返回全公司可用用户 */
  async getUserOptions(): Promise<{ id: number; username: string; displayName: string }[]> {
    const list = await this.userRepo.find({
      where: { status: UserStatus.ACTIVE },
      order: { id: 'ASC' },
    });
    return list.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName ?? '',
    }));
  }

  async resolveOperatorLabel(userId: number, fallbackUsername: string): Promise<string> {
    const fallback = (fallbackUsername ?? '').trim();
    try {
      const u = await this.userRepo.findOne({ where: { id: userId } });
      const label = (u?.displayName ?? '').trim() || (u?.username ?? '').trim() || fallback;
      return label || fallback;
    } catch {
      return fallback;
    }
  }

  /**
   * 辅料出库（事务 + 行锁），并写出库记录。
   * @param params.quantity 出库数量（正数）
   */
  async outbound(params: {
    accessoryId: number;
    quantity: number;
    outboundType: 'order_auto' | 'manual';
    operatorUsername: string;
    remark?: string;
    orderId?: number | null;
    orderNo?: string;
  }): Promise<{ accessory: InventoryAccessory; record: InventoryAccessoryOutbound }> {
    const qty = Number(params.quantity) || 0;
    if (!params.accessoryId || qty <= 0) {
      throw new BadRequestException('出库参数不合法');
    }

    return this.repo.manager.transaction(async (manager) => {
      const accessoryRepo = manager.getRepository(InventoryAccessory);
      const recordRepo = manager.getRepository(InventoryAccessoryOutbound);
      const operationLogRepo = manager.getRepository(InventoryAccessoryOperationLog);

      const accessory = await accessoryRepo
        .createQueryBuilder('a')
        .setLock('pessimistic_write')
        .where('a.id = :id', { id: params.accessoryId })
        .getOne();

      if (!accessory) throw new NotFoundException('辅料记录不存在');

      const before = Number(accessory.quantity) || 0;
      const beforeSnapshot = this.toSnapshot(accessory);
      if (before < qty) {
        throw new BadRequestException(`库存不足：当前 ${before}，需要出库 ${qty}`);
      }

      accessory.quantity = before - qty;
      const savedAccessory = await accessoryRepo.save(accessory);

      const record = recordRepo.create({
        accessoryId: params.accessoryId,
        orderId: params.orderId ?? null,
        orderNo: params.orderNo ?? '',
        outboundType: params.outboundType,
        quantity: qty,
        beforeQuantity: before,
        afterQuantity: savedAccessory.quantity,
        operatorUsername: (params.operatorUsername ?? '').trim(),
        remark: (params.remark ?? '').trim(),
      });
      const savedRecord = await recordRepo.save(record);
      await operationLogRepo.save(
        operationLogRepo.create({
          accessoryId: params.accessoryId,
          action: 'outbound',
          operatorUsername: (params.operatorUsername ?? '').trim(),
          beforeSnapshot,
          afterSnapshot: this.toSnapshot(savedAccessory),
          remark: (params.remark ?? '').trim(),
        }),
      );

      return { accessory: savedAccessory, record: savedRecord };
    });
  }

  async getOutboundRecords(params: {
    accessoryId?: number;
    orderNo?: string;
    outboundType?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    list: Array<
      Omit<InventoryAccessoryOutbound, 'createdAt'> & {
        createdAt: string;
        imageUrl?: string;
        customerName?: string;
        category?: string;
      }
    >;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { accessoryId, orderNo, outboundType, page = 1, pageSize = 20 } = params;
    const qb = this.outboundRepo
      .createQueryBuilder('r')
      .leftJoin(InventoryAccessory, 'a', 'a.id = r.accessory_id')
      .select([
        'r.id AS id',
        'r.accessory_id AS accessoryId',
        'r.order_id AS orderId',
        'r.order_no AS orderNo',
        'r.outbound_type AS outboundType',
        'r.quantity AS quantity',
        'r.before_quantity AS beforeQuantity',
        'r.after_quantity AS afterQuantity',
        'r.operator_username AS operatorUsername',
        'r.remark AS remark',
        'r.created_at AS createdAt',
        "COALESCE(a.image_url, '') AS imageUrl",
        "COALESCE(a.customer_name, '') AS customerName",
        "COALESCE(a.category, '') AS category",
      ]);
    if (accessoryId) qb.andWhere('r.accessory_id = :accessoryId', { accessoryId });
    if (orderNo?.trim()) qb.andWhere('r.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    if (outboundType?.trim()) qb.andWhere('r.outbound_type = :outboundType', { outboundType: outboundType.trim() });
    qb.orderBy('r.created_at', 'DESC');

    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getRawMany<any>();
    const rows = list.map((r: any) => ({
      id: Number(r.id),
      accessoryId: Number(r.accessoryId),
      orderId: r.orderId != null ? Number(r.orderId) : null,
      orderNo: r.orderNo ?? '',
      outboundType: r.outboundType ?? 'manual',
      quantity: Number(r.quantity) || 0,
      beforeQuantity: Number(r.beforeQuantity) || 0,
      afterQuantity: Number(r.afterQuantity) || 0,
      operatorUsername: r.operatorUsername ?? '',
      remark: r.remark ?? '',
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
      imageUrl: r.imageUrl ?? '',
      customerName: r.customerName ?? '',
      category: r.category ?? '',
    }));
    return { list: rows, total, page, pageSize };
  }

  async getOperationLogs(accessoryId: number): Promise<InventoryAccessoryOperationLog[]> {
    await this.getOne(accessoryId);
    return this.operationLogRepo.find({
      where: { accessoryId },
      order: { createdAt: 'DESC' },
    });
  }
}
