import { computed, reactive, ref } from 'vue'
import { getFinanceDashboard, type FinanceDashboardData } from '@/api/finance-control'

export const financeAmount = (value: string | number | null | undefined) => value == null ? '待核对' : Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
export function useFinanceDashboard() {
  const data = ref<FinanceDashboardData | null>(null)
  const loading = ref(false)
  const error = ref('')
  const filter = reactive({ range: [today().slice(0,4) + '-01-01', today()] as [string,string] | null, cashKind: '' })
  let generation = 0
  async function load() {
    const requestId = ++generation
    loading.value = true; error.value = ''
    try {
      const range = filter.range || [today().slice(0,4) + '-01-01', today()]
      const result = await getFinanceDashboard({ dateFrom: range[0], dateTo: range[1], cashKind: filter.cashKind || undefined })
      if (requestId === generation) data.value = result.data
    } catch (e) {
      if (requestId === generation) { data.value = null; error.value = e instanceof Error ? e.message : '看板加载失败，请重试' }
    } finally { if (requestId === generation) loading.value = false }
  }
  function preset(kind: string) {
    const now = new Date(today()); const year = now.getUTCFullYear(); const month = now.getUTCMonth()
    const start = kind === 'month' ? new Date(Date.UTC(year,month,1)) : kind === 'quarter' ? new Date(Date.UTC(year,Math.floor(month/3)*3,1)) : kind === 'lastMonth' ? new Date(Date.UTC(year,month-1,1)) : new Date(Date.UTC(year,0,1))
    filter.range = [start.toISOString().slice(0,10), kind === 'lastMonth' ? new Date(Date.UTC(year,month,0)).toISOString().slice(0,10) : today()]
    return load()
  }
  const warnings = computed(() => {
    if (!data.value) return []
    const { quality:q, accounts, period } = data.value
    const messages: string[] = []
    const pending = accounts.filter(a => !a.reconciled_through || a.reconciled_through < period.dateTo || !a.opening_date || a.opening_date > period.dateFrom)
    if (!accounts.length) messages.push('尚未配置资金账户')
    if (pending.length) messages.push(`${pending.length} 个账户尚未覆盖本期完整核对，当前数字仅代表已登记流水`)
    if (!Number(q.expenseCount)) messages.push('本期没有已登记支出，不代表公司没有支出')
    if (!Number(q.incomeCount)) messages.push('本期没有已登记收款，不代表公司没有回款')
    if (Number(q.unclassified)) messages.push(`${q.unclassified} 笔收支性质待分类，经营收付可能尚未统计完整`)
    if (Number(q.missingAccount)) messages.push(`${q.missingAccount} 笔流水未关联有效资金账户`)
    if (Number(q.unknownDepartment) || Number(q.missingDepartment)) messages.push(`${q.unknownDepartment} 笔部门失效，${q.missingDepartment} 笔待归属`)
    return messages
  })
  function flowLink(kind: 'income'|'expense', departmentId?: number | null, cashKind = filter.cashKind) {
    return { path: `/finance/${kind}`, query: { ...data.value?.period, ...(departmentId !== undefined ? {departmentId:String(departmentId ?? 0)} : {}), ...(cashKind ? {cashKind} : {}) } }
  }
  return { data, loading, error, filter, load, preset, warnings, flowLink }
}
