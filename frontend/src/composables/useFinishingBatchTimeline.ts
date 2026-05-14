import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getFinishingBatches, type FinishingBatchEvent } from '@/api/production-finishing'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export function useFinishingBatchTimeline() {
  const events = ref<FinishingBatchEvent[]>([])
  const loading = ref(false)

  async function load(orderId: number): Promise<void> {
    loading.value = true
    try {
      const res = await getFinishingBatches(orderId)
      events.value = Array.isArray(res.data) ? res.data : []
    } catch (e: unknown) {
      events.value = []
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载批次记录失败'))
    } finally {
      loading.value = false
    }
  }

  return { events, loading, load }
}
