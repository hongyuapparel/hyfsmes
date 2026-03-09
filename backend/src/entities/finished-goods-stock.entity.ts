import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** 成品库存：待入库执行入库后写入，出库时减少 quantity */
@Entity('finished_goods_stock')
export class FinishedGoodsStock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @Column({ name: 'sku_code', length: 64, default: '' })
  skuCode: string;

  @Column({ name: 'quantity', type: 'int', default: 0 })
  quantity: number;

  @Column({ name: 'warehouse', length: 128, default: '' })
  warehouse: string;

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
