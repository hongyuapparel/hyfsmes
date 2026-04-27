import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * 订单状态定义表，对应 order_statuses
 */
@Entity('order_statuses')
export class OrderStatus {
  @PrimaryGeneratedColumn()
  id: number;

  /** 状态编码，如 draft / pending_review */
  @Column({ name: 'code', length: 64, unique: true })
  code: string;

  /** 状态中文名称，如 草稿 / 待审单 */
  @Column({ name: 'label', length: 64 })
  label: string;

  /** 排序序号，越小越靠前 */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  /** 展示分组标记，如 before_production / in_production / completed */
  @Column({ name: 'group_key', type: 'varchar', length: 64, nullable: true })
  groupKey: string | null;

  /** 是否为终态（如：订单完成） */
  @Column({ name: 'is_final', type: 'tinyint', width: 1, default: 0 })
  isFinal: boolean;

  /** 是否启用该状态 */
  @Column({ name: 'enabled', type: 'tinyint', width: 1, default: 1 })
  enabled: boolean;
}

