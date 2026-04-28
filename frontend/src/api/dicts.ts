import request from './request'
import type { AxiosRequestConfig } from 'axios'
import type { SystemOptionTreeNode, SystemOptionItem } from './system-options'

/**
 * 订单相关“设置项下拉”的统一读取入口。
 * - 数据源：后端 system-options 表
 * - 读取通道：/dicts（只读，面向业务页面），避免业务页依赖 /system-options 的 settings 权限
 */

export type DictType =
  | 'collaboration'
  | 'order_types'
  | 'product_groups'
  | 'applicable_people'
  | 'material_types'
  | 'material_sources'
  | 'secondary_processes'
  | 'factories'
  | 'warehouses'
  | 'inventory_types'
  | 'org_departments'
  | 'org_jobs'
  | 'supplier_types'
  | 'process_job_types'

export function getDictOptions(type: DictType, config?: AxiosRequestConfig) {
  return request.get<string[]>('/dicts', { params: { type }, ...(config ?? {}) })
}

export function getDictTree(type: DictType, config?: AxiosRequestConfig) {
  return request.get<SystemOptionTreeNode[]>('/dicts/tree', { params: { type }, ...(config ?? {}) })
}

/** 获取带 id 的完整字典项列表（用于按 optionId 存储与筛选） */
export function getDictItems(type: DictType, config?: AxiosRequestConfig) {
  return request.get<SystemOptionItem[]>('/dicts/list', { params: { type }, ...(config ?? {}) })
}
