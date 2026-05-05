import type { FinishedGoodsOutbound } from '../entities/finished-goods-outbound.entity';
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

export type FinishedGoodsOutboundListResult = {
  list: Array<
    Omit<FinishedGoodsOutbound, 'createdAt'> & {
      createdAt: string;
      imageUrl?: string;
    }
  >;
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
