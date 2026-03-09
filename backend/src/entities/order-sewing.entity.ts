import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

/** 订单车缝登记：车缝数量、次品数量、次品说明、完成时间 */
@Entity('order_sewing')
export class OrderSewing {
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

  /** 到车缝时间 */
  @Column({ name: 'arrived_at', type: 'datetime', nullable: true })
  arrivedAt: Date | null;

  /** 车缝完成时间 */
  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  /** 车缝完成数量 */
  @Column({ name: 'sewing_quantity', type: 'int', default: 0 })
  sewingQuantity: number;

  /** 次品数量 */
  @Column({ name: 'defect_quantity', type: 'int', default: 0 })
  defectQuantity: number;

  /** 次品说明/原因 */
  @Column({ name: 'defect_reason', type: 'varchar', length: 500, default: '' })
  defectReason: string;
}
