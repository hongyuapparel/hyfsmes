/** 已审单：非草稿、非待审单，即待纸样及之后的状态 */
export const PURCHASE_ORDER_STATUSES = [
  'pending_pattern',
  'pending_purchase',
  'pending_cutting',
  'pending_sewing',
  'pending_finishing',
  'completed',
];

export interface PurchaseItemRow {
  orderId: number;
  materialIndex: number;
  orderNo: string;
  orderDate: string | null;
  /** 到待采购状态的时间（订单进入待采购时记录） */
  pendingPurchaseAt: string | null;
  imageUrl: string;
  skuCode: string;
  /** 订单类型 ID（system_options.id, option_type='order_types'） */
  orderTypeId: number | null;
  supplierName: string;
  materialTypeId: number | null;
  materialType: string;
  materialName: string;
  color: string;
  planQuantity: number | null;
  actualPurchaseQuantity: number | null;
  purchaseAmount: string | null;
  purchaseStatus: string;
  pickStatus: string;
  purchaseCompletedAt: string | null;
  pickCompletedAt: string | null;
  purchaseUnitPrice: string | null;
  purchaseOtherCost: string | null;
  purchaseRemark: string | null;
  purchaseImageUrl: string | null;
  materialSourceId: number | null;
  materialSource: string;
  processRoute: 'purchase' | 'picking';
  /** 时效判定：本行物料从到采购至采购/领料完成（与订单时效配置 pending_purchase 对比） */
  timeRating: string;
  /** 订单维度：客户 */
  customerName: string;
  /** 订单维度：跟单 */
  merchandiser: string;
  /** 订单维度：客户交期 */
  customerDueDate: string | null;
  /** 订单件数 */
  orderQuantity: number;
}

export interface PurchaseListQuery {
  /** tab: all | pending | picking | completed */
  tab?: string;
  orderNo?: string;
  skuCode?: string;
  supplier?: string;
  /** 订单类型 ID */
  orderTypeId?: number;
  orderDateStart?: string;
  orderDateEnd?: string;
  completedStart?: string;
  completedEnd?: string;
  page?: number;
  pageSize?: number;
}
