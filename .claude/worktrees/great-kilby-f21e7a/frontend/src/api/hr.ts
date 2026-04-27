import request from './request'

export interface EmployeeItem {
  id: number
  employeeNo: string
  sortOrder?: number
  name: string
  gender: string
  departmentId: number | null
  jobTitleId: number | null
  departmentName?: string
  jobTitleName?: string
  entryDate: string | null
  contactPhone: string
  education: string
  dormitory: string
  idCardNo: string
  nativePlace: string
  homeAddress: string
  emergencyContact: string
  emergencyPhone: string
  leaveDate: string | null
  leaveReason: string
  status: string
  userId: number | null
  user?: { id: number; username: string; displayName: string } | null
  remark: string
  photoUrl: string
  createdAt: string
  updatedAt: string
}

export function getEmployeeList(params?: {
  name?: string
  departmentId?: number
  jobTitleId?: number
  status?: string
  entryDateStart?: string
  entryDateEnd?: string
  leaveDateStart?: string
  leaveDateEnd?: string
  sortBy?: 'sortOrder' | 'name' | 'entryDate' | 'status'
  sortOrder?: 'asc' | 'desc'
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
  gender?: string
  departmentId?: number | null
  jobTitleId?: number | null
  entryDate?: string
  contactPhone?: string
  education?: string
  dormitory?: string
  idCardNo?: string
  nativePlace?: string
  homeAddress?: string
  emergencyContact?: string
  emergencyPhone?: string
  leaveDate?: string
  leaveReason?: string
  status?: string
  userId?: number | null
  remark?: string
  photoUrl?: string
}) {
  return request.post<EmployeeItem>('/hr/items', body)
}

export function updateEmployee(
  id: number,
  body: {
    employeeNo?: string
    name?: string
    gender?: string
    departmentId?: number | null
    jobTitleId?: number | null
    entryDate?: string
    contactPhone?: string
    education?: string
    dormitory?: string
    idCardNo?: string
    nativePlace?: string
    homeAddress?: string
    emergencyContact?: string
    emergencyPhone?: string
    leaveDate?: string
    leaveReason?: string
    status?: string
    userId?: number | null
    remark?: string
    photoUrl?: string
  }
) {
  return request.put<EmployeeItem>(`/hr/items/${id}`, body)
}

export function deleteEmployee(id: number) {
  return request.delete<void>(`/hr/items/${id}`)
}

export function batchUpdateEmployeeOrder(items: { id: number; sort_order: number }[]) {
  return request.patch('/hr/batch/order', { items })
}

export function updateEmployeeSortOrder(id: number, sortOrder: number) {
  return request.patch(`/hr/items/${id}/sort-order`, { sort_order: sortOrder })
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

export function checkEmployeeNameExists(name: string, excludeId?: number | null) {
  return request.get<{ exists: boolean }>('/hr/exists-name', {
    params: { name, excludeId: excludeId ?? undefined },
  })
}
