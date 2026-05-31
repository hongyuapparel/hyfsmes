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
    id: '2026-05-31-sewing-allow-no-cut',
    date: '2026-05-31',
    module: '生产',
    title: '未过裁床订单也能登记车缝',
    description: '不需要过裁床的订单（裁床数全是0），打开"登记车缝完成"弹窗后，车缝数量直接按订单数量预填，可手动改，能正常保存。会提示"此订单未登记裁床数据"。',
  },
  {
    id: '2026-05-30-1-color-size-full-trail',
    date: '2026-05-30',
    module: '生产',
    title: '生产各环节颜色×尺码明细全程留存',
    description: '裁床/车缝/尾部收货/尾部入库/次品环节填写的颜色×尺码明细会完整保存。尾部、待仓 hover、详情页都以你填的原始数据为准，不再按订单计划估算。',
  },
  {
    id: '2026-05-30-2-materials-fabric-width',
    date: '2026-05-30',
    module: '订单',
    title: '订单物料新增"幅宽"列',
    description: '物料表增加了幅宽(cm)一列。能在订单编辑页填写面料幅宽，采购和生产环节能看到。',
  },
  {
    id: '2026-05-30-3-suppliers-dropdown-salesperson',
    date: '2026-05-30',
    module: '供应商',
    title: '供应商下拉对业务员开放',
    description: '业务员账号在订单编辑/采购/财务页可以看到供应商下拉列表了，不再需要供应商管理权限。',
  },
  {
    id: '2026-05-29-system-updates-bell',
    date: '2026-05-29',
    module: '系统',
    title: '新增"系统更新"通知铃铛',
    description: '右上角铃铛会列出最近 7 天的功能更新，登录后会自动展开一次。后续每次有新更新跟随发版同步推送。',
  },
]
