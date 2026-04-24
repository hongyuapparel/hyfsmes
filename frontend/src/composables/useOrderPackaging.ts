import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getAccessoriesList, type AccessoryItem } from '@/api/inventory'
import { uploadImage } from '@/api/uploads'

export interface PackagingCell {
  imageUrl?: string
  accessoryId?: number | null
  accessoryName?: string
  description?: string
}

const defaultPackagingHeaders = ['主唛', '洗水唛', '吊牌', '包装袋', '包装贴纸', '外箱唛头']

export function useOrderPackaging() {
  const packagingHeaders = ref<string[]>([...defaultPackagingHeaders])
  const packagingCells = ref<PackagingCell[]>([])
  const packagingMethod = ref('')
  const packagingFileInputRef = ref<HTMLInputElement | null>(null)
  const activePackagingIndex = ref<number | null>(null)

  const accessoryDialogVisible = ref(false)
  const accessoryDialogLoading = ref(false)
  const accessoryItems = ref<AccessoryItem[]>([])
  const accessoryTargetIndex = ref<number | null>(null)

  function normalizePackagingCells() {
    const len = packagingHeaders.value.length
    if (packagingCells.value.length < len) {
      const toAdd = len - packagingCells.value.length
      for (let i = 0; i < toAdd; i++) packagingCells.value.push({})
    } else if (packagingCells.value.length > len) {
      packagingCells.value.splice(len)
    }
  }

  normalizePackagingCells()

  function getNextPackagingHeader(): string {
    const existing = new Set(packagingHeaders.value.map((h) => String(h ?? '').trim()).filter(Boolean))
    const missingDefault = defaultPackagingHeaders.find((h) => !existing.has(h))
    if (missingDefault) return missingDefault
    return `项${packagingHeaders.value.length + 1}`
  }

  function addPackagingHeader() {
    packagingHeaders.value.push(getNextPackagingHeader())
    normalizePackagingCells()
  }

  function removePackagingHeader(index: number) {
    packagingHeaders.value.splice(index, 1)
    packagingCells.value.splice(index, 1)
  }

  function triggerPackagingUpload(index: number) {
    activePackagingIndex.value = index
    packagingFileInputRef.value?.click()
  }

  async function onPackagingFileChange(e: Event) {
    const input = e.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file || activePackagingIndex.value == null) return
    try {
      const url = await uploadImage(file)
      packagingCells.value[activePackagingIndex.value].imageUrl = url
    } catch (err: unknown) {
      if (!isErrorHandled(err)) ElMessage.error(getErrorMessage(err))
    } finally {
      activePackagingIndex.value = null
    }
  }

  async function loadAccessoryItems() {
    accessoryDialogLoading.value = true
    try {
      const res = await getAccessoriesList({ page: 1, pageSize: 200 })
      const data = res.data
      accessoryItems.value = data?.list ?? []
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('Failed to load accessory inventory', getErrorMessage(e))
    } finally {
      accessoryDialogLoading.value = false
    }
  }

  async function openAccessoryDialog(index: number) {
    accessoryTargetIndex.value = index
    accessoryDialogVisible.value = true
    if (!accessoryItems.value.length) {
      await loadAccessoryItems()
    }
  }

  function onSelectAccessory(row: AccessoryItem) {
    if (accessoryTargetIndex.value == null) return
    const cell = packagingCells.value[accessoryTargetIndex.value]
    if (cell) {
      cell.accessoryId = row.id ?? null
      cell.accessoryName = row.name
      cell.imageUrl = row.imageUrl || ''
    }
    accessoryDialogVisible.value = false
  }

  return {
    defaultPackagingHeaders,
    packagingHeaders,
    packagingCells,
    packagingMethod,
    packagingFileInputRef,
    activePackagingIndex,
    accessoryDialogVisible,
    accessoryDialogLoading,
    accessoryItems,
    accessoryTargetIndex,
    normalizePackagingCells,
    getNextPackagingHeader,
    addPackagingHeader,
    removePackagingHeader,
    triggerPackagingUpload,
    onPackagingFileChange,
    loadAccessoryItems,
    openAccessoryDialog,
    onSelectAccessory,
  }
}
