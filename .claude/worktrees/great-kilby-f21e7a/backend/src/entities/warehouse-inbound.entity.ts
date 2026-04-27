import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

/** 仓库入库登记：从尾部点击入库后，在待入库页面填写仓库、部门、位置后生成 */
@Entity('warehouse_inbound')
export class WarehouseInbound {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', unique: true })
  orderId: number;

  @OneToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /** 入库仓库 ID（关联 system_options.id，optionType = 'warehouses'） */
  @Column({ name: 'warehouse_id', type: 'int', nullable: true })
  warehouseId: number | null;

  /** 部门 */
  @Column({ name: 'department', length: 128, default: '' })
  department: string;

  /** 具体位置 */
  @Column({ name: 'location', length: 255, default: '' })
  location: string;

  /** 入库时间 */
  @Column({ name: 'inbound_at', type: 'datetime' })
  inboundAt: Date;
}
