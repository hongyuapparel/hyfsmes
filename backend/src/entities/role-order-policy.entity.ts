import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

export type RoleOrderAction = 'edit' | 'review' | 'delete';

@Entity('role_order_policies')
@Unique('uniq_role_action_status', ['roleId', 'action', 'statusCode'])
export class RoleOrderPolicy {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'role_id' })
  roleId: number;

  @Column({ type: 'varchar', length: 16 })
  action: RoleOrderAction;

  @Column({ name: 'status_code', type: 'varchar', length: 64 })
  statusCode: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

