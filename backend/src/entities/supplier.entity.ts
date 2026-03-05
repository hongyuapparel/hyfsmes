import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * 供应商实体
 * 后续可在「供应商管理」页面上进行维护
 */
@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  /** 供应商名称 */
  @Column({ name: 'name', length: 255 })
  name: string;

  /** 联系人 */
  @Column({ name: 'contact_person', length: 128, default: '' })
  contactPerson: string;

  /** 联系方式（电话/微信等） */
  @Column({ name: 'contact_info', length: 255, default: '' })
  contactInfo: string;

  /** 供应商类型（如：加工厂、面料商、辅料商等，可选） */
  @Column({ name: 'type', length: 64, default: '' })
  type: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

