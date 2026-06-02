import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 员工入职履历（每段在职周期一条记录）
 *
 * 用于"曾经离职后再次入职"的时间轴展示。
 * employees.entryDate / leaveDate 保留当前/最近一次状态，本表保留完整历史。
 */
@Entity('employee_history')
@Index(['employeeId'])
export class EmployeeHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId: number;

  @Column({ name: 'entry_date', type: 'date', nullable: true })
  entryDate: Date | null;

  @Column({ name: 'leave_date', type: 'date', nullable: true })
  leaveDate: Date | null;

  @Column({ name: 'leave_reason', length: 500, default: '' })
  leaveReason: string;

  @Column({ name: 'remark', length: 500, default: '' })
  remark: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
