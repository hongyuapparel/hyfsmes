import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from './customer.entity';

/**
 * 产品/SKU 实体
 * 字段与 frontend/src/fields/product-fields.ts 的 code 一一对应（camelCase -> snake_case）
 */
@Entity('products')
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'product_name', length: 255, default: '' })
  productName: string;

  @Column({ name: 'sku_code', length: 64, unique: true })
  skuCode: string;

  @Column({ name: 'image_url', length: 512, default: '' })
  imageUrl: string;

  /** 产品分组 ID（system_options.id，option_type='product_groups'），改名后历史展示自动同步 */
  @Column({ name: 'product_group_id', type: 'int', nullable: true })
  productGroupId: number | null;

  /** 适用人群 ID（system_options.id，option_type='applicable_people'），改名后历史展示自动同步 */
  @Column({ name: 'applicable_people_id', type: 'int', nullable: true })
  applicablePeopleId: number | null;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customerId: number | null;

  @ManyToOne(() => Customer, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer | null;

  @Column({ name: 'salesperson', length: 64, default: '' })
  salesperson: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
