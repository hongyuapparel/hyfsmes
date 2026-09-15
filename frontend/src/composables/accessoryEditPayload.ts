import type { AccessoryItem, updateAccessory } from '@/api/inventory'
import type { AccessoriesFormModel } from './useAccessoriesFormDialog'
import { cleanAccessoryMatrix } from '@/utils/accessorySizeMatrix'

/** 未修改的数量不回写，避免基础信息编辑覆盖期间发生的出入库。 */
export function buildAccessoryEditSizePayload(form: AccessoriesFormModel, original: AccessoryItem | null): Parameters<typeof updateAccessory>[1] {
  if (form.isSized && form.sizeQuantities.some(value => value != null && !Number.isInteger(value))) {
    throw new Error('分码数量必须是整数')
  }
  const matrix = form.isSized ? cleanAccessoryMatrix(form.sizeHeaders, form.sizeQuantities) : null
  const originalMatrix = original?.isSized ? cleanAccessoryMatrix(original.sizeHeaders ?? [], original.sizeQuantities ?? []) : null
  if (Boolean(original?.isSized) === form.isSized && JSON.stringify(matrix) === JSON.stringify(originalMatrix)) return {}
  if (!matrix) return { isSized: false }
  if (!matrix.headers.length) throw new Error('请填写分码尺码')
  return { isSized: true, sizeHeaders: matrix.headers, sizeQuantities: matrix.quantities }
}
