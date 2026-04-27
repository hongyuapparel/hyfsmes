import { ref } from 'vue'

let hideTimer: ReturnType<typeof setTimeout> | null = null

/** 当前打开的桌面端悬停预览实例 id（同一时间仅一个浮层） */
export const imageThumbPreviewActiveId = ref<string | null>(null)

let seq = 0

export function nextImageThumbPreviewInstanceId(): string {
  return `app-image-thumb-${++seq}`
}

export function imageThumbPreviewOpen(id: string): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
  imageThumbPreviewActiveId.value = id
}

export function imageThumbPreviewScheduleClose(id: string, delay = 120): void {
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    if (imageThumbPreviewActiveId.value === id) imageThumbPreviewActiveId.value = null
    hideTimer = null
  }, delay)
}

export function imageThumbPreviewCancelClose(): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

