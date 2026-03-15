import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 收入流水：按部门、银行账号手动录入，提款一笔录一笔，不关联订单
 */
@Entity('finance_income_records')
export class IncomeRecord {
  @PrimaryGeneratedColumn()
  id: number;

  /** 发生日期 */
  @Column({ name: 'occur_date', type: 'date' })
  occurDate: Date;

  /** 金额（元） */
  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  /**
   * 部门 ID（system_options.id，option_type='org_departments'）
   * 改名后历史展示自动同步
   */
  @Column({ name: 'department_id', type: 'int', nullable: true })
  departmentId: number | null;

  /**
   * 银行账号 ID（system_options.id，option_type='bank_accounts'）
   * 对应「目前在哪家银行/哪个账号」
   */
  @Column({ name: 'bank_account_id', type: 'int', nullable: true })
  bankAccountId: number | null;

  /** 备注 */
  @Column({ name: 'remark', length: 500, default: '' })
  remark: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
