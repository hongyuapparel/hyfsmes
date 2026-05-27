const LETTER_SIZE_ORDER = new Map(
  ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'].map(
    (size, index): [string, number] => [size, index],
  ),
);

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase();
}

export function normalizeSizeHeader(value: unknown): string {
  const raw = String(value ?? '').trim();
  const token = normalizeToken(raw);
  if (!token) return '';
  if (token === '__UNASSIGNED__' || token === 'TOTAL' || token === '合计' || token === '總計') return '';
  if (LETTER_SIZE_ORDER.has(token)) return token;
  const repeatedXl = token.match(/^(X{2,})L$/);
  if (repeatedXl) return `${repeatedXl[1].length}XL`;
  const numberedXl = token.match(/^(\d+)XL$/);
  if (numberedXl) return `${Number(numberedXl[1])}XL`;
  return raw;
}

export function getSizeHeaderKey(value: unknown): string {
  return normalizeSizeHeader(value).toUpperCase();
}

function getSizeRank(header: string, fallbackIndex: number): number {
  const key = getSizeHeaderKey(header);
  const knownRank = LETTER_SIZE_ORDER.get(key);
  if (knownRank != null) return knownRank;
  const numericValue = Number(key);
  if (Number.isFinite(numericValue)) return 1000 + numericValue;
  return 2000 + fallbackIndex;
}

export function sortSizeHeaders(headers: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const normalized = headers
    .map((header, index) => ({ header: normalizeSizeHeader(header), index }))
    .filter((item) => {
      if (!item.header) return false;
      const key = getSizeHeaderKey(item.header);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return normalized
    .sort((a, b) => getSizeRank(a.header, a.index) - getSizeRank(b.header, b.index))
    .map((item) => item.header);
}

export interface NormalizedSizeMatrix {
  headers: string[];
  quantities: number[];
  total: number;
}

/**
 * 规范化分码矩阵：去空码、合并同义码（相加）、按尺码顺序排序，并算出总量。
 * headers 与 quantities 下标对齐；quantities 可为负。
 */
export function normalizeSizeMatrix(
  headers: Array<string | null | undefined> | null | undefined,
  quantities: Array<number | null | undefined> | null | undefined,
): NormalizedSizeMatrix {
  const headerList = Array.isArray(headers) ? headers : [];
  const qtyList = Array.isArray(quantities) ? quantities : [];
  const sumByKey = new Map<string, number>();
  const displayByKey = new Map<string, string>();
  headerList.forEach((header, index) => {
    const normalized = normalizeSizeHeader(header);
    if (!normalized) return;
    const key = getSizeHeaderKey(normalized);
    const qty = Number(qtyList[index]) || 0;
    sumByKey.set(key, (sumByKey.get(key) ?? 0) + qty);
    if (!displayByKey.has(key)) displayByKey.set(key, normalized);
  });
  const orderedHeaders = sortSizeHeaders(Array.from(displayByKey.values()));
  const resultHeaders: string[] = [];
  const resultQuantities: number[] = [];
  let total = 0;
  for (const header of orderedHeaders) {
    const key = getSizeHeaderKey(header);
    const qty = sumByKey.get(key) ?? 0;
    resultHeaders.push(header);
    resultQuantities.push(qty);
    total += qty;
  }
  return { headers: resultHeaders, quantities: resultQuantities, total };
}
