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

  /** 尾部收货数按尺码明细（与 B 区尺码列一致，最后一项为合计） */
  // 兼容历史数据库：部分环境尚未执行 ALTER TABLE 脚本加列。
  // select=false 可避免在未加列时因 SELECT 字段而报错。
  @Column({ name: 'tail_received_qty_row', type: 'json', nullable: true, select: false })
  tailReceivedQtyRow: number[] | null;

  /** 尾部出货数（发货数量，可多次累加） */
  @Column({ name: 'tail_shipped_qty', type: 'int', default: 0 })
  tailShippedQty: number;

  /** 尾部入库数（入库数量，可多次累加） */
  @Column({ name: 'tail_inbound_qty', type: 'int', default: 0 })
  tailInboundQty: number;

  /** 次品数 */
  @Column({ name: 'defect_quantity', type: 'int', default: 0 })
  defectQuantity: number;

  /** 登记包装完成时的备注（发货/入库/次品分配说明等） */
  @Column({ name: 'remark', type: 'varchar', length: 500, nullable: true })
  remark: string | null;
}
