type SnapshotRow = {
  colorName: string;
  quantities: number[];
};

type Snapshot = {
  headers: string[];
  rows: SnapshotRow[];
};

type LogSummaryInput = {
  before: unknown;
  after: unknown;
  remark?: string;
  sourceOrderNo?: string;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeQuantity(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

function formatQty(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

function normalizeSnapshot(value: unknown): Snapshot | null {
  const raw = asRecord(value);
  const rawHeaders = Array.isArray(raw.headers) ? raw.headers : [];
  const headers = rawHeaders
    .map((header) => normalizeText(header))
    .filter((header) => header && header !== '__UNASSIGNED__' && header !== '合计');
  const rawRows = Array.isArray(raw.rows) ? raw.rows : [];
  if (!headers.length || !rawRows.length) return null;

  const rows = rawRows
    .map((item) => {
      const row = asRecord(item);
      const rawQuantities = Array.isArray(row.quantities)
        ? row.quantities
        : Array.isArray(row.values)
          ? row.values
          : [];
      return {
        colorName: normalizeText(row.colorName),
        quantities: headers.map((_, index) => normalizeQuantity(rawQuantities[index])),
      };
    })
    .filter((row) => row.quantities.some((quantity) => quantity > 0));

  return rows.length ? { headers, rows } : null;
}

function mergeHeaders(...snapshots: Array<Snapshot | null>): string[] {
  const headers: string[] = [];
  snapshots.forEach((snapshot) => {
    snapshot?.headers.forEach((header) => {
      if (!headers.includes(header)) headers.push(header);
    });
  });
  return headers;
}

function remapValues(snapshot: Snapshot | null, colorName: string, headers: string[]): number[] {
  if (!snapshot) return headers.map(() => 0);
  const row = snapshot.rows.find((item) => item.colorName === colorName);
  const indexMap = new Map(snapshot.headers.map((header, index) => [header, index]));
  return headers.map((header) => {
    const sourceIndex = indexMap.get(header);
    return sourceIndex == null ? 0 : normalizeQuantity(row?.quantities[sourceIndex]);
  });
}

function getColorNames(before: Snapshot | null, after: Snapshot | null): string[] {
  const names = [
    ...(before?.rows.map((row) => row.colorName) ?? []),
    ...(after?.rows.map((row) => row.colorName) ?? []),
  ];
  return names.filter((name, index) => names.indexOf(name) === index);
}

export function getFinishedStockAdjustLogSourceOrderNo(input: LogSummaryInput): string {
  const before = asRecord(input.before);
  const after = asRecord(input.after);
  const direct = normalizeText(input.sourceOrderNo) || normalizeText(after.sourceOrderNo) || normalizeText(before.sourceOrderNo);
  if (direct) return direct;
  const match = normalizeText(input.remark).match(/从订单\s*([^\s]+)\s*/);
  return match?.[1] ?? '';
}

function buildSizeDeltaSummary(before: Snapshot | null, after: Snapshot | null): string[] {
  const headers = mergeHeaders(before, after);
  if (!headers.length) return [];
  return getColorNames(before, after)
    .map((colorName) => {
      const beforeValues = remapValues(before, colorName, headers);
      const afterValues = remapValues(after, colorName, headers);
      const deltas = headers
        .map((header, index) => ({ header, delta: afterValues[index] - beforeValues[index] }))
        .filter((item) => item.delta !== 0)
        .map((item) => `${item.header} ${item.delta > 0 ? '+' : ''}${formatQty(item.delta)}件`);
      if (!deltas.length) return '';
      return colorName ? `${colorName}：${deltas.join('、')}` : deltas.join('、');
    })
    .filter(Boolean);
}

export function buildFinishedStockAdjustLogSummary(input: LogSummaryInput): string {
  const before = asRecord(input.before);
  const after = asRecord(input.after);
  const remark = normalizeText(input.remark);
  const beforeSnapshot = normalizeSnapshot(before.colorSizeSnapshot);
  const afterSnapshot = normalizeSnapshot(after.colorSizeSnapshot);
  const sourceOrderNo = getFinishedStockAdjustLogSourceOrderNo(input);
  const beforeQuantity = Number(before.quantity);
  const afterQuantity = Number(after.quantity);
  const hasQuantityDelta = Number.isFinite(beforeQuantity) && Number.isFinite(afterQuantity) && beforeQuantity !== afterQuantity;
  const isInbound = afterQuantity > beforeQuantity || remark.includes('新增库存') || remark.includes('合并入库');

  const sizeSummaries = buildSizeDeltaSummary(beforeSnapshot, afterSnapshot);
  if (isInbound) {
    const prefix = sourceOrderNo ? `从订单 ${sourceOrderNo} 新增库存` : '手工新增库存';
    if (sizeSummaries.length) return `${prefix} ${sizeSummaries.join('；')}`;
    if (hasQuantityDelta) return `${prefix} +${formatQty(afterQuantity - beforeQuantity)}件`;
    return prefix;
  }

  if (sizeSummaries.length) return sizeSummaries.join('；');
  return remark || '更新库存信息';
}
