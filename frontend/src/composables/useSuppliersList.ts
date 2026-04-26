import { onBeforeUnmount, reactive, ref } from 'vue'
import type { Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { deleteSupplier, getSupplierList, type SupplierItem } from '@/api/suppliers'
import { getErrorMessage, isErrorHandled } from '@/api/request'

interface UseSuppliersListResult {
  filter: { name: string; supplierTypeId: number | null }
  nameLabelVisible: Ref<boolean>
  list: Ref<SupplierItem[]>
  selectedIds: Ref<number[]>
  loading: Ref<boolean>
  pagination: { page: number; pageSize: number; total: number }
  load: () => Promise<void>
  onSearch: (byUser?: boolean) => void
  debouncedSearch: () => void
  onReset: () => void
  onPageSizeChange: () => void
  onSelectionChange: (rows: SupplierItem[]) => void
  onBatchDelete: () => Promise<void>
}

export function useSuppliersList(): UseSuppliersListResult {
  const filter = reactive<{ name: string; supplierTypeId: number | null }>({ name: '', supplierTypeId: null })
  const nameLabelVisible = ref(false)
  const list = ref<SupplierItem[]>([])
  const selectedIds = ref<number[]>([])
  const loading = ref(false)
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

  let searchTimer: ReturnType<typeof setTimeout> | null = null

  async function load() {
    loading.value = true
    try {
      const response = await getSupplierList({
        name: filter.name || undefined,
        supplierTypeId: filter.supplierTypeId ?? undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
      })
      const data = response.data
      if (data) {
        list.value = data.list ?? []
        pagination.total = data.total ?? 0
        selectedIds.value = []
      }
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    } finally {
      loading.value = false
    }
  }

  function onSearch(byUser = false) {
    if (byUser && filter.name && String(filter.name).trim()) nameLabelVisible.value = true
    pagination.page = 1
    void load()
  }

  function debouncedSearch() {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      searchTimer = null
      onSearch(false)
    }, 400)
  }

  function onReset() {
    nameLabelVisible.value = false
    filter.name = ''
    filter.supplierTypeId = null
    pagination.page = 1
    void load()
  }

  function onPageSizeChange() {
    pagination.page = 1
    void load()
  }

  function onSelectionChange(rows: SupplierItem[]) {
    selectedIds.value = rows.map((row) => row.id)
  }

  async function onBatchDelete() {
    if (!selectedIds.value.length) return
    try {
      await ElMessageBox.confirm(`确定删除已选 ${selectedIds.value.length} 条供应商记录？`, '提示', {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      })
      for (const id of selectedIds.value) {
        await deleteSupplier(id)
      }
      ElMessage.success('批量删除成功')
      await load()
    } catch (error: unknown) {
      if (error !== 'cancel' && !isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    }
  }

  onBeforeUnmount(() => {
    if (searchTimer) clearTimeout(searchTimer)
  })

  return {
    filter,
    nameLabelVisible,
    list,
    selectedIds,
    loading,
    pagination,
    load,
    onSearch,
    debouncedSearch,
    onReset,
    onPageSizeChange,
    onSelectionChange,
    onBatchDelete,
  }
}
