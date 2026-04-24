import type { Ref } from 'vue'
import type { ProductionProcessItem } from '@/api/production-processes'
import type { SystemOptionItem, SystemOptionLazyNode } from '@/api/system-options'

export interface ProcessTreeRow {
  id: string | number
  rowType: 'department' | 'job_type' | 'process' | 'load_more'
  displayName: string
  department: string
  jobType: string
  processName: string
  price: string
  hasChildren: boolean
  nodeId?: number
  parentId?: number | null
  jobTypePath?: string
  processRow?: ProductionProcessItem
  loadedCount?: number
  totalCount?: number
}

export function getChildrenFromLocalCache(
  childrenMapRef: Ref<Map<number, SystemOptionItem[]>>,
  parentId: number,
): SystemOptionLazyNode[] | null {
  const children = childrenMapRef.value.get(parentId)
  if (!children) return null
  return children.map((child) => ({
    id: child.id,
    value: child.value,
    sortOrder: child.sortOrder,
    hasChildren: childrenMapRef.value.has(child.id),
  }))
}

export function mapJobTypeRowsFromChildren(
  children: SystemOptionLazyNode[],
  parentRow: ProcessTreeRow,
  processJobMetaByNodeIdRef: Ref<Map<number, { department: string; jobTypePath: string }>>,
): ProcessTreeRow[] {
  const parentPath = parentRow.rowType === 'department' ? parentRow.department : (parentRow.jobTypePath ?? parentRow.jobType)
  return children.map((child) => {
    const jobTypePath = `${parentPath} > ${child.value}`
    processJobMetaByNodeIdRef.value.set(child.id, { department: parentRow.department, jobTypePath })
    return {
      id: `job-${child.id}`,
      rowType: 'job_type',
      displayName: child.value,
      department: parentRow.department,
      jobType: jobTypePath,
      processName: '',
      price: '',
      hasChildren: true,
      nodeId: child.id,
      parentId: parentRow.nodeId ?? null,
      jobTypePath,
    }
  })
}

export function buildProcessRowsWithLoadMore(
  parentId: number,
  department: string,
  jobTypePath: string,
  list: ProductionProcessItem[],
  total: number,
  visibleCount: number,
): ProcessTreeRow[] {
  const visibleList = list.slice(0, visibleCount)
  const rows: ProcessTreeRow[] = visibleList.map((item) => ({
    id: item.id,
    rowType: 'process',
    displayName: item.name,
    department: item.department,
    jobType: item.jobType,
    processName: item.name,
    price: item.unitPrice,
    hasChildren: false,
    processRow: item,
  }))
  if (total > visibleList.length) {
    rows.push({
      id: `more-${parentId}`,
      rowType: 'load_more',
      displayName: '',
      department,
      jobType: jobTypePath,
      processName: '',
      price: '',
      hasChildren: false,
      parentId,
      jobTypePath,
      loadedCount: visibleList.length,
      totalCount: total,
    })
  }
  return rows
}

export function buildJobTypePathsFromList(list: SystemOptionItem[], rootId: number, rootValue: string): string[] {
  const childrenByParent = new Map<number, SystemOptionItem[]>()
  for (const item of list) {
    if (item.parentId == null) continue
    const bucket = childrenByParent.get(item.parentId) ?? []
    bucket.push(item)
    childrenByParent.set(item.parentId, bucket)
  }
  for (const bucket of childrenByParent.values()) {
    bucket.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
  }
  const result: string[] = []
  const queue = (childrenByParent.get(rootId) ?? []).map((child) => ({ id: child.id, path: `${rootValue} > ${child.value}` }))
  while (queue.length) {
    const current = queue.shift()!
    result.push(current.path)
    const next = childrenByParent.get(current.id) ?? []
    for (const item of next) queue.push({ id: item.id, path: `${current.path} > ${item.value}` })
  }
  return result
}

export function findProcessTreeRowByNodeId(data: ProcessTreeRow[], nodeId: number): ProcessTreeRow | null {
  const stack = [...data]
  while (stack.length) {
    const current = stack.shift()!
    if (current.nodeId === nodeId) return current
    const children = ((current as unknown as { children?: ProcessTreeRow[] }).children ?? [])
    if (children.length) stack.unshift(...children)
  }
  return null
}
