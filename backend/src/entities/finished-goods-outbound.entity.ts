import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** 成品出库记录：出库时写入一条记录，用于按日期追溯 */
@Entity('finished_goods_outbound')
export class FinishedGoodsOutbound {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'finished_stock_id', type: 'int' })
  finishedStockId: number;

  @Index()
  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  @Index()
  @Column({ name: 'order_no', length: 32, default: '' })
  orderNo: string;

  @Index()
  @Column({ name: 'sku_code', length: 64, default: '' })
  skuCode: string;

  /** 出库时图片快照（优先库存图，其次产品图） */
  @Column({ name: 'image_url', length: 512, default: '' })
  imageUrl: string;

  @Index()
  @Column({ name: 'customer_name', length: 255, default: '' })
  customerName: string;

  /** 出库数量（正整数） */
  @Column({ type: 'int', default: 0 })
  quantity: number;

  /** 部门（出库时从库存冗余） */
  @Column({ name: 'department', length: 128, default: '' })
  department: string;

  /** 仓库 ID（出库时从库存冗余） */
  @Column({ name: 'warehouse_id', type: 'int', nullable: true })
  warehouseId: number | null;

  /** 库存类型 ID（出库时从库存冗余） */
  @Column({ name: 'inventory_type_id', type: 'int', nullable: true })
  inventoryTypeId: number | null;

  /** 领取人 users.id（成品出库；业务员约束在业务层校验） */
  @Column({ name: 'pickup_user_id', type: 'int', nullable: true })
  pickupUserId: number | null;

  /** 领取人姓名快照（冗余展示用） */
  @Column({ name: 'pickup_user_name', length: 128, default: '' })
  pickupUserName: string;

  /** 出库颜色尺码明细快照（可选） */
  @Column({ name: 'size_breakdown', type: 'json', nullable: true })
  sizeBreakdown: Record<string, number> | null;

  /** 操作人（中文名或用户名） */
  @Column({ name: 'operator_username', length: 128, default: '' })
  operatorUsername: string;

  /** 备注（可选） */
  @Column({ type: 'varchar', length: 500, default: '' })
  remark: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

