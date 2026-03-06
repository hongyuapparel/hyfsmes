import request from './request'

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
  /** 出厂价 */
  exFactoryPrice: string
  /** 销售价 */
  salePrice: string
  /** 订单类型（列表展示用） */
  orderType?: string
  /** 合作方式（展示在 SKU 行后面） */
  collaborationType?: string
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
  /** 创建时间 */
  createdAt: string
  /** 更新时间 */
  updatedAt: string
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
  orderType?: string
  /** 工艺项目（原二次工艺） */
  processItem?: string
  salesperson?: string
  merchandiser?: string
  orderDateStart?: string
  orderDateEnd?: string
  customerDueStart?: string
  customerDueEnd?: string
  factory?: string
  status?: string
  page?: number
  pageSize?: number
}

export function getOrders(params?: OrderListQuery) {
  return request.get<OrderListRes>('/orders', { params })
}

export interface OrderStatusCountsRes {
  total: number
  byStatus: Record<string, number>
}

/** 状态 Tab 数量统计（与列表筛选同源，但忽略 status） */
export function getOrderStatusCounts(params?: Omit<OrderListQuery, 'status' | 'page' | 'pageSize'>) {
  return request.get<OrderStatusCountsRes>('/orders/status-counts', { params })
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
  collaborationType?: string
  orderType?: string
  label?: string
  /** 工艺项目（原二次工艺） */
  processItem?: string
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
    materialType?: string
    supplierName?: string
    materialName?: string
    color?: string
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

/** 批量复制为草稿 */
export function copyOrdersToDraft(ids: number[]) {
  return request.post<OrderDetail[]>('/orders/copy-to-draft', { ids })
}

