import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

/** 装箱单明细行：一箱内一款一色一行，尺码数量为 码名→件数 */
@Entity('packing_list_items')
export class PackingListItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'packing_list_id', type: 'int' })
  packingListId: number;

  @Index()
  @Column({ name: 'box_id', type: 'int' })
  boxId: number;

  @Column({ name: 'style_no', length: 128, default: '' })
  styleNo: string;

  @Column({ name: 'style_name', length: 255, default: '' })
  styleName: string;

  @Column({ name: 'color_name', length: 128, default: '' })
  colorName: string;

  @Column({ name: 'image_url', length: 512, default: '' })
  imageUrl: string;

  /** 码名→件数；列顺序由 packing_lists.size_headers 决定 */
  @Column({ name: 'size_quantities', type: 'json', nullable: true })
  sizeQuantities: Record<string, number> | null;

  @Column({ name: 'total_qty', type: 'int', default: 0 })
  totalQty: number;

  /** pending | finished | manual */
  @Column({ name: 'source_type', length: 16, default: 'manual' })
  sourceType: string;

  /** source_type=pending → inbound_pending.id；finished → finished_goods_stock.id */
  @Column({ name: 'source_id', type: 'int', nullable: true })
  sourceId: number | null;
}
