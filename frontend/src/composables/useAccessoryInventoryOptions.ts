import { ref } from 'vue'
import { getAllCustomerCompanyOptions, getSalespeople } from '@/api/customers'
import { getDictItems, getDictTree } from '@/api/dicts'
import type { AccessoryItem } from '@/api/inventory'
import type { SystemOptionItem, SystemOptionTreeNode } from '@/api/system-options'

export type AccessoryCustomerOption = { label: string; value: string; salesperson?: string }
export type AccessoryWarehouseOption = { id: number; label: string }

export function useAccessoryInventoryOptions() {
  const customerOptions = ref<AccessoryCustomerOption[]>([])
  const salespersonOptions = ref<string[]>([])
  const categoryOptions = ref<string[]>([])
  const warehouseOptions = ref<AccessoryWarehouseOption[]>([])

  async function loadCustomerOptions() {
    try {
      const customers = await getAllCustomerCompanyOptions({ sortBy: 'companyName', sortOrder: 'asc' })
      customerOptions.value = customers.map((item) => ({
        label: item.companyName,
        value: item.companyName,
        salesperson: item.salesperson ?? '',
      }))
    } catch {
      console.warn('客户选项加载失败')
    }
  }

  async function loadSalespersonOptions() {
    try {
      const res = await getSalespeople()
      salespersonOptions.value = (res.data ?? []).filter((v) => !!String(v ?? '').trim())
    } catch {
      salespersonOptions.value = []
    }
  }

  async function loadCategoryOptions() {
    try {
      const res = await getDictTree('supplier_types')
      const tree = res.data ?? []
      const accessoryRoot = findNodeByValue(tree, '辅料供应商')
      categoryOptions.value = (accessoryRoot?.children ?? []).map((child) => child.value).filter(Boolean)
    } catch {
      categoryOptions.value = []
    }
  }

  async function loadWarehouseOptions() {
    try {
      const res = await getDictItems('warehouses')
      const list = (res.data ?? []) as SystemOptionItem[]
      warehouseOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
    } catch {
      warehouseOptions.value = []
    }
  }

  function formatWarehouseLabel(warehouseId: number | null | undefined) {
    const id = warehouseId ?? null
    if (id == null) return '-'
    return warehouseOptions.value.find((o) => o.id === id)?.label ?? String(id)
  }

  function getMainImageUrl(row: AccessoryItem): string {
    if (Array.isArray(row.imageUrls)) {
      const first = row.imageUrls.find((url) => !!String(url ?? '').trim())
      if (first) return first
    }
    return String(row.imageUrl ?? '').trim()
  }

  return {
    customerOptions,
    salespersonOptions,
    categoryOptions,
    warehouseOptions,
    loadCustomerOptions,
    loadSalespersonOptions,
    loadCategoryOptions,
    loadWarehouseOptions,
    formatWarehouseLabel,
    getMainImageUrl,
  }
}

function findNodeByValue(nodes: SystemOptionTreeNode[], value: string): SystemOptionTreeNode | null {
  for (const node of nodes) {
    if (node.value === value) return node
    if (node.children?.length) {
      const found = findNodeByValue(node.children, value)
      if (found) return found
    }
  }
  return null
}
