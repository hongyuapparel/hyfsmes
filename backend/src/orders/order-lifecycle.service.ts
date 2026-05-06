import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt, type PackagingCell } from '../entities/order-ext.entity';
import { OrderRemark } from '../entities/order-remark.entity';
import { User } from '../entities/user.entity';
import { InventoryAccessoriesService } from '../inventory-accessories/inventory-accessories.service';
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
    private readonly inventoryAccessoriesService: InventoryAccessoriesService,
  ) {}

  private async autoOutboundAccessoriesByPackagingCells(
    order: Order,
    actor: OrderActor,
    manager: EntityManager,
  ): Promise<void> {
    const orderExtRepo = manager.getRepository(OrderExt);
    const ext = await orderExtRepo.findOne({ where: { orderId: order.id } });
    const cells: PackagingCell[] = Array.isArray(ext?.packagingCells) ? ext.packagingCells : [];
    if (!cells.length) return;
    const orderQty = Number(order.quantity) || 0;
    if (orderQty <= 0) return;

    const countById = new Map<number, number>();
    for (const cell of cells) {
      const accessoryId = Number(cell.accessoryId);
      if (!Number.isInteger(accessoryId) || accessoryId <= 0) continue;
      countById.set(accessoryId, (countById.get(accessoryId) ?? 0) + 1);
    }
    if (!countById.size) return;

    for (const [accessoryId, times] of countById.entries()) {
      const quantity = orderQty * times;
      await this.inventoryAccessoriesService.outboundInTransaction(manager, {
        accessoryId,
        quantity,
        outboundType: 'order_auto',
        operatorUsername: actor.username,
        remark: `订单自动出库：${order.orderNo}（${orderQty} * ${times}）`,
        orderId: order.id,
        orderNo: order.orderNo,
      });
    }
  }

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
    const orderIds = [...new Set((ids ?? []).filter((id) => Number.isInteger(id) && id > 0))];
    if (!orderIds.length) return;
    for (const id of orderIds) {
      await this.orderRepo.manager.transaction(async (manager) => {
        const orderRepo = manager.getRepository(Order);
        const o = await orderRepo
          .createQueryBuilder('o')
          .setLock('pessimistic_write')
          .where('o.id = :id', { id })
          .getOne();
        if (!o || o.status !== 'pending_review') return;
        const before = o.status;
        const next = await this.orderWorkflowService.resolveNextStatus({
          order: o,
          triggerCode: 'review_approve',
          actorUserId: actor.userId,
        });
        const to = next ?? 'pending_purchase';
        if (before === to) return;
        o.status = to;
        o.statusTime = new Date();
        const saved = await orderRepo.save(o);
        await this.orderStatusService.addLog(saved, actor, 'review', `审核订单：${before} -> ${to}`, manager);
        await this.orderStatusService.appendStatusHistory(saved.id, to, manager);
        await this.autoOutboundAccessoriesByPackagingCells(saved, actor, manager);
      });
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
