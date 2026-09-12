import { computed, reactive, ref, type Ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { assignPattern, type PatternListItem } from '@/api/production-pattern'
import { getErrorMessage } from '@/api/request'

export function usePatternAssignment(
  selectedRows: Ref<PatternListItem[]>,
  loaders: { reloadList: () => Promise<void> | void },
) {
  const canAssignSelection = computed(() => selectedRows.value.length > 0 && selectedRows.value.every((row) => row.canAssign))
  const assignDialog = reactive({ visible: false, submitting: false, rows: [] as PatternListItem[], error: '', succeeded: 0 })
  const assignFormRef = ref<FormInstance>()
  const assignForm = reactive({ patternMaster: '', sampleMaker: '' })
  const assignRules: FormRules = {
    patternMaster: [{ required: true, message: '请选择纸样师', trigger: 'change' }],
    sampleMaker: [{ required: true, message: '请选择车版师', trigger: 'change' }],
  }

  function openAssignDialog(rows = selectedRows.value) {
    if (!rows.length || rows.some((row) => !row.canAssign) || assignDialog.submitting) return
    assignForm.patternMaster = rows[0].patternMaster ?? ''
    assignForm.sampleMaker = rows[0].sampleMaker ?? ''
    Object.assign(assignDialog, { rows: [...rows], error: '', succeeded: 0, visible: true })
  }

  function resetAssignForm() {
    if (assignDialog.submitting) return
    Object.assign(assignDialog, { rows: [], error: '', succeeded: 0 })
    assignForm.patternMaster = ''
    assignForm.sampleMaker = ''
    assignFormRef.value?.clearValidate()
  }

  async function submitAssign() {
    if (assignDialog.submitting || !assignDialog.rows.length) return
    if (!assignForm.patternMaster.trim() || !assignForm.sampleMaker.trim()) {
      ElMessage.warning('请先选择纸样师和车版师')
      return
    }
    assignDialog.submitting = true
    assignDialog.error = ''
    let succeeded = 0
    const staff = { patternMaster: assignForm.patternMaster.trim(), sampleMaker: assignForm.sampleMaker.trim() }
    try {
      while (assignDialog.rows.length) {
        const row = assignDialog.rows[0]
        await assignPattern({ orderId: row.orderId, ...staff })
        Object.assign(row, staff, { patternStatus: 'in_progress' })
        assignDialog.rows.shift()
        assignDialog.succeeded++
        succeeded++
        selectedRows.value = selectedRows.value.filter((item) => item.orderId !== row.orderId)
      }
      assignDialog.visible = false
      ElMessage.success(`已分配 ${assignDialog.succeeded} 张订单`)
    } catch (error) {
      assignDialog.error = `已成功 ${assignDialog.succeeded} 张；订单 ${assignDialog.rows[0]?.orderNo ?? ''} 分配失败，剩余 ${assignDialog.rows.length} 张未确认成功。${getErrorMessage(error, '分配失败')}。重试只处理剩余订单。`
    } finally {
      if (succeeded) {
        const results = await Promise.allSettled([
          Promise.resolve().then(() => loaders.reloadList()),
        ])
        if (results.some((result) => result.status === 'rejected')) ElMessage.warning('分配已成功，但列表更新失败，请重新搜索查看')
      }
      assignDialog.submitting = false
    }
  }

  return { canAssignSelection, assignDialog, assignFormRef, assignForm, assignRules, openAssignDialog, resetAssignForm, submitAssign }
}
