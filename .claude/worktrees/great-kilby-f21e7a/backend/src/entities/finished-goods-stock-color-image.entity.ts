import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/** 成品库存颜色图片：同一 SKU 不同颜色可上传不同图片 */
@Entity('finished_goods_stock_color_images')
export class FinishedGoodsStockColorImage {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'finished_stock_id', type: 'int' })
  finishedStockId: number;

  @Index()
  @Column({ name: 'color_name', length: 64, default: '' })
  colorName: string;

  @Column({ name: 'image_url', length: 512, default: '' })
  imageUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

