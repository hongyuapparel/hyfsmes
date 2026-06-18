import { ref } from 'vue'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getAccessoriesList, type AccessoryItem } from '@/api/inventory'

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
  const packagingCellKeys = ref<string[]>([])
  const packagingMethod = ref('')

  const accessoryDialogVisible = ref(false)
  const accessoryDialogLoading = ref(false)
  const accessoryItems = ref<AccessoryItem[]>([])
  const accessoryTargetIndex = ref<number | null>(null)

  let packagingCellKeySeed = 0

  function nextPackagingCellKey() {
    packagingCellKeySeed += 1
    return `packaging-cell-${packagingCellKeySeed}`
  }

  function normalizePackagingCells() {
    const len = packagingHeaders.value.length
    if (packagingCells.value.length < len) {
      const toAdd = len - packagingCells.value.length
      for (let i = 0; i < toAdd; i++) packagingCells.value.push({})
    } else if (packagingCells.value.length > len) {
      packagingCells.value.splice(len)
    }
    if (packagingCellKeys.value.length < len) {
      const toAdd = len - packagingCellKeys.value.length
      for (let i = 0; i < toAdd; i++) packagingCellKeys.value.push(nextPackagingCellKey())
    } else if (packagingCellKeys.value.length > len) {
      packagingCellKeys.value.splice(len)
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
    packagingCellKeys.value.splice(index, 1)
  }

  function movePackagingHeader(from: number, to: number) {
    const len = packagingHeaders.value.length
    if (from === to || from < 0 || to < 0 || from >= len || to >= len) return
    const [movedHeader] = packagingHeaders.value.splice(from, 1)
    packagingHeaders.value.splice(to, 0, movedHeader ?? '')
    const [movedCell] = packagingCells.value.splice(from, 1)
    packagingCells.value.splice(to, 0, movedCell ?? {})
    const [movedKey] = packagingCellKeys.value.splice(from, 1)
    packagingCellKeys.value.splice(to, 0, movedKey ?? nextPackagingCellKey())
  }

  async function loadAccessoryItems() {
    accessoryDialogLoading.value = true
    try {
      // 弹窗内按名称/客户做前端筛选，需一次性取回全部辅料；先查总数再按总数取，避免漏掉排在后面的条目
      const head = await getAccessoriesList({ page: 1, pageSize: 1 })
      const total = head.data?.total ?? 0
      const res = await getAccessoriesList({ page: 1, pageSize: Math.max(total, 1) })
      accessoryItems.value = res.data?.list ?? []
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
    packagingCellKeys,
    packagingMethod,
    accessoryDialogVisible,
    accessoryDialogLoading,
    accessoryItems,
    accessoryTargetIndex,
    normalizePackagingCells,
    getNextPackagingHeader,
    addPackagingHeader,
    removePackagingHeader,
    movePackagingHeader,
    loadAccessoryItems,
    openAccessoryDialog,
    onSelectAccessory,
  }
}
