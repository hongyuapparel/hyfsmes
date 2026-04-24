import { Column, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/** 成本快照 - 物料行 */
export interface CostMaterialRow {
  materialTypeId?: number | null;
  supplierName?: string;
  materialName?: string;
  color?: string;
  fabricWidth?: string;
  usagePerPiece?: number | null;
  lossPercent?: number | null;
  unitPrice?: number;
  includeInCost?: boolean;
  [key: string]: unknown;
}

/** 成本快照 - 工艺行 */
export interface CostProcessItemRow {
  processName?: string;
  supplierName?: string;
  part?: string;
  quantity?: number;
  unitPrice?: number;
  [key: string]: unknown;
}

/** 成本快照 - 生产工序行 */
export interface CostProductionRow {
  processName?: string;
  unitPrice?: number;
  quantity?: number;
  [key: string]: unknown;
}

/** 成本快照内容结构 */
export interface CostSnapshotContent {
  materialRows?: CostMaterialRow[];
  processItemRows?: CostProcessItemRow[];
  productionRows?: CostProductionRow[];
  profitMargin?: number;
  productionCostMultiplier?: number;
  [key: string]: unknown;
}

/**
 * 订单成本快照（订单成本页填写的物料/工艺/工序明细及利润率，按订单保存一份）
 */
@Entity('order_cost_snapshots')
export class OrderCostSnapshot {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_id', type: 'int', unique: true })
  orderId: number;

  /** 快照内容：materialRows, processItemRows, productionRows, profitMargin 等 */
  @Column({ name: 'snapshot', type: 'json', nullable: true })
  snapshot: CostSnapshotContent | null;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
