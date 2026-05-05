const LETTER_SIZE_ORDER = new Map(
  ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL', '9XL', '10XL'].map(
    (size, index) => [size, index],
  ),
);

function normalizeToken(value: unknown): string {
  return String(value ?? '').trim().replace(/\s+/g, '').toUpperCase();
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

export function remapQuantitiesBySizeHeaders(
  sourceHeaders: string[],
  values: unknown[],
  targetHeaders: string[],
): number[] {
  const sourceIndex = new Map(sourceHeaders.map((header, index) => [getSizeHeaderKey(header), index]));
  return targetHeaders.map((header) => {
    const index = sourceIndex.get(getSizeHeaderKey(header));
    if (index == null) return 0;
    const value = Number(values[index]);
    return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
  });
}
