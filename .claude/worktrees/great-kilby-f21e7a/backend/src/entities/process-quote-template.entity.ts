import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * 服装类型报价模板（如 T恤、连衣裙），用于订单成本页一键导入工序列表
 */
@Entity('process_quote_templates')
export class ProcessQuoteTemplate {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', length: 64 })
  name: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
