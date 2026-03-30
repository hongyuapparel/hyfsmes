/**
 * 客户管理 - 字段定义
 * 单一数据源：表单、列表、筛选、排序均基于此配置
 * 后续可在系统配置中增减、调整顺序
 */
import type { FieldDefinition } from './types'

export const CUSTOMER_FIELDS: FieldDefinition[] = [
  { code: 'customerId', label: '客户编号', type: 'text', order: 1, filterable: false },
  { code: 'country', label: '国家', type: 'text', order: 2, filterable: false },
  {
    code: 'companyName',
    label: '公司名称',
    type: 'text',
    order: 3,
    filterable: true,
    placeholder: '输入公司名称或联系人',
  },
  { code: 'contactPerson', label: '联系人', type: 'text', order: 4, filterable: false },
  { code: 'contactInfo', label: '联系方式', type: 'phone', order: 5, filterable: false, placeholder: '国家代码', placeholderSuffix: '电话号码' },
  { code: 'cooperationDate', label: '合作日期', type: 'date', order: 6, sortable: true, filterable: false },
  { code: 'salesperson', label: '业务员', type: 'select', order: 7, filterable: true, optionsKey: 'salespeople', placeholder: '选择业务员' },
  { code: 'createdAt', label: '创建日期', type: 'date', order: 8, sortable: true, filterable: false },
  {
    code: 'lastOrderReferencedAt',
    label: '最近活跃日期',
    type: 'date',
    order: 9,
    sortable: true,
    filterable: false,
  },
  { code: 'productGroup', label: '产品分组', type: 'select', order: 10, filterable: false, optionsKey: 'productGroups', placeholder: '选择产品分组' },
]

/** 按 order 排序后的字段列表 */
export const CUSTOMER_FIELDS_SORTED = [...CUSTOMER_FIELDS].sort((a, b) => a.order - b.order)

/** 筛选项字段 */
export const CUSTOMER_FILTER_FIELDS = CUSTOMER_FIELDS_SORTED.filter((f) => f.filterable)
