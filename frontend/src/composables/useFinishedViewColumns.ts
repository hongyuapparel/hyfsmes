import { getFilterRangeStyle } from '@/composables/useFilterBarHelpers'

export type FinishedStockColumn = {
  prop: 'skuCode' | 'department' | 'location' | 'createdAt' | 'orderNo'
  label: string
  minWidth?: number
  width?: number
}

export type FinishedOutboundColumn = {
  prop: 'createdAt' | 'skuCode' | 'department' | 'pickupUserName' | 'operatorUsername' | 'remark'
  label: string
  minWidth?: number
  width?: number
}

const stockPrimaryColumns: FinishedStockColumn[] = [
  { prop: 'skuCode', label: 'SKU', minWidth: 100 },
]

const stockTailColumns: FinishedStockColumn[] = [
  { prop: 'department', label: '部门', minWidth: 90 },
  { prop: 'location', label: '存放地址', minWidth: 120 },
  { prop: 'createdAt', label: '入库时间', width: 160 },
  { prop: 'orderNo', label: '订单号', minWidth: 110 },
]

const outboundPrimaryColumns: FinishedOutboundColumn[] = [
  { prop: 'createdAt', label: '出库时间', width: 160 },
  { prop: 'skuCode', label: 'SKU', minWidth: 100 },
]

const outboundTailColumns: FinishedOutboundColumn[] = [
  { prop: 'department', label: '部门', minWidth: 90 },
  { prop: 'pickupUserName', label: '领取人', width: 120 },
  { prop: 'operatorUsername', label: '操作人', width: 120 },
  { prop: 'remark', label: '备注', minWidth: 160 },
]

function getInventoryOutboundRangeStyle(v: [string, string] | []) {
  const hasValue = Array.isArray(v) && v.length === 2
  if (!hasValue) return getFilterRangeStyle(v)
  const width = '240px'
  return { ...getFilterRangeStyle(v), width, minWidth: width, flex: `0 0 ${width}` }
}

export function useFinishedViewColumns() {
  return {
    stockPrimaryColumns,
    stockTailColumns,
    outboundPrimaryColumns,
    outboundTailColumns,
    getInventoryOutboundRangeStyle,
  }
}
