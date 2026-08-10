import { computed, reactive, ref, type Ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  fabricOutbound,
  getFabricPickupUserOptions,
  type FabricItem,
  type FabricPickupUserOption,
} from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'

interface UseFabricInventoryOutboundOptions {
  selectedRows: Ref<FabricItem[]>
  reloadStock: () => void | Promise<void>
  reloadOutbounds: () => void | Promise<void>
  clearSelection: () => void
}

export function useFabricInventoryOutbound(options: UseFabricInventoryOutboundOptions) {
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
  const outboundUnitPrice = computed(() => outboundDialog.row?.unitPrice ?? null)
  const outboundAmount = computed(() => {
    if (outboundUnitPrice.value == null) return null
    return Number(outboundUnitPrice.value) * Number(outboundForm.quantity || 0)
  })
  const fabricPickupUserOptions = ref<FabricPickupUserOption[]>([])

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
    try {
      await outboundFormRef.value?.validate()
    } catch {
      return
    }
    if (outboundDialog.row.unitPrice == null) {
      try {
        await ElMessageBox.confirm(
          '该面料当前暂未计价。本次出库会正常扣减库存，但出库单价和金额将记录为“未计价”，之后补价也不会回改本次记录。是否继续？',
          '未计价出库确认',
          { type: 'warning', confirmButtonText: '继续出库', cancelButtonText: '取消' },
        )
      } catch {
        return
      }
    }
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
      options.clearSelection()
      await options.reloadStock()
      await options.reloadOutbounds()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      outboundDialog.submitting = false
    }
  }

  return {
    outboundDialog,
    outboundFormRef,
    outboundForm,
    outboundRules,
    outboundMaxQty,
    outboundUnitPrice,
    outboundAmount,
    fabricPickupUserOptions,
    loadFabricPickupUserOptions,
    openOutboundDialog,
    resetOutboundForm,
    submitOutbound,
  }
}
