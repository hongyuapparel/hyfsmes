import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import type { ColorSizeQuantityRow } from '../common/color-size-row.util';

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

  /** 本批入库的颜色×尺码 snapshot（来自尾部入库登记真值）。
   *  select=false 以兼容未执行 ALTER 的旧库；读取处需 addSelect。 */
  @Column({ name: 'color_size_snapshot', type: 'json', nullable: true, select: false })
  colorSizeSnapshot: { headers: string[]; rows: ColorSizeQuantityRow[] } | null;

  /** normal | defect */
  @Column({ name: 'source_type', length: 32, default: 'normal' })
  sourceType: string;

  /** pending | completed */
  @Column({ name: 'status', length: 32, default: 'pending' })
  status: string;

  @Column({ name: 'operator_username', length: 128, default: '' })
  operatorUsername: string;

  @Column({ name: 'batch_no', type: 'int', nullable: true })
  batchNo: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
