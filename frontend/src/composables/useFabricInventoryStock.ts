import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getAllCustomerCompanyOptions } from '@/api/customers'
import {
  getFabricList,
  getFabricSupplierOptions,
  type FabricItem,
  type FabricSupplierOption,
} from '@/api/inventory'
import { getDictItems } from '@/api/dicts'
import type { SystemOptionItem } from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useTableSort } from '@/composables/useTableSort'

export function useFabricInventoryStock() {
  const filter = reactive<{ name: string; customerName: string; inventoryTypeId: number | null }>({
    name: '',
    customerName: '',
    inventoryTypeId: null,
  })
  const inboundDateRange = ref<[string, string] | null>(null)
  const nameLabelVisible = ref(false)
  const list = ref<FabricItem[]>([])
  const loading = ref(false)
  /** 当前筛选下全量匹配的总数量（接口返回，跨分页） */
  const stockTotalQuantity = ref(0)
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
  const selectedRows = ref<FabricItem[]>([])
  const customerOptions = ref<{ label: string; value: string }[]>([])
  const fabricSupplierOptions = ref<FabricSupplierOption[]>([])
  const fabricSupplierOptionsLoading = ref(false)
  const warehouseOptions = ref<{ id: number; label: string }[]>([])
  const inventoryTypeOptions = ref<{ id: number; label: string }[]>([])

  const fabricStockTableRef = ref()
  const fabricStockShellRef = ref<HTMLElement | null>(null)
  const { tableHeight: fabricStockTableHeight } = useFlexShellTableHeight(fabricStockShellRef)
  const {
    onHeaderDragEnd: onFabricStockHeaderDragEnd,
    restoreColumnWidths: restoreFabricStockColumnWidths,
  } = useTableColumnWidthPersist('inventory-fabric-stock')
  const { onSortChange, sortParams } = useTableSort(() => {
    pagination.page = 1
    void load()
  })

  async function load() {
    loading.value = true
    try {
      const [startDate, endDate] =
        inboundDateRange.value && inboundDateRange.value.length === 2 ? inboundDateRange.value : ['', '']
      const sort = sortParams()
      const sortField = sort.sortField === 'quantity' ? sort.sortField : undefined
      const res = await getFabricList({
        name: filter.name || undefined,
        customerName: filter.customerName || undefined,
        inventoryTypeId: filter.inventoryTypeId ?? undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
        sortField,
        sortOrder: sortField ? sort.sortOrder : undefined,
      })
      const data = res.data
      if (data) {
        list.value = data.list ?? []
        pagination.total = data.total ?? 0
        stockTotalQuantity.value = Number(data.totalQuantity ?? 0) || 0
        restoreFabricStockColumnWidths(fabricStockTableRef.value)
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      loading.value = false
    }
  }

  function onSearch(byUser = false) {
    if (byUser && filter.name && String(filter.name).trim()) nameLabelVisible.value = true
    pagination.page = 1
    load()
  }

  let searchTimer: ReturnType<typeof setTimeout> | null = null
  function debouncedSearch() {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      searchTimer = null
      onSearch(false)
    }, 400)
  }

  function onReset() {
    nameLabelVisible.value = false
    filter.name = ''
    filter.customerName = ''
    filter.inventoryTypeId = null
    inboundDateRange.value = null
    pagination.page = 1
    load()
  }

  function onPageSizeChange() {
    pagination.page = 1
    load()
  }

  function onSelectionChange(rows: FabricItem[]) {
    selectedRows.value = rows ?? []
  }

  async function loadCustomerOptions() {
    try {
      const list = await getAllCustomerCompanyOptions({ sortBy: 'companyName', sortOrder: 'asc' })
      customerOptions.value = list.map((c) => ({ label: c.companyName, value: c.companyName }))
    } catch {
      console.warn('客户选项加载失败')
    }
  }

  async function loadFabricSupplierOptions() {
    fabricSupplierOptionsLoading.value = true
    try {
      const res = await getFabricSupplierOptions()
      fabricSupplierOptions.value = res.data ?? []
    } catch (e: unknown) {
      fabricSupplierOptions.value = []
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      fabricSupplierOptionsLoading.value = false
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

  return {
    filter,
    inboundDateRange,
    nameLabelVisible,
    list,
    loading,
    stockTotalQuantity,
    pagination,
    selectedRows,
    customerOptions,
    fabricSupplierOptions,
    fabricSupplierOptionsLoading,
    warehouseOptions,
    inventoryTypeOptions,
    fabricStockTableRef,
    fabricStockShellRef,
    fabricStockTableHeight,
    onFabricStockHeaderDragEnd,
    onSortChange,
    load,
    onSearch,
    debouncedSearch,
    onReset,
    onPageSizeChange,
    onSelectionChange,
    loadCustomerOptions,
    loadFabricSupplierOptions,
    loadWarehouseOptions,
    loadInventoryTypeOptions,
  }
}
