import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/**
 * 供应商实体
 * 供应商类型-业务范围-联系人-联系电话-工厂地址-结款时间-备注
 */
@Entity('suppliers')
export class Supplier {
  @PrimaryGeneratedColumn()
  id: number;

  /** 供应商名称 */
  @Column({ name: 'name', length: 255 })
  name: string;

  /** 供应商类型 ID（关联 system_options.id，optionType = supplier_types 且 parentId IS NULL） */
  @Column({ name: 'supplier_type_id', type: 'int', nullable: true })
  supplierTypeId: number | null;

  /** 业务范围 ID（关联 system_options.id，optionType = supplier_types 且 parentId = supplier_type_id） */
  @Column({ name: 'business_scope_id', type: 'int', nullable: true })
  businessScopeId: number | null;

  /** 业务范围 ID 列表（多选，兼容逐步从单选迁移到多选） */
  @Column({ name: 'business_scope_ids', type: 'simple-json', nullable: true })
  businessScopeIds: number[] | null;

  /** 最近活跃时间（系统自动更新，禁止人工编辑） */
  @Column({ name: 'last_active_at', type: 'datetime', nullable: true })
  lastActiveAt: Date | null;

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

  /** 备注 */
  @Column({ name: 'remark', length: 500, default: '' })
  remark: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

