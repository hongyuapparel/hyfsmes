// 独立原型业务事件样例，不读取或修改真实 ERP 数据。
export interface PatternReportRecord {
  order: string; arrivedAt: string; assignedAt?: string; completedAt?: string; owner?: string; dueDate: string
}
export const PATTERN_RECORDS: PatternReportRecord[] = [
  { order: 'DEMO-260905', arrivedAt: '2026-09-09 09:00', assignedAt: '2026-09-10 08:30', completedAt: '2026-09-11 10:20', owner: 'p2', dueDate: '2026-09-14' },
  { order: 'DEMO-260903', arrivedAt: '2026-09-10 09:00', assignedAt: '2026-09-11 08:40', completedAt: '2026-09-11 16:10', owner: 'p2', dueDate: '2026-09-15' },
  { order: 'DEMO-260901', arrivedAt: '2026-09-10 10:00', assignedAt: '2026-09-11 09:30', owner: 'p2', dueDate: '2026-09-16' },
  { order: 'DEMO-260902', arrivedAt: '2026-09-10 11:00', dueDate: '2026-09-17' },
  { order: 'DEMO-260906', arrivedAt: '2026-09-11 11:00', dueDate: '2026-09-18' },
]
const day = (time?: string) => time?.slice(0, 10) || ''
export function buildPatternReport(owner: string, date: string, records = PATTERN_RECORDS) {
  const arrived = records.filter(r => day(r.arrivedAt) <= date)
  const own = arrived.filter(r => r.owner === owner && !!r.assignedAt && day(r.assignedAt) <= date)
  return {
    completed: own.filter(r => day(r.completedAt) === date),
    assigned: own.filter(r => day(r.assignedAt) === date),
    active: own.filter(r => !r.completedAt || day(r.completedAt) > date),
    unassigned: arrived.filter(r => !r.assignedAt || day(r.assignedAt) > date),
  }
}
