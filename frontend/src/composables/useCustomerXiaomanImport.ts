import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getXiaomanList,
  importFromXiaoman,
  type XiaomanCompanyItem,
  type XiaomanImportRes,
} from '@/api/customers'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export function useCustomerXiaomanImport(onImported: () => void | Promise<void>) {
  const xiaomanDialogVisible = ref(false)
  const xiaomanKeyword = ref('')
  const xiaomanList = ref<XiaomanCompanyItem[]>([])
  const xiaomanLoading = ref(false)
  const xiaomanImporting = ref(false)
  const xiaomanSelectedIds = ref<number[]>([])
  const xiaomanResult = ref<XiaomanImportRes | null>(null)
  const xiaomanPagination = reactive({ page: 1, pageSize: 20, total: 0 })

  function openXiaomanImport() {
    xiaomanDialogVisible.value = true
  }

  async function loadXiaomanList() {
    xiaomanLoading.value = true
    try {
      const res = await getXiaomanList({
        page: xiaomanPagination.page,
        pageSize: xiaomanPagination.pageSize,
        keyword: xiaomanKeyword.value || undefined,
      })
      const data = res.data
      if (data) {
        xiaomanList.value = data.list ?? []
        xiaomanPagination.total = data.total ?? 0
      } else {
        xiaomanList.value = []
        xiaomanPagination.total = 0
      }
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    } finally {
      xiaomanLoading.value = false
    }
  }

  function onXiaomanSearch() {
    xiaomanPagination.page = 1
    void loadXiaomanList()
  }

  function onXiaomanClear() {
    xiaomanPagination.page = 1
    void loadXiaomanList()
  }

  function onXiaomanSelectionChange(rows: XiaomanCompanyItem[]) {
    xiaomanSelectedIds.value = rows.map((row) => row.company_id)
  }

  async function doXiaomanImport() {
    if (!xiaomanSelectedIds.value.length) return
    xiaomanImporting.value = true
    try {
      const res = await importFromXiaoman(xiaomanSelectedIds.value)
      const data = res.data
      if (data) {
        xiaomanResult.value = data
        ElMessage.success(`导入完成：成功 ${data.imported} 个，跳过 ${data.skipped} 个`)
      }
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    } finally {
      xiaomanImporting.value = false
    }
  }

  function resetXiaomanDialog() {
    xiaomanResult.value = null
    xiaomanSelectedIds.value = []
    xiaomanKeyword.value = ''
    xiaomanPagination.page = 1
  }

  async function closeXiaomanAndRefresh() {
    xiaomanDialogVisible.value = false
    await onImported()
  }

  watch(
    () => xiaomanKeyword.value,
    (value, oldValue) => {
      if (oldValue && !value) {
        xiaomanPagination.page = 1
        void loadXiaomanList()
      }
    },
  )

  return {
    xiaomanDialogVisible,
    xiaomanKeyword,
    xiaomanList,
    xiaomanLoading,
    xiaomanImporting,
    xiaomanSelectedIds,
    xiaomanResult,
    xiaomanPagination,
    openXiaomanImport,
    loadXiaomanList,
    onXiaomanSearch,
    onXiaomanClear,
    onXiaomanSelectionChange,
    doXiaomanImport,
    resetXiaomanDialog,
    closeXiaomanAndRefresh,
  }
}
