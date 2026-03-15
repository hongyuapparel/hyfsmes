import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** 面料库存：记录短期内不用的面料明细 */
@Entity('fabric_stock')
export class FabricStock {
  @PrimaryGeneratedColumn()
  id: number;

  /** 客户 ID，可选，关联 customers.id */
  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customerId: number | null;

  /** 客户名称（冗余字段，方便筛选与展示） */
  @Column({ name: 'customer_name', length: 255, default: '' })
  customerName: string;

  /** 面料名称/编号 */
  @Column({ name: 'name', length: 128, default: '' })
  name: string;

  @Column({ name: 'quantity', type: 'decimal', precision: 12, scale: 2, default: 0 })
  quantity: string;

  @Column({ name: 'unit', length: 32, default: '米' })
  unit: string;

  @Column({ name: 'remark', length: 500, default: '' })
  remark: string;

  /** 图片 URL（新增/编辑时上传） */
  @Column({ name: 'image_url', length: 512, default: '' })
  imageUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
