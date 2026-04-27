/** 裁床登记：异常损耗原因（与后端 CUTTING_ABNORMAL_REASONS 一致） */
export const CUTTING_ABNORMAL_REASONS = [
  '布头布尾',
  '疵布/次布',
  '裁错返工',
  '缩水损耗',
  '色差换片',
  '排料正常损耗',
  '其他',
] as const

export type CuttingAbnormalReason = (typeof CUTTING_ABNORMAL_REASONS)[number]
