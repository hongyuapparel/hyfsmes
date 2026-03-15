import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';
import { OrderStatus } from './order-status.entity';

/**
 * 订单状态进入记录表
 * 每次订单状态变更时写入一条，用于计算「在某一状态的停留时长」及超期统计。
 */
@Entity('order_status_history')
export class OrderStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /** 进入的状态 ID（order_statuses.id） */
  @Column({ name: 'status_id', type: 'int' })
  statusId: number;

  @ManyToOne(() => OrderStatus, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'status_id' })
  status: OrderStatus;

  /** 进入该状态的时间 */
  @CreateDateColumn({ name: 'entered_at' })
  enteredAt: Date;
}
