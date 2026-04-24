import { ref } from 'vue'
import { getDictItems, getDictTree } from '@/api/dicts'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import type { SystemOptionTreeNode } from '@/api/system-options'

interface DictItem {
  id: number
  value: string
}

export function useOrderDetailDictionaries() {
  const orderTypeTree = ref<SystemOptionTreeNode[]>([])
  const collaborationItems = ref<DictItem[]>([])
  const materialTypeItems = ref<DictItem[]>([])

  async function loadDicts() {
    try {
      const [orderTypeRes, collabRes, materialTypeRes] = await Promise.all([
        getDictTree('order_types'),
        getDictItems('collaboration'),
        getDictItems('material_types'),
      ])
      const orderTypeVals = orderTypeRes.data ?? []
      orderTypeTree.value = Array.isArray(orderTypeVals) ? orderTypeVals : []

      const collabVals = collabRes.data ?? []
      collaborationItems.value = Array.isArray(collabVals)
        ? collabVals.map((item: any) => ({ id: item.id, value: item.value }))
        : []

      const materialVals = materialTypeRes.data ?? []
      materialTypeItems.value = Array.isArray(materialVals)
        ? materialVals.map((item: any) => ({ id: item.id, value: item.value }))
        : []
    } catch (e: unknown) {
      if (!isErrorHandled(e)) {
        console.warn('订单字典加载失败', getErrorMessage(e))
      }
    }
  }

  function findOrderTypeLabelById(id: number | null | undefined): string {
    if (!id) return ''
    const stack: SystemOptionTreeNode[] = [...orderTypeTree.value]
    while (stack.length) {
      const node = stack.pop()!
      if (node.id === id) return node.value
      if (node.children?.length) stack.push(...node.children)
    }
    return ''
  }

  function findCollaborationLabelById(id: number | null | undefined): string {
    if (!id) return ''
    const found = collaborationItems.value.find((item) => item.id === id)
    return found?.value ?? ''
  }

  function findMaterialTypeLabelById(id: number | null | undefined): string {
    if (!id) return ''
    const found = materialTypeItems.value.find((item) => item.id === id)
    return found?.value ?? ''
  }

  return {
    loadDicts,
    findOrderTypeLabelById,
    findCollaborationLabelById,
    findMaterialTypeLabelById,
  }
}
