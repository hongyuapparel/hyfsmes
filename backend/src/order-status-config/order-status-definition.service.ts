import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusSla } from '../entities/order-status-sla.entity';

@Injectable()
export class OrderStatusDefinitionService {
  constructor(
    @InjectRepository(OrderStatus)
    private readonly statusRepo: Repository<OrderStatus>,
    @InjectRepository(OrderStatusSla)
    private readonly slaRepo: Repository<OrderStatusSla>,
  ) {}

  async getAllStatuses(): Promise<OrderStatus[]> {
    return this.statusRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async createStatus(payload: Partial<OrderStatus>): Promise<OrderStatus> {
    const rawCode = payload.code?.trim();
    const rawLabel = payload.label?.trim() ?? '';
    const predefinedMap: Record<string, string> = {
      草稿: 'draft',
      待审单: 'pending_review',
      待纸样: 'pending_pattern',
      待采购: 'pending_purchase',
      待工艺: 'pending_craft',
      待裁床: 'pending_cutting',
      待车缝: 'pending_sewing',
      待尾部: 'pending_finishing',
      订单完成: 'completed',
    };
    const mappedCode = predefinedMap[rawLabel];
    const code = rawCode && rawCode.length > 0 ? rawCode : mappedCode || `status_${Date.now()}`;
    const entity = this.statusRepo.create({
      code,
      label: rawLabel,
      sortOrder: payload.sortOrder ?? 0,
      groupKey: payload.groupKey?.trim() || null,
      isFinal: Boolean(payload.isFinal),
      enabled: payload.enabled ?? true,
    });
    return this.statusRepo.save(entity);
  }

  async updateStatus(id: number, payload: Partial<OrderStatus>): Promise<OrderStatus> {
    const status = await this.statusRepo.findOne({ where: { id } });
    if (!status) throw new NotFoundException('状态不存在');
    if (payload.code !== undefined) status.code = payload.code.trim();
    if (payload.label !== undefined) status.label = payload.label.trim();
    if (payload.sortOrder !== undefined) status.sortOrder = payload.sortOrder;
    if (payload.groupKey !== undefined) status.groupKey = payload.groupKey?.trim() || null;
    if (payload.isFinal !== undefined) status.isFinal = Boolean(payload.isFinal);
    if (payload.enabled !== undefined) status.enabled = Boolean(payload.enabled);
    return this.statusRepo.save(status);
  }

  async toggleStatusEnabled(id: number): Promise<OrderStatus> {
    const status = await this.statusRepo.findOne({ where: { id } });
    if (!status) throw new NotFoundException('状态不存在');
    status.enabled = !status.enabled;
    return this.statusRepo.save(status);
  }

  async deleteStatus(id: number): Promise<void> {
    await this.statusRepo.delete(id);
  }

  async getSlaList(): Promise<OrderStatusSla[]> {
    return this.slaRepo.find({ relations: ['orderStatus'], order: { orderStatusId: 'ASC', id: 'ASC' } });
  }

  async createSla(payload: { orderStatusId: number; limitHours: number; enabled?: boolean }): Promise<OrderStatusSla> {
    const status = await this.statusRepo.findOne({ where: { id: payload.orderStatusId } });
    if (!status) throw new NotFoundException('订单状态不存在');
    const entity = this.slaRepo.create({
      orderStatusId: payload.orderStatusId,
      limitHours: String(payload.limitHours),
      enabled: payload.enabled ?? true,
    });
    return this.slaRepo.save(entity);
  }

  async updateSla(
    id: number,
    payload: { orderStatusId?: number; limitHours?: number; enabled?: boolean },
  ): Promise<OrderStatusSla> {
    const row = await this.slaRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('时效配置不存在');
    if (payload.orderStatusId !== undefined) row.orderStatusId = payload.orderStatusId;
    if (payload.limitHours !== undefined) row.limitHours = String(payload.limitHours);
    if (payload.enabled !== undefined) row.enabled = Boolean(payload.enabled);
    return this.slaRepo.save(row);
  }

  async deleteSla(id: number): Promise<void> {
    await this.slaRepo.delete(id);
  }
}
