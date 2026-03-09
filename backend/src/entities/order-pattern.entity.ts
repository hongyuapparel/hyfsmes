import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

/** 订单纸样进度：纸样师、车板师、完成时间、样品图等 */
@Entity('order_pattern')
export class OrderPattern {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', unique: true })
  orderId: number;

  @OneToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /** 纸样师 */
  @Column({ name: 'pattern_master', length: 64, default: '' })
  patternMaster: string;

  /** 车板师（样品制作技师） */
  @Column({ name: 'sample_maker', length: 64, default: '' })
  sampleMaker: string;

  /** 状态：pending_assign | in_progress | completed */
  @Column({ name: 'status', length: 32, default: 'pending_assign' })
  status: string;

  /** 纸样/样品完成时间 */
  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  /** 样品图片（确认完成时上传） */
  @Column({ name: 'sample_image_url', length: 512, default: '' })
  sampleImageUrl: string;
}
