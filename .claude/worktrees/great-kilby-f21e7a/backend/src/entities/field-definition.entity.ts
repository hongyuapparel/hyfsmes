import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

/**
 * 字段定义实体 - 支持各模块字段的显示、顺序、可筛选等配置
 */
@Entity('field_definitions')
export class FieldDefinition {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'module', length: 32 })
  module: string;

  @Column({ name: 'code', length: 64 })
  code: string;

  @Column({ name: 'label', length: 64 })
  label: string;

  @Column({ name: 'type', length: 16 })
  type: string;

  @Column({ name: 'order', type: 'int', default: 0 })
  order: number;

  @Column({ name: 'visible', type: 'tinyint', default: 1 })
  visible: number;

  @Column({ name: 'filterable', type: 'tinyint', default: 0 })
  filterable: number;

  @Column({ name: 'sortable', type: 'tinyint', default: 0 })
  sortable: number;

  @Column({ name: 'placeholder', type: 'varchar', length: 128, nullable: true })
  placeholder: string | null;

  @Column({ name: 'options_key', type: 'varchar', length: 64, nullable: true })
  optionsKey: string | null;
}
