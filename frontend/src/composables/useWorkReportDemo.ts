import { computed, ref } from 'vue'
import { DEMO_DATE, SELF_ID, PEOPLE, getOrder, taskOrders, seedTasks, summarize, compareTasks, isTask, migrateLegacy, applyBatch, type WorkTask, type DraftRow } from './workReportDemo'

const KEY = 'hyfsmes-work-report-prototype-v2'
export function useWorkReportDemo() {
  const storageNotice = ref('')
  const tasks = ref<WorkTask[]>(seedTasks())
  try {
    const raw = localStorage.getItem(KEY)
    const old = localStorage.getItem('hyfsmes-work-report-prototype-v1')
    if (raw || old) {
      const parsed: unknown = JSON.parse(raw || old!)
      const restored = raw ? parsed : migrateLegacy(parsed)
      if (!Array.isArray(restored) || !restored.every(isTask) || new Set(restored.map(t => t.id)).size !== restored.length) throw new Error('invalid')
      tasks.value = restored
    }
  } catch { storageNotice.value = '本机演示记录无法读取，已显示初始样例。' }
  const mode = ref<'mine' | 'team'>('mine')
  const date = ref(DEMO_DATE)
  const role = ref('全部岗位')
  const keyword = ref('')
  const tab = ref('open')
  const activePerson = ref<string | null>(null)
  const feedback = ref('')
  const editing = ref(false)
  const drafts = ref<DraftRow[]>([])
  const draftBaseline = ref('')
  const formError = ref('')
  const dirty = computed(() => editing.value && JSON.stringify(drafts.value) !== draftBaseline.value)
  const mine = computed(() => tasks.value.filter(t => t.owner === SELF_ID))
  const people = computed(() => PEOPLE.filter(p => (role.value === '全部岗位' || p.role === role.value) && p.name.includes(keyword.value.trim())))
  function report(owner: string, reportDate = date.value) {
    const all = tasks.value.filter(t => t.owner === owner)
    const rows = all.filter(t => t.status === 'todo')
    const completed = all.filter(t => t.status === 'done' && t.completedDate === reportDate)
    const adjustments = all.filter(t => t.status === 'deferred' && t.recordedDate === reportDate)
    const pending = rows.filter(t => t.date <= reportDate && (!t.completedDate || t.completedDate > reportDate))
      .map(t => ({ ...t, status: 'todo' as const })).sort((a, b) => a.date.localeCompare(b.date))
    const upcoming = rows.filter(t => t.date > reportDate && (!t.completedDate || t.completedDate > reportDate))
      .map(t => ({ ...t, status: 'todo' as const })).sort((a, b) => a.date.localeCompare(b.date))
    return { completed, pending, upcoming, adjustments, help: rows.filter(t => t.needsHelp), overdue: pending.filter(t => t.date < reportDate).length }
  }
  const person = computed(() => PEOPLE.find(p => p.id === activePerson.value))
  const personReport = computed(() => report(activePerson.value || ''))
  const visible = computed(() => mine.value.filter(t => t.status === 'todo' && (t.title + ' ' + taskOrders(t).join(' ') + ' ' + taskOrders(t).map(o => getOrder(o)?.sku || '').join(' ')).includes(keyword.value.trim())).sort(compareTasks))
    const stats = computed(() => summarize(mine.value.filter(t => t.status !== 'deferred')))
  const sections = computed(() => (['sample', 'bulk', 'other'] as const).map(type => ({
    type, label: type === 'sample' ? '样品' : type === 'bulk' ? '大货' : '其他事项',
    rows: visible.value.filter(t => (t.section || getOrder(t.order)?.orderType) === type),
    drafts: drafts.value.filter(t => (getOrder(t.order)?.orderType || t.section) === type),
  })))
  function persist(next: WorkTask[]) {
    try { localStorage.setItem(KEY, JSON.stringify(next)); storageNotice.value = ''; tasks.value = next; return true }
    catch { storageNotice.value = '本机保存失败，编辑内容仍保留，请重试。'; return false }
  }
  function beginEdit() {
    drafts.value = mine.value.filter(t => t.status === 'todo').sort(compareTasks)
      .map(t => ({ id: t.id, order: t.order, orders: [...taskOrders(t)], sourceIds: [t.id], title: t.title, date: t.date, done: false, end: false, urgent: !!t.urgent, section: t.section, needsHelp: !!t.needsHelp }))
    draftBaseline.value = JSON.stringify(drafts.value); editing.value = true; formError.value = ''; feedback.value = ''
  }
  function addRow(section: 'sample' | 'bulk' | 'other') { drafts.value.push({ id: 'new-' + crypto.randomUUID(), order: '', orders: [], sourceIds: [], title: '', date: DEMO_DATE, done: false, urgent: false, section }) }
  function removeNewRow(id: string) { if (!drafts.value.find(r => r.id === id)?.sourceIds?.length) drafts.value = drafts.value.filter(r => r.id !== id) }
  function mergeRows(ids: string[]) {
    const selected = drafts.value.filter(r => ids.includes(r.id))
    if (selected.length < 2) return
    if (selected.some(r => r.done || r.end || !taskOrders(r).length)) { formError.value = '请先取消完成/结束勾选，并为每行选择订单'; return }
    const orders = [...new Set(selected.flatMap(taskOrders))]
    if (new Set(orders.map(o => getOrder(o)?.orderType)).size !== 1) { formError.value = '样品和大货请分别合并'; return }
    const first = selected[0]
    const merged = { ...first, orders, order: orders[0], sourceIds: [...new Set(selected.flatMap(r => r.sourceIds || []))],
      date: selected.every(r => r.date === first.date) ? first.date : '',
      title: selected.every(r => r.title === first.title) ? first.title : '', urgent: selected.some(r => r.urgent) }
    drafts.value = drafts.value.flatMap(r => r.id === first.id ? [merged] : ids.includes(r.id) ? [] : [r])
    formError.value = ''
  }
  function splitRow(id: string) {
    const row = drafts.value.find(r => r.id === id)
    if (!row || taskOrders(row).length < 2) return
    if (row.done || row.end) { formError.value = '请先取消完成/结束勾选，再拆开订单'; return }
    drafts.value = drafts.value.flatMap(r => r.id !== id ? [r] : taskOrders(r).map((order, index) => ({
      ...r, id: index === 0 ? r.id : 'split-' + crypto.randomUUID(), order, orders: [order],
      sourceIds: (r.sourceIds || []).filter(source => taskOrders(tasks.value.find(t => t.id === source)!).includes(order)),
    })))
    formError.value = ''
  }

  function cancelEdit() { editing.value = false; drafts.value = []; formError.value = '' }
  function saveAll() {
    try {
      const next = applyBatch(tasks.value, drafts.value, () => crypto.randomUUID())
      if (!persist(next)) return false
      cancelEdit(); keyword.value = ''; feedback.value = '全部安排已保存'; return true
    } catch (e) { formError.value = e instanceof Error ? e.message : '保存失败'; return false }
  }
  function switchMode(value: 'mine' | 'team') { mode.value = value; keyword.value = ''; role.value = '全部岗位'; activePerson.value = null }
  function reset() { if (persist(seedTasks())) { cancelEdit(); activePerson.value = null; date.value = DEMO_DATE; keyword.value = ''; tab.value = 'open'; feedback.value = '已恢复初始演示' } }
  return { sections, tasks, mode, date, role, keyword, tab, activePerson, feedback, storageNotice, mine, stats,
    people, visible, person, personReport, report, editing, drafts, dirty, formError,
    mergeRows, splitRow, beginEdit, addRow, removeNewRow, cancelEdit, saveAll, switchMode, reset }
}
