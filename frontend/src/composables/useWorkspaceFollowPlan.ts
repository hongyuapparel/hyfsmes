import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  upsertFollowPlan,
  createManualTask,
  updateManualTask,
  deleteManualTask,
  type WorkspaceFollowOrder,
  type WorkspaceManualTask,
} from '@/api/workspace'

export function useWorkspaceFollowPlan(
  orders: { value: WorkspaceFollowOrder[] },
  manualTasks: { value: WorkspaceManualTask[] },
  selectedDate: { value: string },
  onManualTasksChange: () => void,
) {
  const savingPlan = ref<number | null>(null)

  async function saveFollowDate(order: WorkspaceFollowOrder, date: string | null) {
    if (savingPlan.value === order.id) return
    savingPlan.value = order.id
    try {
      await upsertFollowPlan(order.id, { nextFollowDate: date })
      if (!order.followPlan) order.followPlan = { nextFollowDate: null, nextAction: null }
      order.followPlan.nextFollowDate = date
    } catch {
      ElMessage.error('保存失败')
    } finally {
      savingPlan.value = null
    }
  }

  async function saveFollowAction(order: WorkspaceFollowOrder, action: string | null) {
    if (savingPlan.value === order.id) return
    savingPlan.value = order.id
    try {
      await upsertFollowPlan(order.id, { nextAction: action })
      if (!order.followPlan) order.followPlan = { nextFollowDate: null, nextAction: null }
      order.followPlan.nextAction = action
    } catch {
      ElMessage.error('保存失败')
    } finally {
      savingPlan.value = null
    }
  }

  async function addManualTask(title: string) {
    if (!title.trim()) return
    try {
      await createManualTask({ workDate: selectedDate.value, title: title.trim() })
      await onManualTasksChange()
    } catch {
      ElMessage.error('新增失败')
    }
  }

  async function saveManualTaskDate(task: WorkspaceManualTask, date: string | null) {
    try {
      await updateManualTask(task.id, { nextFollowDate: date })
      task.nextFollowDate = date
    } catch {
      ElMessage.error('保存失败')
    }
  }

  async function saveManualTaskNote(task: WorkspaceManualTask, note: string | null) {
    try {
      await updateManualTask(task.id, { note })
      task.note = note
    } catch {
      ElMessage.error('保存失败')
    }
  }

  async function removeManualTask(task: WorkspaceManualTask) {
    try {
      await deleteManualTask(task.id)
      await onManualTasksChange()
    } catch {
      ElMessage.error('删除失败')
    }
  }

  return {
    savingPlan,
    saveFollowDate,
    saveFollowAction,
    addManualTask,
    saveManualTaskDate,
    saveManualTaskNote,
    removeManualTask,
  }
}
