import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusService } from './order-status.service';
import { ORDER_STATUS_LABEL_MAP, type OrderActor } from './order.types';

export interface ForceOrderStatusDto {
  targetStatus: string;
  reason: string;
  /** @deprecated 暂不支持：会重置领料状态却不回滚库存 */
  resetSubsequent?: boolean;
}

export interface ForceOrderStatusResult {
  id: number;
  status: string;
  warning?: string;
}

@Injectable()
export class OrderAdminOverrideService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderStatus)
    private readonly orderStatusRepo: Repository<OrderStatus>,
    private readonly orderStatusService: OrderStatusService,
  ) {}

  async forceStatus(orderId: number, dto: ForceOrderStatusDto, actor: OrderActor): Promise<ForceOrderStatusResult> {
    const targetStatus = (dto.targetStatus ?? '').trim();
    const reason = (dto.reason ?? '').trim();
    if (!targetStatus) throw new BadRequestException('目标状态不能为空');
    if (!reason) throw new BadRequestException('操作原因不能为空');

    const definition = await this.orderStatusRepo.findOne({ where: { code: targetStatus, enabled: true } });
    if (!definition) throw new BadRequestException(`目标状态「${targetStatus}」不存在或未启用`);

    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.deletedAt) throw new BadRequestException('回收站中的订单请先恢复后再改状态');

    const beforeStatus = order.status;
    if (beforeStatus === targetStatus) {
      throw new BadRequestException('目标状态与当前状态相同，无需修改');
    }

    // 重置后续工序会把领料/采购标回 pending 却不回滚库存，易造成重复扣库存；暂不开放。
    if (dto.resetSubsequent === true) {
      throw new BadRequestException(
        '暂不支持重置后续生产数据（resetSubsequent）。请仅改主状态，并用「编辑已提交生产数据」纠错各工序；库存冲正需另行处理',
      );
    }

    const warning =
      '本次仅修改订单主状态，未改生产登记。若相关工序仍为完成，定时调和约 2 分钟内可能再次推进状态；请用「编辑已提交生产数据」权限修正工序数据';

    await this.orderRepo.manager.transaction(async (manager) => {
      const orderRepo = manager.getRepository(Order);
      const o = await orderRepo.findOne({ where: { id: orderId } });
      if (!o) throw new NotFoundException('订单不存在');
      o.status = targetStatus;
      o.statusTime = new Date();
      await orderRepo.save(o);

      const beforeLabel = ORDER_STATUS_LABEL_MAP[beforeStatus] ?? beforeStatus;
      const afterLabel = ORDER_STATUS_LABEL_MAP[targetStatus] ?? targetStatus;
      const detail = `管理员强制改状态：${beforeLabel}(${beforeStatus}) -> ${afterLabel}(${targetStatus})；原因：${reason}；重置后续工序：否`;
      await this.orderStatusService.addLog(o, actor, 'admin_force_status', detail, manager);
      await this.orderStatusService.appendStatusHistory(o.id, targetStatus, manager);
    });

    return { id: orderId, status: targetStatus, warning };
  }
}
