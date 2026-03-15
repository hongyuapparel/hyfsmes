import request from './request'

export interface EmployeeItem {
  id: number
  employeeNo: string
  name: string
  departmentId: number | null
  jobTitleId: number | null
  departmentName?: string
  jobTitleName?: string
  entryDate: string | null
  contactPhone: string
  status: string
  userId: number | null
  user?: { id: number; username: string; displayName: string } | null
  remark: string
  createdAt: string
  updatedAt: string
}

export function getEmployeeList(params?: {
  name?: string
  departmentId?: number
  jobTitleId?: number
  status?: string
  page?: number
  pageSize?: number
}) {
  return request.get<{ list: EmployeeItem[]; total: number; page: number; pageSize: number }>(
    '/hr/items',
    { params }
  )
}

export function getEmployeeOne(id: number) {
  return request.get<EmployeeItem>(`/hr/items/${id}`)
}

export function createEmployee(body: {
  employeeNo?: string
  name: string
  department?: string
  jobTitle?: string
  entryDate?: string
  contactPhone?: string
  status?: string
  userId?: number | null
  remark?: string
}) {
  return request.post<EmployeeItem>('/hr/items', body)
}

export function updateEmployee(
  id: number,
  body: {
    employeeNo?: string
    name?: string
    department?: string
    jobTitle?: string
    entryDate?: string
    contactPhone?: string
    status?: string
    userId?: number | null
    remark?: string
  }
) {
  return request.put<EmployeeItem>(`/hr/items/${id}`, body)
}

export function deleteEmployee(id: number) {
  return request.delete<void>(`/hr/items/${id}`)
}

/** 人事页「关联用户」下拉，仅需 /hr 权限 */
export interface HrUserOption {
  id: number
  username: string
  displayName: string
}

export function getHrUserOptions() {
  return request.get<HrUserOption[]>('/hr/user-options')
}
