import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

/** 订单工艺完成记录：工艺管理页「确认完成」后写入 */
@Entity('order_craft')
export class OrderCraft {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', unique: true })
  orderId: number;

  @OneToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /** 状态：pending | completed */
  @Column({ name: 'status', length: 32, default: 'pending' })
  status: string;

  /** 到工艺时间：订单进入待工艺（pending_craft）的时间 */
  @Column({ name: 'arrived_at_craft', type: 'datetime', nullable: true })
  arrivedAtCraft: Date | null;

  /** 工艺完成时间 */
  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;
}
