import request from './request'
import type { SystemOptionTreeNode } from './system-options'

/**
 * 订单相关“设置项下拉”的统一读取入口。
 * - 数据源：后端 system-options 表
 * - 读取通道：/dicts（只读，面向业务页面），避免业务页依赖 /system-options 的 settings 权限
 */

export type DictType =
  | 'collaboration'
  | 'order_types'
  | 'product_groups'
  | 'material_types'
  | 'secondary_processes'
  | 'factories'

export function getDictOptions(type: DictType) {
  return request.get<string[]>('/dicts', { params: { type } })
}

export function getDictTree(type: DictType) {
  return request.get<SystemOptionTreeNode[]>('/dicts/tree', { params: { type } })
}

