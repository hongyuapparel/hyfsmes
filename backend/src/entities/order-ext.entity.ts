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

  /** D 区：尺寸信息表头（与前端 sizeInfoMetaHeaders 一致） */
  @Column({ name: 'size_info_meta_headers', type: 'json', nullable: true })
  sizeInfoMetaHeaders: string[] | null;

  /** D 区：尺寸信息行数据（与前端 sizeInfoRows 一致） */
  @Column({ name: 'size_info_rows', type: 'json', nullable: true })
  sizeInfoRows: SizeInfoRow[] | null;

  /** E 区：工艺项目列表（与前端 processItems 一致） */
  @Column({ name: 'process_items', type: 'json', nullable: true })
  processItems: ProcessRow[] | null;

  /** F 区：生产要求（长文本，仍放在扩展表中以保持 orders 表精简） */
  @Column({ name: 'production_requirement', type: 'text', nullable: true })
  productionRequirement: string | null;

  /** G 区：包装表头 */
  @Column({ name: 'packaging_headers', type: 'json', nullable: true })
  packagingHeaders: string[] | null;

  /** G 区：包装单元格（与前端 packagingCells 一致） */
  @Column({ name: 'packaging_cells', type: 'json', nullable: true })
  packagingCells: PackagingCell[] | null;

  /** G 区：包装方式说明 */
  @Column({ name: 'packaging_method', type: 'text', nullable: true })
  packagingMethod: string | null;

  /** H 区：图片附件列表 */
  @Column({ name: 'attachments', type: 'json', nullable: true })
  attachments: string[] | null;
}

export interface ColorSizeRow {
  colorName?: string;
  quantities?: number[];
  remark?: string;
}

export interface SizeInfoRow {
  metaValues: string[];
  sizeValues: number[];
}

export interface OrderMaterialRow {
  /** 物料来源 ID（system_options.id，option_type='material_sources'） */
  materialSourceId?: number | null;
  /** 物料来源名称：仅展示用，不持久化；接口返回时由 materialSourceId 解析填充 */
  materialSource?: string;
  /** 物料类型 ID（system_options.id，option_type='material_types'），仅存 ID 实现改名历史同步 */
  materialTypeId?: number | null;
  /** 物料类型名称：仅展示用，不持久化；接口返回时由 materialTypeId 解析填充 */
  materialType?: string;
  supplierName?: string;
  materialName?: string;
  color?: string;
  fabricWidth?: string;
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
  /** 单价（登记后写入） */
  purchaseUnitPrice?: string | null;
  /** 其他费用（登记后写入） */
  purchaseOtherCost?: string | null;
  /** 采购备注（登记后写入） */
  purchaseRemark?: string | null;
  /** 采购图片 URL（登记后写入） */
  purchaseImageUrl?: string | null;
  /** 领料状态：pending | completed */
  pickStatus?: string;
  /** 领料完成时间（领料登记后写入） */
  pickCompletedAt?: string | null;
  /** 领料备注（领料登记后写入） */
  pickRemark?: string | null;
  /** 领料处理记录（含库存扣减或备注处理） */
  pickLogs?: Array<{
    handledAt: string;
    handledBy: string;
    mode: 'with_stock' | 'remark_only';
    inventorySourceType?: 'fabric' | 'accessory' | 'finished' | null;
    inventoryId?: number | null;
    inventoryName?: string | null;
    stockBatch?: string | null;
    stockColorCode?: string | null;
    stockSpec?: string | null;
    quantity?: number | null;
    remark?: string | null;
  }>;
}

export interface ProcessRow {
  processName?: string;
  supplierName?: string;
  /** 工艺部位，如：前幅/后幅/袖子等 */
  part?: string;
  remark?: string;
}

export interface PackagingCell {
  header?: string;
  imageUrl?: string;
  /** 辅料库存 ID（从辅料库存选择时写入，用于出库扣减） */
  accessoryId?: number | null;
  accessoryName?: string;
  description?: string;
}
