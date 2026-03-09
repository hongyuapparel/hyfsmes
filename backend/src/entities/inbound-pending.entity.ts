import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** 待入库：尾部点击入库后生成，仓管在待入库页选择并填写仓库/部门/位置后完成入库 */
@Entity('inbound_pending')
export class InboundPending {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @Column({ name: 'sku_code', length: 64, default: '' })
  skuCode: string;

  @Column({ name: 'quantity', type: 'int', default: 0 })
  quantity: number;

  /** pending | completed */
  @Column({ name: 'status', length: 32, default: 'pending' })
  status: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
