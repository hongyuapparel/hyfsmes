import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * 生产工序（用于订单成本页勾选，每工序一个单价）
 * 部门：裁床/车缝/尾部；工种按部门在系统选项中配置（process_job_types_裁床 等）
 */
@Entity('production_processes')
export class ProductionProcess {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'department', length: 64, default: '' })
  department: string;

  @Column({ name: 'job_type', length: 128, default: '' })
  jobType: string;

  @Column({ name: 'name', length: 128 })
  name: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPrice: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
