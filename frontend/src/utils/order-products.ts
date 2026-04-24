import type { FieldDefinitionItem } from '@/api/field-definitions'
import type { SystemOptionTreeNode } from '@/api/system-options'

export interface ProductFieldLike {
  code: string
  label: string
  type: string
  order?: number
  visible?: number
  sortable?: boolean | number
  optionsKey?: string
  placeholder?: string
}

export interface GroupTreeNode {
  id: number | null
  path: string
  label: string
  count: number
  children?: GroupTreeNode[]
}

export interface FlatGroupNode {
  id: number | null
  path: string
  label: string
  count: number
  depth: number
  hasChildren: boolean
  collapsed: boolean
}

export interface ProductTableField {
  code: string
  label: string
  type: string
  sortable: boolean
}

export function productListColumnProp(f: { code: string }) {
  return f.code === 'companyName' ? undefined : f.code
}

export function getEffectiveProductFields(apiFields: FieldDefinitionItem[], localFields: ProductFieldLike[]) {
  if (!apiFields.length) return localFields
  const byCode = new Map(apiFields.map((f) => [f.code, f]))
  const merged = [...apiFields] as ProductFieldLike[]
  for (const f of localFields) {
    if (!byCode.has(f.code)) merged.push(f)
  }
  return merged
}

export function buildTableFields(fields: ProductFieldLike[]): ProductTableField[] {
  return fields
    .filter((f) => f.visible !== 0)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((f) => {
      const sortable = f.sortable === true || f.sortable === 1
      return {
        code: f.code,
        label: f.label,
        type: f.type,
        sortable,
      }
    })
}

export function buildFormFields(fields: ProductFieldLike[]) {
  const ordered = fields
    .filter((f) => f.code !== 'createdAt')
    .filter((f) => f.visible !== 0)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const productGroupIndex = ordered.findIndex((f) => f.code === 'productGroup')
  const applicablePeopleIndex = ordered.findIndex((f) => f.code === 'applicablePeople')
  if (productGroupIndex >= 0 && applicablePeopleIndex >= 0 && applicablePeopleIndex !== productGroupIndex + 1) {
    const [applicablePeopleField] = ordered.splice(applicablePeopleIndex, 1)
    ordered.splice(productGroupIndex + 1, 0, applicablePeopleField)
  }
  return ordered
}

export function formatDate(v: string | null | undefined) {
  if (!v) return '-'
  return new Date(v).toLocaleDateString('zh-CN')
}

export function toProductGroupTreeSelect(
  nodes: SystemOptionTreeNode[],
): { label: string; value: number; children?: ReturnType<typeof toProductGroupTreeSelect>; disabled?: boolean }[] {
  return nodes.map((n) => {
    const children = n.children?.length ? toProductGroupTreeSelect(n.children) : []
    const hasChildren = children.length > 0
    return {
      label: n.value,
      value: n.id,
      children: hasChildren ? children : undefined,
      disabled: hasChildren,
    }
  })
}

export function collectDefaultCollapsedPaths(nodes: SystemOptionTreeNode[], parentPath = ''): string[] {
  const result: string[] = []
  for (const n of nodes) {
    const path = parentPath ? `${parentPath} > ${n.value}` : n.value
    if (n.children?.length) {
      result.push(path)
      result.push(...collectDefaultCollapsedPaths(n.children, path))
    }
  }
  return result
}

export function buildGroupTreeWithCounts(
  tree: SystemOptionTreeNode[],
  countMap: Record<number, number>,
): GroupTreeNode[] {
  function build(nodes: SystemOptionTreeNode[], parentPath = ''): GroupTreeNode[] {
    return nodes.map((n) => {
      const path = parentPath ? `${parentPath} > ${n.value}` : n.value
      const childNodes = n.children?.length ? build(n.children, path) : []
      const childSum = childNodes.reduce((s, c) => s + c.count, 0)
      const direct = countMap[n.id] ?? 0
      const count = direct + childSum
      return {
        id: n.id,
        path,
        label: n.value,
        count,
        children: childNodes.length ? childNodes : undefined,
      }
    })
  }
  const children = build(tree)
  const totalFromMap = Object.values(countMap).reduce((s, n) => s + n, 0)
  return [
    {
      id: null,
      path: '',
      label: '全部分组',
      count: totalFromMap,
      children: children.length ? children : undefined,
    },
  ]
}

export function flattenGroupNodes(tree: GroupTreeNode[], collapsedPaths: string[]): FlatGroupNode[] {
  function flatten(nodes: GroupTreeNode[], depth = 0): FlatGroupNode[] {
    const result: FlatGroupNode[] = []
    for (const n of nodes) {
      const hasChildren = !!n.children?.length
      const isCollapsed = collapsedPaths.includes(n.path)
      result.push({
        id: n.id,
        path: n.path,
        label: n.label,
        count: n.count,
        depth,
        hasChildren,
        collapsed: isCollapsed,
      })
      if (hasChildren && !isCollapsed) {
        result.push(...flatten(n.children!, depth + 1))
      }
    }
    return result
  }
  return flatten(tree)
}

export function getColumnMinWidth(
  field: { code: string; type: string },
  imageColumnMinWidth: number,
): number {
  if (field.type === 'image') return imageColumnMinWidth
  if (field.type === 'date') return 120
  if (field.code === 'productName') return 180
  if (field.code === 'productGroup') return 160
  if (field.code === 'companyName') return 160
  if (field.code === 'skuCode') return 120
  return 110
}
