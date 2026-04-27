export type DateRangeShortcut = {
  text: string
  value: () => [Date, Date]
}

function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function endOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

function startOfWeekMonday(d: Date) {
  const x = startOfDay(d)
  const day = x.getDay() // 0=Sun ... 6=Sat
  const diff = (day + 6) % 7 // Monday=0 ... Sunday=6
  x.setDate(x.getDate() - diff)
  return x
}

function endOfWeekMonday(d: Date) {
  const s = startOfWeekMonday(d)
  const e = new Date(s)
  e.setDate(s.getDate() + 6)
  return endOfDay(e)
}

function startOfMonth(d: Date) {
  const x = startOfDay(d)
  x.setDate(1)
  return x
}

function endOfMonth(d: Date) {
  const x = startOfDay(d)
  x.setMonth(x.getMonth() + 1, 0) // last day of current month
  return endOfDay(x)
}

function startOfQuarter(d: Date) {
  const x = startOfDay(d)
  const m = x.getMonth() // 0-11
  const qStart = Math.floor(m / 3) * 3
  x.setMonth(qStart, 1)
  return x
}

function endOfQuarter(d: Date) {
  const s = startOfQuarter(d)
  const x = new Date(s)
  x.setMonth(s.getMonth() + 3, 0)
  return endOfDay(x)
}

function startOfYear(d: Date) {
  const x = startOfDay(d)
  x.setMonth(0, 1)
  return x
}

function endOfYear(d: Date) {
  const x = startOfDay(d)
  x.setMonth(11, 31)
  return endOfDay(x)
}

/** Element Plus el-date-picker (daterange) 快捷选项 */
export const rangeShortcuts: DateRangeShortcut[] = [
  {
    text: '本周',
    value: () => {
      const now = new Date()
      return [startOfWeekMonday(now), endOfWeekMonday(now)]
    },
  },
  {
    text: '本月',
    value: () => {
      const now = new Date()
      return [startOfMonth(now), endOfMonth(now)]
    },
  },
  {
    text: '本季度',
    value: () => {
      const now = new Date()
      return [startOfQuarter(now), endOfQuarter(now)]
    },
  },
  {
    text: '本年度',
    value: () => {
      const now = new Date()
      return [startOfYear(now), endOfYear(now)]
    },
  },
]

