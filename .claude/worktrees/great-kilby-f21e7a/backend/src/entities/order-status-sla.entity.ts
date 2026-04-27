import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { OrderStatus } from './order-status.entity';

/**
 * 订单状态时效配置表
 * 为每个状态配置「合理停留时长（小时）」，超过则视为超期，用于绩效统计。
 */
@Entity('order_status_sla')
export class OrderStatusSla {
  @PrimaryGeneratedColumn()
  id: number;

  /** 订单状态 ID（order_statuses.id），只存 ID */
  @Column({ name: 'order_status_id', type: 'int' })
  orderStatusId: number;

  @ManyToOne(() => OrderStatus, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_status_id' })
  orderStatus: OrderStatus;

  /** 该状态合理停留时长（小时），超过即超期 */
  @Column({ name: 'limit_hours', type: 'decimal', precision: 10, scale: 2 })
  limitHours: string;

  /** 是否启用该条配置 */
  @Column({ name: 'enabled', type: 'tinyint', width: 1, default: 1 })
  enabled: boolean;
}
