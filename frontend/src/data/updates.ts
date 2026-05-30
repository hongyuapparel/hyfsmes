/**
 * 更新文案归属的模块标签。
 * 与左侧菜单大类对齐，新增分类前先评估是否能并入现有项，避免越写越散。
 */
export type SystemUpdateModule =
  | '客户'
  | '订单'
  | '生产'
  | '库存'
  | '财务'
  | '供应商'
  | '人事'
  | '工具'
  | '设置'
  | '系统'

export interface SystemUpdate {
  /** 唯一 id，建议 `日期-短描述-英文`，如 `2026-06-01-order-sla-filter` */
  id: string
  /** 发布日期 `YYYY-MM-DD`，超过 7 天会自动从面板隐藏 */
  date: string
  /** 模块归属，从 SystemUpdateModule 枚举里挑 */
  module: SystemUpdateModule
  /** 标题：动词开头 + 一句话说清做了啥，不超过 20 字 */
  title: string
  /** 说明：1-3 句，站在用户视角说怎么用 / 能解决什么；不写技术词 */
  description: string
  /** 可选，能直接跳到对应页面就一定加 */
  link?: string
}

export const systemUpdates: SystemUpdate[] = [
  {
    id: '2026-05-29-system-updates-bell',
    date: '2026-05-29',
    module: '系统',
    title: '新增"系统更新"通知铃铛',
    description: '右上角铃铛会列出最近 7 天的功能更新，登录后会自动展开一次。后续每次有新更新跟随发版同步推送。',
  },
]
