import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

/** 订单尾部：包装完成数、出货数、次品数、发货/入库状态 */
@Entity('order_finishing')
export class OrderFinishing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', unique: true })
  orderId: number;

  @OneToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /** 状态：pending_ship | shipped | inbound */
  @Column({ name: 'status', length: 32, default: 'pending_ship' })
  status: string;

  /** 到尾部时间 */
  @Column({ name: 'arrived_at', type: 'datetime', nullable: true })
  arrivedAt: Date | null;

  /** 包装完成时间 */
  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  /** 尾部收货数（实际包装完成数量） */
  @Column({ name: 'tail_received_qty', type: 'int', default: 0 })
  tailReceivedQty: number;

  /** 尾部出货数（发货数量，可多次累加） */
  @Column({ name: 'tail_shipped_qty', type: 'int', default: 0 })
  tailShippedQty: number;

  /** 尾部入库数（入库数量，可多次累加） */
  @Column({ name: 'tail_inbound_qty', type: 'int', default: 0 })
  tailInboundQty: number;

  /** 次品数 */
  @Column({ name: 'defect_quantity', type: 'int', default: 0 })
  defectQuantity: number;
}
