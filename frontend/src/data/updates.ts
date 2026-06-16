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
    id: '2026-06-16-orders-unquoted-todo',
    date: '2026-06-16',
    module: '订单',
    title: '新增待报价款式提醒',
    description: '样品单做完后，如果跟单忘了报价，系统现在会自动识别。首页待办新增"待报价"卡片，列出所有已进入"订单完成"、但成本页还没点过"确认报价"的样品款式；点"查看全部"直接进过滤好的订单列表。也可在订单列表通过该入口查看，右上角会显示"仅看待报价"标签，点叉即可退出。',
    link: '/orders/list?unquoted=1',
  },
  {
    id: '2026-06-04-dedupe-supplier-processing-options',
    date: '2026-06-04',
    module: '供应商',
    title: '加工供应商业务范围自动去重',
    description: '"系统设置 → 供应商设置 → 加工供应商"下面历史多次导入时把 A/B/C/D/E 加工方式写了 3-4 份，订单和供应商抽屉里同一项重复出现。系统启动会自动合并这些重复项（保留最早一条），并把曾经选过重复项的供应商引用迁到保留的那条，已配好的供应商不会因为去重而丢业务范围。',
    link: '/settings/suppliers',
  },
  {
    id: '2026-06-02-align-process-dropdown-with-supplier-settings',
    date: '2026-06-02',
    module: '供应商',
    title: '工艺项目下拉跟供应商设置对齐',
    description: '原来订单编辑"工艺项目"下拉里看到的层级，跟"系统设置 → 供应商设置"里配置的对不上（个别子项错挂到更深一层）。系统启动会自动清掉历史错位数据，往后两边完全一致；以后再有人不小心建到第 4 层，会被直接拦下。',
    link: '/settings/suppliers',
  },
  {
    id: '2026-06-02-fix-warehouse-keeper-403-on-accessories',
    date: '2026-06-02',
    module: '库存',
    title: '修复仓管打开辅料库存的无权限提示',
    description: '仓管账号刷新"辅料库存"时，页面顶部会闪两条"无权限访问"红条，"新增辅料"抽屉里的客户和业务员下拉显示"无数据"。已放开仓管对客户和业务员名单的只读权限（不影响客户管理菜单），现在两个下拉都能正常选了。同样的问题在面料/成品/待仓页面也一起修了。',
    link: '/inventory/accessories',
  },
  {
    id: '2026-06-02-accessories-detail-button-primary',
    date: '2026-06-02',
    module: '库存',
    title: '辅料库存"详情"按钮颜色对齐成品库存',
    description: '辅料库存操作列的"详情"原来是灰色，和成品库存的蓝色不一致。统一为蓝色，列表里更显眼。',
    link: '/inventory/accessories',
  },
  {
    id: '2026-06-02-sla-report-overall-duration',
    date: '2026-06-02',
    module: '财务',
    title: '时效报表改按客户交期判定超期',
    description: '财务→订单报表→时效报表：最右"订单总耗时（天）"列改为下单到完成的天数（只对已完成订单显示，未完成显示 -）。"时效判定"改成对比客户交期：已完成订单看完成时间是否晚于交期，未完成订单看今天是否已过交期，结果分"超期/未超期/已超期/进行中"四类。冗余的"进入状态时间"列已删除。',
    link: '/finance/order-sla-report',
  },
  {
    id: '2026-05-31-packaging-show-upstream-chain',
    date: '2026-05-31',
    module: '生产',
    title: '登记入库展示上游各环节实填数',
    description: '尾部"登记入库"对话框，每个颜色 block 顶部按生产链顺序展示订单数量/裁床/车缝（如该环节填了数据）。仓管员能直接对比上下游数字，及时发现异常。没数据的环节自动隐藏，老订单不会变高。',
    link: '/production/finishing',
  },
  {
    id: '2026-05-31-fix-detail-not-yet-vs-no-detail',
    date: '2026-05-31',
    module: '生产',
    title: '尾部详情区分"尚未登记"和"无明细"',
    description: '订单还没走到某个阶段（比如还没入库），该阶段不再误显示"未留存颜色×尺码明细"，改为浅灰色"尚未登记"，跟"已登记但缺颜色细分"明确区分。',
    link: '/production/finishing',
  },
  {
    id: '2026-05-31-fix-packaging-legacy-input',
    date: '2026-05-31',
    module: '生产',
    title: '修复"登记入库"老订单填写失效',
    description: '尾部"登记入库"对话框，以前没按颜色×尺码登记过收货的老订单现在也能正常填本次入库/次品了。输入数字切到下一格不再被清零。',
    link: '/production/finishing',
  },
  {
    id: '2026-05-31-profit-report-currency-symbol',
    date: '2026-05-31',
    module: '财务',
    title: '利润报表金额列前面加￥符号',
    description: '利润报表里 销售价/出厂价/材料成本/工艺项目/生产工序/单件利润/工厂总利润 7 列数字前面统一加￥，一眼能区分金额和数量。负数原样展示（如 ￥-27.57）。',
    link: '/finance/order-sla-report?tab=profit',
  },
  {
    id: '2026-05-31-order-report-filter-and-fit',
    date: '2026-05-31',
    module: '财务',
    title: '订单报表加订单号/SKU 筛选 + 表格列自适应',
    description: '时效报表和利润报表的筛选区开头加了"订单号""SKU编号"两个搜索框，与其他页面写法一致。表格列改为按容器宽度自适应（客户列加宽避免换行），内容过长用省略号+悬停查看，列与列之间也可手动拖宽。',
    link: '/finance/order-sla-report',
  },
  {
    id: '2026-05-31-sla-report-source-aligned-with-production',
    date: '2026-05-31',
    module: '财务',
    title: '时效报表的生产环节时间与生产页对齐',
    description: '修复了时效报表里 纸样/裁床/工艺/车缝/尾部 五个环节时间大量显示 "-" 的问题。报表现在和「生产管理」对应的几个页面读同一张表，生产页有数据，报表就有数据。老订单（含 3 月之前的）现在也能正确显示生产环节时效与超期判定。',
    link: '/finance/order-sla-report',
  },
  {
    id: '2026-05-31-deleted-orders-no-leak',
    date: '2026-05-31',
    module: '系统',
    title: '已删除订单不再同步到其他页面',
    description: '修复了删除订单（移入回收站）后仍出现在 时效/利润报表、采购/纸样/裁床/工艺/车缝/尾部 等生产页面、以及供应商最近合作时间统计 的问题。已删订单只在订单回收站可见，恢复后才回到各页面。',
  },
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
