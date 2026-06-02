import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * 员工年度记录（春节回家、放假、上班、备注等季节性信息）
 *
 * type:
 *   spring_festival_return - 春节回家时间
 *   vacation_start        - 放假时间
 *   work_start            - 上班时间（春节后返岗）
 *   remark                - 当年备注（如"1月13日回家"等历史花名册里的备注列）
 */
@Entity('employee_yearly_record')
@Index(['employeeId', 'year'])
export class EmployeeYearlyRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'employee_id', type: 'int' })
  employeeId: number;

  @Column({ name: 'year', type: 'int' })
  year: number;

  @Column({ name: 'type', length: 32 })
  type: string;

  @Column({ name: 'value', length: 255, default: '' })
  value: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
