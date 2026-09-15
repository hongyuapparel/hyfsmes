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
  const pendingAccounts = computed(() => {
    if (!data.value) return 0
    const { accounts, period } = data.value
    return accounts.filter(a => !a.reconciled_through || a.reconciled_through < period.dateTo || !a.opening_date || a.opening_date > period.dateFrom).length
  })
  const needsReview = computed(() => {
    if (!data.value) return false
    const { quality, accounts } = data.value
    return !accounts.length || pendingAccounts.value > 0 || [quality.unclassified, quality.missingAccount, quality.unknownDepartment, quality.missingDepartment].some(value => Number(value) > 0)
  })
  function flowLink(kind: 'income'|'expense', departmentId?: number | null, cashKind = filter.cashKind) {
    return { path: `/finance/${kind}`, query: { ...data.value?.period, ...(departmentId !== undefined ? {departmentId:String(departmentId ?? 0)} : {}), ...(cashKind ? {cashKind} : {}) } }
  }
  return { data, loading, error, filter, load, preset, pendingAccounts, needsReview, flowLink }
}
