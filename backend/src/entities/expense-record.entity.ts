import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type ObjectType = 'supplier' | 'employee' | 'platform' | 'customer' | 'other';

export const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  supplier: '供应商',
  employee: '员工',
  platform: '平台',
  customer: '客户',
  other: '其他',
};

/** 支出流水 v2 */
@Entity('finance_expense_records')
export class ExpenseRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'occur_date', type: 'date' })
  occurDate: Date;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  /** 支出类型 ID（finance_expense_types.id） */
  @Column({ name: 'expense_type_id', type: 'int', nullable: true })
  expenseTypeId: number | null;

  /** 支出账户 ID（finance_fund_accounts.id） */
  @Column({ name: 'fund_account_id', type: 'int', nullable: true })
  fundAccountId: number | null;

  /** 对象类型：supplier/employee/platform/customer/other */
  @Column({ name: 'object_type', length: 20, default: '' })
  objectType: string;

  /** 收款方名称（自由文本） */
  @Column({ name: 'payee_name', length: 200, default: '' })
  payeeName: string;

  /** 关联订单号（自由文本，兼容非系统订单） */
  @Column({ name: 'order_no', length: 100, default: '' })
  orderNo: string;

  /** 部门 ID（system_options.id，option_type='org_departments'） */
  @Column({ name: 'department_id', type: 'int', nullable: true })
  departmentId: number | null;

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
