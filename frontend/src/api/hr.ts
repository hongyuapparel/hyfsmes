import request from './request'
import { buildSharedGetKey, invalidateSharedGetCache, sharedGet } from './shared-request-cache'

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
  birthYear?: number | null
  birthMonth?: number | null
  birthDay?: number | null
  userId: number | null
  user?: { id: number; username: string; displayName: string } | null
  remark: string
  photoUrl: string
  createdAt: string
  updatedAt: string
}

export interface StaffOptionItem {
  id: number
  name: string
  departmentName: string
  jobTitleName: string
  status: string
}

export function getStaffOptions() {
  const key = buildSharedGetKey('/hr/staff-options')
  return sharedGet(key, () => request.get<StaffOptionItem[]>('/hr/staff-options'), { ttlMs: 30000 })
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
  birthMonth?: number
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
  return request.post<EmployeeItem>('/hr/items', body).then((response) => {
    invalidateSharedGetCache('/hr')
    return response
  })
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
  return request.put<EmployeeItem>(`/hr/items/${id}`, body).then((response) => {
    invalidateSharedGetCache('/hr')
    return response
  })
}

export function deleteEmployee(id: number) {
  return request.delete<void>(`/hr/items/${id}`).then((response) => {
    invalidateSharedGetCache('/hr')
    return response
  })
}

export function batchUpdateEmployeeOrder(items: { id: number; sort_order: number }[]) {
  return request.patch('/hr/batch/order', { items }).then((response) => {
    invalidateSharedGetCache('/hr')
    return response
  })
}

export function updateEmployeeSortOrder(id: number, sortOrder: number) {
  return request.patch(`/hr/items/${id}/sort-order`, { sort_order: sortOrder }).then((response) => {
    invalidateSharedGetCache('/hr')
    return response
  })
}

/** 人事页「关联用户」下拉，仅需 /hr 权限 */
export interface HrUserOption {
  id: number
  username: string
  displayName: string
}

export function getHrUserOptions() {
  const key = buildSharedGetKey('/hr/user-options')
  return sharedGet(key, () => request.get<HrUserOption[]>('/hr/user-options'), { ttlMs: 30000 })
}

export function checkEmployeeNameExists(name: string, excludeId?: number | null) {
  return request.get<{ exists: boolean }>('/hr/exists-name', {
    params: { name, excludeId: excludeId ?? undefined },
  })
}

export interface EmployeeHistoryItem {
  id: number
  employeeId: number
  entryDate: string | null
  leaveDate: string | null
  leaveReason: string
  remark: string
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export interface EmployeeYearlyRecordItem {
  id: number
  employeeId: number
  year: number
  type: 'spring_festival_return' | 'vacation_start' | 'work_start' | 'remark' | string
  value: string
  createdAt: string
  updatedAt: string
}

export function getEmployeeHistory(id: number) {
  return request.get<EmployeeHistoryItem[]>(`/hr/items/${id}/history`)
}

export function getEmployeeYearlyRecords(id: number) {
  return request.get<EmployeeYearlyRecordItem[]>(`/hr/items/${id}/yearly-records`)
}

export interface ImportRostersResult {
  importedEmployees: number
  importedHistory: number
  importedYearlyRecords: number
  unmatchedDepartments: string[]
  unmatchedJobTitles: string[]
  durationMs: number
}

export function importEmployeeRosters() {
  return request.post<ImportRostersResult>('/hr/import-rosters')
}
