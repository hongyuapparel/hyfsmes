import { reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { createSupplier, updateSupplier, type SupplierItem } from '@/api/suppliers'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { type BusinessScopeTreeNode, expandSelectedScopeIds } from '@/composables/useSupplierOptions'

export interface SupplierFormModel {
  name: string
  supplierTypeId: number | null
  businessScopeIds: number[]
  businessScopeId: number | null
  contactPerson: string
  contactInfo: string
  factoryAddress: string
  settlementTime: string
  remark: string
}

interface UseSupplierFormOptions {
  getBusinessScopeTreeByTypeId: (typeId: number | null | undefined) => BusinessScopeTreeNode[]
  onSubmitSuccess: () => Promise<void> | void
}

export function useSupplierForm(options: UseSupplierFormOptions) {
  const formDialog = reactive<{ visible: boolean; submitting: boolean; isEdit: boolean }>({
    visible: false,
    submitting: false,
    isEdit: false,
  })
  const editId = ref<number | null>(null)
  const formRef = reactive<{ value: FormInstance | undefined }>({ value: undefined })
  const businessScopeOptions = ref<BusinessScopeTreeNode[]>([])
  const form = reactive<SupplierFormModel>({
    name: '',
    supplierTypeId: null,
    businessScopeIds: [],
    businessScopeId: null,
    contactPerson: '',
    contactInfo: '',
    factoryAddress: '',
    settlementTime: '',
    remark: '',
  })
  const formRules: FormRules = {
    name: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }],
  }

  function resetForm() {
    formRef.value?.clearValidate()
  }

  function resetFormModel() {
    form.name = ''
    form.supplierTypeId = null
    form.businessScopeIds = []
    form.businessScopeId = null
    form.contactPerson = ''
    form.contactInfo = ''
    form.factoryAddress = ''
    form.settlementTime = ''
    form.remark = ''
  }

  function onFormTypeChange() {
    if (!form.supplierTypeId) {
      businessScopeOptions.value = []
      form.businessScopeIds = []
      form.businessScopeId = null
      return
    }
    const tree = options.getBusinessScopeTreeByTypeId(form.supplierTypeId)
    businessScopeOptions.value = tree
    const validIds = new Set<number>()
    const stack = [...tree]
    while (stack.length) {
      const node = stack.shift()
      if (!node) continue
      validIds.add(node.id)
      if (node.children?.length) stack.unshift(...node.children)
    }
    form.businessScopeIds = form.businessScopeIds.filter((id) => validIds.has(id))
    form.businessScopeId = form.businessScopeIds[0] ?? null
  }

  async function openForm(row: SupplierItem | null) {
    formDialog.isEdit = !!row
    editId.value = row ? row.id : null
    if (row) {
      form.name = row.name
      form.supplierTypeId = row.supplierTypeId ?? null
      form.businessScopeIds = Array.isArray(row.businessScopeIds)
        ? row.businessScopeIds
        : row.businessScopeId != null
          ? [row.businessScopeId]
          : []
      form.businessScopeId = form.businessScopeIds[0] ?? row.businessScopeId ?? null
      form.contactPerson = row.contactPerson ?? ''
      form.contactInfo = row.contactInfo ?? ''
      form.factoryAddress = row.factoryAddress ?? ''
      form.settlementTime = row.settlementTime ?? ''
      form.remark = row.remark ?? ''
    } else {
      resetFormModel()
    }
    formDialog.visible = true
    onFormTypeChange()
  }

  async function submitForm() {
    await formRef.value?.validate().catch(() => {})
    formDialog.submitting = true
    try {
      const typeTree = options.getBusinessScopeTreeByTypeId(form.supplierTypeId)
      const normalizedScopeIds = expandSelectedScopeIds(form.businessScopeIds, typeTree)
      const payload = {
        name: form.name,
        supplierTypeId: form.supplierTypeId,
        businessScopeIds: normalizedScopeIds,
        businessScopeId: normalizedScopeIds[0] ?? null,
        contactPerson: form.contactPerson,
        contactInfo: form.contactInfo,
        factoryAddress: form.factoryAddress,
        settlementTime: form.settlementTime,
        remark: form.remark,
      }
      if (formDialog.isEdit && editId.value != null) {
        await updateSupplier(editId.value, payload)
        ElMessage.success('保存成功')
      } else {
        await createSupplier(payload)
        ElMessage.success('新建成功')
      }
      formDialog.visible = false
      await options.onSubmitSuccess()
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    } finally {
      formDialog.submitting = false
    }
  }

  return {
    formDialog,
    formRef,
    form,
    formRules,
    businessScopeOptions,
    resetForm,
    onFormTypeChange,
    openForm,
    submitForm,
  }
}
