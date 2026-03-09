import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** 面料出库记录：出库时拍照片、写备注（谁领走、用途） */
@Entity('fabric_outbound')
export class FabricOutbound {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'fabric_stock_id', type: 'int' })
  fabricStockId: number;

  /** 出库数量 */
  @Column({ name: 'quantity', type: 'decimal', precision: 12, scale: 2 })
  quantity: string;

  /** 照片 URL */
  @Column({ name: 'photo_url', length: 512, default: '' })
  photoUrl: string;

  /** 备注：谁领走、用途 */
  @Column({ name: 'remark', length: 500, default: '' })
  remark: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
