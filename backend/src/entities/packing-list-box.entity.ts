import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/** 装箱单箱：箱级字段（重量/箱规/备注），明细行挂在 packing_list_items */
@Entity('packing_list_boxes')
export class PackingListBox {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'packing_list_id', type: 'int' })
  packingListId: number;

  @Column({ name: 'box_seq', type: 'int' })
  boxSeq: number;

  @Column({ name: 'weight_kg', type: 'decimal', precision: 10, scale: 2, nullable: true })
  weightKg: string | null;

  @Column({ name: 'carton_size', length: 64, default: '' })
  cartonSize: string;

  @Column({ name: 'remark', length: 255, default: '' })
  remark: string;
}
