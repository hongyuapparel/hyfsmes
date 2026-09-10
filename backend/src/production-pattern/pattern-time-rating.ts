const businessDateFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
});

/** 无时区的数据库日期按业务当地时间读取，有时区的时间转为北京时间。 */
function businessDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  if (typeof value === 'string' && !/(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    const match = /^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?)?$/.exec(value);
    if (!match) return null;
    const date = new Date(`${match[1]}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === match[1] ? match[1] : null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = businessDateFormat.formatToParts(date);
  return ['year', 'month', 'day'].map((key) => parts.find((part) => part.type === key)?.value).join('-');
}

export function judgePatternCustomerDueDate(
  dueDate: Date | string | null | undefined,
  completedAt: Date | string | null | undefined,
  completed: boolean,
  now = new Date(),
): { timeRating: string; timeRatingReason: string; overdueDays: number | null } {
  const due = businessDate(dueDate);
  if (!due) return { overdueDays: null, timeRating: '未填写交期', timeRatingReason: '客户交期为空或无效，无法判断是否超期。' };
  const end = businessDate(completed ? completedAt : now);
  if (!end) return { overdueDays: null, timeRating: '无法判定', timeRatingReason: '纸样已完成但完成时间缺失或无效，请核对完成记录。' };
  const overdueDays = Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${due}T00:00:00Z`)) / 86400000));
  const late = overdueDays > 0;
  return {
    overdueDays,
    timeRating: completed ? (late ? '超期' : '未超期') : (late ? '已超期' : '进行中'),
    timeRatingReason: `客户交期 ${due}；${completed ? '纸样完成日期' : '今天'} ${end}。按北京时间判断，交期当天完成不算超期。`,
  };
}
