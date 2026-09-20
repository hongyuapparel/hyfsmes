import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWorkReportDemo } from './useWorkReportDemo'
describe('订单持续跟进', () => {
  it('合并两个订单后拆出一个完成，未完成订单与历史不丢', () => {
    const m = useWorkReportDemo(); m.beginEdit()
    m.mergeRows(['t1', 't5'])
    const merged = m.drafts.value.find(t => t.id === 't1')!
    expect(merged.orders).toEqual(['DEMO-260901', 'DEMO-260902']); expect(merged.date).toBe('')
    merged.title = '跟进共同物料'; merged.date = '2026-09-12'
    expect(m.saveAll()).toBe(true)
    expect(m.report('m1').completed).toHaveLength(1)
    expect(m.visible.value.filter(t => t.orders?.length === 2)).toHaveLength(1)
    m.beginEdit(); m.splitRow('t1')
    const first = m.drafts.value.find(t => t.order === 'DEMO-260901')!
    first.title = '安排尾部查货'; first.done = true
    expect(m.saveAll()).toBe(true)
    const r = useWorkReportDemo()
    const completed = r.report('m1').completed.find(t => t.title === '跟进共同物料')!
    expect(completed.orders).toEqual(['DEMO-260901'])
    expect(r.visible.value.find(t => t.order === 'DEMO-260902')?.title).toBe('跟进共同物料')
    expect(r.visible.value.find(t => t.order === 'DEMO-260901')?.title).toBe('安排尾部查货')
  })
  it('合并完成按一项计两个订单，拆分取消不写入', () => {
    const m = useWorkReportDemo(); m.beginEdit(); m.mergeRows(['t1', 't5'])
    m.drafts.value.find(t => t.id === 't1')!.title = '共同跟进'; m.drafts.value.find(t => t.id === 't1')!.date = '2026-09-12'; expect(m.saveAll()).toBe(true)
    const before = JSON.stringify(m.tasks.value)
    m.beginEdit(); m.splitRow('t1'); m.cancelEdit(); expect(JSON.stringify(m.tasks.value)).toBe(before)
    m.beginEdit(); const r = m.drafts.value.find(t => t.id === 't1')!; r.done = true; r.title = '共同下一步'
    expect(m.saveAll()).toBe(true)
    const done = m.report('m1').completed.filter(t => t.title === '共同跟进')
    expect(done).toHaveLength(1); expect(done[0].orders).toHaveLength(2)
  })
  it('两个板块草稿独立展示，统一保存；紧急可取消且刷新保留', () => {
    const m = useWorkReportDemo(); m.beginEdit()
    expect(m.sections.value.map(s => s.drafts.length)).toEqual([1, 4, 0])

    m.sections.value[0].drafts[0].title = '样品确认'

    const row = m.sections.value[1].drafts.find(t => t.id === 't6')!
    row.urgent = true

    expect(m.sections.value[0].drafts[0].title).toBe('样品确认')
    expect(m.saveAll()).toBe(true)
    const restored = useWorkReportDemo();
    expect(restored.sections.value[1].rows[0].id).toBe('t6')
    expect(restored.tasks.value.find(t => t.id === 't2')?.title).toBe('样品确认')
    restored.beginEdit(); restored.drafts.value.find(t => t.id === 't6')!.urgent = false
    expect(restored.saveAll()).toBe(true)
    expect(restored.sections.value[1].rows[0].id).toBe('t1')
  })
  beforeEach(() => { vi.restoreAllMocks(); localStorage.clear() })
  it('完成旧步骤并改写下一步，同一订单只留一行，刷新保留', () => {
    const m = useWorkReportDemo(); m.beginEdit()
    Object.assign(m.drafts.value.find(r => r.id === 't1')!, { title: '安排尾部查货', date: '2026-09-12', done: true })
    expect(m.saveAll()).toBe(true)
    const r = useWorkReportDemo()
    expect(r.visible.value.filter(t => t.order === 'DEMO-260901')).toHaveLength(1)
    expect(r.visible.value.find(t => t.id === 't1')?.title).toBe('安排尾部查货')
    expect(r.report('m1').completed.some(t => t.title.includes('200 件'))).toBe(true)
    expect(r.report('m1').completed.some(t => t.title === '安排尾部查货')).toBe(false)
  })
  it('仅改期不算完成，日报保留前后安排', () => {
    const m = useWorkReportDemo(); m.beginEdit()
    m.drafts.value[0].date = '2026-09-13'
    expect(m.saveAll()).toBe(true)
    expect(m.report('m1').completed).toHaveLength(1)
    expect(m.report('m1').adjustments[0].revision).toContain('2026-09-13')
  })
  it('完成最后一步并结束，当前行消失，历史仍可查看', () => {
    const m = useWorkReportDemo(); m.beginEdit()
    Object.assign(m.drafts.value.find(r => r.id === 't1')!, { end: true, done: true })
    expect(m.saveAll()).toBe(true)
    expect(m.visible.value.some(t => t.id === 't1')).toBe(false)
    expect(m.report('m1').completed.some(t => t.order === 'DEMO-260901')).toBe(true)
    expect(m.tasks.value.find(t => t.id === 't1')?.status).toBe('ended')
  })
  it('直接结束不冒充完成；取消编辑不改数据', () => {
    const m = useWorkReportDemo(); const before = JSON.stringify(m.tasks.value); m.beginEdit()
    m.drafts.value[0].end = true; m.cancelEdit()
    expect(JSON.stringify(m.tasks.value)).toBe(before)
    m.beginEdit(); m.drafts.value[0].end = true; expect(m.saveAll()).toBe(true)
    expect(m.report('m1').completed).toHaveLength(1)
    expect(m.report('m1').adjustments[0].revision).toBe('结束跟进')
  })
  it('批量错误不部分写入，拒绝重复订单和未填下一步', () => {
    const m = useWorkReportDemo(); const before = JSON.stringify(m.tasks.value); m.beginEdit()
    m.drafts.value[0].done = true
    expect(m.saveAll()).toBe(false)
    m.drafts.value[0].done = false; m.addRow('bulk')
    Object.assign(m.drafts.value[m.drafts.value.length - 1], { order: 'DEMO-260901', title: '重复安排' })
    expect(m.saveAll()).toBe(false)
    expect(JSON.stringify(m.tasks.value)).toBe(before)
  })
  it('保存失败保留草稿；今天优先，逾期其次，未来升序', () => {
    const m = useWorkReportDemo()
    expect(m.visible.value.map(t => t.id)).toEqual(['t1', 't2', 't5', 't4', 't6'])
    m.beginEdit(); m.drafts.value[0].title = '调整说明'
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    expect(m.saveAll()).toBe(false); expect(m.editing.value).toBe(true)
  })
})
describe('其他事项', () => {
  beforeEach(() => { vi.restoreAllMocks(); localStorage.clear() })
  it('多项不关联订单，协助标记刷新保留，完成后进入日报', () => {
    const m = useWorkReportDemo(); m.beginEdit(); m.addRow('other'); m.addRow('other')
    const other = m.sections.value[2].drafts
    other[0].title = '整理外厂联系方式'
    Object.assign(other[1], { title: '请仓管协助核对样衣位置', needsHelp: true, date: '2026-09-15' })
    expect(m.saveAll()).toBe(true)
    const r = useWorkReportDemo()
    expect(r.sections.value[2].rows).toHaveLength(2)
    expect(r.report('m1').help[0].title).toBe('请仓管协助核对样衣位置')
    expect(r.sections.value[2].rows.every(t => t.order === '' && t.orders?.length === 0)).toBe(true)
    r.beginEdit(); r.sections.value[2].drafts[0].done = true
    expect(r.saveAll()).toBe(true)
    expect(r.sections.value[2].rows).toHaveLength(1)
    expect(r.report('m1').completed.some(t => t.title === '整理外厂联系方式')).toBe(true)
    expect(useWorkReportDemo().sections.value[2].rows).toHaveLength(1)
  })
  it('必填内容和有效日期，调整协助标记不算完成', () => {
    const m = useWorkReportDemo(); m.beginEdit(); m.addRow('other')
    const row = m.sections.value[2].drafts[0]
    expect(m.saveAll()).toBe(false)
    row.title = '整理资料'; row.date = '2026-02-30'
    expect(m.saveAll()).toBe(false)
    row.date = '2026-09-11'; expect(m.saveAll()).toBe(true)
    m.beginEdit(); m.sections.value[2].drafts[0].needsHelp = true
    expect(m.saveAll()).toBe(true)
    expect(m.report('m1').completed).toHaveLength(1)
    expect(m.report('m1').adjustments.some(t => t.title === '整理资料')).toBe(true)
  })
})
import { buildPatternReport, type PatternReportRecord } from './patternReportDemo'
describe('纸样自动报告', () => {
  it('完成与接单可以交叉，部门未分配不计个人在做', () => {
    const r = buildPatternReport('p2', '2026-09-11')
    expect(r.completed.map(t => t.order)).toEqual(['DEMO-260905', 'DEMO-260903'])
    expect(r.assigned).toHaveLength(2)
    expect(r.active.map(t => t.order)).toEqual(['DEMO-260901'])
    expect(r.unassigned).toHaveLength(2)
  })
  it('历史日期不泄漏未来的分配或完成，空日期无记录', () => {
    const r = buildPatternReport('p2', '2026-09-10')
    expect(r.completed).toHaveLength(0)
    expect(r.active.map(t => t.order)).toEqual(['DEMO-260905'])
    expect(r.unassigned.map(t => t.order)).toEqual(['DEMO-260903', 'DEMO-260901', 'DEMO-260902'])
    const empty = buildPatternReport('p2', '2026-09-01')
    expect(Object.values(empty).flat()).toHaveLength(0)
  })
  it('别人的完成不归本人，公共队列两人查看一致', () => {
    const records: PatternReportRecord[] = [
      { order: 'A', owner: 'another', arrivedAt: '2026-09-10 08:00', assignedAt: '2026-09-11 08:00', completedAt: '2026-09-11 10:00', dueDate: '2026-09-12' },
      { order: 'B', arrivedAt: '2026-09-11 08:00', dueDate: '2026-09-12' },
    ]
    const r = buildPatternReport('p2', '2026-09-11', records)
    expect(r.completed).toHaveLength(0)
    expect(r.assigned).toHaveLength(0)
    expect(r.active).toHaveLength(0)
    expect(r.unassigned).toEqual(buildPatternReport('another', '2026-09-11', records).unassigned)
  })
})
