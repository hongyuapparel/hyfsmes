import { ref } from 'vue'
import { getCustomers, type CustomerItem } from '@/api/customers'
import { getSystemOptionsList, type SystemOptionItem } from '@/api/system-options'
import { getFinishedPickupUserOptions, type FinishedPickupUserOption } from '@/api/inventory'

export function useFinishedOptions() {
  const customerOptions = ref<{ label: string; value: string }[]>([])
  const warehouseOptions = ref<{ id: number; label: string }[]>([])
  const inventoryTypeOptions = ref<{ id: number; label: string }[]>([])
  const departmentOptions = ref<{ value: string; label: string }[]>([])
  const pickupUserOptions = ref<FinishedPickupUserOption[]>([])

  async function loadCustomerOptions() {
    try {
      const res = await getCustomers({ page: 1, pageSize: 200, sortBy: 'companyName', sortOrder: 'asc' })
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
      const res = await getSystemOptionsList('warehouses')
      const list = (res.data ?? []) as SystemOptionItem[]
      warehouseOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
    } catch {
      warehouseOptions.value = []
    }
  }

  async function loadInventoryTypeOptions() {
    try {
      const res = await getSystemOptionsList('inventory_types')
      const list = (res.data ?? []) as SystemOptionItem[]
      inventoryTypeOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
    } catch {
      inventoryTypeOptions.value = []
    }
  }

  async function loadDepartmentOptions() {
    try {
      const res = await getSystemOptionsList('org_departments')
      const list = (res.data ?? []) as SystemOptionItem[]
      departmentOptions.value = list.map((o) => ({ value: o.value, label: o.value }))
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
