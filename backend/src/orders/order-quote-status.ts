import type { CostSnapshotContent } from '../entities/order-cost-snapshot.entity';

export type OrderQuoteStatus = 'unconfirmed' | 'needs_reconfirm' | 'confirmed';

export interface OrderQuoteLogStatus {
  lastConfirmLogId: number;
  lastDraftLogId: number;
}

/** 兼容新快照元数据与旧操作日志，统一计算待报价列表展示状态。 */
export function resolveOrderQuoteStatus(
  snapshot?: CostSnapshotContent | null,
  logStatus?: OrderQuoteLogStatus,
): OrderQuoteStatus {
  const confirmedAt = typeof snapshot?.quoteConfirmedAt === 'string'
    && snapshot.quoteConfirmedAt.trim() !== '';
  const previouslyConfirmed = confirmedAt || Boolean(logStatus?.lastConfirmLogId);
  if (!previouslyConfirmed) return 'unconfirmed';

  const legacyLogNeedsReconfirm = Boolean(logStatus?.lastConfirmLogId)
    && (logStatus?.lastDraftLogId ?? 0) > (logStatus?.lastConfirmLogId ?? 0);
  return Boolean(snapshot?.quoteNeedsReconfirm) || legacyLogNeedsReconfirm
    ? 'needs_reconfirm'
    : 'confirmed';
}
