import { reactive, ref, type Ref } from 'vue'
import { ElMessage, type FormRules } from 'element-plus'
import { createAccessory, updateAccessory, type AccessoryItem } from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { cleanAccessoryMatrix } from '@/utils/accessorySizeMatrix'
import { sumDetailRowQty } from '@/utils/finishedStockTableUtils'

export interface AccessoriesFormDialogExpose {
  validate: () => Promise<unknown> | undefined
  clearValidate: () => void
}

type LoadHandler = () => Promise<void> | void

export function useAccessoriesFormDialog(
  selectedRows: Ref<AccessoryItem[]>,
  reloadList: LoadHandler,
  dialogRef: Ref<AccessoriesFormDialogExpose | undefined>,
) {
  const formDialog = reactive<{ visible: boolean; submitting: boolean; isEdit: boolean }>({
    visible: false,
    submitting: false,
    isEdit: false,
  })
  const quickAddSource = ref<AccessoryItem | null>(null)
  const editId = ref<number | null>(null)
  const form = reactive({
    name: '',
    category: '',
    quantity: 0,
    isSized: false,
    sizeHeaders: [] as string[],
    sizeQuantities: [] as number[],
    unit: '个',
    warehouseId: null as number | null,
    location: '',
    customerName: '',
    salesperson: '',
    imageUrl: '',
    imageUrls: [] as string[],
    remark: '',
  })
  const formRules: FormRules = {
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
    salesperson: [{ required: true, message: '请选择业务员', trigger: 'change' }],
  }

  function openForm(row: AccessoryItem | null) {
    quickAddSource.value = null
    formDialog.isEdit = !!row
    editId.value = row ? row.id : null
    const seed = row ?? (selectedRows.value.length === 1 ? selectedRows.value[0]! : null)
    if (seed) {
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
      if (row) {
        form.quantity = seed.quantity ?? 0
        form.sizeHeaders = Array.isArray(seed.sizeHeaders) ? [...seed.sizeHeaders] : []
        form.sizeQuantities = Array.isArray(seed.sizeQuantities) ? [...seed.sizeQuantities] : []
      } else {
        quickAddSource.value = seed
        form.quantity = 0
        // 增量入库：沿用源的尺码结构，本次各码数量从 0 开始填
        const sizedHeaders = seed.isSized && Array.isArray(seed.sizeHeaders) ? seed.sizeHeaders : []
        form.sizeHeaders = [...sizedHeaders]
        form.sizeQuantities = sizedHeaders.map(() => 0)
      }
    } else {
      form.name = ''
      form.category = ''
      form.quantity = 0
      form.isSized = false
      form.sizeHeaders = []
      form.sizeQuantities = []
      form.unit = '个'
      form.warehouseId = null
      form.location = ''
      form.customerName = ''
      form.salesperson = ''
      form.imageUrl = ''
      form.imageUrls = ['']
      form.remark = ''
    }
    formDialog.visible = true
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
      if (formDialog.isEdit && editId.value != null) {
        await updateAccessory(editId.value, {
          name: form.name,
          category: form.category,
          quantity: form.quantity,
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
    openForm,
    resetForm,
    submitForm,
  }
}
