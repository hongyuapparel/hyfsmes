import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** 成品库存：待入库执行入库后写入，出库时减少 quantity */
@Entity('finished_goods_stock')
export class FinishedGoodsStock {
  @PrimaryGeneratedColumn()
  id: number;

  /** 客户 ID，可选，关联 customers.id（从订单冗余过来） */
  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customerId: number | null;

  /** 客户名称（冗余字段，方便筛选与展示） */
  @Column({ name: 'customer_name', length: 255, default: '' })
  customerName: string;

  /** 订单 ID，可选（无订单号直接入库时为 null） */
  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @Column({ name: 'sku_code', length: 64, default: '' })
  skuCode: string;

  @Column({ name: 'quantity', type: 'int', default: 0 })
  quantity: number;

  /** 出厂价（元） */
  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitPrice: string;

  /** 仓库 ID（关联 system_options.id，optionType = 'warehouses'） */
  @Column({ name: 'warehouse_id', type: 'int', nullable: true })
  warehouseId: number | null;

  /** 库存类型 ID（关联 system_options.id，optionType = 'inventory_types'） */
  @Column({ name: 'inventory_type_id', type: 'int', nullable: true })
  inventoryTypeId: number | null;

  @Column({ name: 'department', length: 128, default: '' })
  department: string;

  @Column({ name: 'location', length: 255, default: '' })
  location: string;

  /** 入库时上传的图片 URL（可选） */
  @Column({ name: 'image_url', length: 512, default: '' })
  imageUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
