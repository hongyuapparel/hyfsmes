import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn } from 'typeorm';
import { Order } from './order.entity';

/** 裁床数量行，与 B 区 colorSizeRows 结构一致 */
export interface ActualCutRow {
  colorName?: string;
  quantities?: number[];
  remark?: string;
}

/** 裁床登记：物料用量明细行（持久化输入项；展示用计算字段由前后端按需重算） */
export interface CuttingMaterialUsageRow {
  /** 稳定键：materialTypeId + 名称 + 颜色 + 同键序号 */
  rowKey: string;
  materialTypeId?: number | null;
  /** 主布 / 里布 / 配布 / 衬布 */
  categoryLabel: string;
  materialName: string;
  /** 颜色 / 规格等合并展示快照 */
  colorSpec: string;
  /** 订单预计单件用量（米/件），可来自 C 区 usagePerPiece */
  expectedUsagePerPiece: number | null;
  issuedMeters: number;
  returnedMeters: number;
  abnormalLossMeters: number;
  abnormalReason: string | null;
  remark: string;
}

/** 订单裁床登记：裁床数量、裁剪成本、完成时间 */
@Entity('order_cutting')
export class OrderCutting {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', unique: true })
  orderId: number;

  @OneToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /** 状态：pending | completed */
  @Column({ name: 'status', length: 32, default: 'pending' })
  status: string;

  /** 到裁床时间（订单进入待裁床时或登记时记录） */
  @Column({ name: 'arrived_at', type: 'datetime', nullable: true })
  arrivedAt: Date | null;

  /** 裁床完成时间 */
  @Column({ name: 'completed_at', type: 'datetime', nullable: true })
  completedAt: Date | null;

  /**
   * 裁剪总成本（元），与 cutting_total_cost 新列语义一致；历史数据可能曾按「单价」误填，以登记改造后为准。
   */
  @Column({ name: 'cutting_cost', type: 'decimal', precision: 12, scale: 2, default: 0 })
  cuttingCost: string;

  /**
   * 裁剪单价（元/件）。须 insert/update: false，避免库表未跑迁移时 save() 仍生成未知列 SQL；
   * 实际写入由 ProductionCuttingService 在探测到列存在后执行原生 UPDATE。
   */
  @Column({
    name: 'cutting_unit_price',
    type: 'decimal',
    precision: 14,
    scale: 4,
    nullable: true,
    select: false,
    insert: false,
    update: false,
  })
  cuttingUnitPrice?: string | null;

  /** 裁剪总成本（元），持久化方式同 cutting_unit_price */
  @Column({
    name: 'cutting_total_cost',
    type: 'decimal',
    precision: 14,
    scale: 2,
    nullable: true,
    select: false,
    insert: false,
    update: false,
  })
  cuttingTotalCost?: string | null;

  /** 实际裁剪数量明细 JSON，与 B 区 colorSizeRows 同结构 */
  @Column({ name: 'actual_cut_rows', type: 'json', nullable: true })
  actualCutRows: ActualCutRow[] | null;

  /** 裁剪部门/加工厂：本厂或外发加工厂名称（裁床管理登记用） */
  @Column({ name: 'cutting_department', type: 'varchar', length: 128, nullable: true, select: false })
  cuttingDepartment?: string | null;

  /** 裁剪人：仅本厂裁床时填写 */
  @Column({ name: 'cutter_name', type: 'varchar', length: 64, nullable: true, select: false })
  cutterName?: string | null;

  /**
   * 本次实际净耗合计（米）：由物料用量明细净耗汇总写入；历史数据可能为手工填写的「实际用布」。
   */
  @Column({ name: 'actual_fabric_meters', type: 'decimal', precision: 12, scale: 3, nullable: true, select: false })
  actualFabricMeters?: string | null;

  /** 物料用量明细 JSON；持久化方式同 cutting_unit_price */
  @Column({
    name: 'material_usage',
    type: 'json',
    nullable: true,
    select: false,
    insert: false,
    update: false,
  })
  materialUsage?: CuttingMaterialUsageRow[] | null;
}
