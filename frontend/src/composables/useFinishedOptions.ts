import { ref } from 'vue'
import { getCustomerCompanyOptions, type CustomerItem } from '@/api/customers'
import { getDictItems, getDictTree } from '@/api/dicts'
import type { SystemOptionItem, SystemOptionTreeNode } from '@/api/system-options'
import { getFinishedPickupUserOptions, type FinishedPickupUserOption } from '@/api/inventory'

type DepartmentOption = { value: string; label: string }

export function useFinishedOptions() {
  const customerOptions = ref<{ label: string; value: string }[]>([])
  const warehouseOptions = ref<{ id: number; label: string }[]>([])
  const inventoryTypeOptions = ref<{ id: number; label: string }[]>([])
  const departmentOptions = ref<DepartmentOption[]>([])
  const pickupUserOptions = ref<FinishedPickupUserOption[]>([])

  async function loadCustomerOptions() {
    try {
      const res = await getCustomerCompanyOptions({ sortBy: 'companyName', sortOrder: 'asc' })
      const list = (res.data?.list ?? []) as CustomerItem[]
      customerOptions.value = list.map((c) => ({
        label: c.companyName,
        value: c.companyName,
      }))
    } catch (e: unknown) {
      console.warn('客户选项加载失败')
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

  async function loadInventoryTypeOptions() {
    try {
      const res = await getDictItems('inventory_types')
      const list = (res.data ?? []) as SystemOptionItem[]
      inventoryTypeOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
    } catch {
      inventoryTypeOptions.value = []
    }
  }

  async function loadDepartmentOptions() {
    try {
      const treeRes = await getDictTree('org_departments')
      const tree = (treeRes.data ?? []) as SystemOptionTreeNode[]
      const treeOptions = flattenDepartmentTree(tree)
      if (treeOptions.length) {
        departmentOptions.value = treeOptions
        return
      }
    } catch {
      // 树接口失败时继续回退到平铺字典，避免下拉不可用。
    }
    try {
      const listRes = await getDictItems('org_departments')
      const list = (listRes.data ?? []) as SystemOptionItem[]
      departmentOptions.value = sortSystemOptions(list).map((o) => ({ value: o.value, label: o.value }))
    } catch {
      departmentOptions.value = []
    }
  }

  async function loadPickupUserOptions() {
    try {
      const res = await getFinishedPickupUserOptions()
      pickupUserOptions.value = (res.data ?? []) as FinishedPickupUserOption[]
    } catch {
      pickupUserOptions.value = []
    }
  }

  function findWarehouseLabelById(id: number | null | undefined): string {
    if (id == null) return ''
    const item = warehouseOptions.value.find((w) => w.id === id)
    return item?.label ?? ''
  }

  function findInventoryTypeLabelById(id: number | null | undefined): string {
    if (id == null) return ''
    const item = inventoryTypeOptions.value.find((o) => o.id === id)
    return item?.label ?? ''
  }

  return {
    customerOptions,
    warehouseOptions,
    inventoryTypeOptions,
    departmentOptions,
    pickupUserOptions,
    loadWarehouseOptions,
    loadInventoryTypeOptions,
    loadDepartmentOptions,
    loadCustomerOptions,
    loadPickupUserOptions,
    findWarehouseLabelById,
    findInventoryTypeLabelById,
  }
}

function sortSystemOptions<T extends Pick<SystemOptionItem, 'id' | 'sortOrder'>>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
}

function flattenDepartmentTree(nodes: SystemOptionTreeNode[], depth = 0): DepartmentOption[] {
  return sortSystemOptions(nodes).flatMap((node) => {
    const label = depth > 0 ? `${'　'.repeat(depth)}${node.value}` : node.value
    return [
      { value: node.value, label },
      ...flattenDepartmentTree(Array.isArray(node.children) ? node.children : [], depth + 1),
    ]
  })
}
