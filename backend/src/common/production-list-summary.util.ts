/** Count the filtered result before selecting a tab or slicing a page. */
export function summarizeProductionTab<T>(
  allRows: T[],
  tab: string | undefined,
  statuses: readonly string[],
  getStatus: (row: T) => string,
): { rows: T[]; tabCounts: Record<string, number> } {
  const tabCounts: Record<string, number> = { all: allRows.length };
  for (const status of statuses) tabCounts[status] = 0;
  const filterTab = tab != null && statuses.includes(tab);
  const rows: T[] = [];
  for (const row of allRows) {
    const status = getStatus(row);
    if (statuses.includes(status)) tabCounts[status]++;
    if (!filterTab || status === tab) rows.push(row);
  }
  return { rows, tabCounts };
}
