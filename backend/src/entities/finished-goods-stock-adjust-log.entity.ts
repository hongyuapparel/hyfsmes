import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** 成品库存资料调整记录：仅记录仓库/库存类型/部门/存放地址等信息变更 */
@Entity('finished_goods_stock_adjust_logs')
export class FinishedGoodsStockAdjustLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'finished_stock_id', type: 'int' })
  finishedStockId: number;

  /** 操作账号（中文名或用户名） */
  @Column({ name: 'operator_username', length: 128, default: '' })
  operatorUsername: string;

  /** 变更前 */
  @Column({ name: 'before', type: 'json', nullable: true })
  before: Record<string, unknown> | null;

  /** 变更后 */
  @Column({ name: 'after', type: 'json', nullable: true })
  after: Record<string, unknown> | null;

  /** 备注（可选） */
  @Column({ name: 'remark', type: 'varchar', length: 500, default: '' })
  remark: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

