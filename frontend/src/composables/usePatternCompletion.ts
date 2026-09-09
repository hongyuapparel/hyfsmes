import { reactive, ref, type Ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { checkPatternCompletion, completePattern, editCompletedPattern, type PatternListItem } from '@/api/production-pattern'
import { uploadImage } from '@/api/uploads'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export function usePatternCompletion(
  selectedRows: Ref<PatternListItem[]>,
  loaders: { reloadList: () => Promise<void> | void; reloadTabCounts: () => Promise<void> | void },
) {
  const completeDialog = reactive<{
    visible: boolean; submitting: boolean; mode: 'complete' | 'edit'
    row: PatternListItem | null; rows: PatternListItem[]; batch: boolean; error: string
  }>({ visible: false, submitting: false, mode: 'complete', row: null, rows: [], batch: false, error: '' })
  const completeFormRef = ref<FormInstance>()
  const completeForm = reactive({ sampleImageUrl: '' })
  const completeRules: FormRules = {}
  const sampleImageFileInputRef = ref<HTMLInputElement | null>(null)
  const sampleImageUploading = ref(false)

  let beforeComplete: (() => Promise<boolean>) | undefined
  let afterComplete: (() => void) | undefined
  function openCompleteDialog(rows = selectedRows.value, before?: () => Promise<boolean>, after?: () => void) {
    if (!rows.length || rows.some((row) => row.patternStatus === 'completed')) return
    beforeComplete = before
    afterComplete = after
    Object.assign(completeDialog, {
      mode: 'complete', row: rows[0], rows: [...rows], batch: rows.length > 1, error: '', visible: true,
    })
    completeForm.sampleImageUrl = rows[0].sampleImageUrl ?? ''
  }

  function openEditCompletedDialog(rows = selectedRows.value) {
    beforeComplete = undefined
    afterComplete = undefined
    if (rows.length !== 1 || rows[0].patternStatus !== 'completed') return
    const row = rows[0]
    Object.assign(completeDialog, { mode: 'edit', row, rows: [row], batch: false, error: '', visible: true })
    completeForm.sampleImageUrl = row.sampleImageUrl ?? ''
  }

  function resetCompleteForm() {
    if (completeDialog.submitting || sampleImageUploading.value) return
    Object.assign(completeDialog, { row: null, rows: [], mode: 'complete', batch: false, error: '' })
    completeForm.sampleImageUrl = ''
    completeFormRef.value?.clearValidate()
    if (sampleImageFileInputRef.value) sampleImageFileInputRef.value.value = ''
  }

  function triggerSampleImageUpload() {
    if (!completeDialog.submitting && !sampleImageUploading.value) sampleImageFileInputRef.value?.click()
  }
  function clearSampleImage() {
    if (!completeDialog.submitting && !sampleImageUploading.value) completeForm.sampleImageUrl = ''
  }

  async function onSampleImageFileChange(event: Event) {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file || completeDialog.submitting || sampleImageUploading.value) return
    sampleImageUploading.value = true
    try {
      completeForm.sampleImageUrl = await uploadImage(file)
    } catch (error) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error, '上传失败'))
    } finally {
      sampleImageUploading.value = false
      target.value = ''
    }
  }

  async function submitComplete() {
    if (!completeDialog.rows.length || completeDialog.submitting || sampleImageUploading.value) return
    completeDialog.submitting = true
    completeDialog.error = ''
    const editing = completeDialog.mode === 'edit'
    let succeeded = 0
    try {
      if (!editing && beforeComplete && !await beforeComplete()) return
      if (!editing) {
        const { data } = await checkPatternCompletion(completeDialog.rows.map(row => row.orderId))
        if (data.issues.length) {
          completeDialog.error = '尚未完成任何订单，请先补齐以下问题：\n' + data.issues.map(issue => {
            const row = completeDialog.rows.find(item => item.orderId === issue.orderId)
            return `订单 ${row?.orderNo ?? issue.orderId}：${issue.message}`
          }).join('\n')
          return
        }
      }
      // 成功后移出待处理快照；失败重试不会重复提交前面已成功的订单。
      while (completeDialog.rows.length) {
        const row = completeDialog.rows[0]
        const payload = {
          orderId: row.orderId,
          sampleImageUrl: completeDialog.batch ? row.sampleImageUrl : completeForm.sampleImageUrl.trim(),
        }
        if (editing) await editCompletedPattern(payload)
        else await completePattern(payload)
        row.sampleImageUrl = payload.sampleImageUrl
        completeDialog.rows.shift()
        succeeded++
        selectedRows.value = selectedRows.value.filter((selected) => selected.orderId !== row.orderId)
      }
      completeDialog.visible = false
      afterComplete?.()
      ElMessage.success(editing ? '已保存纸样纠错（主状态未改）' : `已完成 ${succeeded} 张订单的纸样`)
    } catch (error) {
      completeDialog.error = `本次成功 ${succeeded} 张；订单 ${completeDialog.rows[0]?.orderNo ?? ''} 处理失败，剩余 ${completeDialog.rows.length} 张未确认成功。${getErrorMessage(error, '操作失败')}。可重试剩余订单。`
      if (!isErrorHandled(error)) ElMessage.error(completeDialog.error)
    } finally {
      if (succeeded) {
        const results = await Promise.allSettled([
          Promise.resolve().then(() => loaders.reloadList()),
          Promise.resolve().then(() => loaders.reloadTabCounts()),
        ])
        if (results.some((result) => result.status === 'rejected')) ElMessage.warning('操作已成功，但列表更新失败，请重新搜索查看')
      }
      completeDialog.submitting = false
    }
  }

  return {
    completeDialog, completeFormRef, completeForm, completeRules, sampleImageFileInputRef,
    sampleImageUploading, openCompleteDialog, openEditCompletedDialog, resetCompleteForm,
    triggerSampleImageUpload, clearSampleImage, onSampleImageFileChange, submitComplete,
  }
}
