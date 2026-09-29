import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getPackingLists, type PackingListQuery, type PackingListRow, type PackingListListRes } from '@/api/packing-lists'
import { getErrorMessage, isErrorHandled } from '@/api/request'

type Summary = PackingListListRes['summary']
function normalizeSummary(summary: Summary | undefined): Summary | null {
  if (!summary) return null
  return { boxCount: Math.max(0, Number(summary.boxCount) || 0), totalQty: Math.max(0, Number(summary.totalQty) || 0) }
}
function sumRows(rows: PackingListRow[]): Summary {
  return rows.reduce((sum, row) => ({ boxCount: sum.boxCount + (Number(row.boxCount) || 0),
    totalQty: sum.totalQty + (Number(row.totalQty) || 0) }), { boxCount: 0, totalQty: 0 })
}

/** 保留旧接口汇总兼容逻辑，所有分页查询始终携带相同状态和筛选范围。 */
async function resolveFilterSummary(params: PackingListQuery, response: PackingListListRes): Promise<Summary> {
  const direct = normalizeSummary(response.summary)
  const current = sumRows(response.list ?? [])
  const stale = direct?.boxCount === 0 && direct?.totalQty === 0 && (current.boxCount > 0 || current.totalQty > 0)
  if (direct && !stale) return direct
  const total = Math.max(0, Number(response.total) || 0)
  if (!total) return { boxCount: 0, totalQty: 0 }
  const rows: PackingListRow[] = []
  for (let page = 1; page <= Math.ceil(total / 100); page++) {
    const res = await getPackingLists({ ...params, page, pageSize: 100 })
    const summary = normalizeSummary(res.data.summary)
    if (summary) return summary
    rows.push(...(res.data.list ?? []))
  }
  return sumRows(rows)
}

export function usePackingListData(query: () => PackingListQuery, afterLoad: () => void) {
  const list = ref<PackingListRow[]>([])
  const loading = ref(false)
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
  const filterSummary = reactive<Summary>({ boxCount: 0, totalQty: 0 })
  let loadSeq = 0
  async function load() {
    const seq = ++loadSeq
    loading.value = true
    try {
      const params = { ...query(), page: pagination.page, pageSize: pagination.pageSize }
      const res = await getPackingLists(params)
      if (seq !== loadSeq) return
      // 移走末页最后一条后，返回仍有记录的最后一页。
      const lastPage = Math.max(1, Math.ceil(res.data.total / pagination.pageSize))
      if (pagination.page > lastPage) { pagination.page = lastPage; await load(); return }
      const summary = await resolveFilterSummary(params, res.data)
      if (seq !== loadSeq) return
      list.value = res.data.list
      pagination.total = res.data.total
      Object.assign(filterSummary, summary)
      afterLoad()
    } catch (e) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载装箱单失败'))
    } finally {
      if (seq === loadSeq) loading.value = false
    }
  }
  return { list, loading, pagination, filterSummary, load }
}
