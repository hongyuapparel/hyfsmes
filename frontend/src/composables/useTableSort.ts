import { ref } from 'vue'

export type SortDir = 'asc' | 'desc' | ''

/**
 * 列表表头排序（后端排序）共用逻辑：
 * - 绑定 el-table 的 @sort-change；列上用 sortable="custom"
 * - sortParams() 注入到列表请求参数；变更时回调 onChange（通常回到第1页并重新加载）
 */
export function useTableSort(onChange: () => void) {
  const sortField = ref('')
  const sortOrder = ref<SortDir>('')

  function onSortChange(payload: { prop: string; order: 'ascending' | 'descending' | null }) {
    if (!payload.order) {
      sortField.value = ''
      sortOrder.value = ''
    } else {
      sortField.value = payload.prop
      sortOrder.value = payload.order === 'ascending' ? 'asc' : 'desc'
    }
    onChange()
  }

  function sortParams(): { sortField?: string; sortOrder?: 'asc' | 'desc' } {
    if (sortField.value && (sortOrder.value === 'asc' || sortOrder.value === 'desc')) {
      return { sortField: sortField.value, sortOrder: sortOrder.value }
    }
    return {}
  }

  function resetSort() {
    sortField.value = ''
    sortOrder.value = ''
  }

  return { sortField, sortOrder, onSortChange, sortParams, resetSort }
}
