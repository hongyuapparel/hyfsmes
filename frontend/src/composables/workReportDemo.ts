export const DEMO_DATE = '2026-09-11'
export const SELF_ID = 'm1'
export const ROLES = ['跟单', '采购', '纸样', '裁床', '车间', '尾部', '仓管']
export const PEOPLE = [
  { id: 'm1', name: '林晓', role: '跟单' }, { id: 'm2', name: '陈悦', role: '跟单' },
  { id: 'p1', name: '周宁', role: '采购' }, { id: 'p2', name: '何师傅', role: '纸样' },
  { id: 'c1', name: '黄主管', role: '裁床' }, { id: 's1', name: '吴主管', role: '车间' },
  { id: 'f1', name: '郑主管', role: '尾部' }, { id: 'w1', name: '李敏', role: '仓管' },
]
export interface DemoOrder {
  orderType: 'sample' | 'bulk'; imageUrl?: string; no: string; customer: string; salesperson: string; status: string; sku: string
}
// 仅供独立原型展示的款式示意图，不是真实订单图片。
const demoGarmentImage = (color: string, collar: string) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><rect width="160" height="160" rx="12" fill="#f5f7fa"/><path d="M53 30 30 42 12 78 35 90 45 72 45 132 115 132 115 72 125 90 148 78 130 42 107 30 94 25 66 25Z" fill="${color}" stroke="#526174" stroke-width="3"/><path d="${collar}" fill="none" stroke="#ffffff" stroke-width="3"/><text x="80" y="151" text-anchor="middle" font-size="12" fill="#526174">款式示意</text></svg>`)
export const ORDERS: DemoOrder[] = [
  { no: 'DEMO-260901', orderType: 'bulk', imageUrl: demoGarmentImage('#7895b2', 'M66 25 Q80 57 94 25 M62 102 H98 V120 H62Z'), customer: '示例客户 North', salesperson: 'Emily（示例）', status: '车缝中', sku: '卫衣 HY101' },
  { no: 'DEMO-260902', orderType: 'bulk', customer: '示例客户 Coast', salesperson: 'Andy（示例）', status: '待采购', sku: '夹克 HY205' },
  { no: 'DEMO-260903', orderType: 'sample', imageUrl: demoGarmentImage('#bc886c', 'M66 25 Q80 49 94 25 M64 75 H96 M64 85 H96'), customer: '示例客户 North', salesperson: 'Emily（示例）', status: '工艺外发', sku: '印花T恤 HY308' },
  { no: 'DEMO-260905', orderType: 'sample', imageUrl: demoGarmentImage('#a2b7a0', 'M66 25 80 43 94 25 M80 43 V132 M66 25 58 47 80 43 102 47 94 25'), customer: '示例客户 Field', salesperson: 'Emily（示例）', status: '待纸样', sku: '衬衫 HY402' },
  { no: 'DEMO-260906', orderType: 'bulk', customer: '示例客户 Coast', salesperson: 'Andy（示例）', status: '工艺外发', sku: '绣花卫衣 HY106' },
  { no: 'DEMO-260908', orderType: 'bulk', customer: '示例客户 West', salesperson: 'Andy（示例）', status: '车缝中', sku: '长裤 HY508' },
  { no: 'DEMO-260909', orderType: 'bulk', customer: '示例客户 Field', salesperson: 'Emily（示例）', status: '待尾部', sku: 'Polo HY609' },
]
export const getOrder = (no: string) => ORDERS.find(o => o.no === no)
export { taskOrders } from '../../../backend/src/work-reports/work-report-plan'
export type { WorkTask, DraftRow, TaskInput } from '../../../backend/src/work-reports/work-report-plan'
import { applyReportBatch, type WorkTask, type DraftRow, type TaskInput } from '../../../backend/src/work-reports/work-report-plan'
export const applyBatch = (current: WorkTask[], drafts: DraftRow[], newId: () => string) =>
  applyReportBatch(current, drafts, newId, { owner: SELF_ID, today: DEMO_DATE, orders: ORDERS })

export const emptyInput = (): TaskInput => ({ order: '', title: '', date: DEMO_DATE })
const sample = (id: string, owner: string, order: string, title: string, date = DEMO_DATE, done = false): WorkTask =>
  ({ id, owner, order, title, date, status: done ? 'done' : 'todo', completedDate: done ? date : '', history: [date + '｜安排：' + title] })
export function seedTasks(): WorkTask[] {
  return [
    sample('t1', SELF_ID, 'DEMO-260901', '确认卫衣外发余货 200 件的回厂时间'),
    sample('t2', SELF_ID, 'DEMO-260903', '确认印花色差处理方案'),
    sample('t3', SELF_ID, 'DEMO-260905', '核对衬衫尺寸并交给纸样', DEMO_DATE, true),
    sample('t4', SELF_ID, 'DEMO-260909', '确认急单工艺与尾部衔接', '2026-09-12'),
    sample('t5', SELF_ID, 'DEMO-260902', '跟进夹克拉链到料', '2026-09-10'),
    sample('t6', SELF_ID, 'DEMO-260906', '确认绣花厂下周回货安排', '2026-09-15'),
    sample('t7', 'm2', 'DEMO-260908', '核对外发工厂首件'),
    sample('t8', 'p1', 'DEMO-260902', '落实缺少拉链的补发时间'),
    sample('t9', 'p2', 'DEMO-260905', '交付衬衫 V3 纸样', DEMO_DATE, true),
    sample('t10', 'c1', 'DEMO-260901', '完成裁片交接'),
    sample('t11', 's1', 'DEMO-260905', '安排衬衫车缝'),
    sample('t12', 'f1', 'DEMO-260909', '检查回货并反馈缺陷', DEMO_DATE, true),
    sample('y1', SELF_ID, 'DEMO-260901', '取得外厂回货承诺', '2026-09-10', true),
  ]
}
export function compareTasks(a: WorkTask, b: WorkTask, today = DEMO_DATE) {
  const group = (t: WorkTask) => t.status !== 'todo' ? 3 : t.date === today ? 0 : t.date < today ? 1 : 2
  if (a.status === 'todo' && b.status === 'todo' && (a.urgent || b.urgent)) return Number(!!b.urgent) - Number(!!a.urgent) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
  return group(a) - group(b) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
}
export function summarize(tasks: WorkTask[]) {
  return { planned: tasks.length, done: tasks.filter(t => t.status === 'done').length,
    open: tasks.filter(t => t.status === 'todo').length }
}
export function validateInput(input: TaskInput): string {
  if (input.section !== 'other' && !getOrder(input.order)) return '请选择一个订单'
  if (!input.title.trim()) return '请填写下一步要做的事情'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || !Number.isFinite(Date.parse(input.date + 'T12:00:00Z'))
    || new Date(input.date + 'T12:00:00Z').toISOString().slice(0, 10) !== input.date) return '请选择有效的预计执行日期'
  return ''
}
export function isTask(value: unknown): value is WorkTask {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return ['id', 'owner', 'date', 'title', 'order', 'completedDate'].every(k => typeof v[k] === 'string')
    && (v.section === undefined || ['sample', 'bulk', 'other'].includes(String(v.section)))
    && (v.needsHelp === undefined || typeof v.needsHelp === 'boolean')
    && (v.orders === undefined || (Array.isArray(v.orders) && (v.orders.length > 0 || v.section === 'other') && v.orders.every(o => typeof o === 'string')))
    && PEOPLE.some(p => p.id === v.owner) && ['todo', 'done', 'deferred', 'ended'].includes(String(v.status))
    && Array.isArray(v.history) && v.history.every(h => typeof h === 'string')
}
export function migrateLegacy(value: unknown): WorkTask[] {
  if (!Array.isArray(value)) throw new Error('invalid')
  return value.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw new Error('invalid')
    const v = item as Record<string, unknown>
    const mapped = { ...v, status: v.status === 'done' || v.status === 'deferred' ? v.status : 'todo',
      completedDate: v.status === 'done' ? v.date : '' }
    if (!isTask(mapped)) throw new Error('invalid')
    return mapped
  })
}
