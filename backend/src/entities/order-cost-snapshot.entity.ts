import { Column, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * 订单成本快照（订单成本页填写的物料/工艺/工序明细及利润率，按订单保存一份）
 */
@Entity('order_cost_snapshots')
@Index(['orderId'], { unique: true })
export class OrderCostSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', unique: true })
  orderId: number;

  /** 快照内容：materialRows, processItemRows, productionRows, profitMargin 等 */
  @Column({ name: 'snapshot', type: 'json', nullable: true })
  snapshot: Record<string, unknown> | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
