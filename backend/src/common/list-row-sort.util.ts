/**
 * 列表行按字段排序（用于"取全部→JS切片分页"的列表，排序须在切片前调用）。
 * 仅允许 allowedFields 白名单内的字段；sortOrder 非 asc/desc 时不排序，保持默认顺序。
 * 字段值统一按字符串比较（时间列存为 'YYYY-MM-DD HH:mm:ss' 字典序即时间序）；空值恒排最后。
 */
export function applyRowSort<T>(
  rows: T[],
  sortField: string | undefined,
  sortOrder: string | undefined,
  allowedFields: string[],
): T[] {
  if (!sortField || !allowedFields.includes(sortField)) return rows;
  if (sortOrder !== 'asc' && sortOrder !== 'desc') return rows;
  const dir = sortOrder === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortField];
    const bv = (b as Record<string, unknown>)[sortField];
    const as = av == null || av === '' ? null : String(av);
    const bs = bv == null || bv === '' ? null : String(bv);
    if (as === bs) return 0;
    if (as === null) return 1;
    if (bs === null) return -1;
    return as < bs ? -dir : dir;
  });
}
