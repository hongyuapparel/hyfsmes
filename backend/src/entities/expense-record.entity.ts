import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 支出流水：能匹配系统环节的关联订单/供应商，匹配不上的直接录入明细
 */
@Entity('finance_expense_records')
export class ExpenseRecord {
  @PrimaryGeneratedColumn()
  id: number;

  /** 发生日期 */
  @Column({ name: 'occur_date', type: 'date' })
  occurDate: Date;

  /** 金额（元） */
  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount: string;

  /**
   * 支出类型 ID（system_options.id，option_type='expense_types'）
   */
  @Column({ name: 'expense_type_id', type: 'int', nullable: true })
  expenseTypeId: number | null;

  /**
   * 部门 ID（system_options.id，option_type='org_departments'），可选
   */
  @Column({ name: 'department_id', type: 'int', nullable: true })
  departmentId: number | null;

  /** 付款账号 ID（system_options.id，option_type='bank_accounts'） */
  @Column({ name: 'bank_account_id', type: 'int', nullable: true })
  bankAccountId: number | null;

  /** 收款方/对方（选填） */
  @Column({ name: 'payee', length: 100, default: '' })
  payee: string;

  /** 款号/外部单号（选填，用于对账/防重复） */
  @Column({ name: 'style_no', length: 50, default: '' })
  styleNo: string;

  /** 关联订单 ID（能匹配上系统订单时填写） */
  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  /** 关联供应商 ID（能匹配上系统供应商时填写） */
  @Column({ name: 'supplier_id', type: 'int', nullable: true })
  supplierId: number | null;

  /** 明细/备注（匹配不上的支出在此写清楚） */
  @Column({ name: 'detail', length: 500, default: '' })
  detail: string;

  /** 图片/附件 URL 数组（选填） */
  @Column({ name: 'attachments', type: 'json', nullable: true })
  attachments: string[] | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
