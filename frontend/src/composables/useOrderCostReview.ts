import { computed, type Ref } from 'vue'
import { ElMessageBox } from 'element-plus'
import type { OrderDetail } from '@/api/orders'
import { mergeMaterialRowsFromOrder, mergeProcessItemRowsFromOrder, type MaterialRow, type ProcessItemRow, type ProductionRow } from '@/utils/order-cost'
import { orderCostStructureDifferences, reviewCostRows } from '@/utils/order-cost-review'

export function useOrderCostReview(order: Ref<OrderDetail | null>, materials: Ref<MaterialRow[]>, processes: Ref<ProcessItemRow[]>, production: Ref<ProductionRow[]>, multiplier: Ref<number>) {
  const costIssues = computed(() => reviewCostRows(materials.value, processes.value, production.value, multiplier.value))
  const structureDifferences = computed(() => orderCostStructureDifferences(order.value, materials.value, processes.value))
  async function syncOrderStructure() {
    if (!order.value || !structureDifferences.value.length) return
    try {
      await ElMessageBox.confirm('将按当前订单重建物料和工艺项目，保留匹配项目的单价。成本页单独新增的项目会移除，未匹配项目需重新填写单价。同步后需保存草稿或重新确认报价。', '同步订单内容', {
        confirmButtonText: '确认同步', cancelButtonText: '保持当前成本', type: 'warning',
      })
    } catch { return }
    if (!order.value) return
    materials.value = mergeMaterialRowsFromOrder(order.value.materials ?? [], materials.value)
    processes.value = mergeProcessItemRowsFromOrder(order.value.processItems ?? [], processes.value)
  }
  return { costIssues, structureDifferences, syncOrderStructure }
}
