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
