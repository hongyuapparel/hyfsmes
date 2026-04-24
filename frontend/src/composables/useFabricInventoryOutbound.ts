import { computed, reactive, ref, type Ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  fabricOutbound,
  getFabricOutboundRecords,
  getFabricPickupUserOptions,
  type FabricItem,
  type FabricOutboundRecord,
  type FabricPickupUserOption,
} from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { getFilterRangeStyle } from '@/composables/useFilterBarHelpers'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'

interface UseFabricInventoryOutboundOptions {
  selectedRows: Ref<FabricItem[]>
  reloadStock: () => void | Promise<void>
}

export function useFabricInventoryOutbound(options: UseFabricInventoryOutboundOptions) {
  const outboundFilter = reactive<{
    name: string
    customerName: string
    dateRange: [string, string] | []
  }>({ name: '', customerName: '', dateRange: [] })
  const outboundList = ref<FabricOutboundRecord[]>([])
  const outboundLoading2 = ref(false)
  const outboundPagination = reactive({ page: 1, pageSize: 20, total: 0 })

  const fabricOutboundTableRef = ref()
  const fabricOutboundShellRef = ref<HTMLElement | null>(null)
  const { tableHeight: fabricOutboundTableHeight } = useFlexShellTableHeight(fabricOutboundShellRef)
  const {
    onHeaderDragEnd: onFabricOutboundHeaderDragEnd,
    restoreColumnWidths: restoreFabricOutboundColumnWidths,
  } = useTableColumnWidthPersist('inventory-fabric-outbounds')

  const outboundDialog = reactive<{
    visible: boolean
    submitting: boolean
    row: FabricItem | null
  }>({ visible: false, submitting: false, row: null })
  const outboundFormRef = ref<FormInstance>()
  const outboundForm = reactive({
    pickupUserId: null as number | null,
    quantity: 0,
    photoUrl: '',
    remark: '',
  })
  const outboundRules: FormRules = {
    pickupUserId: [{ required: true, message: '请选择领取人', trigger: 'change' }],
    quantity: [{ required: true, message: '请输入出库数量', trigger: 'blur' }],
    remark: [{ required: true, message: '请填写谁领走及用途', trigger: 'blur' }],
  }
  const outboundMaxQty = computed(() => {
    const row = outboundDialog.row
    if (!row) return 0
    const q = parseFloat(String(row.quantity))
    return Number.isFinite(q) ? q : 0
  })
  const fabricPickupUserOptions = ref<FabricPickupUserOption[]>([])

  function getInventoryOutboundRangeStyle(v: [string, string] | []) {
    const hasValue = Array.isArray(v) && v.length === 2
    if (!hasValue) return getFilterRangeStyle(v)
    const w = '240px'
    return { ...getFilterRangeStyle(v), width: w, minWidth: w, flex: `0 0 ${w}` }
  }

  async function loadOutbounds() {
    outboundLoading2.value = true
    try {
      const [startDate, endDate] =
        Array.isArray(outboundFilter.dateRange) && outboundFilter.dateRange.length === 2
          ? outboundFilter.dateRange
          : ['', '']
      const res = await getFabricOutboundRecords({
        name: outboundFilter.name || undefined,
        customerName: outboundFilter.customerName || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: outboundPagination.page,
        pageSize: outboundPagination.pageSize,
      })
      const data = res.data
      outboundList.value = data?.list ?? []
      outboundPagination.total = data?.total ?? 0
      restoreFabricOutboundColumnWidths(fabricOutboundTableRef.value)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      outboundLoading2.value = false
    }
  }

  function onOutboundSearch(_byUser = false) {
    outboundPagination.page = 1
    loadOutbounds()
  }

  function onOutboundReset() {
    outboundFilter.name = ''
    outboundFilter.customerName = ''
    outboundFilter.dateRange = []
    outboundPagination.page = 1
    loadOutbounds()
  }

  function onOutboundPageSizeChange() {
    outboundPagination.page = 1
    loadOutbounds()
  }

  async function loadFabricPickupUserOptions() {
    try {
      const res = await getFabricPickupUserOptions()
      fabricPickupUserOptions.value = res.data ?? []
    } catch {
      fabricPickupUserOptions.value = []
    }
  }

  function openOutboundDialog(row?: FabricItem) {
    const target = row ?? options.selectedRows.value[0]
    if (!target) {
      ElMessage.warning('请先选中 1 条面料记录')
      return
    }
    outboundDialog.row = target
    const q = parseFloat(String(target.quantity))
    outboundForm.pickupUserId = null
    outboundForm.quantity = Number.isFinite(q) && q > 0 ? Math.min(1, q) : 0
    outboundForm.photoUrl = ''
    outboundForm.remark = ''
    outboundDialog.visible = true
  }

  function resetOutboundForm() {
    outboundDialog.row = null
    outboundForm.pickupUserId = null
    outboundForm.quantity = 0
    outboundForm.photoUrl = ''
    outboundForm.remark = ''
    outboundFormRef.value?.clearValidate()
  }

  async function submitOutbound() {
    if (!outboundDialog.row) return
    if (!outboundForm.pickupUserId || !outboundForm.photoUrl || !outboundForm.remark?.trim()) {
      ElMessage.warning('请选择领取人，并上传出库照片、填写备注（谁领走、用途）')
      return
    }
    await outboundFormRef.value?.validate().catch(() => {})
    outboundDialog.submitting = true
    try {
      await fabricOutbound({
        id: outboundDialog.row.id,
        quantity: outboundForm.quantity,
        photoUrl: outboundForm.photoUrl,
        remark: outboundForm.remark,
        pickupUserId: outboundForm.pickupUserId,
      })
      ElMessage.success('出库成功')
      outboundDialog.visible = false
      options.selectedRows.value = []
      await options.reloadStock()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      outboundDialog.submitting = false
    }
  }

  return {
    outboundFilter,
    outboundList,
    outboundLoading2,
    outboundPagination,
    fabricOutboundTableRef,
    fabricOutboundShellRef,
    fabricOutboundTableHeight,
    onFabricOutboundHeaderDragEnd,
    outboundDialog,
    outboundFormRef,
    outboundForm,
    outboundRules,
    outboundMaxQty,
    fabricPickupUserOptions,
    getInventoryOutboundRangeStyle,
    loadOutbounds,
    onOutboundSearch,
    onOutboundReset,
    onOutboundPageSizeChange,
    loadFabricPickupUserOptions,
    openOutboundDialog,
    resetOutboundForm,
    submitOutbound,
  }
}
