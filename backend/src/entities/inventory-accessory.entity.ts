import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** 辅料库存：商标、吊牌、洗水唛等 */
@Entity('inventory_accessory')
export class InventoryAccessory {
  @PrimaryGeneratedColumn()
  id: number;

  /** 客户 ID，可选，关联 customers.id */
  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customerId: number | null;

  /** 客户名称（冗余字段，方便筛选与展示） */
  @Column({ name: 'customer_name', length: 255, default: '' })
  customerName: string;

  /** 业务员（必填，来自客户业务员选项） */
  @Column({ name: 'salesperson', length: 128, default: '' })
  salesperson: string;

  @Column({ length: 128 })
  name: string;

  /** 类别：如 商标、吊牌、洗水唛 */
  @Column({ length: 64, default: '' })
  category: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  /** 是否启用分码（按尺码拆分数量），逐条开关 */
  @Column({ name: 'is_sized', type: 'boolean', default: false })
  isSized: boolean;

  /** 分码尺码表头，如 ["S","M","L"]，与 sizeQuantities 下标对齐 */
  @Column({ name: 'size_headers', type: 'json', nullable: true })
  sizeHeaders: string[] | null;

  /** 分码各码数量，与 sizeHeaders 下标对齐，可为负（待订购信号） */
  @Column({ name: 'size_quantities', type: 'json', nullable: true })
  sizeQuantities: number[] | null;

  @Column({ length: 32, default: '个' })
  unit: string;

  /** 仓库 system_options.id（option_type = warehouses） */
  @Column({ name: 'warehouse_id', type: 'int', nullable: true })
  warehouseId: number | null;

  /** 存放地址 */
  @Column({ length: 255, default: '' })
  location: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  remark: string;

  /** 图片 URL（新增/编辑时上传） */
  @Column({ name: 'image_url', length: 512, default: '' })
  imageUrl: string;

  /** 多图 URL 列表（第一张作为主图） */
  @Column({ name: 'image_urls', type: 'json', nullable: true })
  imageUrls: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
