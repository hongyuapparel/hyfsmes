import { computed, onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { registerPick, registerPurchase, type PurchaseItemRow } from '@/api/production-purchase'
import { getAccessoriesList, getFabricList, getFinishedStockList } from '@/api/inventory'
import { getErrorMessage, isErrorHandled, isRequestCanceled } from '@/api/request'
import { formatDisplayNumber } from '@/utils/display-number'

type PickInventorySourceType = 'fabric' | 'accessory' | 'finished'
const PICK_INVENTORY_PAGE_SIZE = 20
const PICK_INVENTORY_SEARCH_DELAY_MS = 300

type UsePurchaseDialogsOptions = {
  currentTab: Ref<string>
  hasSelection: Ref<boolean>
  selectedRows: Ref<PurchaseItemRow[]>
  reload: () => Promise<void>
  reloadTabCounts: () => Promise<void>
  clearSelection: () => void
}

export function usePurchaseDialogs(options: UsePurchaseDialogsOptions) {
  const registerDialog = reactive<{
    visible: boolean
    submitting: boolean
    row: PurchaseItemRow | null
  }>({ visible: false, submitting: false, row: null })
  const registerFormRef = ref<FormInstance>()
  const registerForm = reactive({
    actualPurchaseQuantity: 0,
    unitPrice: '',
    otherCost: '',
    purchaseAmount: '',
    remark: '',
    imageUrl: '',
  })
  const registerRules: FormRules = {
    actualPurchaseQuantity: [{ required: true, message: '请输入实际采购数量', trigger: 'blur' }],
  }

  const pickDialog = reactive<{
    visible: boolean
    submitting: boolean
    row: PurchaseItemRow | null
    index: number
    total: number
  }>({
    visible: false,
    submitting: false,
    row: null,
    index: 0,
    total: 0,
  })
  const pickFormRef = ref<FormInstance>()
  const pickForm = reactive<{
    inventorySourceType: PickInventorySourceType | null
    inventoryId: number | null
    quantity: number | null
    remark: string
  }>({
    inventorySourceType: null,
    inventoryId: null,
    quantity: null,
    remark: '',
  })
  const pickInventoryOptions = ref<
    Array<{ id: number; label: string; availableQuantity: number; imageUrl: string }>
  >([])
  const pickInventoryLoading = ref(false)
  let currentSourceType: PickInventorySourceType | null = null
  let pickInventorySearchTimer: ReturnType<typeof setTimeout> | null = null
  let pickInventoryReqId = 0
  let pickInventoryAbortController: AbortController | null = null
  const pickRules: FormRules = {
    quantity: [
      {
        validator: (_rule, value, callback) => {
          const hasStock = !!(pickForm.inventorySourceType && pickForm.inventoryId)
          if (!hasStock) return callback()
          const qty = Number(value ?? 0)
          if (!Number.isFinite(qty) || qty <= 0) return callback(new Error('选择库存后，调取数量必须大于 0'))
          const selected = pickInventoryOptions.value.find((x) => x.id === pickForm.inventoryId)
          if (selected && qty > selected.availableQuantity) return callback(new Error('调取数量不能大于可用库存'))
          callback()
        },
        trigger: 'blur',
      },
    ],
    remark: [
      {
        validator: (_rule, value, callback) => {
          const hasStock = !!(pickForm.inventorySourceType && pickForm.inventoryId && Number(pickForm.quantity) > 0)
          if (hasStock) return callback()
          if (String(value ?? '').trim()) return callback()
          callback(new Error('未选择库存时请至少填写备注说明'))
        },
        trigger: 'blur',
      },
    ],
  }

  watch(
    () => [registerForm.actualPurchaseQuantity, registerForm.unitPrice, registerForm.otherCost] as const,
    ([qty, unit, other]) => {
      const q = Number(qty) || 0
      const parseNumber = (v: string) => {
        const cleaned = (v ?? '').replace(/[^\d.-]/g, '')
        const n = Number(cleaned)
        return Number.isNaN(n) ? 0 : n
      }
      const u = parseNumber(unit)
      const o = parseNumber(other)
      const total = q * u + o
      registerForm.purchaseAmount = Number.isFinite(total) ? formatDisplayNumber(total) : formatDisplayNumber(0)
    },
    { immediate: true },
  )

  function openRegisterDialog() {
    if (options.selectedRows.value.length === 0) return
    const row = options.selectedRows.value[0]
    registerDialog.row = row
    registerForm.actualPurchaseQuantity = row.actualPurchaseQuantity ?? row.planQuantity ?? 0
    registerForm.unitPrice = row.purchaseUnitPrice ?? ''
    registerForm.otherCost = row.purchaseOtherCost ?? ''
    registerForm.purchaseAmount = row.purchaseAmount ?? ''
    registerForm.remark = row.purchaseRemark ?? ''
    registerForm.imageUrl = row.purchaseImageUrl ?? ''
    registerDialog.visible = true
  }

  function openPickDialog() {
    const row = options.selectedRows.value[0]
    if (!row) return
    pickDialog.row = row
    pickDialog.index = 0
    pickDialog.total = options.selectedRows.value.length
    pickDialog.visible = true
  }

  function onBatchHandle() {
    if (!options.hasSelection.value) return
    if (options.currentTab.value === 'picking') {
      openPickDialog()
      return
    }
    openRegisterDialog()
  }

  function clearPickInventorySearchTimer() {
    if (!pickInventorySearchTimer) return
    clearTimeout(pickInventorySearchTimer)
    pickInventorySearchTimer = null
  }

  function cancelPickInventoryLoad() {
    clearPickInventorySearchTimer()
    pickInventoryReqId += 1
    pickInventoryAbortController?.abort()
    pickInventoryAbortController = null
    pickInventoryLoading.value = false
  }

  async function loadPickInventory(sourceType: PickInventorySourceType | null, name?: string) {
    if (!sourceType) {
      cancelPickInventoryLoad()
      pickInventoryOptions.value = []
      return
    }
    const reqId = pickInventoryReqId + 1
    pickInventoryReqId = reqId
    pickInventoryAbortController?.abort()
    const controller = new AbortController()
    pickInventoryAbortController = controller
    const keyword = name?.trim() || undefined
    pickInventoryLoading.value = true
    try {
      let nextOptions: Array<{ id: number; label: string; availableQuantity: number; imageUrl: string }> = []
      if (sourceType === 'fabric') {
        const res = await getFabricList(
          { name: keyword, skipTotal: true, page: 1, pageSize: PICK_INVENTORY_PAGE_SIZE },
          { signal: controller.signal },
        )
        nextOptions = (res.data?.list ?? []).map((item) => ({
          id: item.id,
          label: `${item.name}（可用:${item.quantity}${item.unit ?? ''}）`,
          availableQuantity: Number(item.quantity) || 0,
          imageUrl: item.imageUrl ?? '',
        }))
      } else if (sourceType === 'accessory') {
        const res = await getAccessoriesList(
          { name: keyword, skipTotal: true, page: 1, pageSize: PICK_INVENTORY_PAGE_SIZE },
          { signal: controller.signal },
        )
        nextOptions = (res.data?.list ?? []).map((item) => ({
          id: item.id,
          label: `${item.name}（可用:${item.quantity}${item.unit ?? ''}）`,
          availableQuantity: Number(item.quantity) || 0,
          imageUrl: item.imageUrl ?? '',
        }))
      } else {
        const res = await getFinishedStockList(
          { tab: 'stored', skuCode: keyword, page: 1, pageSize: PICK_INVENTORY_PAGE_SIZE },
          { signal: controller.signal },
        )
        nextOptions = (res.data?.list ?? []).map((item) => ({
          id: item.id,
          label: `${item.skuCode}（可用:${item.quantity}）`,
          availableQuantity: Number(item.quantity) || 0,
          imageUrl: item.imageUrl ?? '',
        }))
      }
      if (reqId === pickInventoryReqId) pickInventoryOptions.value = nextOptions
    } catch (e: unknown) {
      if (isRequestCanceled(e) || reqId !== pickInventoryReqId) return
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '库存列表加载失败'))
    } finally {
      if (reqId === pickInventoryReqId) {
        pickInventoryLoading.value = false
        if (pickInventoryAbortController === controller) pickInventoryAbortController = null
      }
    }
  }

  async function onPickSourceTypeChange(val: PickInventorySourceType | null) {
    clearPickInventorySearchTimer()
    pickForm.inventoryId = null
    pickInventoryOptions.value = []
    currentSourceType = val
    await loadPickInventory(val)
  }

  function onPickInventorySearch(query: string) {
    clearPickInventorySearchTimer()
    const keyword = query.trim()
    pickInventorySearchTimer = setTimeout(() => {
      pickInventorySearchTimer = null
      void loadPickInventory(currentSourceType, keyword || undefined)
    }, PICK_INVENTORY_SEARCH_DELAY_MS)
  }

  function resetPickForm() {
    pickDialog.row = null
    pickDialog.index = 0
    pickDialog.total = 0
    pickForm.inventorySourceType = null
    pickForm.inventoryId = null
    pickForm.quantity = null
    pickForm.remark = ''
    currentSourceType = null
    cancelPickInventoryLoad()
    pickInventoryOptions.value = []
    pickFormRef.value?.clearValidate()
  }

  async function submitPick() {
    if (!pickDialog.row) return
    const rows = options.selectedRows.value.slice()
    if (!rows.length) return
    pickDialog.submitting = true
    try {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        pickDialog.row = row
        pickDialog.index = i
        pickDialog.total = rows.length
        await pickFormRef.value?.validate()
        await registerPick({
          orderId: row.orderId,
          materialIndex: row.materialIndex,
          inventorySourceType: pickForm.inventorySourceType,
          inventoryId: pickForm.inventoryId,
          quantity: pickForm.quantity,
          remark: pickForm.remark.trim() || null,
        })
      }
      ElMessage.success('领料处理成功')
      pickDialog.visible = false
      await options.reload()
      await options.reloadTabCounts()
      options.clearSelection()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '领料处理失败'))
    } finally {
      pickDialog.submitting = false
    }
  }

  function resetRegisterForm() {
    registerDialog.row = null
    registerForm.actualPurchaseQuantity = 0
    registerForm.purchaseAmount = ''
    registerForm.unitPrice = ''
    registerForm.otherCost = ''
    registerForm.remark = ''
    registerForm.imageUrl = ''
    registerFormRef.value?.clearValidate()
  }

  async function submitRegister() {
    if (!registerDialog.row) return
    await registerFormRef.value?.validate().catch(() => {})
    registerDialog.submitting = true
    try {
      await registerPurchase({
        orderId: registerDialog.row.orderId,
        materialIndex: registerDialog.row.materialIndex,
        actualPurchaseQuantity: registerForm.actualPurchaseQuantity,
        unitPrice: registerForm.unitPrice.trim() || '0',
        otherCost: registerForm.otherCost.trim() || '0',
        remark: registerForm.remark.trim(),
        imageUrl: registerForm.imageUrl.trim(),
      })
      ElMessage.success('登记成功')
      registerDialog.visible = false
      await options.reload()
      await options.reloadTabCounts()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '登记失败'))
    } finally {
      registerDialog.submitting = false
    }
  }

  const batchButtonLabel = computed(() =>
    options.currentTab.value === 'picking' ? '领料' : '登记实际采购',
  )

  onBeforeUnmount(() => {
    cancelPickInventoryLoad()
  })

  return {
    registerDialog,
    registerFormRef,
    registerForm,
    registerRules,
    pickDialog,
    pickFormRef,
    pickForm,
    pickInventoryOptions,
    pickInventoryLoading,
    pickRules,
    batchButtonLabel,
    onBatchHandle,
    onPickSourceTypeChange,
    onPickInventorySearch,
    resetPickForm,
    submitPick,
    resetRegisterForm,
    submitRegister,
  }
}
