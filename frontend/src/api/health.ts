import request from '@/api/request'

export interface HealthRes {
  status: string
}

export function getHealth() {
  return request.get<HealthRes>('/health')
}
