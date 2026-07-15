import { BadRequestException } from '@nestjs/common';
import type { ColorSizeSnapshot } from '../finished-goods-stock/finished-goods-stock.types';
import {
  parseStoredColorSizeSnapshot,
  subtractColorSizeSnapshots,
} from '../finished-goods-stock/finished-goods-stock-query.utils';

export function getColorSizeSnapshotTotal(snapshot: ColorSizeSnapshot | null): number {
  if (!snapshot?.rows?.length) return 0;
  return snapshot.rows.reduce(
    (sum, row) =>
      sum +
      row.quantities.reduce((rowSum, qty) => rowSum + Math.max(0, Math.trunc(Number(qty) || 0)), 0),
    0,
  );
}

export function assertColorSizeSnapshotTotal(
  snapshot: ColorSizeSnapshot | null,
  expectedQty: number,
  message: string,
): void {
  const safeExpected = Math.max(0, Math.trunc(Number(expectedQty) || 0));
  if (!snapshot) {
    if (safeExpected > 0) {
      throw new BadRequestException(`${message}（缺少有效尺码明细，总数量 ${safeExpected}）`);
    }
    return;
  }
  const actual = getColorSizeSnapshotTotal(snapshot);
  if (actual !== safeExpected) {
    throw new BadRequestException(`${message}（尺码合计 ${actual}，总数量 ${safeExpected}）`);
  }
}

/**
 * 有本批当前尺码时：校验发货尺码合计=数量、不超剩余各码，并返回扣减后的剩余 snapshot。
 * 无当前尺码：允许整批发货仅校验合计；分批必须有当前尺码。
 */
export function applyPendingOutboundSizeDeduction(params: {
  label: string;
  pendingQty: number;
  shipQty: number;
  /** 已解析的当前尺码（DB 或尾部兜底）；不要只传未解析的 raw */
  currentSnapshot: ColorSizeSnapshot | null;
  outgoingSizeBreakdown: unknown;
  currentSource?: 'db' | 'finishing-fallback' | 'none';
}): { remainingSnapshot: ColorSizeSnapshot | null; outgoingSnapshot: ColorSizeSnapshot | null } {
  const { label, pendingQty, shipQty, currentSnapshot, outgoingSizeBreakdown } = params;
  const outgoingSnapshot = parseStoredColorSizeSnapshot(outgoingSizeBreakdown);
  const remainQty = pendingQty - shipQty;

  if (currentSnapshot) {
    if (!outgoingSnapshot) {
      throw new BadRequestException(`${label} 已有颜色×尺码明细，发货必须按尺码填写`);
    }
    assertColorSizeSnapshotTotal(currentSnapshot, pendingQty, `${label} 当前待仓尺码明细与待处理数量不一致`);
    assertColorSizeSnapshotTotal(outgoingSnapshot, shipQty, `${label} 发货尺码明细合计必须等于发货数量`);
    const remainingSnapshot = subtractColorSizeSnapshots(currentSnapshot, outgoingSnapshot);
    if (remainQty > 0) {
      if (!remainingSnapshot) {
        throw new BadRequestException(`${label} 扣减后未能生成有效剩余尺码明细，请核对发货尺码`);
      }
      assertColorSizeSnapshotTotal(remainingSnapshot, remainQty, `${label} 扣减后剩余尺码与剩余数量不一致`);
    }
    return { remainingSnapshot: remainQty > 0 ? remainingSnapshot : null, outgoingSnapshot };
  }

  if (remainQty > 0) {
    throw new BadRequestException(
      `${label} 未留存本批颜色×尺码明细，无法分批发货；请一次发完，或先在尾部核对入库尺码后再处理`,
    );
  }
  if (outgoingSnapshot) {
    assertColorSizeSnapshotTotal(outgoingSnapshot, shipQty, `${label} 发货尺码明细合计必须等于发货数量`);
  }
  return { remainingSnapshot: null, outgoingSnapshot };
}
