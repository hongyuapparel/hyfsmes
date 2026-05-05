import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderRemark } from '../entities/order-remark.entity';
import { User } from '../entities/user.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { OrderStatusService } from './order-status.service';
import { type OrderActor } from './order.types';

@Injectable()
export class OrderLifecycleService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderRemark)
    private readonly orderRemarkRepo: Repository<OrderRemark>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly orderWorkflowService: OrderWorkflowService,
    private readonly orderStatusService: OrderStatusService,
  ) {}

  async deleteMany(ids: number[], actor: OrderActor): Promise<void> {
    if (!ids?.length) return;
    const orders = await this.orderRepo.findByIds(ids);
    if (!orders.length) return;
    const now = new Date();
    for (const o of orders) {
      if (o.deletedAt) continue;
      o.deletedAt = now;
      o.deletedBy = actor.username;
      o.deleteReason = '移入回收站';
      await this.orderRepo.save(o);
      await this.orderStatusService.addLog(o, actor, 'delete', '删除订单（移入回收站）');
    }
  }

  async restoreMany(ids: number[], actor: OrderActor): Promise<void> {
    if (!ids?.length) return;
    const orders = await this.orderRepo.findByIds(ids);
    if (!orders.length) return;
    for (const o of orders) {
      if (!o.deletedAt) continue;
      o.deletedAt = null;
      o.deletedBy = null;
      o.deleteReason = null;
      await this.orderRepo.save(o);
      await this.orderStatusService.addLog(o, actor, 'restore', '恢复订单（从回收站恢复）');
    }
  }

  async reviewMany(ids: number[], actor: OrderActor): Promise<void> {
    if (!ids?.length) return;
    const orders = await this.orderRepo.findByIds(ids);
    for (const o of orders) {
      if (o.status !== 'pending_review') continue;
      const before = o.status;
      const next = await this.orderWorkflowService.resolveNextStatus({
        order: o as Order,
        triggerCode: 'review_approve',
        actorUserId: actor.userId,
      });
      const to = next ?? 'pending_purchase';
      o.status = to;
      o.statusTime = new Date();
      await this.orderRepo.save(o);
      if (before !== to) {
        await this.orderStatusService.addLog(o, actor, 'review', `审核订单：${before} -> ${to}`);
        await this.orderStatusService.appendStatusHistory(o.id, to);
      }
    }
  }

  async reviewRejectMany(ids: number[], reason: string, actor: OrderActor): Promise<void> {
    if (!ids?.length) return;
    const trimmedReason = (reason ?? '').trim();
    if (!trimmedReason) throw new Error('退回原因不能为空');
    const orders = await this.orderRepo.findByIds(ids);
    for (const o of orders) {
      if (o.status !== 'pending_review') continue;
      const before = o.status;
      const next = await this.orderWorkflowService.resolveNextStatus({
        order: o as Order,
        triggerCode: 'review_reject',
        actorUserId: actor.userId,
      });
      const to = next ?? 'draft';
      o.status = to;
      o.statusTime = new Date();
      await this.orderRepo.save(o);
      await this.addRemark(o.id, actor, `审核退回原因：${trimmedReason}`);
      if (before !== to) {
        await this.orderStatusService.addLog(o, actor, 'review', `审核退回：${before} -> ${to}；原因：${trimmedReason}`);
        await this.orderStatusService.appendStatusHistory(o.id, to);
      }
    }
  }

  private async addRemark(orderId: number, actor: OrderActor, content: string): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) return;
    let operatorUsername = actor.username;
    try {
      const user = await this.userRepo.findOne({ where: { id: actor.userId } });
      if (user) operatorUsername = (user.displayName && user.displayName.trim()) || user.username || actor.username;
    } catch {
      operatorUsername = actor.username;
    }
    const trimmed = (content ?? '').trim();
    if (!trimmed) return;
    const remark = this.orderRemarkRepo.create({ orderId: order.id, order, operatorUsername, content: trimmed });
    await this.orderRemarkRepo.save(remark);
  }
}
