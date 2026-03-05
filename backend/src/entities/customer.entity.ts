import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * 客户实体
 * 字段与 frontend/src/fields/customer-fields.ts 的 code 一一对应（camelCase -> snake_case）
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

  @Column({ name: 'product_group', length: 64, default: '' })
  productGroup: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
