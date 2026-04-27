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

  /** 分单时间（分发给加工厂的时间） */
  @Column({ name: 'distributed_at', type: 'datetime', nullable: true })
  distributedAt: Date | null;

  /** 加工厂交期（对方需交货给我们的日期） */
  @Column({ name: 'factory_due_date', type: 'date', nullable: true })
  factoryDueDate: Date | null;

  /** 车缝加工费（元） */
  @Column({ name: 'sewing_fee', type: 'decimal', precision: 12, scale: 2, default: 0 })
  sewingFee: string;

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

  /** 车缝完成数量按尺码明细（与 B 区尺码列一致，最后一项为合计） */
  @Column({ name: 'sewing_quantity_row', type: 'json', nullable: true })
  sewingQuantityRow: number[] | null;
}
