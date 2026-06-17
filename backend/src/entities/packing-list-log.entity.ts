import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** 装箱单操作记录：谁在何时做了创建/修改/发货/删除，summary 记关键字段变更摘要 */
@Entity('packing_list_logs')
export class PackingListLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'packing_list_id', type: 'int' })
  packingListId: number;

  @Column({ name: 'operator_username', length: 128, default: '' })
  operatorUsername: string;

  /** create | update | ship | delete */
  @Column({ name: 'action', length: 32, default: '' })
  action: string;

  /** 变更摘要文本，如「客户 A→B；箱数 6→8」 */
  @Column({ name: 'summary', length: 1000, default: '' })
  summary: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
