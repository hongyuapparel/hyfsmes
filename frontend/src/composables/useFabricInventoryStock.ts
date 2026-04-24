import { nextTick, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { getCustomers, type CustomerItem } from '@/api/customers'
import {
  createFabric,
  getFabricList,
  getFabricOperationLogs,
  getFabricSupplierOptions,
  type FabricItem,
  type FabricOperationLog,
  type FabricSupplierOption,
  updateFabric,
} from '@/api/inventory'
import { getSystemOptionsList, type SystemOptionItem } from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'

export function useFabricInventoryStock() {
  const filter = reactive({ name: '', customerName: '' })
  const inboundDateRange = ref<[string, string] | null>(null)
  const nameLabelVisible = ref(false)
  const list = ref<FabricItem[]>([])
  const loading = ref(false)
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
  const selectedRows = ref<FabricItem[]>([])
  const customerOptions = ref<{ label: string; value: string }[]>([])
  const fabricSupplierOptions = ref<FabricSupplierOption[]>([])
  /** 每次打开表单递增，重置下拉内部筛选关键字，避免从其它页返回后仍停留在旧关键字导致「无匹配」 */
  const fabricSupplierSelectKey = ref(0)
  const fabricSupplierOptionsLoading = ref(false)
  const warehouseOptions = ref<{ id: number; label: string }[]>([])

  const fabricStockTableRef = ref()
  const fabricStockShellRef = ref<HTMLElement | null>(null)
  const { tableHeight: fabricStockTableHeight } = useFlexShellTableHeight(fabricStockShellRef)
  const {
    onHeaderDragEnd: onFabricStockHeaderDragEnd,
    restoreColumnWidths: restoreFabricStockColumnWidths,
  } = useTableColumnWidthPersist('inventory-fabric-stock')

  const formDialog = reactive<{ visible: boolean; submitting: boolean; isEdit: boolean }>({
    visible: false,
    submitting: false,
    isEdit: false,
  })
  const quickAddSource = ref<FabricItem | null>(null)
  const quickAddBaseQuantity = ref(0)
  const editId = ref<number | null>(null)
  const formRef = ref<FormInstance>()
  const form = reactive({
    name: '',
    quantity: 0,
    unit: '米',
    customerName: '',
    supplierId: null as number | null,
    warehouseId: null as number | null,
    storageLocation: '',
    imageUrl: '',
    remark: '',
  })
  const formRules: FormRules = {
    name: [{ required: true, message: '请输入面料名称', trigger: 'blur' }],
  }

  const detailDrawer = reactive<{
    visible: boolean
    row: FabricItem | null
    loading: boolean
    logs: FabricOperationLog[]
  }>({ visible: false, row: null, loading: false, logs: [] })

  async function load() {
    loading.value = true
    try {
      const [startDate, endDate] =
        inboundDateRange.value && inboundDateRange.value.length === 2 ? inboundDateRange.value : ['', '']
      const res = await getFabricList({
        name: filter.name || undefined,
        customerName: filter.customerName || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      })
      const data = res.data
      if (data) {
        list.value = data.list ?? []
        pagination.total = data.total ?? 0
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
      const res = await getSystemOptionsList('warehouses')
      const list = (res.data ?? []) as SystemOptionItem[]
      warehouseOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
    } catch {
      warehouseOptions.value = []
    }
  }

  async function openForm(row: FabricItem | null) {
    quickAddSource.value = null
    quickAddBaseQuantity.value = 0
    formDialog.isEdit = !!row
    editId.value = row ? row.id : null
    const seed = row ?? (selectedRows.value.length === 1 ? selectedRows.value[0]! : null)
    if (seed) {
      form.name = seed.name
      form.unit = seed.unit ?? '米'
      form.customerName = seed.customerName ?? ''
      form.supplierId = seed.supplierId != null && seed.supplierId > 0 ? seed.supplierId : null
      form.warehouseId = seed.warehouseId != null && seed.warehouseId > 0 ? seed.warehouseId : null
      form.storageLocation = seed.storageLocation ?? ''
      form.imageUrl = seed.imageUrl ?? ''
      form.remark = seed.remark ?? ''
      if (row) {
        form.quantity = parseFloat(String(seed.quantity)) || 0
      } else {
        quickAddSource.value = seed
        quickAddBaseQuantity.value = parseFloat(String(seed.quantity)) || 0
        form.quantity = 0
      }
    } else {
      form.name = ''
      form.quantity = 0
      form.unit = '米'
      form.customerName = ''
      form.supplierId = null
      form.warehouseId = null
      form.storageLocation = ''
      form.imageUrl = ''
      form.remark = ''
    }
    fabricSupplierSelectKey.value += 1
    formDialog.visible = true
    await nextTick()
    await loadFabricSupplierOptions()
  }

  function resetForm() {
    formRef.value?.clearValidate()
  }

  async function submitForm() {
    await formRef.value?.validate().catch(() => {})
    formDialog.submitting = true
    try {
      if (formDialog.isEdit && editId.value != null) {
        await updateFabric(editId.value, {
          name: form.name,
          quantity: form.quantity,
          unit: form.unit,
          customerName: form.customerName || undefined,
          imageUrl: form.imageUrl || undefined,
          remark: form.remark,
          supplierId: form.supplierId,
          warehouseId: form.warehouseId,
          storageLocation: form.storageLocation,
        })
        ElMessage.success('保存成功')
      } else {
        const inputQty = Number(form.quantity) || 0
        if (quickAddSource.value) {
          if (inputQty <= 0) {
            ElMessage.warning('请输入大于 0 的新增数量')
            return
          }
          await updateFabric(quickAddSource.value.id, {
            name: form.name,
            quantity: quickAddBaseQuantity.value + inputQty,
            unit: form.unit,
            customerName: form.customerName || undefined,
            imageUrl: form.imageUrl || undefined,
            remark: form.remark,
            supplierId: form.supplierId,
            warehouseId: form.warehouseId,
            storageLocation: form.storageLocation,
          })
          ElMessage.success('库存增加成功')
        } else {
          await createFabric({
            name: form.name,
            quantity: form.quantity,
            unit: form.unit,
            customerName: form.customerName || undefined,
            imageUrl: form.imageUrl || undefined,
            remark: form.remark,
            supplierId: form.supplierId,
            warehouseId: form.warehouseId,
            storageLocation: form.storageLocation,
          })
          ElMessage.success('新增成功')
        }
      }
      formDialog.visible = false
      load()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      formDialog.submitting = false
    }
  }

  function formatLogAction(action: string) {
    if (action === 'create') return '新建'
    if (action === 'update') return '编辑'
    if (action === 'outbound') return '出库'
    if (action === 'delete') return '删除'
    return action || '操作'
  }

  async function openDetail(row: FabricItem) {
    detailDrawer.row = row
    detailDrawer.visible = true
    detailDrawer.loading = true
    try {
      const res = await getFabricOperationLogs(row.id)
      detailDrawer.logs = res.data ?? []
    } catch (e: unknown) {
      detailDrawer.logs = []
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      detailDrawer.loading = false
    }
  }

  return {
    filter,
    inboundDateRange,
    nameLabelVisible,
    list,
    loading,
    pagination,
    selectedRows,
    customerOptions,
    fabricSupplierOptions,
    fabricSupplierSelectKey,
    fabricSupplierOptionsLoading,
    warehouseOptions,
    fabricStockTableRef,
    fabricStockShellRef,
    fabricStockTableHeight,
    onFabricStockHeaderDragEnd,
    formDialog,
    quickAddSource,
    formRef,
    form,
    formRules,
    detailDrawer,
    load,
    onSearch,
    debouncedSearch,
    onReset,
    onPageSizeChange,
    onSelectionChange,
    loadCustomerOptions,
    loadFabricSupplierOptions,
    loadWarehouseOptions,
    openForm,
    resetForm,
    submitForm,
    formatLogAction,
    openDetail,
  }
}
