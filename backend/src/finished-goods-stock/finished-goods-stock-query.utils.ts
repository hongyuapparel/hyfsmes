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

function sameSnapshotQuantities(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
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
  const blankRows: number[][] = [];

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
      blankRows.push(quantities);
      return;
    }
    addRow(colorName, quantities);
  });

  blankRows.forEach((quantities) => {
    const exactMatches = orderedColors.filter((colorName) =>
      sameSnapshotQuantities(rowMap.get(colorName) ?? [], quantities),
    );
    if (exactMatches.length === 1) addRow(exactMatches[0], quantities);
    else if (orderedColors.length === 1) addRow(orderedColors[0], quantities);
    else addRow('', quantities);
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

function allocateByWeight(weights: number[], total: number): number[] {
  const safeTotal = Math.max(0, Math.trunc(Number(total) || 0));
  if (!weights.length) return [];
  const normalized = weights.map((weight) => Math.max(0, Number(weight) || 0));
  const sumWeight = normalized.reduce((sum, weight) => sum + weight, 0);
  if (safeTotal <= 0) return normalized.map(() => 0);
  if (sumWeight <= 0) {
    const allocated = normalized.map(() => 0);
    allocated[0] = safeTotal;
    return allocated;
  }
  const exact = normalized.map((weight) => (weight * safeTotal) / sumWeight);
  const base = exact.map((value) => Math.floor(value));
  let remain = safeTotal - base.reduce((sum, value) => sum + value, 0);
  const order = exact
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac);
  let cursor = 0;
  while (remain > 0 && order.length > 0) {
    base[order[cursor % order.length].index] += 1;
    remain -= 1;
    cursor += 1;
  }
  return base;
}

export function scaleColorSizeRowsToQuantity(
  headers: string[],
  rows: Array<{ colorName?: string; quantities?: unknown[] }>,
  targetQty: number,
): Array<{ colorName: string; quantities: number[] }> {
  if (!headers.length || !rows.length) return [];
  const safeTarget = Math.max(0, Math.trunc(Number(targetQty) || 0));
  const weights: number[] = [];
  rows.forEach((row) => {
    for (let i = 0; i < headers.length; i += 1) {
      weights.push(Math.max(0, Number(row.quantities?.[i]) || 0));
    }
  });
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  if (weightSum <= 0) {
    return rows.map((row) => ({
      colorName: String(row.colorName ?? '').trim(),
      quantities: Array(headers.length).fill(0),
    }));
  }
  const allocated = weightSum === safeTarget ? [...weights] : allocateByWeight(weights, safeTarget);
  let cursor = 0;
  return rows.map((row) => {
    const quantities: number[] = [];
    for (let i = 0; i < headers.length; i += 1) {
      quantities.push(allocated[cursor] ?? 0);
      cursor += 1;
    }
    return { colorName: String(row.colorName ?? '').trim(), quantities };
  });
}
