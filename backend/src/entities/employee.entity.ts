import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * 人员档案（人事管理）
 * 与用户管理分离：用户 = 系统登录账号；人员 = 公司员工档案。
 * 可选关联 userId，表示该员工对应的系统账号。
 */
@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn()
  id: number;

  /** 工号 */
  @Column({ name: 'employee_no', length: 64, default: '' })
  employeeNo: string;

  /** 姓名 */
  @Column({ name: 'name', length: 64 })
  name: string;

  /** 部门 */
  @Column({ name: 'department', length: 128, default: '' })
  department: string;

  /** 岗位 */
  @Column({ name: 'job_title', length: 128, default: '' })
  jobTitle: string;

  /** 入职日期 */
  @Column({ name: 'entry_date', type: 'date', nullable: true })
  entryDate: Date | null;

  /** 联系电话 */
  @Column({ name: 'contact_phone', length: 64, default: '' })
  contactPhone: string;

  /** 状态：active 在职 / left 离职 */
  @Column({ name: 'status', length: 32, default: 'active' })
  status: string;

  /** 关联系统用户（可选，用于“该员工对应哪个登录账号”） */
  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  /** 备注 */
  @Column({ name: 'remark', length: 500, default: '' })
  remark: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
