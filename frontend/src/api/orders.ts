import request from './request'
import type { AxiosRequestConfig } from 'axios'

/** 订单列表项，列表/表格共用同一数据结构 */
export interface OrderListItem {
  id: number
  /** 订单号（唯一） */
  orderNo: string
  /** SKU 编号 */
  skuCode: string
  /** 客户 ID，可为空 */
  customerId: number | null
  /** 客户名称（冗余字段，方便展示与导出） */
  customerName: string
  /** 业务员 */
  salesperson: string
  /** 跟单员 */
  merchandiser: string
  /** 数量 */
  quantity: number
  /** 裁床总件数（来自裁床登记），可为空 */
  actualCutTotal?: number | null
  /** 车缝完成件数，可为空 */
  sewingQuantity?: number | null
  /** 尾部收货数（包装完成），可为空 */
  tailReceivedQty?: number | null
  /** 尾部出货数（发货数量），可为空 */
  tailShippedQty?: number | null
  /** 出厂价 */
  exFactoryPrice: string
  /** 销售价 */
  salePrice: string
  /** 订单类型 ID（system_options.id, option_type='order_types'） */
  orderTypeId?: number | null
  /** 合作方式 ID（system_options.id, option_type='collaboration'） */
  collaborationTypeId?: number | null
  /** 标签/样品类型 */
  label: string
  /** 工艺项目（原二次工艺） */
  processItem: string
  /** 当前状态 */
  status: string
  /** 当前状态时间 */
  statusTime: string | null
  /** 下单时间 */
  orderDate: string | null
  /** 客户交期 */
  customerDueDate: string | null
  /** 加工厂名称 */
  factoryName: string
  /** 订单图片 */
  imageUrl: string
  /** SKU 对应产品分组 ID（来自 products.product_group_id） */
  productGroupId?: number | null
  /** SKU 对应产品分组名称（路径） */
  productGroupName?: string
  /** SKU 对应适用人群 ID（来自 products.applicable_people_id） */
  applicablePeopleId?: number | null
  /** SKU 对应适用人群名称 */
  applicablePeopleName?: string
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
  /** 备注条数（列表接口附带，用于角标展示） */
  remarkCount?: number
}

export interface OrderListRes {
  list: OrderListItem[]
  total: number
  page: number
  pageSize: number
}

export interface OrderListQuery {
  orderNo?: string
  skuCode?: string
  customer?: string
  /** 订单类型 ID */
  orderTypeId?: number
  /** 工艺项目（原二次工艺） */
  processItem?: string
  /** 合作方式 ID */
  collaborationTypeId?: number
  salesperson?: string
  merchandiser?: string
  orderDateStart?: string
  orderDateEnd?: string
  /** 完成时间开始（YYYY-MM-DD，仅对已完成订单生效） */
  completedStart?: string
  /** 完成时间结束（YYYY-MM-DD，仅对已完成订单生效） */
  completedEnd?: string
  /** 客户交期开始（兼容旧参数） */
  customerDueStart?: string
  /** 客户交期结束（兼容旧参数） */
  customerDueEnd?: string
  factory?: string
  status?: string
  page?: number
  pageSize?: number
}

export function getOrders(params?: OrderListQuery, config?: AxiosRequestConfig) {
  return request.get<OrderListRes>('/orders', { params, ...(config ?? {}) })
}

export interface OrderStatusCountsRes {
  total: number
  byStatus: Record<string, number>
}

/** 状态 Tab 数量统计（与列表筛选同源，但忽略 status） */
export function getOrderStatusCounts(
  params?: Omit<OrderListQuery, 'status' | 'page' | 'pageSize'>,
  config?: AxiosRequestConfig,
) {
  return request.get<OrderStatusCountsRes>('/orders/status-counts', { params, ...(config ?? {}) })
}

/** 订单编辑页表单字段（仅 A 区，后续可扩展） */
export interface OrderFormPayload {
  skuCode?: string
  xiaomanOrderNo?: string
  customerId?: number | null
  customerName?: string
  salesperson?: string
  merchandiser?: string
  merchandiserPhone?: string
  /** 合作方式 ID（system_options.id, option_type='collaboration'） */
  collaborationTypeId?: number | null
  /** 订单类型 ID（system_options.id, option_type='order_types'） */
  orderTypeId?: number | null
  /** 工艺项目（原二次工艺） */
  processItem?: string
  /**
   * 与列表/详情 `processItem` 对应的展示字段（历史命名，与 E 区 processItems 摘要并存）
   */
  secondaryProcess?: string
  quantity?: number
  exFactoryPrice?: string
  salePrice?: string
  orderDate?: string | null
  customerDueDate?: string | null
  factoryName?: string
  imageUrl?: string
  /** B 区：颜色 / 尺码数量 */
  colorSizeRows?: Array<{
    colorName: string
    quantities: number[]
    remark?: string
  }>
  colorSizeHeaders?: string[]
  /** C 区：物料信息 */
  materials?: Array<{
    /** 物料来源 ID（system_options.id, option_type='material_sources'） */
    materialSourceId?: number | null
    /** 物料来源名称（冗余显示字段） */
    materialSource?: string
    /** 物料类型 ID（system_options.id, option_type='material_types'） */
    materialTypeId?: number | null
    /** 物料类型名称（冗余显示字段） */
    materialType?: string
    supplierName?: string
    materialName?: string
    color?: string
    fabricWidth?: string
    usagePerPiece?: number | null
    lossPercent?: number | null
    orderPieces?: number | null
    purchaseQuantity?: number | null
    cuttingQuantity?: number | null
    remark?: string
  }>
  /** D 区：尺寸信息 */
  sizeInfoMetaHeaders?: string[]
  sizeInfoRows?: Array<{
    metaValues: string[]
    sizeValues: number[]
  }>
  /** E 区：工艺项目 */
  processItems?: Array<{
    processName?: string
    supplierName?: string
    remark?: string
  }>
  /** F 区：生产要求 */
  productionRequirement?: string
  /** G 区：包装要求 */
  packagingHeaders?: string[]
  packagingCells?: Array<{
    header: string
    imageUrl?: string
    accessoryId?: number | null
    accessoryName?: string
    description?: string
  }>
  packagingMethod?: string
  /** H 区：图片附件 */
  attachments?: string[]
}

