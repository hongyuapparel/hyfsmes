/**
 * 产品列表 - 字段定义
 * 单一数据源：表单、列表、筛选、排序均基于此配置
 * 后续可在系统配置中增减、调整顺序
 */
import type { FieldDefinition } from './types'

export const PRODUCT_FIELDS: FieldDefinition[] = [
  { code: 'createdAt', label: '创建时间', type: 'date', order: 1, sortable: true, filterable: false },
  { code: 'skuCode', label: 'SKU编号', type: 'text', order: 2, filterable: true, placeholder: '输入SKU编号' },
  { code: 'imageUrl', label: '图片', type: 'image', order: 3, filterable: false, placeholder: '图片URL' },
  { code: 'productGroup', label: '产品分组', type: 'select', order: 4, filterable: true, optionsKey: 'productGroups', placeholder: '选择产品分组' },
  { code: 'companyName', label: '客户', type: 'select', order: 5, filterable: true, optionsKey: 'customers', placeholder: '选择客户' },
  { code: 'salesperson', label: '业务员', type: 'select', order: 6, filterable: true, optionsKey: 'salespeople', placeholder: '选择业务员' },
]

/** 按 order 排序后的字段列表 */
export const PRODUCT_FIELDS_SORTED = [...PRODUCT_FIELDS].sort((a, b) => a.order - b.order)

/** 筛选项字段 */
export const PRODUCT_FILTER_FIELDS = PRODUCT_FIELDS.filter((f) => f.filterable)
