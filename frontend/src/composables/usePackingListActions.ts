import { reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import {
  deletePackingList,
  getPackingListDetail,
  getPackingListLogs,
  type PackingListLogItem,
  type PackingListRow,
} from '@/api/packing-lists'
import { exportPackingListExcel } from '@/utils/packing-export'

/** 装箱单列表的批量勾选/导出/删除 + 操作记录抽屉编排（视图只负责绑定模板） */
export function usePackingListActions(reload: () => void) {
  const tableRef = ref<InstanceType<typeof import('element-plus')['ElTable']>>()
  const selectedRows = ref<PackingListRow[]>([])

  function onSelectionChange(rows: PackingListRow[]) {
    selectedRows.value = rows
  }

  function clearSelection() {
    tableRef.value?.clearSelection()
  }

  async function batchExport() {
    const rows = selectedRows.value
    if (!rows.length) return
    let ok = 0
    for (const row of rows) {
      try {
        const res = await getPackingListDetail(row.id)
        exportPackingListExcel(res.data)
        ok++
      } catch (e) {
        if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, `导出 ${row.code} 失败`))
      }
    }
    if (ok) ElMessage.success(`已导出 ${ok} 个装箱单`)
  }

  async function batchDelete() {
    const drafts = selectedRows.value.filter((r) => r.status === 'draft')
    const skipped = selectedRows.value.length - drafts.length
    if (!drafts.length) {
      ElMessage.warning('选中的装箱单均已发货，不可删除')
      return
    }
    const tip = skipped > 0 ? `（${skipped} 个已发货将跳过）` : ''
    try {
      await ElMessageBox.confirm(`确定删除选中的 ${drafts.length} 个草稿装箱单吗？${tip}`, '批量删除确认', { type: 'warning' })
    } catch {
      return
    }
    let ok = 0
    for (const row of drafts) {
      try {
        await deletePackingList(row.id)
        ok++
      } catch (e) {
        if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, `删除 ${row.code} 失败`))
      }
    }
    if (ok) ElMessage.success(`已删除 ${ok} 个装箱单`)
    clearSelection()
    reload()
  }

  const logDrawer = reactive<{ visible: boolean; title: string; loading: boolean; logs: PackingListLogItem[] }>({
    visible: false,
    title: '',
    loading: false,
    logs: [],
  })

  async function openLog(row: PackingListRow) {
    logDrawer.title = `操作记录 ${row.code}`
    logDrawer.logs = []
    logDrawer.visible = true
    logDrawer.loading = true
    try {
      const res = await getPackingListLogs(row.id)
      logDrawer.logs = res.data ?? []
    } catch (e) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载操作记录失败'))
    } finally {
      logDrawer.loading = false
    }
  }

  return { tableRef, selectedRows, onSelectionChange, clearSelection, batchExport, batchDelete, logDrawer, openLog }
}
