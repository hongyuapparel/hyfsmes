import type { Ref } from 'vue'
import type { PackingBoxDraft } from './usePackingGridRows'

/** 新增尺码列默认按此顺序补码，用尽后留空待手填 */
const STANDARD_SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'XS', 'XXS', '均码']

/** 尺码列（表头）增删改：操作 sizeHeaders 顺序，并同步迁移各行 sizeQuantities 的 key */
export function usePackingSizeHeaders(sizeHeaders: Ref<string[]>, boxes: Ref<PackingBoxDraft[]>) {
  function insertSizeHeader(name: string, index?: number): boolean {
    const trimmed = name.trim()
    if (!trimmed || sizeHeaders.value.includes(trimmed)) return false
    const at = index != null && index >= 0 && index <= sizeHeaders.value.length ? index : sizeHeaders.value.length
    sizeHeaders.value.splice(at, 0, trimmed)
    return true
  }

  function removeSizeHeader(name: string): void {
    const at = sizeHeaders.value.indexOf(name)
    removeSizeColumnAt(at)
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
          if (name in item.sizeQuantities) {
            item.totalQty = 0
            delete item.sizeQuantities[name]
          }
        }
      }
    }
  }

  /**
   * 校验完成后，同步提交表头和数量键；输入中的临时名称不能进入业务数据。
   */
  function commitSizeHeader(index: number, proposedName: string): 'ok' | 'duplicate' | 'removed' {
    const headers = sizeHeaders.value
    if (index < 0 || index >= headers.length) return 'ok'
    const oldName = headers[index] ?? ''
    const newName = proposedName.trim()
    if (!newName) {
      // 空名：旧列有数据则撤销回旧名，否则删除该空列
      if (oldName && columnHasData(oldName)) {
        headers[index] = oldName
        return 'ok'
      }
      removeSizeColumnAt(index)
      return 'removed'
    }
    if (headers.some((h, i) => i !== index && h.trim() === newName) ||
        (oldName !== newName && columnHasData(newName))) {
      headers[index] = oldName
      return 'duplicate'
    }
    headers[index] = newName
    if (oldName && oldName !== newName) {
      for (const box of boxes.value) {
        for (const item of box.items) {
          if (oldName in item.sizeQuantities) {
            item.totalQty = 0
            const v = item.sizeQuantities[oldName]
            delete item.sizeQuantities[oldName]
            item.sizeQuantities[newName] = v
          }
        }
      }
    }
    return 'ok'
  }

  return { insertSizeHeader, removeSizeHeader, addSizeColumn, removeSizeColumnAt, commitSizeHeader }
}
