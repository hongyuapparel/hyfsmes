import request from './request'

export interface LoginRes {
  access_token: string
}

export interface MeRes {
  id: number
  username: string
  displayName: string
  roleId: number
  roleName: string
  permissions: { id: number; code: string; name: string; type: string; routePath: string }[]
  orderPolicies?: {
    edit: string[]
    review: string[]
    delete: string[]
  }
}

export function login(username: string, password: string) {
  return request.post<LoginRes>('/auth/login', { username, password })
}

export function getMe() {
  return request.get<MeRes>('/auth/me')
}
