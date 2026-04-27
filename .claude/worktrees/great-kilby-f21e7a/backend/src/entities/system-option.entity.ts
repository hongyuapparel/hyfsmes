import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';

/**
 * 系统选项 - 产品分组等可配置的下拉选项，支持父子层级
 */
@Entity('system_options')
export class SystemOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'option_type', length: 64 })
  optionType: string;

  @Column({ name: 'value', length: 128 })
  value: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId: number | null;

  @ManyToOne(() => SystemOption, (o) => o.children, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent: SystemOption | null;

  @OneToMany(() => SystemOption, (o) => o.parent)
  children: SystemOption[];
}
