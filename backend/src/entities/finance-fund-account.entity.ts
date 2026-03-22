import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export type FundAccountType = 'public' | 'private' | 'wechat' | 'alipay' | 'other';

export const FUND_ACCOUNT_TYPE_LABELS: Record<FundAccountType, string> = {
  public: '公账',
  private: '私账',
  wechat: '微信',
  alipay: '支付宝',
  other: '其他',
};

@Entity('finance_fund_accounts')
export class FinanceFundAccount {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', length: 100 })
  name: string;

  @Column({ name: 'account_type', type: 'enum', enum: ['public', 'private', 'wechat', 'alipay', 'other'], default: 'public' })
  accountType: FundAccountType;

  @Column({ name: 'owner', length: 100, default: '' })
  owner: string;

  @Column({ name: 'is_enabled', type: 'tinyint', default: 1 })
  isEnabled: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
