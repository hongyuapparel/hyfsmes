import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

/** 裁床数量行，与 B 区 colorSizeRows 结构一致 */
export interface ActualCutRow {
  colorName?: string;
  quantities?: number[];
  remark?: string;
}

/** 订单裁床登记：裁床数量、裁剪成本、完成时间 */
@Entity('order_cutting')
export class OrderCutting {
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

  /** 到裁床时间（订单进入待裁床时或登记时记录） */
  @Column({ name: 'arrived_at', type: 'datetime', nullable: true })
  arrivedAt: Date | null;

  /** 裁床完成时间 */
  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  /** 裁剪成本（元），同步到订单成本用 */
  @Column({ name: 'cutting_cost', type: 'decimal', precision: 12, scale: 2, default: 0 })
  cuttingCost: string;

  /** 实际裁剪数量明细 JSON，与 B 区 colorSizeRows 同结构 */
  @Column({ name: 'actual_cut_rows', type: 'json', nullable: true })
  actualCutRows: ActualCutRow[] | null;

  /** 裁剪部门/加工厂：本厂或外发加工厂名称（裁床管理登记用） */
  @Column({ name: 'cutting_department', type: 'varchar', length: 128, nullable: true, select: false })
  cuttingDepartment?: string | null;

  /** 裁剪人：仅本厂裁床时填写 */
  @Column({ name: 'cutter_name', type: 'varchar', length: 64, nullable: true, select: false })
  cutterName?: string | null;

  /** 实际用布总米数：仅本厂裁床时填写，用于对比纸样用量 */
  @Column({ name: 'actual_fabric_meters', type: 'decimal', precision: 12, scale: 3, nullable: true, select: false })
  actualFabricMeters?: string | null;
}
