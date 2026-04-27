import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProductionProcess } from './production-process.entity';
import { ProcessQuoteTemplate } from './process-quote-template.entity';

/**
 * 报价模板下的工序项（关联生产工序，导入时带出部门/工种/单价）
 */
@Entity('process_quote_template_items')
export class ProcessQuoteTemplateItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'template_id', type: 'int' })
  templateId: number;

  @Column({ name: 'process_id', type: 'int' })
  processId: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @ManyToOne(() => ProcessQuoteTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: ProcessQuoteTemplate;

  @ManyToOne(() => ProductionProcess, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'process_id' })
  process: ProductionProcess;
}
