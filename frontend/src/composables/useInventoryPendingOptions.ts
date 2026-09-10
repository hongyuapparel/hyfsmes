import { ref } from 'vue'
import { getDictItems } from '@/api/dicts'
import { getPendingPickupUserOptions, type FinishedPickupUserOption } from '@/api/inventory'
import type { SystemOptionItem } from '@/api/system-options'

export function useInventoryPendingOptions() {
  const warehouseOptions = ref<{ id: number; label: string }[]>([])
  const inventoryTypeOptions = ref<{ id: number; label: string }[]>([])
  const departmentOptions = ref<{ value: string; label: string }[]>([])
  const pickupUserOptions = ref<FinishedPickupUserOption[]>([])
  async function loadWarehouseOptions() {
    try {
      const res = await getDictItems('warehouses')
      const list = (res.data ?? []) as SystemOptionItem[]
      warehouseOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
    } catch {
      warehouseOptions.value = []
    }
  }

  async function loadDepartmentOptions() {
    try {
      const res = await getDictItems('org_departments')
      const list = (res.data ?? []) as SystemOptionItem[]
      departmentOptions.value = list.map((o) => ({ value: o.value, label: o.value }))
    } catch {
      departmentOptions.value = []
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

  async function loadPickupUserOptions() {
    try {
      const res = await getPendingPickupUserOptions()
      pickupUserOptions.value = res.data ?? []
    } catch {
      pickupUserOptions.value = []
    }
  }

  async function loadDialogOptions() {
    await Promise.all([
      loadWarehouseOptions(),
      loadInventoryTypeOptions(),
      loadDepartmentOptions(),
      loadPickupUserOptions(),
    ])
  }

  return { warehouseOptions, inventoryTypeOptions, departmentOptions, pickupUserOptions, loadDialogOptions }
}
