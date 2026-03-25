import request from './request'

export interface UserItem {
  id: number
  username: string
  displayName: string
  roleId: number
  role?: { id: number; name: string }
  status: string
  createdAt: string
  lastLoginAt: string | null
}

export function getUsers() {
  return request.get<UserItem[]>('/users')
}

export function searchUsers(params?: { keyword?: string; role?: string; status?: string }) {
  return request.get<UserItem[]>('/users/manage', { params })
}

export function createUser(data: { username: string; password: string; display_name?: string; role_id: number }) {
  return request.post('/users', data)
}

export function updateUser(id: number, data: { username?: string; display_name?: string; role_id?: number; status?: string }) {
  return request.patch(`/users/${id}`, data)
}

export function resetUserPassword(id: number, password: string) {
  return request.post(`/users/${id}/reset-password`, { password })
}
