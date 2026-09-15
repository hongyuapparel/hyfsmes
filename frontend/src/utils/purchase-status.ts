import type { PurchaseItemRow } from '@/api/production-purchase'

export function displayStatus(row: PurchaseItemRow): 'pending' | 'purchasing' | 'completed' {
  if (row.processRoute === 'picking') {
    return row.pickStatus === 'completed' ? 'completed' : 'pending'
  }
  return row.purchaseStatus === 'completed' ? 'completed' : row.purchaseStatus === 'purchasing' ? 'purchasing' : 'pending'
}

export function displayStatusLabel(row: PurchaseItemRow): string {
  if (row.processRoute === 'picking') return displayStatus(row) === 'completed' ? '领料完成' : '待领料'
  return displayStatus(row) === 'completed' ? '采购完成' : displayStatus(row) === 'purchasing' ? '采购中' : '等待采购'
}
