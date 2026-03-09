import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

/**
 * 订单操作记录表
 * 用于记录每一次对订单的关键操作及其变更内容，便于追溯。
 */
@Entity('order_operation_logs')
export class OrderOperationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /** 订单号（冗余，便于查询与导出） */
  @Column({ name: 'order_no', length: 64 })
  orderNo: string;

  /** 操作账号（用户名） */
  @Column({ name: 'operator_username', length: 64 })
  operatorUsername: string;

  /** 操作类型：create / update / submit / review / delete / copy_to_draft 等 */
  @Column({ length: 32 })
  action: string;

  /**
   * 变更内容说明
   * 建议存储为简要的中文描述，例如：
   * "客户名称: A公司 -> B公司; 数量: 100 -> 120"
   */
  @Column({ type: 'text' })
  detail: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

