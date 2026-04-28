import { computed, reactive, ref, watch, type Ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { registerPick, registerPurchase, type PurchaseItemRow } from '@/api/production-purchase'
import { getAccessoriesList, getFabricList, getFinishedStockList } from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { formatDisplayNumber } from '@/utils/display-number'

type PickInventorySourceType = 'fabric' | 'accessory' | 'finished'

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

  async function loadPickInventory(sourceType: PickInventorySourceType | null, name?: string) {
    if (!sourceType) return
    pickInventoryLoading.value = true
    try {
      if (sourceType === 'fabric') {
        const res = await getFabricList({ name: name || undefined, page: 1, pageSize: 100 })
        pickInventoryOptions.value = (res.data?.list ?? []).map((item) => ({
          id: item.id,
          label: `${item.name}（可用:${item.quantity}${item.unit ?? ''}）`,
          availableQuantity: Number(item.quantity) || 0,
          imageUrl: item.imageUrl ?? '',
        }))
        return
      }
      if (sourceType === 'accessory') {
        const res = await getAccessoriesList({ name: name || undefined, page: 1, pageSize: 100 })
        pickInventoryOptions.value = (res.data?.list ?? []).map((item) => ({
          id: item.id,
          label: `${item.name}（可用:${item.quantity}${item.unit ?? ''}）`,
          availableQuantity: Number(item.quantity) || 0,
          imageUrl: item.imageUrl ?? '',
        }))
        return
      }
      const res = await getFinishedStockList({ tab: 'stored', page: 1, pageSize: 100 })
      pickInventoryOptions.value = (res.data?.list ?? []).map((item) => ({
        id: item.id,
        label: `${item.skuCode}（可用:${item.quantity}）`,
        availableQuantity: Number(item.quantity) || 0,
        imageUrl: item.imageUrl ?? '',
      }))
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '库存列表加载失败'))
    } finally {
      pickInventoryLoading.value = false
    }
  }

  async function onPickSourceTypeChange(val: PickInventorySourceType | null) {
    pickForm.inventoryId = null
    pickInventoryOptions.value = []
    currentSourceType = val
    await loadPickInventory(val)
  }

  async function onPickInventorySearch(query: string) {
    await loadPickInventory(currentSourceType, query.trim() || undefined)
  }

  function resetPickForm() {
    pickDialog.row = null
    pickDialog.index = 0
    pickDialog.total = 0
    pickForm.inventorySourceType = null
    pickForm.inventoryId = null
    pickForm.quantity = null
    pickForm.remark = ''
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
