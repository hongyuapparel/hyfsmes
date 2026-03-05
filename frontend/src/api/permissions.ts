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
