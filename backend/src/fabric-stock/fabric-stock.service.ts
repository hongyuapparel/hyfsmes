import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FabricStock } from '../entities/fabric-stock.entity';
import { FabricOutbound } from '../entities/fabric-outbound.entity';
import { FabricStockOperationLog } from '../entities/fabric-stock-operation-log.entity';

@Injectable()
export class FabricStockService {
  private readonly logger = new Logger(FabricStockService.name);

  constructor(
    @InjectRepository(FabricStock)
    private readonly stockRepo: Repository<FabricStock>,
    @InjectRepository(FabricOutbound)
    private readonly outboundRepo: Repository<FabricOutbound>,
    @InjectRepository(FabricStockOperationLog)
    private readonly operationLogRepo: Repository<FabricStockOperationLog>,
  ) {}

  private toSnapshot(item: FabricStock): Record<string, unknown> {
    return {
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      customerName: item.customerName,
      imageUrl: item.imageUrl,
      remark: item.remark,
    };
  }

  private async addOperationLog(params: {
    fabricStockId: number;
    action: string;
    operatorUsername: string;
    beforeSnapshot?: Record<string, unknown> | null;
    afterSnapshot?: Record<string, unknown> | null;
    remark?: string;
  }) {
    try {
      const row = this.operationLogRepo.create({
        fabricStockId: params.fabricStockId,
        action: params.action,
        operatorUsername: (params.operatorUsername ?? '').trim(),
        beforeSnapshot: params.beforeSnapshot ?? null,
        afterSnapshot: params.afterSnapshot ?? null,
        remark: (params.remark ?? '').trim(),
      });
      await this.operationLogRepo.save(row);
    } catch (e: unknown) {
      if (this.isTableMissingError(e, 'fabric_stock_operation_log')) {
        // 领料/出入库主流程不依赖该日志表，缺表时降级为仅记录告警日志。
        this.logger.warn('fabric_stock_operation_log 表不存在，已跳过操作日志写入');
        return;
      }
      throw e;
    }
  }

  private isTableMissingError(error: unknown, tableName: string): boolean {
    const msg = String((error as { message?: unknown })?.message ?? error ?? '').toLowerCase();
    return msg.includes("doesn't exist") && msg.includes(tableName.toLowerCase());
  }

  async getList(params: {
    name?: string;
    customerName?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: FabricStock[]; total: number; page: number; pageSize: number }> {
    const { name, customerName, page = 1, pageSize = 20 } = params;
    const qb = this.stockRepo.createQueryBuilder('s');
    if (name?.trim()) {
      qb.andWhere('s.name LIKE :name', { name: `%${name.trim()}%` });
    }
    if (customerName?.trim()) {
      qb.andWhere('s.customer_name LIKE :customerName', {
        customerName: `%${customerName.trim()}%`,
      });
    }
    qb.orderBy('s.created_at', 'DESC');
    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    return { list, total, page, pageSize };
  }

  async getOne(id: number): Promise<FabricStock> {
    const item = await this.stockRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('面料记录不存在');
    return item;
  }

  async create(dto: { name: string; quantity?: number; unit?: string; customerName?: string; remark?: string; imageUrl?: string; operatorUsername?: string }): Promise<FabricStock> {
    const entity = this.stockRepo.create({
      name: dto.name?.trim() ?? '',
      quantity: String(dto.quantity ?? 0),
      unit: dto.unit?.trim() ?? '米',
      customerName: dto.customerName?.trim() ?? '',
      remark: dto.remark?.trim() ?? '',
      imageUrl: dto.imageUrl?.trim() ?? '',
    });
    const saved = await this.stockRepo.save(entity);
    await this.addOperationLog({
      fabricStockId: saved.id,
      action: 'create',
      operatorUsername: dto.operatorUsername ?? '',
      beforeSnapshot: null,
      afterSnapshot: this.toSnapshot(saved),
    });
    return saved;
  }

  async update(id: number, dto: { name?: string; quantity?: number; unit?: string; customerName?: string; remark?: string; imageUrl?: string; operatorUsername?: string }): Promise<FabricStock> {
    const item = await this.stockRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('面料记录不存在');
    const before = this.toSnapshot(item);
    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.quantity !== undefined) item.quantity = String(dto.quantity);
    if (dto.unit !== undefined) item.unit = dto.unit?.trim() ?? '米';
    if (dto.customerName !== undefined) item.customerName = dto.customerName?.trim() ?? '';
    if (dto.remark !== undefined) item.remark = dto.remark?.trim() ?? '';
    if (dto.imageUrl !== undefined) item.imageUrl = dto.imageUrl?.trim() ?? '';
    const saved = await this.stockRepo.save(item);
    await this.addOperationLog({
      fabricStockId: saved.id,
      action: 'update',
      operatorUsername: dto.operatorUsername ?? '',
      beforeSnapshot: before,
      afterSnapshot: this.toSnapshot(saved),
    });
    return saved;
  }

