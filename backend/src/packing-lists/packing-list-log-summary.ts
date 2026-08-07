import type { SavePackingListDto } from './dto';

type PackingListBefore = {
  code: string;
  customerId?: number | null;
  customerName: string;
  serviceManager: string;
  poNo: string;
  country: string;
  postalCode: string;
  xiaomanOrderNo: string;
  xiaomanOrderId: string;
  packDate: string | null;
  remark: string;
  showCompany: boolean;
  sizeHeaders: string[];
  boxes: Array<{
    boxSeq: number;
    weightKg: number | null;
    cartonSize: string;
    remark: string;
    items: Array<{
      styleNo: string;
      styleName: string;
      colorName: string;
      imageUrl: string;
      sizeQuantities: Record<string, number>;
      totalQty: number;
      sourceType: string;
      sourceId: number | null;
    }>;
  }>;
};

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function shown(value: unknown): string {
  return text(value) || '-';
}

function normalizeSizeQuantities(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([size, quantity]) => [size.trim(), Math.max(0, Number(quantity) || 0)] as const)
      .filter(([size, quantity]) => !!size && quantity > 0)
      .sort(([left], [right]) => left.localeCompare(right, 'zh-CN')),
  );
}

function normalizeBoxes(boxes: SavePackingListDto['boxes']): unknown[] {
  return (Array.isArray(boxes) ? boxes : []).map((box, boxIndex) => ({
    boxSeq: boxIndex + 1,
    weightKg: box.weightKg == null ? null : Number(box.weightKg),
    cartonSize: text(box.cartonSize),
    remark: text(box.remark),
    items: (Array.isArray(box.items) ? box.items : []).map((item) => ({
      styleNo: text(item.styleNo),
      styleName: text(item.styleName),
      colorName: text(item.colorName),
      imageUrl: text(item.imageUrl),
      sizeQuantities: normalizeSizeQuantities(item.sizeQuantities),
      totalQty: Math.max(0, Number(item.totalQty) || 0),
      sourceType: text(item.sourceType) || 'manual',
      sourceId: item.sourceId == null ? null : Number(item.sourceId),
    })),
  }));
}

function totalQuantity(boxes: Array<{ items?: Array<{ sizeQuantities?: unknown; totalQty?: unknown }> }>): number {
  return boxes.reduce((boxSum, box) => boxSum + (box.items ?? []).reduce((itemSum, item) => {
    const sizeTotal = Object.values(normalizeSizeQuantities(item.sizeQuantities)).reduce((sum, quantity) => sum + quantity, 0);
    return itemSum + (sizeTotal > 0 ? sizeTotal : Math.max(0, Number(item.totalQty) || 0));
  }, 0), 0);
}

function itemKeys(box: { items?: Array<{ styleNo?: unknown; colorName?: unknown }> } | undefined): string[] {
  const keys = (box?.items ?? []).map((item) => `${shown(item.styleNo)}/${shown(item.colorName)}`);
  return keys.filter((key, index) => keys.indexOf(key) === index);
}

export function buildPackingListUpdateSummary(before: PackingListBefore, payload: SavePackingListDto): string {
  const parts: string[] = [];
  const diff = (label: string, previous: unknown, next: unknown) => {
    if (String(previous ?? '') !== String(next ?? '')) parts.push(`${label}「${shown(previous)}」→「${shown(next)}」`);
  };
  diff('客户档案', before.customerId ?? null, payload.customerId ?? null);
  diff('客户', before.customerName, payload.customerName);
  diff('业务员', before.serviceManager, payload.serviceManager);
  diff('PO号', before.poNo, payload.poNo);
  diff('国家', before.country, payload.country);
  diff('邮编', before.postalCode, payload.postalCode);
  diff('小满单号', before.xiaomanOrderNo, payload.xiaomanOrderNo);
  diff('小满订单ID', before.xiaomanOrderId, payload.xiaomanOrderId);
  diff('装箱日期', before.packDate, payload.packDate);
  diff('备注', before.remark, payload.remark);
  diff('箱贴公司名', before.showCompany ? '显示' : '隐藏', payload.showCompany === false ? '隐藏' : '显示');
  const nextHeaders = Array.isArray(payload.sizeHeaders) ? payload.sizeHeaders.map(text).filter(Boolean) : [];
  if (JSON.stringify(before.sizeHeaders ?? []) !== JSON.stringify(nextHeaders)) {
    parts.push(`尺码列「${(before.sizeHeaders ?? []).join('、') || '-'}」→「${nextHeaders.join('、') || '-'}」`);
  }

  const previousBoxes = normalizeBoxes(before.boxes as SavePackingListDto['boxes']);
  const nextBoxes = normalizeBoxes(payload.boxes);
  if (JSON.stringify(previousBoxes) !== JSON.stringify(nextBoxes)) {
    const previousTotal = totalQuantity(before.boxes);
    const nextTotal = totalQuantity(payload.boxes);
    if (before.boxes.length !== payload.boxes.length) parts.push(`箱数 ${before.boxes.length}→${payload.boxes.length}`);
    if (previousTotal !== nextTotal) parts.push(`件数 ${previousTotal}→${nextTotal}`);
    const changedBoxes: string[] = [];
    const maxBoxes = Math.max(previousBoxes.length, nextBoxes.length);
    for (let index = 0; index < maxBoxes; index += 1) {
      if (JSON.stringify(previousBoxes[index]) === JSON.stringify(nextBoxes[index])) continue;
      const keys = [...itemKeys(before.boxes[index]), ...itemKeys(payload.boxes[index])]
        .filter((key, keyIndex, list) => list.indexOf(key) === keyIndex);
      changedBoxes.push(`第${index + 1}箱${keys.length ? `（${keys.join('、')}）` : ''}`);
    }
    parts.push(`箱规/箱内明细已修改：${changedBoxes.join('、')}`);
  }
  return `修改装箱单 ${before.code}：${parts.length ? parts.join('；') : '未修改任何字段'}`;
}

export function buildPackingListShipSummary(detail: PackingListBefore): string {
  const total = totalQuantity(detail.boxes);
  const items = detail.boxes.flatMap((box) => box.items);
  const byStyleColor = new Map<string, number>();
  items.forEach((item) => {
    const key = `${shown(item.styleNo)}/${shown(item.colorName)}`;
    const sizeTotal = Object.values(normalizeSizeQuantities(item.sizeQuantities)).reduce((sum, quantity) => sum + quantity, 0);
    byStyleColor.set(key, (byStyleColor.get(key) ?? 0) + (sizeTotal > 0 ? sizeTotal : Math.max(0, Number(item.totalQty) || 0)));
  });
  const detailText = Array.from(byStyleColor.entries()).map(([key, quantity]) => `${key} ${quantity}件`).join('、');
  return `发货 ${detail.code}：${detail.boxes.length}箱，共${total}件${detailText ? `；${detailText}` : ''}`;
}
