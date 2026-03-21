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

/** 根据角色名称获取系统建议的编码（与菜单/业务命名一致） */
export function suggestRoleCode(name: string) {
  return request.get<{ code: string | null }>('/roles/suggest-code', {
    params: { name: (name || '').trim() },
  })
}

export function createRole(data: { code?: string; name: string }) {
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

export interface RoleOrderPolicies {
  edit: string[]
  review: string[]
  delete: string[]
}

export function getRoleOrderPolicies(roleId: number) {
  return request.get<RoleOrderPolicies>(`/roles/${roleId}/order-policies`, {
    skipGlobalErrorHandler: true,
  } as any)
}

export function setRoleOrderPolicies(roleId: number, data: Partial<RoleOrderPolicies>) {
  return request.put(`/roles/${roleId}/order-policies`, data, {
    skipGlobalErrorHandler: true,
  } as any)
}
