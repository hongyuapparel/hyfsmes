import type { Ref } from 'vue'
import type { OrderListItem } from '@/api/orders'
import type { SystemOptionTreeNode } from '@/api/system-options'

interface UseOrderListPresentationParams {
  statusLabelMap: Ref<Record<string, string>>
  statusCounts: Ref<Record<string, number>>
  statusTotal: Ref<number>
  orderTypeTree: Ref<SystemOptionTreeNode[]>
  findOrderTypeLabelById: (id: number) => string
  findCollaborationLabelById: (id: number) => string
}

export function useOrderListPresentation(params: UseOrderListPresentationParams) {
  const {
    statusLabelMap,
    statusCounts,
    statusTotal,
    orderTypeTree,
    findOrderTypeLabelById,
    findCollaborationLabelById,
  } = params

  function getStatusLabel(status: string): string {
    const map = statusLabelMap.value
    return map[status] || status || '-'
  }

  function getStatusTagType(
    status: string,
  ): 'success' | 'warning' | 'info' | 'danger' | 'primary' | undefined {
    const s = (status ?? '').toLowerCase()
    if (s === 'completed') return 'success'
    if (s === 'draft' || s === 'pending_review') return 'info'
    if (!s) return 'info'
    return 'warning'
  }

  function getCustomerDueDateClass(
    customerDueDate: string | null | undefined,
    status: string | null | undefined,
  ): string | undefined {
    const s = (status ?? '').toLowerCase()
    if (s === 'completed' || s === 'draft') return undefined
    if (!customerDueDate) return undefined
    const d = new Date(customerDueDate)
    if (Number.isNaN(d.getTime())) return undefined

    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfDueDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())
    const diffDays = Math.floor((startOfDueDay.getTime() - startOfToday.getTime()) / 86400000)

    if (diffDays < 0) return 'due-overdue'
    if (diffDays <= 7) return 'due-soon'
    return undefined
  }

  function orderTypeDisplay(item: OrderListItem): string {
    if (typeof item.orderTypeId === 'number') {
      const label = findOrderTypeLabelById(item.orderTypeId)
      if (label && label.trim()) return label.trim()
    }
    return ''
  }

  function findOrderTypePathById(id: number | null | undefined): string[] {
    if (!id) return []
    const dfs = (nodes: SystemOptionTreeNode[], path: string[]): string[] | null => {
      for (const node of nodes) {
        const currentPath = [...path, node.value]
        if (node.id === id) return currentPath
        if (node.children?.length) {
          const found = dfs(node.children, currentPath)
          if (found) return found
        }
      }
      return null
    }
    return dfs(orderTypeTree.value, []) ?? []
  }

  function isSampleOrder(item: OrderListItem): boolean {
    if (typeof item.orderTypeId !== 'number') return false
    const path = findOrderTypePathById(item.orderTypeId)
    return path.some((seg) => (seg ?? '').includes('样品'))
  }

  function collaborationDisplay(item: OrderListItem): string {
    if (typeof item.collaborationTypeId === 'number') {
      const label = findCollaborationLabelById(item.collaborationTypeId)
      if (label && label.trim()) return label.trim()
    }
    return ''
  }

  function getOrderMetaTags(item: OrderListItem): string[] {
    const tags: string[] = []
    const orderType = orderTypeDisplay(item)
    const processItem = item.processItem?.trim()
    const collaboration = collaborationDisplay(item)
    if (orderType) tags.push(orderType)
    if (processItem) tags.push(processItem)
    if (collaboration) tags.push(collaboration)
    return tags
  }

  function formatDate(v: string | null | undefined): string {
    if (!v) return '-'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleDateString('zh-CN')
  }

  function formatDateTime(v: string | null | undefined): string {
    if (!v) return '-'
    const d = new Date(v)
    if (Number.isNaN(d.getTime())) return '-'
    return d.toLocaleString('zh-CN')
  }

  function getStatusTabLabel(tab: { label: string; value: string }) {
    const count = tab.value === 'all' ? statusTotal.value : (statusCounts.value[tab.value] ?? 0)
    return `${tab.label}(${count})`
  }

  return {
    getStatusLabel,
    getStatusTagType,
    getCustomerDueDateClass,
    isSampleOrder,
    getOrderMetaTags,
    formatDate,
    formatDateTime,
    getStatusTabLabel,
  }
}
