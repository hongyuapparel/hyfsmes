import { BadRequestException } from '@nestjs/common';
import type { ColorSizeSnapshot } from './finished-goods-stock.types';
import { getSizeHeaderKey, normalizeSizeHeader, remapQuantitiesBySizeHeaders, sortSizeHeaders } from './size-header-order.util';

export function formatDateTimeForResponse(value: unknown): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value as string | number);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function isTableMissingError(error: unknown, tableName: string): boolean {
  const withMessage = error as { message?: unknown } | null;
  const msg = String(withMessage?.message ?? '');
  return msg.includes('Table') && msg.includes(tableName) && msg.includes("doesn't exist");
}

export function normalizeOrderUnitPrice(value: unknown): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return '0';
  return n.toFixed(2);
}

function snapshotRowTotal(row: { quantities: unknown[] }): number {
  return row.quantities.reduce<number>(
    (sum, quantity) => sum + Math.max(0, Math.trunc(Number(quantity) || 0)),
    0,
  );
}

function normalizeColorSizeSnapshot(snapshot: ColorSizeSnapshot | null): ColorSizeSnapshot | null {
  if (!snapshot?.headers?.length || !snapshot.rows?.length) return null;

  const headers: string[] = [];
  const sourceHeaderToTarget: number[] = [];
  snapshot.headers.forEach((header, sourceIndex) => {
    const normalized = normalizeSizeHeader(header);
    if (!normalized || normalized === '__UNASSIGNED__') return;
    let targetIndex = headers.findIndex((item) => getSizeHeaderKey(item) === getSizeHeaderKey(normalized));
    if (targetIndex < 0) {
      targetIndex = headers.length;
      headers.push(normalized);
    }
    sourceHeaderToTarget[sourceIndex] = targetIndex;
  });
  if (!headers.length) return null;

  const orderedColors: string[] = [];
  const rowMap = new Map<string, number[]>();

  const addRow = (colorName: string, quantities: number[]) => {
    let existing = rowMap.get(colorName);
    if (!existing) {
      existing = Array(headers.length).fill(0);
      rowMap.set(colorName, existing);
      orderedColors.push(colorName);
    }
    quantities.forEach((quantity, index) => {
      existing![index] += quantity;
    });
  };

  snapshot.rows.forEach((rawRow) => {
    const quantities = Array(headers.length).fill(0);
    const sourceValues = Array.isArray(rawRow.quantities) ? rawRow.quantities : [];
    sourceValues.forEach((value, sourceIndex) => {
      const targetIndex = sourceHeaderToTarget[sourceIndex];
      if (targetIndex == null) return;
      const n = Number(value);
      quantities[targetIndex] += Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
    });
    if (snapshotRowTotal({ quantities }) <= 0) return;
    const colorName = String(rawRow.colorName ?? '').trim();
    if (!colorName || colorName === '__UNASSIGNED__') {
      // 颜色缺失本身也是数据事实；不得根据其它行或唯一颜色自动归色。
      addRow('', quantities);
      return;
    }
    addRow(colorName, quantities);
  });

  const sortedHeaders = sortSizeHeaders(headers);
  const rows = orderedColors
    .map((colorName) => ({ colorName, quantities: [...(rowMap.get(colorName) ?? [])] }))
    .filter((row) => snapshotRowTotal(row) > 0);
  if (!rows.length) return null;
  return {
    headers: sortedHeaders,
    rows: rows.map((row) => ({
      colorName: row.colorName,
      quantities: remapQuantitiesBySizeHeaders(headers, row.quantities, sortedHeaders),
    })),
  };
}

export function parseStoredColorSizeSnapshot(raw: unknown): ColorSizeSnapshot | null {
  if (raw == null || raw === '') return null;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const rec = parsed as Record<string, unknown>;
  const headersRaw = Array.isArray(rec.headers) ? rec.headers : [];
  const headers = headersRaw.map(normalizeSizeHeader).filter((h) => h.length > 0);
  const rowsRaw = Array.isArray(rec.rows) ? rec.rows : [];
  if (!headers.length || !rowsRaw.length) return null;
  const rows: Array<{ colorName: string; quantities: number[] }> = [];
  for (const item of rowsRaw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const colorName = String(row.colorName ?? '').trim();
    const sourceValues = Array.isArray(row.quantities)
      ? row.quantities
      : Array.isArray(row.values)
        ? row.values
        : [];
    const quantities = headers.map((_, i) => {
      const n = Number(sourceValues[i]);
      return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
    });
    rows.push({ colorName, quantities });
  }
  if (!rows.length) return null;
  return normalizeColorSizeSnapshot({ headers, rows });
}

export function parseListSizeBreakdownFromSnapshot(raw: unknown): {
  headers: string[];
  rows: Array<{ colorName: string; values: number[] }>;
} | null {
  const snapshot = parseStoredColorSizeSnapshot(raw);
  if (!snapshot) return null;
  return {
    headers: [...snapshot.headers],
    rows: snapshot.rows.map((row) => ({
      colorName: row.colorName,
      values: [...row.quantities],
    })),
  };
}

export function subtractColorSizeSnapshots(current: ColorSizeSnapshot | null, outgoing: ColorSizeSnapshot | null): ColorSizeSnapshot | null {
  if (!current || !outgoing) return current;
  const headers = [...current.headers];
  const rows = current.rows.map((row) => ({
    colorName: String(row.colorName ?? '').trim(),
    quantities: headers.map((_, index) => Math.max(0, Math.trunc(Number(row.quantities[index]) || 0))),
  }));
  const rowMap = new Map(rows.map((row) => [row.colorName, row]));
  const headerIndex = new Map(headers.map((header, index) => [getSizeHeaderKey(header), index]));
  outgoing.rows.forEach((outRow) => {
    const colorName = String(outRow.colorName ?? '').trim();
    const targetRow = rowMap.get(colorName);
    if (!targetRow) throw new BadRequestException(`颜色「${colorName || '-'}」库存明细不足，无法出库`);
    outgoing.headers.forEach((header, outIndex) => {
      const qty = Math.max(0, Math.trunc(Number(outRow.quantities?.[outIndex]) || 0));
      if (qty <= 0) return;
      const targetIndex = headerIndex.get(getSizeHeaderKey(header));
      if (targetIndex == null) throw new BadRequestException(`尺码「${header}」库存明细不足，无法出库`);
      const remain = Math.max(0, Math.trunc(Number(targetRow.quantities[targetIndex]) || 0));
      if (remain < qty) throw new BadRequestException(`颜色「${colorName || '-'}」尺码「${header}」库存不足`);
      targetRow.quantities[targetIndex] = remain - qty;
    });
  });
  const activeRows = rows
    .map((row) => ({
      colorName: row.colorName,
      quantities: headers.map((_, index) => Math.max(0, Math.trunc(Number(row.quantities[index]) || 0))),
    }))
    .filter((row) => row.quantities.some((qty) => qty > 0));
  if (!activeRows.length) return { headers: [], rows: [] };
  return normalizeColorSizeSnapshot({ headers, rows: activeRows });
}
