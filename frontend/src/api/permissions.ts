import request from './request'

export interface PermissionItem {
  id: number
  code: string
  name: string
  type: string
  routePath: string
}

export function getPermissions() {
  return request.get<PermissionItem[]>('/permissions')
}

export function resyncAdminPermissions() {
  return request.post<{ success: boolean; message: string }>('/permissions/resync-admin')
}
