import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  deleteOrphanImages,
  scanOrphanImages,
  type OrphanImageItem,
  type ScanOrphanImagesResult,
} from '@/api/uploads'
import { appConfirm } from '@/utils/message-box'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { resolveAssetUrl } from '@/utils/url'

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatTotalSize(bytes: number): string {
  return formatFileSize(bytes)
}

function toImageUrl(filename: string): string {
  return resolveAssetUrl(`/uploads/${filename}`)
}

export function useImageCleanup() {
  const scanning = ref(false)
  const deleting = ref(false)
  const scanResult = ref<ScanOrphanImagesResult | null>(null)
  const selectedFilenames = ref<string[]>([])

  const orphans = computed(() => scanResult.value?.orphans ?? [])
  const hasScanned = computed(() => scanResult.value !== null)
  const totalCount = computed(() => scanResult.value?.totalCount ?? 0)
  const totalSizeLabel = computed(() => formatTotalSize(scanResult.value?.totalSize ?? 0))
  const allSelected = computed(
    () => orphans.value.length > 0 && selectedFilenames.value.length === orphans.value.length,
  )
  const isIndeterminate = computed(
    () =>
      selectedFilenames.value.length > 0
      && selectedFilenames.value.length < orphans.value.length,
  )

  function rowImageUrl(row: OrphanImageItem): string {
    return toImageUrl(row.filename)
  }

  function formatMtime(iso: string): string {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('zh-CN', { hour12: false })
  }

  async function runScan() {
    scanning.value = true
    selectedFilenames.value = []
    try {
      scanResult.value = await scanOrphanImages()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      scanning.value = false
    }
  }

  function toggleSelectAll(checked: boolean) {
    selectedFilenames.value = checked ? orphans.value.map((o) => o.filename) : []
  }

  function invertSelection() {
    const set = new Set(selectedFilenames.value)
    selectedFilenames.value = orphans.value
      .filter((o) => !set.has(o.filename))
      .map((o) => o.filename)
  }

  function onSelectionChange(rows: OrphanImageItem[]) {
    selectedFilenames.value = rows.map((r) => r.filename)
  }

  async function deleteSelected() {
    if (!selectedFilenames.value.length) {
      ElMessage.warning('请先选择要删除的图片')
      return
    }
    try {
      await appConfirm(
        `确定删除选中的 ${selectedFilenames.value.length} 个孤立图片？此操作不可恢复。`,
        '删除确认',
        { type: 'warning' },
      )
    } catch {
      return
    }

    deleting.value = true
    try {
      const result = await deleteOrphanImages([...selectedFilenames.value])
      const deletedSet = new Set(result.deleted)
      if (result.deleted.length) {
        ElMessage.success(`已删除 ${result.deleted.length} 个文件`)
      }
      if (result.skipped.length) {
        ElMessage.warning(
          `${result.skipped.length} 个文件跳过：${result.skipped.map((s) => s.filename).join('、')}`,
        )
      }
      if (scanResult.value) {
        const remaining = scanResult.value.orphans.filter((o) => !deletedSet.has(o.filename))
        scanResult.value = {
          ...scanResult.value,
          orphans: remaining,
          totalCount: remaining.length,
          totalSize: remaining.reduce((sum, o) => sum + o.sizeBytes, 0),
        }
      }
      selectedFilenames.value = []
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      deleting.value = false
    }
  }

  return {
    scanning,
    deleting,
    scanResult,
    selectedFilenames,
    orphans,
    hasScanned,
    totalCount,
    totalSizeLabel,
    allSelected,
    isIndeterminate,
    rowImageUrl,
    formatMtime,
    formatFileSize,
    runScan,
    toggleSelectAll,
    invertSelection,
    onSelectionChange,
    deleteSelected,
  }
}