  async remove(id: number, operatorUsername = ''): Promise<void> {
    const item = await this.stockRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('面料记录不存在');
    const before = this.toSnapshot(item);
    await this.stockRepo.remove(item);
    await this.addOperationLog({
      fabricStockId: id,
      action: 'delete',
      operatorUsername,
      beforeSnapshot: before,
      afterSnapshot: null,
    });
  }

  /** 出库：减少数量，并记录照片与备注（谁领走、用途） */
  async outbound(
    id: number,
    quantity: number,
    photoUrl: string,
    remark: string,
    operatorUsername = '',
  ): Promise<void> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) throw new NotFoundException('面料记录不存在');
    const qty = Number(quantity);
    const current = parseFloat(stock.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new NotFoundException('出库数量必须大于 0');
    }
    if (qty > current) {
      throw new NotFoundException('出库数量不能大于当前库存');
    }
    const before = this.toSnapshot(stock);
    stock.quantity = String(current - qty);
    const saved = await this.stockRepo.save(stock);
    const out = this.outboundRepo.create({
      fabricStockId: id,
      quantity: String(qty),
      photoUrl: photoUrl?.trim() ?? '',
      remark: remark?.trim() ?? '',
    });
    await this.outboundRepo.save(out);
    await this.addOperationLog({
      fabricStockId: id,
      action: 'outbound',
      operatorUsername,
      beforeSnapshot: before,
      afterSnapshot: this.toSnapshot(saved),
      remark: remark?.trim() ?? '',
    });
  }

  async getOutboundRecords(params: {
    name?: string;
    customerName?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: Array<{ id: number; fabricStockId: number; name: string; customerName: string; unit: string; quantity: string; photoUrl: string; remark: string; createdAt: string }>; total: number; page: number; pageSize: number }> {
    const { name, customerName, startDate, endDate, page = 1, pageSize = 20 } = params;
    const qb = this.outboundRepo
      .createQueryBuilder('o')
      .innerJoin(FabricStock, 's', 's.id = o.fabric_stock_id')
      .select([
        'o.id AS id',
        'o.fabric_stock_id AS fabricStockId',
        's.name AS name',
        's.customer_name AS customerName',
        's.unit AS unit',
        'o.quantity AS quantity',
        'o.photo_url AS photoUrl',
        'o.remark AS remark',
        'o.created_at AS createdAt',
      ]);

    if (name?.trim()) qb.andWhere('s.name LIKE :name', { name: `%${name.trim()}%` });
    if (customerName?.trim()) qb.andWhere('s.customer_name LIKE :customerName', { customerName: `%${customerName.trim()}%` });
    if (startDate?.trim()) qb.andWhere('o.created_at >= :start', { start: `${startDate.trim()} 00:00:00` });
    if (endDate?.trim()) qb.andWhere('o.created_at <= :end', { end: `${endDate.trim()} 23:59:59` });

    qb.orderBy('o.created_at', 'DESC');
    const total = await qb.getCount();
    const rows = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getRawMany<{
        id: number;
        fabricStockId: number;
        name: string;
        customerName: string;
        unit: string;
        quantity: string;
        photoUrl: string;
        remark: string;
        createdAt: Date;
      }>();

    const list = rows.map((r) => ({
      id: r.id,
      fabricStockId: r.fabricStockId,
      name: r.name ?? '',
      customerName: r.customerName ?? '',
      unit: r.unit ?? '',
      quantity: r.quantity ?? '0',
      photoUrl: r.photoUrl ?? '',
      remark: r.remark ?? '',
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
    }));
    return { list, total, page, pageSize };
  }

  async getOperationLogs(fabricStockId: number): Promise<FabricStockOperationLog[]> {
    await this.getOne(fabricStockId);
    return this.operationLogRepo.find({
      where: { fabricStockId },
      order: { createdAt: 'DESC' },
    });
  }
}
