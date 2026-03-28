/**
 * 订单环节 SLA 判定文案与 Element Plus `el-tag` 的 `type` 映射。
 * 生产管理列表与财务「订单流转时效报表」等各阶段判定共用同一套文案（超期 / 未超期 / 进行中 / 未配置时限）。
 */
export function productionTimeRatingTagType(
  rating: string,
): 'success' | 'info' | 'warning' | 'danger' | undefined {
  if (rating === '超期') return 'danger'
  if (rating === '未超期') return 'success'
  if (rating === '进行中') return 'warning'
  if (rating === '未配置时限') return 'info'
  return undefined
}
