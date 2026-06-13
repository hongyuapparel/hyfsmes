import { computed, ref } from 'vue'
import type { PickableLine } from '@/api/packing-lists'

export interface PackingItemDraft {
  styleNo: string
  styleName: string
  colorName: string
  imageUrl: string
  /** 码名→件数 */
  sizeQuantities: Record<string, number>
  /** 无分码数据（hasSnapshot=false 来源/纯手工）时手填的件数；有分码时以分码和为准 */
  totalQty: number
  sourceType: 'pending' | 'finished' | 'manual'
  sourceId: number | null
}

export interface PackingBoxDraft {
  key: string
  weightKg: number | null
  cartonSize: string
  remark: string
  items: PackingItemDraft[]
}

export interface PackingFlatRow {
  box: PackingBoxDraft
  item: PackingItemDraft
  boxIndex: number
  itemIndex: number
  isFirstRow: boolean
  rowspan: number
}

export interface OverAllocation {
  sourceType: 'pending' | 'finished'
  sourceId: number
  styleNo: string
  colorName: string
  /** null 表示按总量超发（pending / 无分码来源） */
  sizeName: string | null
  allocated: number
  available: number
}

interface SourceAllocation {
  totalQty: number
  sizeQuantities: Record<string, number>
  styleNo: string
}

/** 新增尺码列默认按此顺序补码，用尽后留空待手填 */
const STANDARD_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'XS', 'XXS', '均码']

let draftUid = 0
function nextKey(): string {
  draftUid += 1
  return `packing-draft-${draftUid}`
}

export function createEmptyPackingItem(): PackingItemDraft {
  return { styleNo: '', styleName: '', colorName: '', imageUrl: '', sizeQuantities: {}, totalQty: 0, sourceType: 'manual', sourceId: null }
}

export function packingItemTotal(item: PackingItemDraft): number {
  const sizeTotal = Object.values(item.sizeQuantities).reduce((sum, n) => sum + (Number(n) || 0), 0)
  return sizeTotal > 0 ? sizeTotal : Math.max(0, Number(item.totalQty) || 0)
}

export function allocationKey(sourceType: string, sourceId: number, colorName: string): string {
  return `${sourceType}:${sourceId}:${colorName.trim()}`
}

