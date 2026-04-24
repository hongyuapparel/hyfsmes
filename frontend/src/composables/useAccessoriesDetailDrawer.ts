import { reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { getAccessoryOperationLogs, type AccessoryItem, type AccessoryOperationLog } from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export function useAccessoriesDetailDrawer() {
  const detailDrawer = reactive<{
    visible: boolean
    row: AccessoryItem | null
    loading: boolean
    logs: AccessoryOperationLog[]
  }>({
    visible: false,
    row: null,
    loading: false,
    logs: [],
  })

  function formatLogAction(action: string) {
    if (action === 'create') return '新建'
    if (action === 'update') return '编辑'
    if (action === 'outbound') return '出库'
    if (action === 'delete') return '删除'
    return action || '操作'
  }

  async function openDetail(row: AccessoryItem) {
    detailDrawer.row = row
    detailDrawer.visible = true
    detailDrawer.loading = true
    try {
      const res = await getAccessoryOperationLogs(row.id)
      detailDrawer.logs = res.data ?? []
    } catch (e: unknown) {
      detailDrawer.logs = []
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      detailDrawer.loading = false
    }
  }

  return {
    detailDrawer,
    formatLogAction,
    openDetail,
  }
}
