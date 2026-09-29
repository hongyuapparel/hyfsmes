import { computed, reactive, type Ref } from 'vue'
import { ElMessage } from 'element-plus'
import { setPackingListHold, type PackingListRow } from '@/api/packing-lists'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export const PACKING_STATUS_TABS = [
  { label: '全部', name: 'all', status: '' },
  { label: '草稿', name: 'draft', status: 'draft' },
  { label: '滞留待发', name: 'held', status: 'held' },
  { label: '已发货', name: 'shipped', status: 'shipped' },
] as const

export function packingStatusLabel(status: string): string {
  return PACKING_STATUS_TABS.find((tab) => tab.status === status)?.label ?? status
}

/** 按装箱日期计自然日，不把标记日冒充装箱日，也不自动判定滞留。 */
export function packingAgeLabel(packDate: string | null, now = new Date()): string {
  if (!packDate || !/^\d{4}-\d{2}-\d{2}$/.test(packDate)) return '-'
  const date = new Date(`${packDate}T00:00:00Z`)
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== packDate) return '-'
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const days = Math.floor((today - date.getTime()) / 86400000)
  return days < 0 ? '装箱日期未到' : `${days} 天`
}

export function usePackingListHold(selectedRows: Ref<PackingListRow[]>, reload: () => Promise<void>, clearSelection: () => void) {
  const holdDialog = reactive({ visible: false, submitting: false, status: 'held' as 'held' | 'draft', ids: [] as number[], reason: '' })
  const canHold = computed(() => selectedRows.value.length > 0 && selectedRows.value.every((row) => row.status === 'draft'))
  const canResume = computed(() => selectedRows.value.length > 0 && selectedRows.value.every((row) => row.status === 'held'))

  function openHold(rows: PackingListRow[], status: 'held' | 'draft') {
    if (!rows.length || holdDialog.submitting) return
    const sourceStatus = status === 'held' ? 'draft' : 'held'
    if (rows.some((row) => row.status !== sourceStatus)) {
      ElMessage.warning(status === 'held' ? '请仅选择草稿装箱单' : '请仅选择滞留待发装箱单')
      return
    }
    holdDialog.status = status
    holdDialog.ids = rows.map((row) => row.id)
    holdDialog.reason = ''
    holdDialog.visible = true
  }

  async function submitHold() {
    if (holdDialog.submitting || !holdDialog.ids.length) return
    holdDialog.submitting = true
    try {
      const res = await setPackingListHold({ ids: holdDialog.ids, status: holdDialog.status, reason: holdDialog.reason.trim() })
      ElMessage.success(`已${holdDialog.status === 'held' ? '标记滞留' : '移回草稿'} ${res.data.changed} 个装箱单`)
      holdDialog.visible = false
      clearSelection()
      await reload()
    } catch (e) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '切换分类失败，请重试'))
    } finally {
      holdDialog.submitting = false
    }
  }
  return { holdDialog, canHold, canResume, openHold, submitHold }
}
