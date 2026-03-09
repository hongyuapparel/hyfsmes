import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * 供应商实体
 * 供应商类型-业务范围-合作日期-联系人-联系电话-工厂地址-结款时间
 */
@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  /** 供应商名称 */
  @Column({ name: 'name', length: 255 })
  name: string;

  /** 供应商类型：面料、辅料、工艺、生产加工等 */
  @Column({ name: 'type', length: 64, default: '' })
  type: string;

  /** 业务范围 */
  @Column({ name: 'business_scope', length: 255, default: '' })
  businessScope: string;

  /** 合作日期 */
  @Column({ name: 'cooperation_date', type: 'date', nullable: true })
  cooperationDate: Date | null;

  /** 联系人 */
  @Column({ name: 'contact_person', length: 128, default: '' })
  contactPerson: string;

  /** 联系电话 */
  @Column({ name: 'contact_info', length: 255, default: '' })
  contactInfo: string;

  /** 工厂地址 */
  @Column({ name: 'factory_address', length: 512, default: '' })
  factoryAddress: string;

  /** 结款时间（如月结30天、季结、货到付款等） */
  @Column({ name: 'settlement_time', length: 128, default: '' })
  settlementTime: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

