/**
 * 颜色×尺码二维数量行：生产环节（车缝/尾部收货/尾部入库等）按颜色和尺码登记的真实数量。
 * 与订单计划（order_ext.colorSizeRows）/裁床（order_cutting.actualCutRows）同结构。
 */
export interface ColorSizeQuantityRow {
  colorName: string;
  quantities: number[];
}

/** 标准化单元格值为非负整数 */
function toCellInt(v: unknown): number {
  return Math.max(0, Math.trunc(Number(v) || 0));
}

/** 把入参标准化为干净的二维行（裁剪/补齐到 sizeLen，trim colorName） */
export function normalizeColorRows(
  rows: ColorSizeQuantityRow[] | null | undefined,
  sizeLen: number,
): ColorSizeQuantityRow[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => {
    const q = Array.isArray(r?.quantities) ? r.quantities : [];
    const quantities = Array.from({ length: sizeLen }, (_, i) => toCellInt(q[i]));
    return { colorName: String(r?.colorName ?? '').trim(), quantities };
  });
}

/** 二维行总和：合计永远按"分尺码之和"现算，永不读独立字段 */
export function sumColorRows(rows: ColorSizeQuantityRow[]): number {
  let sum = 0;
  for (const r of rows) {
    const q = Array.isArray(r?.quantities) ? r.quantities : [];
    for (const n of q) sum += toCellInt(n);
  }
  return sum;
}

/** 按尺码列求和（聚合一维行；不含合计列） */
export function sumColorRowsBySize(rows: ColorSizeQuantityRow[], sizeLen: number): number[] {
  const out = Array(sizeLen).fill(0) as number[];
  for (const r of rows) {
    const q = Array.isArray(r?.quantities) ? r.quantities : [];
    for (let i = 0; i < sizeLen; i++) out[i] += toCellInt(q[i]);
  }
  return out;
}

/** 形态校验：颜色行数 + 颜色名 + 每行尺码数严格对齐 */
export function assertColorRowsShape(
  rows: ColorSizeQuantityRow[],
  planColorNames: string[],
  sizeLen: number,
): void {
  if (!Array.isArray(rows) || rows.length !== planColorNames.length) {
    throw new Error(`颜色行数 ${rows?.length ?? 0} 与订单计划颜色数 ${planColorNames.length} 不一致`);
  }
  for (let i = 0; i < rows.length; i++) {
    const expected = (planColorNames[i] ?? '').trim();
    const actual = (rows[i]?.colorName ?? '').trim();
    if (actual !== expected) {
      throw new Error(`第 ${i + 1} 行颜色 "${actual}" 与订单计划 "${expected}" 不一致`);
    }
    const q = rows[i]?.quantities;
    if (!Array.isArray(q) || q.length !== sizeLen) {
      throw new Error(`第 ${i + 1} 行（${expected}）尺码数 ${q?.length ?? 0} 与订单 ${sizeLen} 不一致`);
    }
  }
}

/**
 * 二维行逐元素加法（累加批次入库等场景）。两边都已标准化。
 * 若 base 为空（首批），返回 add 副本。
 * 若 add 为空，返回 base 副本。
 * 颜色顺序以 planColorNames 为准。
 */
export function addColorRows(
  base: ColorSizeQuantityRow[] | null,
  add: ColorSizeQuantityRow[],
  planColorNames: string[],
  sizeLen: number,
): ColorSizeQuantityRow[] {
  const baseMap = new Map<string, number[]>();
  if (Array.isArray(base)) {
    for (const r of base) baseMap.set((r?.colorName ?? '').trim(), Array.isArray(r?.quantities) ? r.quantities.map(toCellInt) : []);
  }
  const addMap = new Map<string, number[]>();
  for (const r of add) addMap.set((r?.colorName ?? '').trim(), Array.isArray(r?.quantities) ? r.quantities.map(toCellInt) : []);

  return planColorNames.map((rawName) => {
    const name = (rawName ?? '').trim();
    const bq = baseMap.get(name) ?? Array(sizeLen).fill(0);
    const aq = addMap.get(name) ?? Array(sizeLen).fill(0);
    const quantities = Array.from({ length: sizeLen }, (_, i) => toCellInt(bq[i]) + toCellInt(aq[i]));
    return { colorName: name, quantities };
  });
}

/**
 * 老数据兜底分摊：把一维聚合（如 sewing_quantity_row）按订单计划的颜色比例按列分摊到二维。
 * 每列大余数分摊，保证 各颜色和 = 聚合该列值。
 * 仅用于读取兜底与一次性迁移，不用于运行时的"美化"。
 */
export function splitAggregateRowToColors(
  aggregatePerSize: number[],
  planRows: Array<{ colorName?: string | null; quantities?: number[] | null }>,
  sizeLen: number,
): ColorSizeQuantityRow[] {
  const planNames = planRows.map((r) => String(r?.colorName ?? '').trim());
  const planMatrix: number[][] = planRows.map((r) => {
    const q = Array.isArray(r?.quantities) ? r.quantities : [];
    return Array.from({ length: sizeLen }, (_, i) => toCellInt(q[i]));
  });
  const colSum: number[] = Array(sizeLen).fill(0);
  for (const r of planMatrix) for (let i = 0; i < sizeLen; i++) colSum[i] += r[i];

  const result: number[][] = planMatrix.map(() => Array(sizeLen).fill(0));
  for (let i = 0; i < sizeLen; i++) {
    const target = toCellInt(aggregatePerSize[i]);
    if (target === 0) continue;
    const sumP = colSum[i];
    if (sumP === 0) {
      result[0][i] = target;
      continue;
    }
    const exact = planMatrix.map((r) => (r[i] * target) / sumP);
    const base = exact.map((v) => Math.floor(v));
    let remain = target - base.reduce((s, v) => s + v, 0);
    const order = exact
      .map((v, c) => ({ c, frac: v - Math.floor(v) }))
      .sort((a, b) => b.frac - a.frac);
    let cur = 0;
    while (remain > 0 && order.length > 0) {
      base[order[cur % order.length].c] += 1;
      remain -= 1;
      cur += 1;
    }
    for (let c = 0; c < planMatrix.length; c++) result[c][i] = base[c];
  }
  return planNames.map((name, c) => ({ colorName: name, quantities: result[c] }));
}
