import { reactive, ref, type Ref } from 'vue'
import { ElMessage, type FormRules } from 'element-plus'
import {
  createAccessory,
  updateAccessory,
  getAccessoryOperationLogs,
  type AccessoryItem,
  type AccessoryOperationLog,
} from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { cleanAccessoryMatrix } from '@/utils/accessorySizeMatrix'
import { sumDetailRowQty } from '@/utils/finishedStockTableUtils'

export interface AccessoriesFormDialogExpose {
  validate: () => Promise<unknown> | undefined
  clearValidate: () => void
}

export type AccessoriesFormMode = 'create' | 'edit' | 'view'

export interface AccessoriesFormModel {
  name: string
  category: string
  quantity: number
  isSized: boolean
  sizeHeaders: string[]
  sizeQuantities: number[]
  unit: string
  warehouseId: number | null
  location: string
  customerName: string
  salesperson: string
  imageUrl: string
  imageUrls: string[]
  remark: string
}

function emptyAccessoryForm(): AccessoriesFormModel {
  return {
    name: '', category: '', quantity: 0, isSized: false, sizeHeaders: [], sizeQuantities: [],
    unit: '个', warehouseId: null, location: '', customerName: '', salesperson: '', imageUrl: '', imageUrls: [''], remark: '',
  }
}

type LoadHandler = () => Promise<void> | void

