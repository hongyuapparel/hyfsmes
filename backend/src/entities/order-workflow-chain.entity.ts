import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('order_workflow_chains')
export class OrderWorkflowChain {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', length: 128 })
  name: string;

  @Column({ name: 'conditions_json', type: 'json', nullable: true })
  conditionsJson: unknown | null;

  @Column({ name: 'enabled', type: 'tinyint', width: 1, default: 1 })
  enabled: boolean;

  /** 链路列表排序（数字越小越靠前） */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}

