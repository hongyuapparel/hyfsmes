import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * 订单实体
 * 字段与前端 OrderListItem / 订单字段定义一一对应（camelCase -> snake_case）
 */
@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn()
  id: number;

  /** 订单号（唯一，不可重复） */
  @Column({ name: 'order_no', length: 64, unique: true })
  orderNo: string;

  /** SKU 编号 */
  @Index()
  @Column({ name: 'sku_code', length: 64, default: '' })
  skuCode: string;

  /** 客户 ID，可选，后续可关联 customers 表 */
  @Column({ name: 'customer_id', type: 'int', nullable: true })
  customerId: number | null;

  /** 客户名称（冗余字段，方便列表展示与导出） */
  @Index()
  @Column({ name: 'customer_name', length: 255, default: '' })
  customerName: string;

  /** 业务员 */
  @Column({ name: 'salesperson', length: 64, default: '' })
  salesperson: string;

  /** 跟单员 */
  @Column({ name: 'merchandiser', length: 64, default: '' })
  merchandiser: string;

  /** 数量 */
  @Column({ name: 'quantity', type: 'int', default: 0 })
  quantity: number;

  /** 出厂价 */
  @Column({ name: 'ex_factory_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  exFactoryPrice: string;

  /** 销售价 */
  @Column({ name: 'sale_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  salePrice: string;

  /**
   * 合作方式 ID（system_options.id，option_type='collaboration'）
   * 通过 system_options 表改名后，历史订单展示会自动同步
   */
  @Column({ name: 'collaboration_type_id', type: 'int', nullable: true })
  collaborationTypeId: number | null;

  /**
   * 订单类型 ID（system_options.id，option_type='order_types'）
   * 通过 system_options 表改名后，历史订单展示会自动同步
   */
  @Column({ name: 'order_type_id', type: 'int', nullable: true })
  orderTypeId: number | null;

  /** 工艺项目（原二次工艺） */
  @Column({ name: 'process_item', length: 255, default: '' })
  processItem: string;

  /**
   * 当前状态：
   * draft / pending_review / pending_pattern / pending_purchase / pending_cutting /
   * pending_sewing / pending_finishing / completed 等
   */
  @Index()
  @Column({ name: 'status', length: 64, default: 'draft' })
  status: string;

  /** 当前状态变更时间 */
  @Column({ name: 'status_time', type: 'datetime', nullable: true })
  statusTime: Date | null;

  /** 下单时间 */
  @Column({ name: 'order_date', type: 'datetime', nullable: true })
  orderDate: Date | null;

  /** 客户交期 */
  @Column({ name: 'customer_due_date', type: 'datetime', nullable: true })
  customerDueDate: Date | null;

  /** 加工厂名称 */
  @Index()
  @Column({ name: 'factory_name', length: 255, default: '' })
  factoryName: string;

  /** 订单主图/封面图 */
  @Column({ name: 'image_url', length: 512, default: '' })
  imageUrl: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

