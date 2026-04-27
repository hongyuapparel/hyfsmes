export interface FinishingListItem {
  orderId: number;
  orderNo: string;
  skuCode: string;
  imageUrl: string;
  customerName: string;
  salesperson: string;
  merchandiser: string;
  quantity: number;
  customerDueDate: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
  finishingStatus: string;
  cutTotal: number | null;
  sewingQuantity: number | null;
  factoryName: string | null;
  tailReceivedQty: number | null;
  tailShippedQty: number | null;
  tailInboundQty: number | null;
  defectQuantity: number | null;
  remark: string | null;
  timeRating: string;
}

export interface FinishingListQuery {
  tab?: string;
  orderNo?: string;
  skuCode?: string;
  completedStart?: string;
  completedEnd?: string;
  page?: number;
  pageSize?: number;
}
