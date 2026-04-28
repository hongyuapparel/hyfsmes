import { ref } from 'vue'
import { getDictItems } from '@/api/dicts'
import type { SystemOptionItem } from '@/api/system-options'

export interface BusinessScopeTreeNode {
  id: number
  value: number
  label: string
  children?: BusinessScopeTreeNode[]
}

export function useSupplierOptions() {
  const supplierTypeOptions = ref<{ id: number; label: string }[]>([])
  const businessScopeTreeByTypeId = ref<Record<number, BusinessScopeTreeNode[]>>({})
  const businessScopeLabelById = ref<Record<number, string>>({})

  function findSupplierTypeLabelById(id: number | null | undefined): string {
    if (id == null) return ''
    const item = supplierTypeOptions.value.find((option) => option.id === id)
    return item?.label ?? ''
  }

  function findBusinessScopeLabelById(id: number | null | undefined): string {
    if (id == null) return ''
    return businessScopeLabelById.value[id] ?? ''
  }

  function getScopeLabels(ids: number[] | null | undefined, fallbackId?: number | null): string[] {
    const labels = (Array.isArray(ids) ? ids : [])
      .map((id) => findBusinessScopeLabelById(id))
      .filter(Boolean)
    if (labels.length) return labels
    if (fallbackId != null) {
      const one = findBusinessScopeLabelById(fallbackId)
      return one ? [one] : []
    }
    return []
  }

  function formatBusinessScopes(ids: number[] | null | undefined, fallbackId?: number | null): string {
    const labels = getScopeLabels(ids, fallbackId)
    return labels.length ? labels.join('、') : '-'
  }

  function getBusinessScopeTreeByTypeId(typeId: number | null | undefined): BusinessScopeTreeNode[] {
    if (typeId == null) return []
    return businessScopeTreeByTypeId.value[typeId] ?? []
  }

  async function loadSupplierOptions() {
    try {
      const response = await getDictItems('supplier_types')
      const optionList = response.data ?? []
      const roots = optionList.filter((item) => item.parentId == null)
      supplierTypeOptions.value = roots.map((root) => ({ id: root.id, label: root.value }))

      const childrenByParent: Record<number, SystemOptionItem[]> = {}
      for (const option of optionList) {
        if (option.parentId == null) continue
        const parentId = option.parentId
        if (!childrenByParent[parentId]) childrenByParent[parentId] = []
        childrenByParent[parentId].push(option)
      }

      const nextTreeByTypeId: Record<number, BusinessScopeTreeNode[]> = {}
      const nextLabelById: Record<number, string> = {}

      const buildTree = (parentId: number, parentPath = ''): BusinessScopeTreeNode[] => {
        const children = childrenByParent[parentId] ?? []
        return children.map((child) => {
          const path = parentPath ? `${parentPath} / ${child.value}` : child.value
          nextLabelById[child.id] = path
          return {
            id: child.id,
            value: child.id,
            label: child.value,
            children: buildTree(child.id, path),
          }
        })
      }

      for (const root of roots) {
        nextTreeByTypeId[root.id] = buildTree(root.id)
      }

      businessScopeTreeByTypeId.value = nextTreeByTypeId
      businessScopeLabelById.value = nextLabelById
    } catch {
      supplierTypeOptions.value = []
      businessScopeTreeByTypeId.value = {}
      businessScopeLabelById.value = {}
    }
  }

  return {
    supplierTypeOptions,
    findSupplierTypeLabelById,
    getScopeLabels,
    formatBusinessScopes,
    getBusinessScopeTreeByTypeId,
    loadSupplierOptions,
  }
}

export function expandSelectedScopeIds(selectedIds: number[], tree: BusinessScopeTreeNode[]): number[] {
  if (!Array.isArray(selectedIds) || !selectedIds.length) return []

  const selected = new Set(selectedIds)
  const expanded = new Set<number>()

  const walk = (node: BusinessScopeTreeNode, inheritedSelected: boolean) => {
    const currentSelected = inheritedSelected || selected.has(node.id)
    if (currentSelected) expanded.add(node.id)
    if (node.children?.length) {
      for (const child of node.children) walk(child, currentSelected)
    }
  }

  for (const root of tree) walk(root, false)
  return [...expanded]
}
