export type OperationLogColorSizeRow = {
  colorName: string;
  quantities: number[];
};

export function formatColorSizeOperationDetail(
  headers: string[],
  rows: OperationLogColorSizeRow[] | null | undefined,
  fallbackTotal?: number,
): string {
  if (!Array.isArray(rows) || !rows.length || !headers.length) {
    return `合计 ${Math.max(0, Number(fallbackTotal) || 0)}件`;
  }
  const parts = rows.map((row) => {
    const quantities = headers
      .map((header, index) => ({ header: String(header ?? '').trim() || `尺码${index + 1}`, quantity: Number(row.quantities?.[index]) || 0 }))
      .filter((item) => item.quantity !== 0);
    const total = quantities.reduce((sum, item) => sum + item.quantity, 0);
    const sizeText = quantities.map((item) => `${item.header} ${item.quantity}`).join('、') || '无数量';
    return `${String(row.colorName ?? '').trim() || '-'}（${sizeText}，合计${total}件）`;
  });
  return parts.join('；');
}
