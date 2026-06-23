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

  /** 收货国家：英文国名（前端中英对照下拉选/小满带出），进客户单+箱贴打印 */
  @Column({ name: 'country', length: 64, default: '' })
  country: string;

  /** 邮编：手填，进客户单+箱贴打印 */
  @Column({ name: 'postal_code', length: 32, default: '' })
  postalCode: string;

  /** 小满单号：业务员选/填，供财务审核，仅内部用，不进客户单/箱贴打印 */
  @Column({ name: 'xiaoman_order_no', length: 64, default: '' })
  xiaomanOrderNo: string;

  /** 小满订单ID：用于跳转 crm.xiaoman.cn/order/detail/{id}，从小满下拉选中时写入 */
  @Column({ name: 'xiaoman_order_id', length: 32, default: '' })
  xiaomanOrderId: string;

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
