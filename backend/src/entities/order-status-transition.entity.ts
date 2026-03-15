import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * 订单状态流转规则表，对应 order_status_transitions
 */
@Entity('order_status_transitions')
export class OrderStatusTransition {
  @PrimaryGeneratedColumn()
  id: number;

  /** 所属链路ID（允许为空，表示独立规则） */
  @Column({ name: 'chain_id', type: 'int', nullable: true })
  chainId: number | null;

  /** 链路内步骤顺序（允许为空） */
  @Column({ name: 'step_order', type: 'int', nullable: true })
  stepOrder: number | null;

  /** 当前状态编码 */
  @Column({ name: 'from_status', length: 64 })
  fromStatus: string;

  /** 目标状态编码 */
  @Column({ name: 'to_status', length: 64 })
  toStatus: string;

  /** 触发类型：button / auto_event 等 */
  @Column({ name: 'trigger_type', length: 32 })
  triggerType: string;

  /** 触发编码，如 review_approve / purchase_all_completed 等 */
  @Column({ name: 'trigger_code', length: 64 })
  triggerCode: string;

  /** 条件 JSON，如订单类型/合作方式/是否样板等 */
  @Column({ name: 'conditions_json', type: 'json', nullable: true })
  conditionsJson: unknown | null;

  /** 流转后归属部门标记，如 purchase / pattern / cutting */
  @Column({ name: 'next_department', type: 'varchar', length: 64, nullable: true })
  nextDepartment: string | null;

  /** 允许触发该流转的角色编码列表，逗号分隔 */
  @Column({ name: 'allow_roles', type: 'varchar', length: 255, nullable: true })
  allowRoles: string | null;

  /** 是否启用该条规则 */
  @Column({ name: 'enabled', type: 'tinyint', width: 1, default: 1 })
  enabled: boolean;
}

