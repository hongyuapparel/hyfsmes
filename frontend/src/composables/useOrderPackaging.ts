import { ref } from 'vue'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getAccessoriesList, type AccessoryItem } from '@/api/inventory'

export interface PackagingCell {
  imageUrl?: string
  accessoryId?: number | null
  accessoryName?: string
  description?: string
}

export interface AccessoryDialogSearchQuery {
  name?: string
  customerName?: string
}

const defaultPackagingHeaders = ['主唛', '洗水唛', '吊牌', '包装袋', '包装贴纸', '外箱唛头']

/** 弹窗列表单页上限：避免一次渲染数百行缩略图 */
const ACCESSORY_DIALOG_PAGE_SIZE = 100

export function useOrderPackaging(options?: { getPreferredCustomer?: () => string }) {
  const packagingHeaders = ref<string[]>([...defaultPackagingHeaders])
  const packagingCells = ref<PackagingCell[]>([])
  const packagingCellKeys = ref<string[]>([])
  const packagingMethod = ref('')

  const accessoryDialogVisible = ref(false)
  const accessoryDialogLoading = ref(false)
  const accessoryItems = ref<AccessoryItem[]>([])
  const accessoryTargetIndex = ref<number | null>(null)
  /**
   * true：当前列表已是「浏览/搜索」结果（可含通用辅料），不再提示仅匹配客户。
   * false：仅订单客户匹配的部分列表。
   */
  const accessoryItemsFullLoaded = ref(false)
  /** 部分缓存对应的客户名 */
  const accessoryPartialCustomer = ref('')

  let packagingCellKeySeed = 0
  let accessoryLoadSeq = 0

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

  /** 服务端分页/模糊搜索，不再一次拉全库 */
  async function searchAccessoryItems(query: AccessoryDialogSearchQuery = {}) {
    const seq = ++accessoryLoadSeq
    accessoryDialogLoading.value = true
    try {
      const name = query.name?.trim() || undefined
      // 有名称时不传 customerName，由前端保留「客户匹配 + 通用」过滤；否则按客户拉匹配项
      const customerName = name ? undefined : query.customerName?.trim() || undefined
      const res = await getAccessoriesList({
        name,
        customerName,
        page: 1,
        pageSize: ACCESSORY_DIALOG_PAGE_SIZE,
        skipTotal: true,
      })
      if (seq !== accessoryLoadSeq) return
      accessoryItems.value = res.data?.list ?? []
      accessoryItemsFullLoaded.value = true
      accessoryPartialCustomer.value = ''
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('Failed to search accessory inventory', getErrorMessage(e))
    } finally {
      if (seq === accessoryLoadSeq) accessoryDialogLoading.value = false
    }
  }

  async function loadAccessoryItems(preferredCustomer?: string) {
    const seq = ++accessoryLoadSeq
    const cust = (preferredCustomer ?? '').trim()
    const showBlocking = !accessoryItems.value.length
    if (showBlocking) accessoryDialogLoading.value = true
    try {
      if (cust) {
        const matched = await getAccessoriesList({
          customerName: cust,
          page: 1,
          pageSize: ACCESSORY_DIALOG_PAGE_SIZE,
          skipTotal: true,
        })
        if (seq !== accessoryLoadSeq) return
        const list = matched.data?.list ?? []
        accessoryItems.value = list
        accessoryPartialCustomer.value = cust
        accessoryItemsFullLoaded.value = false
        if (list.length) {
          accessoryDialogLoading.value = false
          return
        }
      }
      // 无客户或不匹配：拉一页最近辅料（含通用）
      await searchAccessoryItems({})
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('Failed to load accessory inventory', getErrorMessage(e))
    } finally {
      if (seq === accessoryLoadSeq) accessoryDialogLoading.value = false
    }
  }

  async function openAccessoryDialog(index: number) {
    accessoryTargetIndex.value = index
    accessoryDialogVisible.value = true
    const preferred = (options?.getPreferredCustomer?.() ?? '').trim()
    if (accessoryItemsFullLoaded.value) return
    const samePartial =
      accessoryItems.value.length > 0 &&
      accessoryPartialCustomer.value.trim().toLowerCase() === preferred.toLowerCase()
    if (samePartial) return
    accessoryItems.value = []
    accessoryPartialCustomer.value = ''
    await loadAccessoryItems(preferred)
  }

  /** 弹窗筛选变化：名称走服务端；清空/切换客户时按需拉一页 */
  async function onAccessoryDialogSearch(query: AccessoryDialogSearchQuery) {
    const name = query.name?.trim() ?? ''
    const customerName = query.customerName?.trim() ?? ''
    if (name) {
      await searchAccessoryItems({ name, customerName })
      return
    }
    if (!customerName) {
      await searchAccessoryItems({})
      return
    }
    // 仅客户：回到「客户匹配」轻量列表
    accessoryItemsFullLoaded.value = false
    accessoryItems.value = []
    await loadAccessoryItems(customerName)
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
    accessoryItemsFullLoaded,
    accessoryTargetIndex,
    normalizePackagingCells,
    getNextPackagingHeader,
    addPackagingHeader,
    removePackagingHeader,
    movePackagingHeader,
    loadAccessoryItems,
    openAccessoryDialog,
    onAccessoryDialogSearch,
    onSelectAccessory,
  }
}
