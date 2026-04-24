import { computed, reactive, ref, type Ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  assignPattern,
  completePattern,
  getPatternMaterials,
  savePatternMaterials,
  type PatternListItem,
  type PatternMaterialRow,
} from '@/api/production-pattern'
import { getEmployeeList, type EmployeeItem } from '@/api/hr'
import { getDictItems } from '@/api/dicts'
import { uploadImage } from '@/api/uploads'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useAuthStore } from '@/stores/auth'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'

type LabelFinders = {
  findOrderTypeLabelById: (id: number | null | undefined) => string
  findCollaborationLabelById: (id: number | null | undefined) => string
}

type LoadFunctions = {
  reloadList: () => Promise<void> | void
  reloadTabCounts: () => Promise<void> | void
}

export function usePatternDialogs(
  selectedRows: Ref<PatternListItem[]>,
  loaders: LoadFunctions,
  labelFinders: LabelFinders,
) {
  const authStore = useAuthStore()
  const canEditPatternMaterials = computed(() => {
    const roleName = (authStore.user?.roleName ?? '').trim()
    if (!roleName) return false
    if (roleName === '超级管理员' || roleName === '管理员') return true
    return roleName.includes('纸样')
  })

  const detailDrawer = reactive<{ visible: boolean; loading: boolean; saving: boolean; row: PatternListItem | null }>({
    visible: false,
    loading: false,
    saving: false,
    row: null,
  })
  const materialsForm = reactive<{ materials: PatternMaterialRow[]; remark: string }>({ materials: [], remark: '' })
  const materialTypeOptions = ref<{ id: number; label: string }[]>([])

  const assignDialog = reactive<{ visible: boolean; submitting: boolean }>({ visible: false, submitting: false })
  const assignFormRef = ref<FormInstance>()
  const assignForm = reactive({ patternMaster: '', sampleMaker: '' })
  const assignRules: FormRules = {
    patternMaster: [{ required: true, message: '请选择纸样师', trigger: 'change' }],
    sampleMaker: [{ required: true, message: '请选择车版师', trigger: 'change' }],
  }
  const patternMasterOptions = ref<EmployeeItem[]>([])
  const sampleMakerOptions = ref<EmployeeItem[]>([])

  const completeDialog = reactive<{ visible: boolean; submitting: boolean; row: PatternListItem | null }>({
    visible: false,
    submitting: false,
    row: null,
  })
  const completeFormRef = ref<FormInstance>()
  const completeForm = reactive({ sampleImageUrl: '' })
  const completeRules: FormRules = {}
  const sampleImageFileInputRef = ref<HTMLInputElement | null>(null)
  const sampleImageUploading = ref(false)

  function patternBriefFromRow(row: PatternListItem): ProductionOrderBriefModel {
    return {
      orderNo: row.orderNo,
      skuCode: row.skuCode,
      imageUrl: row.imageUrl,
      customerName: row.customerName,
      merchandiser: row.merchandiser,
      customerDueDate: row.customerDueDate,
      orderQuantity: row.quantity,
      orderDate: row.orderDate,
      orderTypeLabel: labelFinders.findOrderTypeLabelById(row.orderTypeId),
      collaborationLabel: labelFinders.findCollaborationLabelById(row.collaborationTypeId),
    }
  }

  function resetMaterialsForm() {
    materialsForm.materials = []
    materialsForm.remark = ''
  }

  function normalizePatternMaterialRow(row: PatternMaterialRow): PatternMaterialRow {
    return {
      materialTypeId: row.materialTypeId ?? null,
      materialName: (row.materialName ?? '').toString(),
      fabricWidth: (row.fabricWidth ?? '').toString(),
      usagePerPiece: row.usagePerPiece ?? null,
      cuttingQuantity: row.cuttingQuantity ?? null,
      remark: (row.remark ?? '').toString(),
    }
  }

  function addMaterialRow() {
    materialsForm.materials.push({
      materialTypeId: null,
      materialName: '',
      fabricWidth: '',
      usagePerPiece: null,
      cuttingQuantity: null,
      remark: '',
    })
  }

  function removeMaterialRow(index: number) {
    materialsForm.materials.splice(index, 1)
  }

  function onDetailDrawerClosed() {
    resetMaterialsForm()
    detailDrawer.row = null
  }

  async function openPatternDetailDrawer(row: PatternListItem) {
    detailDrawer.row = row
    detailDrawer.visible = true
    detailDrawer.loading = true
    try {
      const res = await getPatternMaterials(row.orderId)
      const data = res.data
      materialsForm.materials = (data?.materials ?? []).map(normalizePatternMaterialRow)
      materialsForm.remark = data?.remark ?? ''
      if (!materialsForm.materials.length && canEditPatternMaterials.value) addMaterialRow()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载失败'))
      if (!materialsForm.materials.length && canEditPatternMaterials.value) addMaterialRow()
    } finally {
      detailDrawer.loading = false
    }
  }

  async function submitMaterials() {
    if (!detailDrawer.row) return
    const payloadMaterials = (materialsForm.materials ?? [])
      .map(normalizePatternMaterialRow)
      .filter((row) => row.materialTypeId != null || (row.materialName ?? '').trim().length > 0)
    detailDrawer.saving = true
    try {
      await savePatternMaterials(detailDrawer.row.orderId, {
        materials: payloadMaterials,
        remark: materialsForm.remark ?? '',
      })
      ElMessage.success('已保存')
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '保存失败'))
    } finally {
      detailDrawer.saving = false
    }
  }

  function openAssignDialog() {
    if (selectedRows.value.length === 0) return
    assignForm.patternMaster = selectedRows.value[0].patternMaster ?? ''
    assignForm.sampleMaker = selectedRows.value[0].sampleMaker ?? ''
    assignDialog.visible = true
  }

  function resetAssignForm() {
    assignForm.patternMaster = ''
    assignForm.sampleMaker = ''
    assignFormRef.value?.clearValidate()
  }

  async function submitAssign() {
    await assignFormRef.value?.validate().catch(() => {})
    if (selectedRows.value.length === 0) return
    assignDialog.submitting = true
    try {
      for (const row of selectedRows.value) {
        await assignPattern({
          orderId: row.orderId,
          patternMaster: assignForm.patternMaster,
          sampleMaker: assignForm.sampleMaker,
        })
      }
      ElMessage.success('分配成功')
      assignDialog.visible = false
      await loaders.reloadList()
      void loaders.reloadTabCounts()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '分配失败'))
    } finally {
      assignDialog.submitting = false
    }
  }

  function openCompleteDialog() {
    if (selectedRows.value.length === 0) return
    completeDialog.row = selectedRows.value[0]
    completeForm.sampleImageUrl = ''
    completeDialog.visible = true
  }

  function resetCompleteForm() {
    completeDialog.row = null
    completeForm.sampleImageUrl = ''
    completeFormRef.value?.clearValidate()
    if (sampleImageFileInputRef.value) sampleImageFileInputRef.value.value = ''
  }

  function triggerSampleImageUpload() {
    sampleImageFileInputRef.value?.click()
  }

  function clearSampleImage() {
    completeForm.sampleImageUrl = ''
    if (sampleImageFileInputRef.value) sampleImageFileInputRef.value.value = ''
  }

  async function onSampleImageFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return
    sampleImageUploading.value = true
    try {
      const url = await uploadImage(file)
      completeForm.sampleImageUrl = url
      completeFormRef.value?.validateField('sampleImageUrl').catch(() => {})
    } catch (error) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error, '上传失败'))
    } finally {
      sampleImageUploading.value = false
      target.value = ''
    }
  }

  async function submitComplete() {
    if (!completeDialog.row) return
    completeDialog.submitting = true
    try {
      await completePattern({
        orderId: completeDialog.row.orderId,
        sampleImageUrl: (completeForm.sampleImageUrl ?? '').trim(),
      })
      ElMessage.success('纸样已完成，订单已进入样品完成')
      completeDialog.visible = false
      await loaders.reloadList()
      void loaders.reloadTabCounts()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '操作失败'))
    } finally {
      completeDialog.submitting = false
    }
  }

  async function loadPatternStaffOptions() {
    try {
      const res = await getEmployeeList({ status: 'active', page: 1, pageSize: 200 })
      const data = res.data
      const employees = data?.list ?? []
      patternMasterOptions.value = employees.filter((e) => e.jobTitleName === '纸样师')
      sampleMakerOptions.value = employees.filter((e) => e.jobTitleName === '车版师')
    } catch {
      patternMasterOptions.value = []
      sampleMakerOptions.value = []
    }
  }

  async function loadMaterialTypes() {
    try {
      const res = await getDictItems('material_types')
      const list = res.data ?? []
      materialTypeOptions.value = (Array.isArray(list) ? list : []).map((item: any) => ({
        id: item.id,
        label: item.value,
      }))
    } catch {
      materialTypeOptions.value = []
    }
  }

  return {
    canEditPatternMaterials,
    detailDrawer,
    materialsForm,
    materialTypeOptions,
    assignDialog,
    assignFormRef,
    assignForm,
    assignRules,
    patternMasterOptions,
    sampleMakerOptions,
    completeDialog,
    completeFormRef,
    completeForm,
    completeRules,
    sampleImageFileInputRef,
    sampleImageUploading,
    patternBriefFromRow,
    addMaterialRow,
    removeMaterialRow,
    onDetailDrawerClosed,
    openPatternDetailDrawer,
    submitMaterials,
    openAssignDialog,
    resetAssignForm,
    submitAssign,
    openCompleteDialog,
    resetCompleteForm,
    triggerSampleImageUpload,
    clearSampleImage,
    onSampleImageFileChange,
    submitComplete,
    loadPatternStaffOptions,
    loadMaterialTypes,
  }
}
