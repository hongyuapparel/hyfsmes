import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

/** 订单扩展数据（物料、工艺等），与 Order 1:1 */
@Entity('order_ext')
export class OrderExt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', unique: true })
  orderId: number;

  @OneToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /**
   * 物料列表 JSON，与前端 C 区 materials 一致。
   * 每项可含采购相关字段：purchaseStatus、actualPurchaseQuantity、purchaseAmount、purchaseCompletedAt
   */
  @Column({ type: 'json', nullable: true })
  materials: OrderMaterialRow[] | null;

  /** B 区尺码表头，与前端 colorSizeHeaders 一致 */
  @Column({ name: 'color_size_headers', type: 'json', nullable: true })
  colorSizeHeaders: string[] | null;

  /** B 区颜色尺码数量行，与前端 colorSizeRows 一致 */
  @Column({ name: 'color_size_rows', type: 'json', nullable: true })
  colorSizeRows: ColorSizeRow[] | null;
}

export interface ColorSizeRow {
  colorName?: string;
  quantities?: number[];
  remark?: string;
}

export interface OrderMaterialRow {
  materialType?: string;
  supplierName?: string;
  materialName?: string;
  color?: string;
  usagePerPiece?: number | null;
  lossPercent?: number | null;
  orderPieces?: number | null;
  purchaseQuantity?: number | null;
  cuttingQuantity?: number | null;
  remark?: string;
  /** 采购状态：pending | completed */
  purchaseStatus?: string;
  /** 实际采购数量（登记后写入） */
  actualPurchaseQuantity?: number | null;
  /** 采购金额（登记后写入） */
  purchaseAmount?: string | null;
  /** 采购完成时间（登记后写入） */
  purchaseCompletedAt?: string | null;
}