export type OrderDetail = OrderListItem & OrderFormPayload

/** 获取订单详情（编辑回显） */
export function getOrderDetail(id: number) {
  return request.get<OrderDetail>(`/orders/${id}`)
}

export interface OrderSizeBreakdownRes {
  headers: string[]
  rows: Array<{
    label: string
    values: (number | null)[]
  }>
}

/** 订单尺码数量追踪明细（列表数量悬停用） */
export function getOrderSizeBreakdown(id: number) {
  return request.get<OrderSizeBreakdownRes>(`/orders/${id}/size-breakdown`)
}

export interface OrderColorSizeBreakdownRes {
  headers: string[]
  rows: Array<{
    colorName: string
    values: number[]
  }>
}

/** 订单颜色尺码数量明细（待入库数量悬停用） */
export function getOrderColorSizeBreakdown(id: number) {
  return request.get<OrderColorSizeBreakdownRes>(`/orders/${id}/color-size-breakdown`)
}

export interface OrderOperationLogItem {
  id: number
  orderId: number
  orderNo: string
  operatorUsername: string
  action: string
  detail: string
  createdAt: string
}

/** 获取订单操作记录 */
export function getOrderLogs(id: number) {
  return request.get<OrderOperationLogItem[]>(`/orders/${id}/logs`)
}

export interface OrderRemarkItem {
  id: number
  orderId: number
  operatorUsername: string
  content: string
  createdAt: string
}

/** 获取订单备注列表 */
export function getOrderRemarks(id: number) {
  return request.get<OrderRemarkItem[]>(`/orders/${id}/remarks`)
}

/** 新增订单备注 */
export function addOrderRemark(id: number, content: string) {
  return request.post<OrderRemarkItem>(`/orders/${id}/remarks`, { content })
}

/** 订单成本快照（后端返回） */
export interface OrderCostSnapshotRes {
  id: number
  orderId: number
  snapshot: {
    materialRows?: unknown[]
    processItemRows?: unknown[]
    productionRows?: unknown[]
    profitMargin?: number
    quoteNeedsReconfirm?: boolean
    quoteConfirmedAt?: string
    quoteConfirmedBy?: string
    quoteConfirmedExFactoryPrice?: string
    quoteDraftUpdatedAt?: string
    quoteDraftUpdatedBy?: string
  } | null
  updatedAt: string
}

/** 获取订单成本快照（成本页回显） */
export function getOrderCost(id: number) {
  return request.get<OrderCostSnapshotRes | null>(`/orders/${id}/cost`)
}

/** 保存订单成本草稿（不同步订单卡片出厂价） */
export function saveOrderCost(id: number, payload: { snapshot: Record<string, unknown> }) {
  return request.put<OrderCostSnapshotRes>(`/orders/${id}/cost`, payload)
}

/** 确认订单报价（同步订单卡片出厂价） */
export function confirmOrderCost(id: number, payload: { snapshot: Record<string, unknown> }) {
  return request.post<OrderCostSnapshotRes>(`/orders/${id}/cost/confirm`, payload)
}

/** 新建草稿 */
export function createOrderDraft(payload: OrderFormPayload) {
  return request.post<OrderDetail>('/orders', payload)
}

/** 保存草稿 */
export function updateOrderDraft(id: number, payload: OrderFormPayload) {
  return request.put<OrderDetail>(`/orders/${id}`, payload)
}

/** 保存并提交 */
export function submitOrder(id: number) {
  return request.post<OrderDetail>(`/orders/${id}/submit`)
}

/** 批量删除订单 */
export function deleteOrders(ids: number[]) {
  return request.post<void>('/orders/batch-delete', { ids })
}

/** 待审单批量审核 */
export function reviewOrders(ids: number[]) {
  return request.post<void>('/orders/review', { ids })
}

/** 待审单批量审核退回为草稿，并写入退回原因备注 */
export function reviewRejectOrders(ids: number[], reason: string) {
  return request.post<void>('/orders/review/reject', { ids, reason })
}

/** 批量复制为草稿 */
export function copyOrdersToDraft(ids: number[]) {
  return request.post<OrderDetail[]>('/orders/copy-to-draft', { ids })
}

