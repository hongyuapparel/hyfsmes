import { onBeforeUnmount, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getSupplierOne, getSupplierRecentRecords, type SupplierItem, type SupplierRecentRecordItem } from '@/api/suppliers'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const DETAIL_DRAWER_MIN_WIDTH = 680
const DETAIL_DRAWER_DEFAULT_WIDTH = 860
const DETAIL_DRAWER_MAX_MARGIN = 48

export function useSupplierDetailDrawer() {
  const detailDrawerWidth = ref(DETAIL_DRAWER_DEFAULT_WIDTH)
  const detailDrawer = reactive<{
    visible: boolean
    loading: boolean
    data: SupplierItem | null
    recentRecords: SupplierRecentRecordItem[]
  }>({
    visible: false,
    loading: false,
    data: null,
    recentRecords: [],
  })
  const resizeMoveHandler = ref<((evt: MouseEvent) => void) | null>(null)
  const resizeUpHandler = ref<(() => void) | null>(null)

  function getDetailDrawerMaxWidth() {
    return Math.max(DETAIL_DRAWER_MIN_WIDTH, window.innerWidth - DETAIL_DRAWER_MAX_MARGIN)
  }

  function clampDetailDrawerWidth(width: number) {
    return Math.min(Math.max(width, DETAIL_DRAWER_MIN_WIDTH), getDetailDrawerMaxWidth())
  }

  function stopResizeDetailDrawer() {
    if (resizeMoveHandler.value) {
      window.removeEventListener('mousemove', resizeMoveHandler.value)
      resizeMoveHandler.value = null
    }
    if (resizeUpHandler.value) {
      window.removeEventListener('mouseup', resizeUpHandler.value)
      resizeUpHandler.value = null
    }
  }

  function startResizeDetailDrawer(event: MouseEvent) {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = detailDrawerWidth.value
    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX
      detailDrawerWidth.value = clampDetailDrawerWidth(startWidth + delta)
    }
    const onMouseUp = () => stopResizeDetailDrawer()
    stopResizeDetailDrawer()
    resizeMoveHandler.value = onMouseMove
    resizeUpHandler.value = onMouseUp
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  async function openDetailDrawer(row: SupplierItem) {
    detailDrawer.visible = true
    detailDrawer.loading = true
    detailDrawer.data = null
    detailDrawer.recentRecords = []
    detailDrawerWidth.value = clampDetailDrawerWidth(detailDrawerWidth.value)
    try {
      const [oneResponse, recentResponse] = await Promise.all([
        getSupplierOne(row.id),
        getSupplierRecentRecords(row.id, 10),
      ])
      detailDrawer.data = oneResponse.data ?? row
      detailDrawer.recentRecords = recentResponse.data ?? []
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    } finally {
      detailDrawer.loading = false
    }
  }

  onBeforeUnmount(() => {
    stopResizeDetailDrawer()
  })

  return {
    detailDrawer,
    detailDrawerWidth,
    startResizeDetailDrawer,
    openDetailDrawer,
  }
}
