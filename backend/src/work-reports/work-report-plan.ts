export interface WorkTask {
  automaticKey?: string;
  section?: 'sample' | 'bulk' | 'other'; needsHelp?: boolean;
  orders?: string[]; urgent?: boolean; id: string; owner: string; date: string; title: string; order: string
  status: 'todo' | 'done' | 'deferred' | 'ended'; recordedDate?: string; revision?: string; completedDate: string; history: string[]
}
export interface TaskInput { order: string; title: string; date: string; section?: 'sample' | 'bulk' | 'other' }
export interface DraftRow extends TaskInput { orders?: string[]; sourceIds?: string[]; urgent?: boolean; needsHelp?: boolean; id: string; done: boolean; end?: boolean }

export const taskOrders = (task: { order: string; orders?: string[] }) => task.orders?.length ? task.orders : (task.order ? [task.order] : [])

export function applyReportBatch(current: WorkTask[], drafts: DraftRow[], newId: () => string, context: { owner: string; today: string; orders: { no: string; orderType: string }[] }): WorkTask[] {
  const SELF_ID = context.owner, DEMO_DATE = context.today;
  const getOrder = (no: string) => context.orders.find(o => o.no === no);
  const validateInput = (input: TaskInput) => {
    if (input.section !== 'other' && !getOrder(input.order)) return '请选择一个订单';
    if ((input.section === 'other' && !input.title.trim()) || input.title.length > 200) return '请填写200字以内的工作安排';
    if (input.date && !validReportDate(input.date)) return '请选择有效的预计执行日期';
    return '';
  };

  if (new Set(drafts.map(r => r.id)).size !== drafts.length) throw new Error('存在重复行')
  const originals = current.filter(t => t.owner === SELF_ID && t.status === 'todo')
  const sources = (r: DraftRow) => r.sourceIds || (current.some(t => t.id === r.id) ? [r.id] : [])
  drafts.forEach((r, i) => {
    const orders = taskOrders(r)
    if (r.section === 'other' ? orders.length > 0 : !orders.length || orders.some(o => !getOrder(o))) throw new Error(`第 ${i + 1} 行：请检查关联订单`)
    if (r.section !== 'other' && new Set(orders.map(o => getOrder(o)?.orderType)).size !== 1) throw new Error('样品和大货请分别安排')
    const error = validateInput({ ...r, order: orders[0] })
    if (error) throw new Error(`第 ${i + 1} 行：${error}`)
    for (const id of sources(r)) {
      const original = originals.find(t => t.id === id)
      if (!original) throw new Error('不能修改其他人员或历史记录')
      if (r.section === 'other' ? original.section !== 'other' || sources(r).length !== 1 : !orders.some(o => taskOrders(original).includes(o))) throw new Error('关联来源不匹配')
    }
    if (sources(r).length && orders.some(o => !sources(r).some(id => taskOrders(originals.find(t => t.id === id)!).includes(o)))) throw new Error('请通过合并安排关联已有订单')
    if (r.done && !sources(r).length) throw new Error('新增安排没有上一步')
    if (r.section !== 'other' && r.done && !r.end && sources(r).some(id => originals.find(t => t.id === id)?.title.trim() === r.title.trim())) throw new Error(`第 ${i + 1} 行：请填写完成后的下一步安排，或结束跟进`)
  })
  const allOrders = drafts.flatMap(taskOrders)
  if (new Set(allOrders).size !== allOrders.length) throw new Error('同一订单只保留一行当前安排，请合并后保存')
  for (const original of originals) {
    if (original.section === 'other' && drafts.filter(r => sources(r).includes(original.id)).length !== 1) throw new Error('其他事项不能丢失或重复，请使用完成或结束')
    for (const order of taskOrders(original)) {
      if (!drafts.some(r => sources(r).includes(original.id) && taskOrders(r).includes(order))) throw new Error('原订单不能丢失，请使用结束跟进')
    }
  }
  const next = current.filter(t => !(t.owner === SELF_ID && t.status === 'todo')).map(t => ({ ...t, history: [...t.history] }))
  for (const original of originals) {
    const linked = drafts.filter(r => sources(r).includes(original.id))
    const unchanged = linked.length === 1 && linked[0].id === original.id && linked[0].title.trim() === original.title
      && linked[0].date === original.date && !!linked[0].urgent === !!original.urgent && !!linked[0].needsHelp === !!original.needsHelp && !linked[0].done && !linked[0].end
      && JSON.stringify(taskOrders(linked[0])) === JSON.stringify(taskOrders(original))
    if (unchanged) continue
    for (const done of [true, false]) {
      const parts = linked.filter(r => !!r.done === done)
      const orders = taskOrders(original).filter(o => parts.some(r => taskOrders(r).includes(o)))
      if (!parts.length || (!orders.length && original.section !== 'other')) continue
      next.push({ ...original, ...(original.section === 'other' && done ? { title: parts[0].title.trim(), needsHelp: !!parts[0].needsHelp } : {}), id: newId(), order: orders[0] || '', orders, status: done ? 'done' : 'deferred',
        completedDate: done ? DEMO_DATE : '', recordedDate: DEMO_DATE,
        revision: parts.map(r => r.section === 'other' && r.done ? '事项已完成' : r.end ? '结束跟进' : `下一步：${r.title.trim()}（${r.date}）`).join('；'),
        history: [...original.history] })
    }
  }
  for (const r of drafts) {
    const previous = originals.filter(t => sources(r).includes(t.id))
    const orders = taskOrders(r)
    next.push({ id: previous.some(t => t.id === r.id) ? r.id : newId(), owner: SELF_ID, order: orders[0] || '', orders, section: r.section, needsHelp: !!r.needsHelp,
      title: r.title.trim(), date: r.date, urgent: !!r.urgent, status: r.end || (r.section === 'other' && r.done) ? 'ended' : 'todo', completedDate: '',
      recordedDate: DEMO_DATE, history: [...new Set(previous.flatMap(t => t.history)), DEMO_DATE + '｜保存工作安排'] })
  }
  return next
}


export function validReportDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;
}
