import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('order_follow_plans')
@Index(['orderId', 'userId'], { unique: true })
export class OrderFollowPlan {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'order_id', type: 'int' })
  orderId: number;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'next_follow_date', type: 'date', nullable: true })
  nextFollowDate: string | null;

  @Column({ name: 'next_action', type: 'varchar', length: 200, nullable: true })
  nextAction: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
