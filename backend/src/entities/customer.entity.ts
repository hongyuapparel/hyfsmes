import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * 客户实体
 * 字段与 frontend/src/fields/customer-fields.ts 的 code 一一对应（camelCase -> snake_case）；
 * createdAt 对应列表「创建日期」；「最近活跃日期」由订单关联在列表接口中单独计算，见 lastOrderReferencedAt
 */
@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'customer_id', length: 64, unique: true })
  customerId: string;

  @Column({ name: 'country', length: 64, default: '' })
  country: string;

  @Column({ name: 'company_name', length: 255 })
  companyName: string;

  @Column({ name: 'contact_person', length: 128, default: '' })
  contactPerson: string;

  @Column({ name: 'contact_info', length: 255, default: '' })
  contactInfo: string;

  @Column({ name: 'cooperation_date', type: 'date', nullable: true })
  cooperationDate: Date | null;

  @Column({ name: 'salesperson', length: 64, default: '' })
  salesperson: string;

  /** 产品分组 ID（system_options.id，option_type='product_groups'），改名后历史展示自动同步 */
  @Column({ name: 'product_group_id', type: 'int', nullable: true })
  productGroupId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
