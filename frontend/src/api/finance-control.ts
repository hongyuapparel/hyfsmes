import request from './request'

export const CASH_KIND_OPTIONS = [
  { value: 'operating', label: '经营收付' },
  { value: 'investing', label: '投资收付（设备等）' },
  { value: 'financing', label: '筹资收付（借款、注资等）' },
  { value: 'unclassified', label: '待分类' },
] as const
export type CashKind = typeof CASH_KIND_OPTIONS[number]['value']
export const cashKindLabel = (kind: string) => CASH_KIND_OPTIONS.find(item => item.value === kind)?.label ?? '待分类'
export interface FinanceAccountStatus {
  id: number; name: string; is_enabled: number; opening_date: string | null; opening_balance: string | null
  reconciled_through: string | null; reconciled_balance: string | null; bookBalance: string | null; asOf: string
}
export interface FinanceTransfer {
  id: number; occur_date: string; from_account_id: number; to_account_id: number; fromName: string; toName: string
  amount: string; bank_reference: string; remark: string; deleted_at: string | null
}
export interface FinanceTransferQuery { page: number; pageSize: number; status: string; keyword: string }
export interface FinanceTransferPage { list: FinanceTransfer[]; total: number; page: number; pageSize: number }
export interface FinanceAudit {
  id: number; action: string; actor_name: string; created_at: string; reason: string
  before_data: Record<string, unknown> | null; after_data: Record<string, unknown> | null
}
export interface FinanceTotals { totalIncome: string; totalExpense: string; netCashFlow: string }
export interface FinanceDashboardData {
  period: { dateFrom: string; dateTo: string }; cashKind: string; periodSummary: FinanceTotals
  previous: FinanceTotals & { period: { dateFrom: string; dateTo: string } }
  departments: (FinanceTotals & { departmentId: number | null; departmentName: string; previous: FinanceTotals })[]
  trend: (FinanceTotals & { month: string })[]; nature: (FinanceTotals & { cashKind: string })[]
  quality: { incomeCount: string; expenseCount: string; unclassified: string; missingAccount: string; missingDepartment: string; unknownDepartment: string; latest: string | null }
  accounts: FinanceAccountStatus[]; currentBookBalance: string | null; generatedAt: string
}
export const getFinanceDashboard = (params: { dateFrom: string; dateTo: string; cashKind?: string }) => request.get<FinanceDashboardData>('/finance/dashboard', { params })
export const getFinanceAccounts = (through?: string) => request.get<FinanceAccountStatus[]>('/finance/control/accounts', { params: { through } })
export const setFinanceOpening = (id: number, body: { date: string; amount: number; reason: string }) => request.post(`/finance/control/accounts/${id}/opening`, body)
export const reconcileFinanceAccount = (id: number, body: { date: string; amount: number }) => request.post(`/finance/control/accounts/${id}/reconcile`, body)
export const reopenFinanceAccount = (id: number, reason: string) => request.post(`/finance/control/accounts/${id}/reopen`, { reason })
export const getFinanceTransfers = (params: FinanceTransferQuery) => request.get<FinanceTransferPage>('/finance/control/transfers', { params })
export const createFinanceTransfer = (body: { date: string; amount: number; fromId: number | null; toId: number | null; reference: string; remark: string }) => request.post('/finance/control/transfers', body)
export const voidFinanceTransfer = (id: number, reason: string) => request.post(`/finance/control/transfers/${id}/void`, { reason })
export const getFinanceHistory = (kind: string, id: number) => request.get<FinanceAudit[]>(kind === 'income' || kind === 'expense' ? `/finance/${kind}/${id}/history` : `/finance/control/history/${kind}/${id}`)
export const restoreFinanceRecord = (kind: 'income' | 'expense', id: number, version: number, reason: string) => request.post(`/finance/${kind}/${id}/restore`, { version, reason })
