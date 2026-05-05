import type {
  ColorSizeRow,
  OrderMaterialRow,
  PackagingCell,
  ProcessRow,
  SizeInfoRow,
} from '../entities/order-ext.entity';
import type { Order } from '../entities/order.entity';

export const ORDER_STATUS_LABEL_MAP: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审单',
  pending_pattern: '待纸样',
  pending_purchase: '待采购',
  pending_cutting: '待裁床',
  pending_craft: '待工艺',
  pending_sewing: '待车缝',
  pending_finishing: '待尾部',
  completed: '订单完成',
};

export interface OrderListQuery {
  orderNo?: string;
  skuCode?: string;
  customer?: string;
  processItem?: string;
  salesperson?: string;
  merchandiser?: string;
  orderDateStart?: string;
  orderDateEnd?: string;
  completedStart?: string;
  completedEnd?: string;
  customerDueStart?: string;
  customerDueEnd?: string;
  factory?: string;
  status?: string;
  orderTypeId?: number | null;
  collaborationTypeId?: number | null;
  deletedOnly?: boolean;
  page?: number;
  pageSize?: number;
}

export interface OrderEditPayload {
  skuCode?: string;
  customerId?: number | null;
  customerName?: string;
  collaborationTypeId?: number | null;
  orderTypeId?: number | null;
  salesperson?: string;
  merchandiser?: string;
  quantity?: number;
  exFactoryPrice?: string;
  salePrice?: string;
  processItem?: string;
  orderDate?: string | null;
  customerDueDate?: string | null;
  factoryName?: string;
  imageUrl?: string;
  colorSizeHeaders?: string[];
  colorSizeRows?: ColorSizeRow[];
  materials?: OrderMaterialRow[];
  sizeInfoMetaHeaders?: string[];
  sizeInfoRows?: SizeInfoRow[];
  processItems?: ProcessRow[];
  productionRequirement?: string;
  packagingHeaders?: string[];
  packagingCells?: PackagingCell[];
  packagingMethod?: string;
  attachments?: string[];
}

export interface OrderActor {
  userId: number;
  username: string;
}

export type OrderDetail = Order & {
  materials?: OrderMaterialRow[];
  colorSizeHeaders?: string[];
  colorSizeRows?: ColorSizeRow[];
  sizeInfoMetaHeaders?: string[];
  sizeInfoRows?: SizeInfoRow[];
  processItems?: ProcessRow[];
  productionRequirement?: string;
  packagingHeaders?: string[];
  packagingCells?: PackagingCell[];
  packagingMethod?: string;
  attachments?: string[];
  productGroupId?: number | null;
  productGroupName?: string;
  applicablePeopleId?: number | null;
  applicablePeopleName?: string;
};
