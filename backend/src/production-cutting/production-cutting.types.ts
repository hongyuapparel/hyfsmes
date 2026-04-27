/** 与前端一致的异常损耗原因（固定选项） */
export const CUTTING_ABNORMAL_REASONS = [
  '布头布尾',
  '疵布/次布',
  '裁错返工',
  '缩水损耗',
  '色差换片',
  '排料正常损耗',
  '其他',
] as const;

export interface CuttingListItem {
  orderId: number;
  orderNo: string;
  customerName: string;
  salesperson: string;
  merchandiser: string;
  customerDueDate: string | null;
  skuCode: string;
  quantity: number;
  imageUrl: string;
  arrivedAt: string | null;
  completedAt: string | null;
  cuttingStatus: string;
  actualCutTotal: number | null;
  cuttingCost: string | null;
  cuttingUnitPrice: string | null;
  actualFabricMeters: string | null;
  timeRating: string;
}

export interface CuttingListQuery {
  tab?: string;
  orderNo?: string;
  skuCode?: string;
  completedStart?: string;
  completedEnd?: string;
  page?: number;
  pageSize?: number;
}

export interface CuttingRegisterFormMaterialRow {
  rowKey: string;
  materialTypeId: number | null;
  categoryLabel: string;
  materialName: string;
  colorSpec: string;
  expectedUsagePerPiece: number | null;
  issuedMeters: number;
  returnedMeters: number;
  abnormalLossMeters: number;
  abnormalReason: string | null;
  remark: string;
}

export interface CuttingRegisterFormResponse {
  orderBrief: {
    orderNo: string;
    skuCode: string;
    quantity: number;
    customerName: string;
    orderDate: string | null;
  };
  colorSizeHeaders: string[];
  colorSizeRows: { colorName: string; quantities: number[]; remark?: string }[];
  materialUsageRows: CuttingRegisterFormMaterialRow[];
}

export interface CuttingCompletedDetailResponse {
  orderBrief: {
    orderNo: string;
    skuCode: string;
    quantity: number;
    customerName: string;
    orderDate: string | null;
  };
  colorSizeHeaders: string[];
  actualCutRows: { colorName: string; quantities: number[]; remark?: string }[];
  materialUsageRows: CuttingRegisterFormMaterialRow[];
  cuttingDepartment: string | null;
  cutterName: string | null;
  cuttingUnitPrice: string | null;
  cuttingTotalCost: string | null;
  cuttingCost: string | null;
  actualFabricMeters: string | null;
  arrivedAt: string | null;
  completedAt: string | null;
}
