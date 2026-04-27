import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * 辅料出库记录：
 * - 自动：订单提交时按订单数量扣减
 * - 手动：日常领用/调整等
 */
@Entity('inventory_accessory_outbound')
export class InventoryAccessoryOutbound {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'accessory_id', type: 'int' })
  accessoryId: number;

  /** 关联订单 ID（自动出库时填写；手动出库可为空） */
  @Index()
  @Column({ name: 'order_id', type: 'int', nullable: true })
  orderId: number | null;

  /** 关联订单号（自动出库时填写；用于快速检索） */
  @Index()
  @Column({ name: 'order_no', length: 32, default: '' })
  orderNo: string;

  /**
   * 出库类型：
   * - order_auto：订单自动出库
   * - manual：手动出库
   */
  @Index()
  @Column({ name: 'outbound_type', length: 32, default: 'manual' })
  outboundType: 'order_auto' | 'manual';

  /** 出库数量（正数） */
  @Column({ type: 'int', default: 0 })
  quantity: number;

  /** 出库前库存 */
  @Column({ name: 'before_quantity', type: 'int', default: 0 })
  beforeQuantity: number;

  /** 出库后库存 */
  @Column({ name: 'after_quantity', type: 'int', default: 0 })
  afterQuantity: number;

  /** 操作人（用户名/中文名均可） */
  @Column({ name: 'operator_username', length: 128, default: '' })
  operatorUsername: string;

  /** 备注（如领取人、用途等） */
  @Column({ type: 'varchar', length: 500, default: '' })
  remark: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

