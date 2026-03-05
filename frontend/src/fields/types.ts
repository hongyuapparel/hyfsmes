/**
 * 共享字段类型定义
 * 同一字段在不同页面使用相同 code，保证显示一致
 * 后续可迁移至系统配置（DB），支持增减、排序
 */
export type FieldType = 'text' | 'date' | 'select' | 'number' | 'phone'

export interface FieldDefinition {
  /** 唯一标识，全系统统一，用于数据绑定与跨页面复用 */
  code: string
  /** 显示名称 */
  label: string
  /** 字段类型 */
  type: FieldType
  /** 是否可排序（日期、数字类） */
  sortable?: boolean
  /** 是否可作为筛选项 */
  filterable?: boolean
  /** 下拉选项来源（select 类型），如 'salespeople' | 'productGroups' */
  optionsKey?: string
  /** 表单项占位符 */
  placeholder?: string
  /** 电话类型时，第二个输入框（号码）的占位符 */
  placeholderSuffix?: string
  /** 表单/列表中的显示顺序（数字越小越靠前），后续由系统配置覆盖 */
  order: number
}
