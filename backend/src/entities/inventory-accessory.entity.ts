import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** 辅料库存：商标、吊牌、洗水唛等 */
@Entity('inventory_accessory')
export class InventoryAccessory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 128 })
  name: string;

  /** 类别：如 商标、吊牌、洗水唛 */
  @Column({ length: 64, default: '' })
  category: string;

  @Column({ type: 'int', default: 0 })
  quantity: number;

  @Column({ length: 32, default: '个' })
  unit: string;

  @Column({ type: 'varchar', length: 500, default: '' })
  remark: string;

  /** 图片 URL（新增/编辑时上传） */
  @Column({ name: 'image_url', length: 512, default: '' })
  imageUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
