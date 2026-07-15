import { onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage, type FormRules } from 'element-plus'
import { editCompletedPick, registerPick, type PurchaseItemRow } from '@/api/production-purchase'
import { getAccessoriesList, getFabricList, getFinishedStockList } from '@/api/inventory'
import { getErrorMessage, isErrorHandled, isRequestCanceled } from '@/api/request'

export type PickInventorySourceType = 'fabric' | 'accessory' | 'finished'

export interface PurchasePickDialogState {
  visible: boolean
  submitting: boolean
  mode: 'register' | 'edit'
  row: PurchaseItemRow | null
  index: number
  total: number
}

export interface PurchasePickForm {
  inventorySourceType: PickInventorySourceType | null
  inventoryId: number | null
  quantity: number | null
  remark: string
}

export interface PurchasePickInventoryOption {
  id: number
  label: string
  availableQuantity: number
  imageUrl: string
}

type UsePurchasePickDialogOptions = {
  selectedRows: { value: PurchaseItemRow[] }
  reload: () => Promise<void>
  reloadTabCounts: () => Promise<void>
  clearSelection: () => void
}

const PICK_INVENTORY_PAGE_SIZE = 20
const PICK_INVENTORY_SEARCH_DELAY_MS = 300

export function usePurchasePickDialog(options: UsePurchasePickDialogOptions) {
  const pickDialog = reactive<PurchasePickDialogState>({
    visible: false,
    submitting: false,
    mode: 'register',
    row: null,
    index: 0,
    total: 0,
  })
  const pickForm = reactive<PurchasePickForm>({
    inventorySourceType: null,
    inventoryId: null,
    quantity: null,
    remark: '',
  })
  const pickInventoryOptions = ref<PurchasePickInventoryOption[]>([])
  const pickInventoryLoading = ref(false)
  let currentSourceType: PickInventorySourceType | null = null
  let pickDefaultKeyword: string | undefined
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
          if (String(value ?? '').trim()) return callback()
          if (pickDialog.mode === 'edit') {
            return callback(new Error('请填写纠错备注'))
          }
          const hasStock = !!(pickForm.inventorySourceType && pickForm.inventoryId && Number(pickForm.quantity) > 0)
          if (hasStock) return callback()
          callback(new Error('未选择库存时请至少填写备注说明'))
        },
        trigger: 'blur',
      },
    ],
  }

  function openPickDialog() {
    const pending = options.selectedRows.value.filter(
      (r) => r.processRoute === 'picking' && r.pickStatus !== 'completed',
    )
    const row = pending[0]
    if (!row) {
      ElMessage.warning('请选择待领料物料；已完成请用「编辑已提交领料」')
      return
    }
    pickDialog.mode = 'register'
    pickDialog.row = row
    pickDialog.index = 0
    pickDialog.total = pending.length
    pickDialog.visible = true
    pickForm.inventorySourceType = 'fabric'
    pickForm.inventoryId = null
    pickForm.quantity = null
    pickForm.remark = ''
    currentSourceType = 'fabric'
    pickDefaultKeyword = computePickDefaultKeyword('fabric', row)
    void loadPickInventory('fabric', pickDefaultKeyword, true)
  }

  function openEditCompletedPickDialog() {
    const completed = options.selectedRows.value.filter(
      (r) => r.processRoute === 'picking' && r.pickStatus === 'completed',
    )
    const row = completed[0]
    if (!row) {
      ElMessage.warning('请选择已领料完成的物料')
      return
    }
    pickDialog.mode = 'edit'
    pickDialog.row = row
    pickDialog.index = 0
    pickDialog.total = completed.length
    pickDialog.visible = true
    pickForm.inventorySourceType = null
    pickForm.inventoryId = null
    pickForm.quantity = null
    pickForm.remark = (row.pickRemark ?? '').trim()
    currentSourceType = null
    pickDefaultKeyword = undefined
    cancelPickInventoryLoad()
    pickInventoryOptions.value = []
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

  async function loadPickInventory(
    sourceType: PickInventorySourceType | null,
    name?: string,
    autoSelectFirst = false,
  ) {
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
      let nextOptions: PurchasePickInventoryOption[] = []
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
      if (reqId === pickInventoryReqId) {
        pickInventoryOptions.value = nextOptions
        if (autoSelectFirst && pickForm.inventoryId == null && nextOptions.length) {
          pickForm.inventoryId = nextOptions[0].id
        }
      }
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

  function computePickDefaultKeyword(
    sourceType: PickInventorySourceType | null,
    row: PurchaseItemRow | null,
  ): string | undefined {
    if (!sourceType || !row) return undefined
    if (sourceType === 'finished') return row.skuCode?.trim() || undefined
    if (sourceType === 'fabric') return row.color?.trim() || row.materialName?.trim() || undefined
    return row.materialName?.trim() || row.color?.trim() || undefined
  }

  async function onPickSourceTypeChange(val: PickInventorySourceType | null) {
    clearPickInventorySearchTimer()
    pickForm.inventoryId = null
    pickInventoryOptions.value = []
    currentSourceType = val
    pickDefaultKeyword = computePickDefaultKeyword(val, pickDialog.row)
    await loadPickInventory(val, pickDefaultKeyword, true)
  }

  function onPickInventorySearch(query: string) {
    clearPickInventorySearchTimer()
    const keyword = query.trim()
    pickInventorySearchTimer = setTimeout(() => {
      pickInventorySearchTimer = null
      void loadPickInventory(currentSourceType, keyword || pickDefaultKeyword)
    }, PICK_INVENTORY_SEARCH_DELAY_MS)
  }

  function resetPickForm() {
    pickDialog.mode = 'register'
    pickDialog.row = null
    pickDialog.index = 0
    pickDialog.total = 0
    pickForm.inventorySourceType = null
    pickForm.inventoryId = null
    pickForm.quantity = null
    pickForm.remark = ''
    currentSourceType = null
    pickDefaultKeyword = undefined
    cancelPickInventoryLoad()
    pickInventoryOptions.value = []
  }

  async function submitPick() {
    if (!pickDialog.row) return
    if (pickDialog.mode === 'edit') {
      if (!pickForm.remark.trim()) {
        ElMessage.warning('请填写纠错备注')
        return
      }
    }
    const editRows =
      pickDialog.mode === 'edit'
        ? options.selectedRows.value.filter(
            (r) => r.processRoute === 'picking' && r.pickStatus === 'completed',
          )
        : []
    const registerRows =
      pickDialog.mode === 'register'
        ? options.selectedRows.value.filter(
            (r) => r.processRoute === 'picking' && r.pickStatus !== 'completed',
          )
        : []
    if (pickDialog.mode === 'edit' && !editRows.length) {
      ElMessage.warning('请选择已领料完成的物料')
      return
    }
    if (pickDialog.mode === 'register' && !registerRows.length) {
      ElMessage.warning('请选择待领料物料')
      return
    }

    pickDialog.submitting = true
    try {
      if (pickDialog.mode === 'edit') {
        const remark = pickForm.remark.trim()
        for (let i = 0; i < editRows.length; i++) {
          const row = editRows[i]
          pickDialog.row = row
          pickDialog.index = i
          pickDialog.total = editRows.length
          await editCompletedPick({
            orderId: row.orderId,
            materialIndex: row.materialIndex,
            remark,
          })
        }
        ElMessage.success('已保存领料纠错备注（未重新扣库存）')
      } else {
        for (let i = 0; i < registerRows.length; i++) {
          const row = registerRows[i]
          pickDialog.row = row
          pickDialog.index = i
          pickDialog.total = registerRows.length
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
      }
      pickDialog.visible = false
      await options.reload()
      await options.reloadTabCounts()
      options.clearSelection()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) {
        ElMessage.error(getErrorMessage(e, pickDialog.mode === 'edit' ? '领料纠错失败' : '领料处理失败'))
      }
    } finally {
      pickDialog.submitting = false
    }
  }

  onBeforeUnmount(() => {
    cancelPickInventoryLoad()
  })

  return {
    pickDialog,
    pickForm,
    pickInventoryOptions,
    pickInventoryLoading,
    pickRules,
    onPickSourceTypeChange,
    onPickInventorySearch,
    openPickDialog,
    openEditCompletedPickDialog,
    resetPickForm,
    submitPick,
  }
}
