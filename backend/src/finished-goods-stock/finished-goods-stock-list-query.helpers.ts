import type { ColorSizeSnapshot, FinishedStockRow } from './finished-goods-stock.types';

export type StoredStockRawRow = {
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
  productImageUrl: string;
  imageUrl: string;
  createdAt: Date;
  colorSizeSnapshot?: unknown;
};

export function snapshotToListSizeBreakdown(
  snapshot: ColorSizeSnapshot | null,
): NonNullable<FinishedStockRow['sizeBreakdown']> | null {
  if (!snapshot?.headers.length || !snapshot.rows.length) return null;
  return {
    headers: [...snapshot.headers],
    rows: snapshot.rows.map((row) => ({ colorName: row.colorName, values: [...row.quantities] })),
  };
}
