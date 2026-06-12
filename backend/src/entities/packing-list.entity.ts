import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/** 装箱单主表：草稿可编辑，确认发货后联动待仓/成品出库并锁定 */
@Entity('packing_lists')
export class PackingList {
  @PrimaryGeneratedColumn()
  id: number;

  /** 单号，服务端生成 PL-YYYYMMDD-NN */
  @Column({ name: 'code', length: 32, default: '' })
  code: string;

  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customerId: number | null;

  /** 客户名称（冗余，支持档案外手填客户） */
  @Index()
  @Column({ name: 'customer_name', length: 255, default: '' })
  customerName: string;

  /** 业务员（文本，对齐 customer.salesperson 既有模式） */
  @Column({ name: 'service_manager', length: 128, default: '' })
  serviceManager: string;

  @Column({ name: 'po_no', length: 255, default: '' })
  poNo: string;

  @Column({ name: 'pack_date', type: 'date', nullable: true })
  packDate: string | null;

  @Column({ name: 'remark', length: 1000, default: '' })
  remark: string;

  /** 箱贴是否显示公司名顶条 */
  @Column({ name: 'show_company', type: 'tinyint', default: 1 })
  showCompany: number;

  /** 尺码列顺序，行内 sizeQuantities 的展示顺序以此为准 */
  @Column({ name: 'size_headers', type: 'json', nullable: true })
  sizeHeaders: string[] | null;

  /** draft | shipped */
  @Index()
  @Column({ name: 'status', length: 16, default: 'draft' })
  status: string;

  @Column({ name: 'shipped_at', type: 'datetime', nullable: true })
  shippedAt: Date | null;

  @Column({ name: 'operator_username', length: 255, default: '' })
  operatorUsername: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
