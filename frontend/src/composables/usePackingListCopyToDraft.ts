import { computed, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { copyPackingListToDraft, type PackingListRow } from '@/api/packing-lists'
import { getErrorMessage, isErrorHandled } from '@/api/request'

interface CopyDialogState {
  visible: boolean
  submitting: boolean
  source: PackingListRow | null
  boxFrom: number
  boxTo: number
  remark: string
}

export function usePackingListCopyToDraft(reload: () => void | Promise<void>) {
  const copyDialog = reactive<CopyDialogState>({
    visible: false,
    submitting: false,
    source: null,
    boxFrom: 1,
    boxTo: 1,
    remark: '',
  })

  const copyMaxBox = computed(() => Math.max(1, copyDialog.source?.boxCount ?? 1))
  const normalizedCopyRange = computed(() => {
    const max = copyMaxBox.value
    const rawFrom = Math.min(max, Math.max(1, Math.floor(Number(copyDialog.boxFrom) || 1)))
    const rawTo = Math.min(max, Math.max(1, Math.floor(Number(copyDialog.boxTo) || rawFrom)))
    return { from: Math.min(rawFrom, rawTo), to: Math.max(rawFrom, rawTo) }
  })
  const copyRangeCount = computed(() => normalizedCopyRange.value.to - normalizedCopyRange.value.from + 1)

  function openCopyDialog(row: PackingListRow) {
    if (row.status !== 'draft') {
      ElMessage.warning('仅草稿装箱单可拆分')
      return
    }
    if (row.boxCount <= 0) {
      ElMessage.warning('该装箱单暂无箱子')
      return
    }
    copyDialog.source = row
    copyDialog.boxFrom = 1
    copyDialog.boxTo = row.boxCount
    copyDialog.remark = ''
    copyDialog.visible = true
  }

  async function submitCopyToDraft() {
    if (copyDialog.submitting) return
    const source = copyDialog.source
    if (!source) return
    const range = normalizedCopyRange.value
    copyDialog.submitting = true
    try {
      const res = await copyPackingListToDraft(source.id, {
        boxFrom: range.from,
        boxTo: range.to,
        remark: copyDialog.remark.trim() || undefined,
      })
      ElMessage.success(`已生成 ${res.data.code}`)
      copyDialog.visible = false
      copyDialog.source = null
      try {
        await reload()
      } catch {
        ElMessage.warning(`已生成 ${res.data.code}，但列表刷新失败，请手动刷新`)
      }
    } catch (e) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '生成新草稿失败'))
    } finally {
      copyDialog.submitting = false
    }
  }

  return {
    copyDialog,
    copyMaxBox,
    copyRangeCount,
    openCopyDialog,
    submitCopyToDraft,
  }
}