export function useAccessoriesFormDialog(
  selectedRows: Ref<AccessoryItem[]>,
  reloadList: LoadHandler,
  dialogRef: Ref<AccessoriesFormDialogExpose | undefined>,
) {
  const formDialog = reactive<{ visible: boolean; submitting: boolean; mode: AccessoriesFormMode; logsLoading: boolean }>({
    visible: false,
    submitting: false,
    mode: 'create',
    logsLoading: false,
  })
  const quickAddSource = ref<AccessoryItem | null>(null)
  const editId = ref<number | null>(null)
  /** 当前查看/编辑的行，用于编辑中「取消」时还原表单 */
  const detailRow = ref<AccessoryItem | null>(null)
  const logs = ref<AccessoryOperationLog[]>([])
  const form = reactive<AccessoriesFormModel>(emptyAccessoryForm())
  const formRules: FormRules = {
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    salesperson: [{ required: true, message: '请选择业务员', trigger: 'change' }],
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
      const res = await getAccessoryOperationLogs(id)
      logs.value = res.data ?? []
    } catch (e: unknown) {
      logs.value = []
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      formDialog.logsLoading = false
    }
  }

  /** 把一条已有辅料的全部字段铺进表单（详情/编辑/编辑中取消还原都用它） */
  function applyRowToForm(seed: AccessoryItem) {
    form.name = seed.name
    form.category = seed.category ?? ''
    form.unit = seed.unit ?? '个'
    form.warehouseId = seed.warehouseId ?? null
    form.location = seed.location ?? ''
    form.customerName = seed.customerName ?? ''
    form.salesperson = seed.salesperson ?? ''
    form.imageUrl = seed.imageUrl ?? ''
    const seedImageUrls = Array.isArray(seed.imageUrls)
      ? seed.imageUrls.filter((url) => !!String(url ?? '').trim())
      : (seed.imageUrl ? [seed.imageUrl] : [''])
    form.imageUrls = seedImageUrls.length ? seedImageUrls : ['']
    form.remark = seed.remark ?? ''
    form.isSized = !!seed.isSized
    form.quantity = seed.quantity ?? 0
    form.sizeHeaders = Array.isArray(seed.sizeHeaders) ? [...seed.sizeHeaders] : []
    form.sizeQuantities = Array.isArray(seed.sizeQuantities) ? [...seed.sizeQuantities] : []
  }

  function openForm(row: AccessoryItem | null, mode: AccessoriesFormMode = row ? 'edit' : 'create') {
    formDialog.mode = mode
    quickAddSource.value = null
    logs.value = []
    editId.value = row ? row.id : null
    const isRowMode = mode === 'edit' || mode === 'view'
    detailRow.value = isRowMode ? row : null
    if (isRowMode && row) {
      applyRowToForm(row)
    } else if (mode === 'create' && selectedRows.value.length === 1) {
      // 增量入库：沿用源记录的字段，数量从 0 开始、各码清零
      const seed = selectedRows.value[0]!
      applyRowToForm(seed)
      quickAddSource.value = seed
      form.quantity = 0
      const sizedHeaders = seed.isSized && Array.isArray(seed.sizeHeaders) ? seed.sizeHeaders : []
      form.sizeHeaders = [...sizedHeaders]
      form.sizeQuantities = sizedHeaders.map(() => 0)
    } else {
      Object.assign(form, emptyAccessoryForm())
    }
    formDialog.visible = true
    if (mode === 'view' && row) void fetchLogs(row.id)
  }

  function enterEdit() {
    formDialog.mode = 'edit'
  }

  /** 编辑中点「取消」：还原表单到原始值并回到详情态 */
  function exitEdit() {
    if (detailRow.value) applyRowToForm(detailRow.value)
    dialogRef.value?.clearValidate()
    formDialog.mode = 'view'
  }

  function resetForm() {
    dialogRef.value?.clearValidate()
  }

  function getImagePayload(): { imageUrl?: string; imageUrls: string[] } {
    const imageUrls = form.imageUrls.map((url) => String(url ?? '').trim()).filter(Boolean)
    return {
      imageUrl: imageUrls[0] || undefined,
      imageUrls,
    }
  }

  async function submitForm() {
    await dialogRef.value?.validate?.().catch(() => {})
    formDialog.submitting = true
    try {
      const imagePayload = getImagePayload()
      if (formDialog.mode === 'edit' && editId.value != null) {
        const editMatrix = form.isSized ? cleanAccessoryMatrix(form.sizeHeaders, form.sizeQuantities) : null
        if (form.isSized && (!editMatrix || editMatrix.headers.length === 0)) {
          ElMessage.warning('请填写分码尺码')
          return
        }
        if (form.isSized && editMatrix && sumDetailRowQty(editMatrix.quantities) <= 0) {
          ElMessage.warning('分码数量合计必须大于 0')
          return
        }
        const editSizePayload = editMatrix
          ? { isSized: true, sizeHeaders: editMatrix.headers, sizeQuantities: editMatrix.quantities }
          : { isSized: false }
        await updateAccessory(editId.value, {
          name: form.name,
          category: form.category,
          ...editSizePayload,
          unit: form.unit,
          warehouseId: form.warehouseId ?? null,
          location: form.location || undefined,
          customerName: form.customerName || undefined,
          salesperson: form.salesperson,
          ...imagePayload,
          remark: form.remark,
        })
        ElMessage.success('保存成功')
      } else {
        const isSized = form.isSized
        const matrix = isSized ? cleanAccessoryMatrix(form.sizeHeaders, form.sizeQuantities) : null
        if (isSized && (!matrix || matrix.headers.length === 0)) {
          ElMessage.warning('请填写分码尺码')
          return
        }
        const total = matrix ? sumDetailRowQty(matrix.quantities) : Number(form.quantity) || 0
        if (total <= 0) {
          ElMessage.warning(
            isSized
              ? '分码数量合计必须大于 0'
              : quickAddSource.value
                ? '请输入大于 0 的新增数量'
                : '数量必须大于 0',
          )
          return
        }
        const sizePayload = matrix
          ? { isSized: true, sizeHeaders: matrix.headers, sizeQuantities: matrix.quantities }
          : { quantity: Number(form.quantity) || 0 }
        await createAccessory({
          name: form.name,
          category: form.category,
          ...sizePayload,
          unit: form.unit,
          warehouseId: form.warehouseId ?? null,
          location: form.location || undefined,
          customerName: form.customerName || undefined,
          salesperson: form.salesperson,
          ...imagePayload,
          remark: form.remark,
        })
        ElMessage.success(quickAddSource.value ? '库存增加成功' : '新增成功')
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
