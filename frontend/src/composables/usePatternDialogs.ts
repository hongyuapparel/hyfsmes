import { computed, reactive, ref, watch, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getPatternMaterials, getPatternLogs,
  savePatternMaterials,
  type PatternListItem,
  type PatternMaterialRow,
} from '@/api/production-pattern'
import { getStaffOptions, type StaffOptionItem } from '@/api/hr'
import { getDictItems } from '@/api/dicts'
import { usePatternAssignment } from './usePatternAssignment'
import { toLogSectionItems } from '@/api/operation-logs'
import { usePatternCompletion } from './usePatternCompletion'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useAuthStore } from '@/stores/auth'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'
import { roundMaterialUsageQty } from '@/utils/material-usage-qty'

type LabelFinders = {
  findOrderTypeLabelById: (id: number | null | undefined) => string
  findCollaborationLabelById: (id: number | null | undefined) => string
}

type LoadFunctions = {
  reloadList: () => Promise<void> | void
}

export function usePatternDialogs(
  selectedRows: Ref<PatternListItem[]>,
  loaders: LoadFunctions,
  labelFinders: LabelFinders,
) {
  const authStore = useAuthStore()
  const canEditPatternMaterials = computed(() => authStore.hasPermission('production_pattern_materials') || authStore.hasPermission('production_admin_edit'))

  const detailDrawer = reactive<{ visible: boolean; loading: boolean; saving: boolean; loaded: boolean; row: PatternListItem | null }>({
    visible: false,
    loading: false,
    saving: false,
    loaded: false,
    row: null,
  })
  const materialsForm = reactive<{ materials: PatternMaterialRow[]; remark: string }>({ materials: [], remark: '' })
  const materialTypeOptions = ref<{ id: number; label: string }[]>([])

  const assignment = usePatternAssignment(selectedRows, loaders)
  const patternMasterOptions = ref<StaffOptionItem[]>([])
  const sampleMakerOptions = ref<StaffOptionItem[]>([])

  const completion = usePatternCompletion(selectedRows, loaders)

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
      usagePerPiece:
        row.usagePerPiece != null ? roundMaterialUsageQty(Number(row.usagePerPiece)) : null,
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

  let materialsVersion: string | undefined
  const patternDrawerLogsError = ref('')
  let materialsRequest = 0
  const materialsSnapshot = ref<{ materials: PatternMaterialRow[]; remark: string } | null>(null)
  const hasUnsavedMaterials = computed(() => materialsSnapshot.value != null && JSON.stringify(materialsSnapshot.value) !== JSON.stringify(materialsForm))
  function onEnterEdit() {
    materialsSnapshot.value = JSON.parse(JSON.stringify(materialsForm)) as typeof materialsForm
  }
  function onCancelEdit() {
    if (materialsSnapshot.value) Object.assign(materialsForm, materialsSnapshot.value)
    materialsSnapshot.value = null
  }
  watch(() => detailDrawer.visible, (visible) => {
    if (!visible) { materialsRequest++; detailDrawer.loaded = false; materialsSnapshot.value = null }
  })
  const patternDrawerLogs = ref<ReturnType<typeof toLogSectionItems>>([])
  let logsRequest = 0
  async function loadPatternDrawerLogs() {
    const request = ++logsRequest
    const row = detailDrawer.row
    patternDrawerLogs.value = []
    if (!row || !detailDrawer.visible) return
    patternDrawerLogsError.value = ''
    try {
      const { data: logs } = await getPatternLogs(row.orderId)
      if (request === logsRequest && detailDrawer.visible && detailDrawer.row?.orderId === row.orderId) patternDrawerLogs.value = toLogSectionItems(logs)
    } catch {
      if (request === logsRequest && detailDrawer.visible) patternDrawerLogsError.value = '操作记录加载失败，请关闭详情后重新打开。'
    }
  }
  watch(() => [detailDrawer.row?.orderId, detailDrawer.visible], () => { void loadPatternDrawerLogs() })

  watch(() => assignment.assignDialog.visible || completion.completeDialog.visible, (visible) => {
    if (!visible && detailDrawer.visible) void loadPatternDrawerLogs()
  })

  function onDetailDrawerClosed() {
    if (detailDrawer.visible) return
    materialsRequest++
    detailDrawer.loaded = false
    detailDrawer.loading = false
    materialsSnapshot.value = null
    resetMaterialsForm()
    detailDrawer.row = null
  }

  async function openPatternDetailDrawer(row: PatternListItem) {
    if (detailDrawer.saving) return
    const request = ++materialsRequest
    resetMaterialsForm()
    materialsSnapshot.value = null
    detailDrawer.loaded = false
    detailDrawer.row = row
    detailDrawer.visible = true
    detailDrawer.loading = true
    try {
      const res = await getPatternMaterials(row.orderId)
      if (request !== materialsRequest || !detailDrawer.visible) return
      const data = res.data
      materialsVersion = data?.version
      materialsForm.materials = (data?.materials ?? []).map(normalizePatternMaterialRow)
      materialsForm.remark = data?.remark ?? ''
      detailDrawer.loaded = true
    } catch (e: unknown) {
      if (request === materialsRequest && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载失败'))
    } finally {
      if (request === materialsRequest) detailDrawer.loading = false
    }
  }

  async function submitMaterials(): Promise<boolean> {
    if (!detailDrawer.row || !detailDrawer.loaded || detailDrawer.loading || detailDrawer.saving) return false
    const payloadMaterials = (materialsForm.materials ?? [])
      .map(normalizePatternMaterialRow)
      .filter((row) => row.materialTypeId != null || row.usagePerPiece != null || row.cuttingQuantity != null || [row.materialName, row.fabricWidth, row.remark].some((value) => (value ?? '').trim()))
    detailDrawer.saving = true
    try {
      const result = await savePatternMaterials(detailDrawer.row.orderId, {
        materials: payloadMaterials,
        remark: materialsForm.remark ?? '', expectedVersion: materialsVersion,
      })
      materialsVersion = result.data?.version
      materialsForm.materials = payloadMaterials
      materialsSnapshot.value = JSON.parse(JSON.stringify(materialsForm)) as typeof materialsForm
      void loadPatternDrawerLogs()
      ElMessage.success('已保存')
      return true
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '保存失败'))
      return false
    } finally {
      detailDrawer.saving = false
    }
  }

  async function loadPatternStaffOptions() {
    try {
      const res = await getStaffOptions()
      const active = (res.data ?? []).filter((e) => (e.status ?? '').toLowerCase() !== 'left')
      patternMasterOptions.value = active.filter((e) => (e.jobTitleName ?? '').includes('纸样师'))
      sampleMakerOptions.value = active.filter((e) => (e.jobTitleName ?? '').includes('车版师'))
    } catch {
      patternMasterOptions.value = []
      sampleMakerOptions.value = []
    }
  }

  async function loadMaterialTypes() {
    try {
      const res = await getDictItems('material_types')
      const list = res.data ?? []
      materialTypeOptions.value = (Array.isArray(list) ? list : []).map((item) => ({
        id: item.id,
        label: item.value,
      }))
    } catch {
      materialTypeOptions.value = []
    }
  }

  function completeFromDrawer() {
    const row = detailDrawer.row
    if (!row || !detailDrawer.loaded) return
    if (hasUnsavedMaterials.value) { ElMessage.warning('请先保存用料，再确认完成'); return }
    completion.openCompleteDialog([row], undefined, () => { detailDrawer.visible = false })
  }

  return {
    completeFromDrawer,
    canEditPatternMaterials,
    hasUnsavedMaterials, onEnterEdit, onCancelEdit, patternDrawerLogs, patternDrawerLogsError,
    detailDrawer,
    materialsForm,
    materialTypeOptions,
    ...assignment,
    patternMasterOptions,
    sampleMakerOptions,
    ...completion,
    patternBriefFromRow,
    addMaterialRow,
    removeMaterialRow,
    onDetailDrawerClosed,
    openPatternDetailDrawer,
    submitMaterials,
    loadPatternStaffOptions,
    loadMaterialTypes,
  }
}
