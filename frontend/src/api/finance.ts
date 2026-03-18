import request from './request'

/** 收入流水单条（含解析后的部门、银行账号名称） */
export interface IncomeRecordItem {
  id: number
  occurDate: string
  amount: string
  payer?: string
  departmentId: number | null
  bankAccountId: number | null
  departmentName: string
  bankAccountName: string
  remark: string
  attachments?: string[] | null
  createdAt: string
  updatedAt: string
}

/** 支出流水单条（含解析后的类型、部门、订单号、供应商名称） */
export interface ExpenseRecordItem {
  id: number
  occurDate: string
  amount: string
  expenseTypeId: number | null
  departmentId: number | null
  bankAccountId?: number | null
  payee?: string
  styleNo?: string
  orderId: number | null
  supplierId: number | null
  expenseTypeName: string
  departmentName: string
  bankAccountName?: string
  orderNo: string
  supplierName: string
  detail: string
  attachments?: string[] | null
  createdAt: string
  updatedAt: string
}

/** 收入流水列表 */
export function getIncomeList(params?: {
  dateFrom?: string
  dateTo?: string
  departmentId?: number | null
  bankAccountId?: number | null
  page?: number
  pageSize?: number
}) {
  return request.get<{
    list: IncomeRecordItem[]
    total: number
    page: number
    pageSize: number
  }>('/finance/income', { params })
}

/** 收入流水下拉选项 */
export function getIncomeOptions() {
  return request.get<{
    departments: { id: number; value: string }[]
    bankAccounts: { id: number; value: string }[]
  }>('/finance/income/options')
}

export function getIncomeOne(id: number) {
  return request.get<IncomeRecordItem>(`/finance/income/${id}`)
}

export function createIncome(body: {
  occurDate: string
  amount: number | string
  departmentId?: number | null
  bankAccountId?: number | null
  remark?: string
}) {
  return request.post<IncomeRecordItem>('/finance/income', body)
}

export function updateIncome(
  id: number,
  body: {
    occurDate?: string
    amount?: number | string
    departmentId?: number | null
    bankAccountId?: number | null
    remark?: string
  }
) {
  return request.patch<IncomeRecordItem>(`/finance/income/${id}`, body)
}

export function deleteIncome(id: number) {
  return request.delete(`/finance/income/${id}`)
}

/** 支出流水列表 */
export function getExpenseList(params?: {
  dateFrom?: string
  dateTo?: string
  expenseTypeId?: number | null
  departmentId?: number | null
  orderId?: number | null
  supplierId?: number | null
  page?: number
  pageSize?: number
}) {
  return request.get<{
    list: ExpenseRecordItem[]
    total: number
    page: number
    pageSize: number
  }>('/finance/expense', { params })
}

/** 支出流水下拉选项 */
export function getExpenseOptions() {
  return request.get<{
    expenseTypes: { id: number; value: string }[]
    departments: { id: number; value: string }[]
    bankAccounts?: { id: number; value: string }[]
  }>('/finance/expense/options')
}

export function getExpenseOne(id: number) {
  return request.get<ExpenseRecordItem>(`/finance/expense/${id}`)
}

export function createExpense(body: {
  occurDate: string
  amount: number | string
  expenseTypeId?: number | null
  departmentId?: number | null
  orderId?: number | null
  supplierId?: number | null
  detail?: string
}) {
  return request.post<ExpenseRecordItem>('/finance/expense', body)
}

export function updateExpense(
  id: number,
  body: {
    occurDate?: string
    amount?: number | string
    expenseTypeId?: number | null
    departmentId?: number | null
    orderId?: number | null
    supplierId?: number | null
    detail?: string
  }
) {
  return request.patch<ExpenseRecordItem>(`/finance/expense/${id}`, body)
}

export function deleteExpense(id: number) {
  return request.delete(`/finance/expense/${id}`)
}
