import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('workspace_manual_tasks')
export class WorkspaceManualTask {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'work_date', type: 'date' })
  workDate: string;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ name: 'next_follow_date', type: 'date', nullable: true })
  nextFollowDate: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
