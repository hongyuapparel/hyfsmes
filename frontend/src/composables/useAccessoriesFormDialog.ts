import { reactive, ref, type Ref } from 'vue'
import { ElMessage, type FormRules } from 'element-plus'
import { createAccessory, updateAccessory, type AccessoryItem } from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'

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
      if (row) {
        form.quantity = seed.quantity ?? 0
      } else {
        quickAddSource.value = seed
        form.quantity = 0
      }
    } else {
      form.name = ''
      form.category = ''
      form.quantity = 0
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
        const inputQty = Number(form.quantity) || 0
        if (quickAddSource.value) {
          if (inputQty <= 0) {
            ElMessage.warning('请输入大于 0 的新增数量')
            return
          }
          await createAccessory({
            name: form.name,
            category: form.category,
            quantity: inputQty,
            unit: form.unit,
            warehouseId: form.warehouseId ?? null,
            location: form.location || undefined,
            customerName: form.customerName || undefined,
            salesperson: form.salesperson,
            ...imagePayload,
            remark: form.remark,
          })
          ElMessage.success('库存增加成功')
        } else {
          await createAccessory({
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
          ElMessage.success('新增成功')
        }
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
