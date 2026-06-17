import { nextTick, reactive, ref, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormRules } from 'element-plus'
import {
  createFabric,
  updateFabric,
  getFabricOperationLogs,
  type FabricItem,
  type FabricOperationLog,
} from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export interface FabricFormDialogExpose {
  validate: () => Promise<unknown> | undefined
  clearValidate: () => void
}

export type FabricFormMode = 'create' | 'edit' | 'view'

export interface FabricFormModel {
  name: string
  quantity: number
  unit: string
  customerName: string
  supplierId: number | null
  warehouseId: number | null
  inventoryTypeId: number | null
  storageLocation: string
  imageUrl: string
  remark: string
}

function emptyFabricForm(): FabricFormModel {
  return {
    name: '', quantity: 0, unit: '米', customerName: '', supplierId: null,
    warehouseId: null, inventoryTypeId: null, storageLocation: '', imageUrl: '', remark: '',
  }
}

type LoadHandler = () => Promise<void> | void

export function useFabricFormDialog(
  selectedRows: Ref<FabricItem[]>,
  reloadList: LoadHandler,
  dialogRef: Ref<FabricFormDialogExpose | undefined>,
  loadSuppliers: () => Promise<void> | void,
) {
  const formDialog = reactive<{ visible: boolean; submitting: boolean; mode: FabricFormMode; logsLoading: boolean }>({
    visible: false,
    submitting: false,
    mode: 'create',
    logsLoading: false,
  })
  const quickAddSource = ref<FabricItem | null>(null)
  const editId = ref<number | null>(null)
  const detailRow = ref<FabricItem | null>(null)
  const logs = ref<FabricOperationLog[]>([])
  /** 每次打开表单递增，重置供应商下拉内部筛选关键字 */
  const fabricSupplierSelectKey = ref(0)
  const form = reactive<FabricFormModel>(emptyFabricForm())
  const formRules: FormRules = {
    name: [{ required: true, message: '请输入面料名称', trigger: 'blur' }],
  }

  function formatLogAction(action: string): string {
    if (action === 'create') return '新建'
    if (action === 'inbound') return '新增入库'
    if (action === 'update') return '编辑'
    if (action === 'outbound') return '出库'
    if (action === 'delete') return '删除'
    return action || '操作'
  }

  async function fetchLogs(id: number): Promise<void> {
    formDialog.logsLoading = true
    try {
      const res = await getFabricOperationLogs(id)
      logs.value = res.data ?? []
    } catch (e: unknown) {
      logs.value = []
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      formDialog.logsLoading = false
    }
  }

  function applyRowToForm(seed: FabricItem) {
    form.name = seed.name
    form.unit = seed.unit ?? '米'
    form.customerName = seed.customerName ?? ''
    form.supplierId = seed.supplierId != null && seed.supplierId > 0 ? seed.supplierId : null
    form.warehouseId = seed.warehouseId != null && seed.warehouseId > 0 ? seed.warehouseId : null
    form.inventoryTypeId = seed.inventoryTypeId != null && seed.inventoryTypeId > 0 ? seed.inventoryTypeId : null
    form.storageLocation = seed.storageLocation ?? ''
    form.imageUrl = seed.imageUrl ?? ''
    form.remark = seed.remark ?? ''
    form.quantity = parseFloat(String(seed.quantity)) || 0
  }

  async function openForm(row: FabricItem | null, mode: FabricFormMode = row ? 'edit' : 'create') {
    formDialog.mode = mode
    quickAddSource.value = null
    logs.value = []
    editId.value = row ? row.id : null
    const isRowMode = mode === 'edit' || mode === 'view'
    detailRow.value = isRowMode ? row : null
    if (isRowMode && row) {
      applyRowToForm(row)
    } else if (mode === 'create' && selectedRows.value.length === 1) {
      // 增量入库：沿用源记录字段，数量从 0 开始
      applyRowToForm(selectedRows.value[0]!)
      quickAddSource.value = selectedRows.value[0]!
      form.quantity = 0
    } else {
      Object.assign(form, emptyFabricForm())
    }
    fabricSupplierSelectKey.value += 1
    formDialog.visible = true
    if (mode === 'view' && row) void fetchLogs(row.id)
    await nextTick()
    await loadSuppliers()
  }

  function enterEdit() {
    formDialog.mode = 'edit'
  }

  function exitEdit() {
    if (detailRow.value) applyRowToForm(detailRow.value)
    dialogRef.value?.clearValidate()
    formDialog.mode = 'view'
  }

  function resetForm() {
    dialogRef.value?.clearValidate()
  }

  function buildPayload() {
    return {
      name: form.name,
      unit: form.unit,
      customerName: form.customerName || undefined,
      imageUrl: form.imageUrl || undefined,
      remark: form.remark,
      supplierId: form.supplierId,
      warehouseId: form.warehouseId,
      inventoryTypeId: form.inventoryTypeId,
      storageLocation: form.storageLocation,
    }
  }

  async function submitForm() {
    await dialogRef.value?.validate?.().catch(() => {})
    formDialog.submitting = true
    try {
      if (formDialog.mode === 'edit' && editId.value != null) {
        await updateFabric(editId.value, { ...buildPayload(), quantity: form.quantity })
        ElMessage.success('保存成功')
      } else if (quickAddSource.value) {
        const inputQty = Number(form.quantity) || 0
        if (inputQty <= 0) {
          ElMessage.warning('请输入大于 0 的新增数量')
          return
        }
        await createFabric({ ...buildPayload(), quantity: inputQty })
        ElMessage.success('库存增加成功')
      } else {
        await createFabric({ ...buildPayload(), quantity: form.quantity })
        ElMessage.success('新增成功')
      }
      formDialog.visible = false
      await reloadList()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      formDialog.submitting = false
    }
  }

  return {
    formDialog,
    quickAddSource,
    fabricSupplierSelectKey,
    form,
    formRules,
    logs,
    openForm,
    enterEdit,
    exitEdit,
    resetForm,
    submitForm,
    formatLogAction,
  }
}
