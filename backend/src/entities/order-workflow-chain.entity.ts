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

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}

