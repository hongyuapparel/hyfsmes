import { reactive, ref, type Ref } from 'vue'
import { ElMessage, type FormRules } from 'element-plus'
import {
  getAccessoryOutboundUserOptions,
  manualAccessoryOutbound,
  type AccessoryItem,
  type AccessoryOutboundUserOption,
} from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export interface AccessoriesOutboundDialogExpose {
  validate: () => Promise<unknown> | undefined
  clearValidate: () => void
}

type LoadHandler = () => Promise<void> | void

export function useAccessoriesOutboundDialog(
  selectedRows: Ref<AccessoryItem[]>,
  reloadList: LoadHandler,
  dialogRef: Ref<AccessoriesOutboundDialogExpose | undefined>,
) {
  const outboundDialog = reactive<{ visible: boolean; submitting: boolean }>({
    visible: false,
    submitting: false,
  })
  const outboundUserOptions = ref<AccessoryOutboundUserOption[]>([])
  const outboundForm = reactive<{
    accessoryId: number | null
    accessoryName: string
    pickupUserId: number | null
    quantity: number
    maxQuantity: number
    remark: string
  }>({
    accessoryId: null,
    accessoryName: '',
    pickupUserId: null,
    quantity: 1,
    maxQuantity: 0,
    remark: '',
  })
  const outboundRules: FormRules = {
    pickupUserId: [{ required: true, message: '请选择领取人', trigger: 'change' }],
    quantity: [{ required: true, message: '请输入出库数量', trigger: 'blur' }],
  }

  async function ensureOutboundUserOptionsLoaded() {
    if (outboundUserOptions.value.length) return
    try {
      const res = await getAccessoryOutboundUserOptions()
      outboundUserOptions.value = res.data ?? []
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  async function openOutboundDialog() {
    if (selectedRows.value.length !== 1) {
      ElMessage.warning('请先选中 1 条辅料记录')
      return
    }
    const row = selectedRows.value[0]
    outboundForm.accessoryId = row.id
    outboundForm.accessoryName = row.name
    outboundForm.maxQuantity = Number(row.quantity) || 0
    outboundForm.quantity = outboundForm.maxQuantity > 0 ? 1 : 0
    outboundForm.pickupUserId = null
    outboundForm.remark = ''
    await ensureOutboundUserOptionsLoaded()
    outboundDialog.visible = true
  }

  function resetOutboundDialog() {
    dialogRef.value?.clearValidate()
  }

  async function submitOutbound() {
    if (!outboundForm.accessoryId) return
    await dialogRef.value?.validate?.().catch(() => {})
    if (!outboundForm.pickupUserId) return
    const pickupUser = outboundUserOptions.value.find((u) => u.id === outboundForm.pickupUserId)
    const pickupUserLabel = pickupUser ? (pickupUser.displayName || pickupUser.username) : ''
    if (!pickupUserLabel) {
      ElMessage.warning('领取人无效，请重新选择')
      return
    }
    const qty = Number(outboundForm.quantity) || 0
    if (qty <= 0) {
      ElMessage.warning('出库数量不合法')
      return
    }
    if (qty > (Number(outboundForm.maxQuantity) || 0)) {
      ElMessage.warning('出库数量不能大于当前库存')
      return
    }
    outboundDialog.submitting = true
    try {
      const remark = [`领取人：${pickupUserLabel}`, (outboundForm.remark ?? '').trim()].filter(Boolean).join('；')
      await manualAccessoryOutbound({
        accessoryId: outboundForm.accessoryId,
        quantity: qty,
        remark,
      })
      ElMessage.success('出库成功')
      outboundDialog.visible = false
      selectedRows.value = []
      await reloadList()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      outboundDialog.submitting = false
    }
  }

  return {
    outboundDialog,
    outboundUserOptions,
    outboundForm,
    outboundRules,
    openOutboundDialog,
    resetOutboundDialog,
    submitOutbound,
  }
}
