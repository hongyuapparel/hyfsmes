import type { Order } from '../entities/order.entity';
import type { OrderStatusHistory } from '../entities/order-status-history.entity';
import type { OrderOperationLog } from '../entities/order-operation-log.entity';

/** 退回后重新提交是新一轮审单，不累计旧轮次或草稿等待时间。 */
export function resolveOrderReviewPeriod(
  order: Pick<Order, 'status' | 'orderDate' | 'statusTime'>,
  history: OrderStatusHistory[],
  logs: OrderOperationLog[],
): { start: Date | null; end: Date | null } {
  if (order.status === 'draft') return { start: null, end: null };
  const sorted = [...history].sort((a, b) => a.enteredAt.getTime() - b.enteredAt.getTime() || a.id - b.id);
  const lastEntry = sorted.filter((row) => row.status?.code === 'pending_review').at(-1);
  const lastSubmit = logs.filter((log) => log.action === 'submit')
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id).at(-1);
  // 下单时间在每次草稿提交时更新，可恢复部分缺失的历史；不得用建单时间代替提交。
  const starts = [lastEntry?.enteredAt, lastSubmit?.createdAt, order.orderDate,
    order.status === 'pending_review' ? order.statusTime : null]
    .filter((value): value is Date => value instanceof Date && Number.isFinite(value.getTime()));
  const start = starts.length ? new Date(Math.max(...starts.map((value) => value.getTime()))) : null;
  if (!start || order.status === 'pending_review') return { start, end: null };
  const lastEntryIndex = lastEntry ? sorted.indexOf(lastEntry) : -1;
  const nextEntry = sorted.find((row, index) => index > lastEntryIndex
    && row.enteredAt >= start && row.status?.code !== 'pending_review');
  if (nextEntry) {
    // 退回草稿不是审单通过，不能把退回时间当作通过时间。
    return { start, end: nextEntry.status?.code === 'draft' ? null : nextEntry.enteredAt };
  }
  const approval = logs.filter((log) => log.action === 'review' && log.createdAt >= start
    && log.detail?.includes('审核订单') && !log.detail.includes('审核退回'))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id)[0];
  return { start, end: approval?.createdAt ?? null };
}
