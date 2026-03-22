import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

/** 收入流水 v2 */
@Entity('finance_income_records')
export class IncomeRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'occur_date', type: 'date' })
  occurDate: Date;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  /** 收入类型 ID（finance_income_types.id） */
  @Column({ name: 'income_type_id', type: 'int', nullable: true })
  incomeTypeId: number | null;

  /** 收款账户 ID（finance_fund_accounts.id） */
  @Column({ name: 'fund_account_id', type: 'int', nullable: true })
  fundAccountId: number | null;

  /** 来源方/客户名称（自由文本） */
  @Column({ name: 'source_name', length: 200, default: '' })
  sourceName: string;

  /** 关联订单号（自由文本，兼容非系统订单） */
  @Column({ name: 'order_no', length: 100, default: '' })
  orderNo: string;

  /** 经办人 */
  @Column({ name: 'operator', length: 100, default: '' })
  operator: string;

  @Column({ name: 'remark', length: 500, default: '' })
  remark: string;

  @Column({ name: 'attachments', type: 'json', nullable: true })
  attachments: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