export function usePackingGridRows() {
  const sizeHeaders = ref<string[]>([])
  const boxes = ref<PackingBoxDraft[]>([])

  function createBox(): PackingBoxDraft {
    return { key: nextKey(), weightKg: null, cartonSize: '', remark: '', items: [createEmptyPackingItem()] }
  }

  function addBox(): void {
    boxes.value.push(createBox())
  }

  function removeBox(boxIndex: number): void {
    boxes.value.splice(boxIndex, 1)
  }

  function copyBox(boxIndex: number): void {
    const source = boxes.value[boxIndex]
    if (!source) return
    const clone: PackingBoxDraft = {
      key: nextKey(),
      weightKg: source.weightKg,
      cartonSize: source.cartonSize,
      remark: source.remark,
      items: source.items.map((item) => ({ ...item, sizeQuantities: { ...item.sizeQuantities } })),
    }
    boxes.value.splice(boxIndex + 1, 0, clone)
  }

  function addItemToBox(boxIndex: number, item?: PackingItemDraft): void {
    boxes.value[boxIndex]?.items.push(item ?? createEmptyPackingItem())
  }

  function removeItem(boxIndex: number, itemIndex: number): void {
    const box = boxes.value[boxIndex]
    if (!box) return
    box.items.splice(itemIndex, 1)
    if (!box.items.length) box.items.push(createEmptyPackingItem())
  }

  function insertSizeHeader(name: string, index?: number): boolean {
    const trimmed = name.trim()
    if (!trimmed || sizeHeaders.value.includes(trimmed)) return false
    const at = index != null && index >= 0 && index <= sizeHeaders.value.length ? index : sizeHeaders.value.length
    sizeHeaders.value.splice(at, 0, trimmed)
    return true
  }

  function removeSizeHeader(name: string): void {
    const at = sizeHeaders.value.indexOf(name)
    if (at < 0) return
    sizeHeaders.value.splice(at, 1)
    for (const box of boxes.value) {
      for (const item of box.items) {
        if (name in item.sizeQuantities) delete item.sizeQuantities[name]
      }
    }
  }

  /**
   * 新增一个尺码列：默认取下一个未用的标准码（S/M/L…），标准码用尽则留空待手填。
   * index 指定插入位置（在该下标前插入），不传则追加到末尾。返回新列的下标。
   */
  function addSizeColumn(index?: number): number {
    const used = new Set(sizeHeaders.value.map((h) => h.trim()))
    const next = STANDARD_SIZES.find((s) => !used.has(s)) ?? ''
    const at = index != null && index >= 0 && index <= sizeHeaders.value.length ? index : sizeHeaders.value.length
    sizeHeaders.value.splice(at, 0, next)
    return at
  }

  function columnHasData(name: string): boolean {
    if (!name) return false
    return boxes.value.some((box) => box.items.some((item) => (Number(item.sizeQuantities[name]) || 0) > 0))
  }

  function removeSizeColumnAt(index: number): void {
    const headers = sizeHeaders.value
    if (index < 0 || index >= headers.length) return
    const name = headers[index]
    headers.splice(index, 1)
    if (name) {
      for (const box of boxes.value) {
        for (const item of box.items) {
          if (name in item.sizeQuantities) delete item.sizeQuantities[name]
        }
      }
    }
  }

  /**
   * 提交列头改名（列头 v-model 已把 headers[index] 改为新值后调用）。
   * oldName 为进入编辑前的列名。返回提交结果，供前端提示。
   */
  function commitSizeHeader(index: number, oldName: string): 'ok' | 'duplicate' | 'removed' {
    const headers = sizeHeaders.value
    if (index < 0 || index >= headers.length) return 'ok'
    const newName = (headers[index] ?? '').trim()
    if (!newName) {
      // 空名：旧列有数据则撤销回旧名，否则删除该空列
      if (oldName && columnHasData(oldName)) {
        headers[index] = oldName
        return 'ok'
      }
      removeSizeColumnAt(index)
      return 'removed'
    }
    if (headers.some((h, i) => i !== index && h.trim() === newName)) {
      headers[index] = oldName
      return 'duplicate'
    }
    headers[index] = newName
    if (oldName && oldName !== newName) {
      for (const box of boxes.value) {
        for (const item of box.items) {
          if (oldName in item.sizeQuantities) {
            const v = item.sizeQuantities[oldName]
            delete item.sizeQuantities[oldName]
            item.sizeQuantities[newName] = v
          }
        }
      }
    }
    return 'ok'
  }

  const flatRows = computed<PackingFlatRow[]>(() => {
    const rows: PackingFlatRow[] = []
    boxes.value.forEach((box, boxIndex) => {
      box.items.forEach((item, itemIndex) => {
        rows.push({ box, item, boxIndex, itemIndex, isFirstRow: itemIndex === 0, rowspan: box.items.length })
      })
    })
    return rows
  })

  const totals = computed(() => {
    const bySize: Record<string, number> = {}
    let totalQty = 0
    let totalWeight = 0
    for (const box of boxes.value) {
      totalWeight += Number(box.weightKg) || 0
      for (const item of box.items) {
        totalQty += packingItemTotal(item)
        for (const [size, qty] of Object.entries(item.sizeQuantities)) {
          const n = Number(qty) || 0
          if (n > 0) bySize[size] = (bySize[size] ?? 0) + n
        }
      }
    }
    return { boxCount: boxes.value.length, totalQty, totalWeight, bySize }
  })

  const allocationBySource = computed<Map<string, SourceAllocation>>(() => {
    const map = new Map<string, SourceAllocation>()
    for (const box of boxes.value) {
      for (const item of box.items) {
        if (item.sourceType === 'manual' || item.sourceId == null) continue
        const key = allocationKey(item.sourceType, item.sourceId, item.colorName)
        const entry = map.get(key) ?? { totalQty: 0, sizeQuantities: {}, styleNo: item.styleNo }
        entry.totalQty += packingItemTotal(item)
        for (const [size, qty] of Object.entries(item.sizeQuantities)) {
          const n = Number(qty) || 0
          if (n > 0) entry.sizeQuantities[size] = (entry.sizeQuantities[size] ?? 0) + n
        }
        map.set(key, entry)
      }
    }
    return map
  })

  /** 超发校验：finished 有分码逐码比，pending/无分码按 source 总量比；无 picked 信息的来源跳过（后端兜底校验） */
  function validateAgainstPicked(picked: PickableLine[]): OverAllocation[] {
    const errors: OverAllocation[] = []
    const pickedByKey = new Map(picked.map((line) => [allocationKey(line.sourceType, line.sourceId, line.colorName), line]))
    const pendingAvailable = new Map<number, number>()
    for (const line of picked) {
      if (line.sourceType === 'pending') {
        pendingAvailable.set(line.sourceId, (pendingAvailable.get(line.sourceId) ?? 0) + line.totalQty)
      }
    }

    const pendingAllocated = new Map<number, { totalQty: number; styleNo: string; hasPicked: boolean }>()
    for (const [key, allocation] of allocationBySource.value) {
      const [sourceType, sourceIdRaw] = key.split(':')
      const sourceId = Number(sourceIdRaw)
      const line = pickedByKey.get(key)
      if (sourceType === 'pending') {
        const entry = pendingAllocated.get(sourceId) ?? { totalQty: 0, styleNo: allocation.styleNo, hasPicked: false }
        entry.totalQty += allocation.totalQty
        entry.hasPicked = entry.hasPicked || !!line
        pendingAllocated.set(sourceId, entry)
        continue
      }
      if (!line) continue
      if (line.hasSnapshot) {
        for (const [size, allocated] of Object.entries(allocation.sizeQuantities)) {
          const available = line.sizeQuantities[size] ?? 0
          if (allocated > available) {
            errors.push({ sourceType: 'finished', sourceId, styleNo: allocation.styleNo, colorName: line.colorName, sizeName: size, allocated, available })
          }
        }
      } else if (allocation.totalQty > line.totalQty) {
        errors.push({ sourceType: 'finished', sourceId, styleNo: allocation.styleNo, colorName: line.colorName, sizeName: null, allocated: allocation.totalQty, available: line.totalQty })
      }
    }

    for (const [sourceId, entry] of pendingAllocated) {
      if (!entry.hasPicked && !pendingAvailable.has(sourceId)) continue
      const available = pendingAvailable.get(sourceId) ?? 0
      if (entry.totalQty > available) {
        errors.push({ sourceType: 'pending', sourceId, styleNo: entry.styleNo, colorName: '', sizeName: null, allocated: entry.totalQty, available })
      }
    }
    return errors
  }

  return {
    sizeHeaders,
    boxes,
    flatRows,
    totals,
    allocationBySource,
    addBox,
    removeBox,
    copyBox,
    addItemToBox,
    removeItem,
    insertSizeHeader,
    removeSizeHeader,
    addSizeColumn,
    removeSizeColumnAt,
    commitSizeHeader,
    validateAgainstPicked,
  }
}
