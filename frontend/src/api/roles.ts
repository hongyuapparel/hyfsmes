import request from './request'

export interface RoleItem {
  id: number
  code: string
  name: string
  status: string
}

export function getRoles() {
  return request.get<RoleItem[]>('/roles')
}

export function createRole(data: { code: string; name: string }) {
  return request.post('/roles', data)
}

export function updateRole(id: number, data: { code?: string; name?: string; status?: string }) {
  return request.patch(`/roles/${id}`, data)
}

export function deleteRole(id: number) {
  return request.delete(`/roles/${id}`)
}

export function getRolePermissions(roleId: number) {
  return request.get<number[]>(`/roles/${roleId}/permissions`)
}

export function setRolePermissions(roleId: number, permissionIds: number[]) {
  return request.put(`/roles/${roleId}/permissions`, { permission_ids: permissionIds })
}
