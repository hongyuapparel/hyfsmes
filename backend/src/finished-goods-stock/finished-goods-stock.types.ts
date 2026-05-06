import type { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';

export interface FinishedStockRow {
  id: number;
  orderId: number | null;
  orderNo: string;
  customerName: string;
  skuCode: string;
  quantity: number;
  unitPrice: string;
  warehouseId: number | null;
  inventoryTypeId: number | null;
  department: string;
  location: string;
  imageUrl: string;
  productImageUrl?: string;
  createdAt: string;
  type: 'pending' | 'stored';
  sizeBreakdown?: {
    headers: string[];
    rows: Array<{ colorName: string; values: number[] }>;
  } | null;
  colorImages?: Array<{ colorName: string; imageUrl: string }>;
}

export type FinishedOutboundItemInput = {
  id: number;
  quantity: number;
  sizeBreakdown?: unknown;
};

export type ColorSizeSnapshot = {
  headers: string[];
  rows: Array<{ colorName: string; quantities: number[] }>;
};

export type FinishedGoodsOutboundRecord = {
  id: number;
  finishedStockId: number;
  orderId: number | null;
  orderNo: string;
  skuCode: string;
  customerName: string;
  quantity: number;
  department: string;
  warehouseId: number | null;
  inventoryTypeId: number | null;
  pickupUserId: number | null;
  pickupUserName: string;
  sizeBreakdown: ColorSizeSnapshot | null;
  operatorUsername: string;
  remark: string;
  createdAt: string;
  imageUrl?: string;
};

export type FinishedGoodsOutboundListResult = {
  list: FinishedGoodsOutboundRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type FinishedGoodsStockDetailResult = {
  stock: FinishedGoodsStock & { remark?: string };
  orderNo: string;
  productImageUrl: string;
  colorImages: Array<{ colorName: string; imageUrl: string; updatedAt: string }>;
  adjustLogs: Array<{
    id: number;
    operatorUsername: string;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    remark: string;
    sourceOrderNo: string;
    summary: string;
    summaries: string[];
    createdAt: string;
  }>;
  colorSize: { headers: string[]; colors: string[]; rows: Array<{ colorName: string; quantities: number[] }> };
  groupSizeHeaders: string[];
};
