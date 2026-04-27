import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('inventory_accessory_operation_log')
export class InventoryAccessoryOperationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'accessory_id', type: 'int' })
  accessoryId: number;

  @Column({ name: 'operator_username', length: 128, default: '' })
  operatorUsername: string;

  @Column({ name: 'action', length: 32, default: '' })
  action: string;

  @Column({ name: 'before_snapshot', type: 'json', nullable: true })
  beforeSnapshot: Record<string, unknown> | null;

  @Column({ name: 'after_snapshot', type: 'json', nullable: true })
  afterSnapshot: Record<string, unknown> | null;

  @Column({ name: 'remark', length: 500, default: '' })
  remark: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

