import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** 面料出库记录：出库时拍照片、写备注（谁领走、用途） */
@Entity('fabric_outbound')
export class FabricOutbound {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'fabric_stock_id', type: 'int' })
  fabricStockId: number;

  /** 出库时的面料名称快照，避免后续编辑影响历史记录 */
  @Column({ name: 'name_snapshot', type: 'varchar', length: 128, nullable: true })
  nameSnapshot: string | null;

  @Column({ name: 'customer_name_snapshot', type: 'varchar', length: 255, nullable: true })
  customerNameSnapshot: string | null;

  @Column({ name: 'unit_snapshot', type: 'varchar', length: 32, nullable: true })
  unitSnapshot: string | null;

  /** 出库时库存类型快照 */
  @Column({ name: 'inventory_type_id', type: 'int', nullable: true })
  inventoryTypeId: number | null;

  @Column({ name: 'inventory_type_label', type: 'varchar', length: 255, nullable: true })
  inventoryTypeLabel: string | null;

  /** 出库数量 */
  @Column({ name: 'quantity', type: 'decimal', precision: 12, scale: 2 })
  quantity: string;

  /** 出库时成本单价与金额；null 表示当时未计价 */
  @Column({ name: 'unit_price', type: 'decimal', precision: 14, scale: 4, nullable: true })
  unitPrice: string | null;

  @Column({ name: 'amount', type: 'decimal', precision: 16, scale: 2, nullable: true })
  amount: string | null;

  /** 照片 URL */
  @Column({ name: 'photo_url', length: 512, default: '' })
  photoUrl: string;

  /** 备注：谁领走、用途 */
  @Column({ name: 'remark', length: 500, default: '' })
  remark: string;

  /** 领取人 users.id */
  @Column({ name: 'pickup_user_id', type: 'int', nullable: true })
  pickupUserId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
