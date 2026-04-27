import request from './request'

// ─── 配置类型 ──────────────────────────────────────────────────────────────
export interface FinanceFundAccount {
  id: number
  name: string
  accountType: 'public' | 'private' | 'wechat' | 'alipay' | 'other'
  owner: string
  isEnabled: boolean
  sortOrder: number
}

export interface FinanceIncomeType {
  id: number
  name: string
  isEnabled: boolean
  sortOrder: number
}

export interface FinanceExpenseType {
  id: number
  name: string
  isEnabled: boolean
  sortOrder: number
}

export interface FinanceDropdownOptions {
  fundAccounts: FinanceFundAccount[]
  incomeTypes: FinanceIncomeType[]
  expenseTypes: FinanceExpenseType[]
}

export function getFinanceDropdownOptions() {
  return request.get<FinanceDropdownOptions>('/finance-settings/options')
}

// ─── 收入流水 ────────────────────────────────────────────────────────────────
export interface IncomeRecordItem {
  id: number
  occurDate: string
  amount: string
  incomeTypeId: number | null
  fundAccountId: number | null
  sourceName: string
  orderNo: string
  operator: string
  remark: string
  attachments: string[] | null
  incomeTypeName: string
  fundAccountName: string
  createdAt: string
  updatedAt: string
}

export function getIncomeList(params?: {
  dateFrom?: string
  dateTo?: string
  incomeTypeId?: number | null
  fundAccountId?: number | null
  sourceNameKeyword?: string
  orderNo?: string
  page?: number
  pageSize?: number
}) {
  return request.get<{ list: IncomeRecordItem[]; total: number; page: number; pageSize: number }>(
    '/finance/income',
    { params },
  )
}

export function getIncomeOne(id: number) {
  return request.get<IncomeRecordItem>(`/finance/income/${id}`)
}

export function createIncome(body: {
  occurDate: string
  amount: number | string
  incomeTypeId?: number | null
  fundAccountId?: number | null
  sourceName?: string
  orderNo?: string
  operator?: string
  remark?: string
  attachments?: string[] | null
}) {
  return request.post<IncomeRecordItem>('/finance/income', body)
}

export function updateIncome(id: number, body: Partial<Parameters<typeof createIncome>[0]>) {
  return request.patch<IncomeRecordItem>(`/finance/income/${id}`, body)
}

export function deleteIncome(id: number) {
  return request.delete(`/finance/income/${id}`)
}

// ─── 支出流水 ────────────────────────────────────────────────────────────────
export const OBJECT_TYPE_OPTIONS = [
  { value: 'supplier', label: '供应商' },
  { value: 'employee', label: '员工' },
  { value: 'platform', label: '平台' },
  { value: 'customer', label: '客户' },
  { value: 'other', label: '其他' },
] as const

export type ObjectType = 'supplier' | 'employee' | 'platform' | 'customer' | 'other'

export interface ExpenseRecordItem {
  id: number
  occurDate: string
  amount: string
  expenseTypeId: number | null
  fundAccountId: number | null
  objectType: string
  payeeName: string
  orderNo: string
  departmentId: number | null
  operator: string
  remark: string
  attachments: string[] | null
  expenseTypeName: string
  fundAccountName: string
  departmentName: string
  createdAt: string
  updatedAt: string
}

export function getExpenseList(params?: {
  dateFrom?: string
  dateTo?: string
  expenseTypeId?: number | null
  fundAccountId?: number | null
  payeeKeyword?: string
  orderNo?: string
  page?: number
  pageSize?: number
}) {
  return request.get<{ list: ExpenseRecordItem[]; total: number; page: number; pageSize: number }>(
    '/finance/expense',
    { params },
  )
}

export function getExpenseOne(id: number) {
  return request.get<ExpenseRecordItem>(`/finance/expense/${id}`)
}

export function createExpense(body: {
  occurDate: string
  amount: number | string
  expenseTypeId?: number | null
  fundAccountId?: number | null
  objectType?: string
  payeeName?: string
  orderNo?: string
  departmentId?: number | null
  operator?: string
  remark?: string
  attachments?: string[] | null
}) {
  return request.post<ExpenseRecordItem>('/finance/expense', body)
}

export function updateExpense(id: number, body: Partial<Parameters<typeof createExpense>[0]>) {
  return request.patch<ExpenseRecordItem>(`/finance/expense/${id}`, body)
}

export function deleteExpense(id: number) {
  return request.delete(`/finance/expense/${id}`)
}

// ─── 财务看板 ────────────────────────────────────────────────────────────────
export interface DashboardSummary {
  currentMonth: {
    totalIncome: string
    totalExpense: string
    orderExpense: string
    companyExpense: string
    orderProfit: string
  }
  accountBalances: Array<{ fundAccountId: number; fundAccountName: string; balance: string }>
  recentIncome: (IncomeRecordItem & { incomeTypeName: string })[]
  recentExpense: (ExpenseRecordItem & { expenseTypeName: string })[]
  expenseTypeTop5: Array<{ expenseTypeName: string; totalAmount: string }>
  departmentExpenseTop5: Array<{ departmentName: string; totalAmount: string }>
}

export function getDashboardSummary() {
  return request.get<DashboardSummary>('/finance/dashboard')
}

// ─── 财务设置 CRUD ───────────────────────────────────────────────────────────
export function getFundAccounts() {
  return request.get<FinanceFundAccount[]>('/finance-settings/fund-accounts')
}
export function createFundAccount(body: Omit<FinanceFundAccount, 'id'>) {
  return request.post<FinanceFundAccount>('/finance-settings/fund-accounts', body)
}
export function updateFundAccount(id: number, body: Partial<Omit<FinanceFundAccount, 'id'>>) {
  return request.patch<FinanceFundAccount>(`/finance-settings/fund-accounts/${id}`, body)
}
export function deleteFundAccount(id: number) {
  return request.delete(`/finance-settings/fund-accounts/${id}`)
}

export function getIncomeTypes() {
  return request.get<FinanceIncomeType[]>('/finance-settings/income-types')
}
export function createIncomeType(body: Omit<FinanceIncomeType, 'id'>) {
  return request.post<FinanceIncomeType>('/finance-settings/income-types', body)
}
export function updateIncomeType(id: number, body: Partial<Omit<FinanceIncomeType, 'id'>>) {
  return request.patch<FinanceIncomeType>(`/finance-settings/income-types/${id}`, body)
}
export function deleteIncomeType(id: number) {
  return request.delete(`/finance-settings/income-types/${id}`)
}

export function getExpenseTypes() {
  return request.get<FinanceExpenseType[]>('/finance-settings/expense-types')
}
export function createExpenseType(body: Omit<FinanceExpenseType, 'id'>) {
  return request.post<FinanceExpenseType>('/finance-settings/expense-types', body)
}
export function updateExpenseType(id: number, body: Partial<Omit<FinanceExpenseType, 'id'>>) {
  return request.patch<FinanceExpenseType>(`/finance-settings/expense-types/${id}`, body)
}
export function deleteExpenseType(id: number) {
  return request.delete(`/finance-settings/expense-types/${id}`)
}
