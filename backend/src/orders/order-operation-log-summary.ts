import type { OrderEditPayload } from './order.types';

type OrderBefore = Record<string, unknown>;

function text(value: unknown): string {
  return String(value ?? '').trim();
}

function shown(value: unknown): string {
  const normalized = text(value);
  return normalized || '-';
}

function comparable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(comparable);
  if (!value || typeof value !== 'object') return value ?? null;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, comparable(item)]),
  );
}

function changed(before: unknown, after: unknown): boolean {
  return JSON.stringify(comparable(before)) !== JSON.stringify(comparable(after));
}

function comparableMaterials(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((rawRow) => {
    if (!rawRow || typeof rawRow !== 'object') return rawRow;
    const {
      materialType: _displayMaterialType,
      materialSource: _displayMaterialSource,
      __rowKey: _frontendRowKey,
      ...row
    } = rawRow as Record<string, unknown>;
    return row;
  });
}

function listCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function totalColorSizeQuantity(value: unknown): number {
  if (!Array.isArray(value)) return 0;
  return value.reduce((sum, rawRow) => {
    const row = rawRow && typeof rawRow === 'object' ? rawRow as Record<string, unknown> : {};
    const quantities = Array.isArray(row.quantities)
      ? row.quantities
      : Array.isArray(row.values)
        ? row.values
        : [];
    return sum + quantities.reduce<number>((rowSum, quantity) => rowSum + (Number(quantity) || 0), 0);
  }, 0);
}

function appendStructuredChange(
  parts: string[],
  label: string,
  before: unknown,
  after: unknown,
  description?: (value: unknown) => string,
): void {
  if (!changed(before, after)) return;
  const describe = description ?? ((value: unknown) => `${listCount(value)}项`);
  parts.push(`${label}已修改（${describe(before)}→${describe(after)}）`);
}

export function buildOrderCreateLogDetail(payload: OrderEditPayload): string {
  const parts = [
    `SKU ${shown(payload.skuCode)}`,
    `客户 ${shown(payload.customerName)}`,
    `数量 ${Number(payload.quantity) || 0}件`,
  ];
  const colorTotal = totalColorSizeQuantity(payload.colorSizeRows);
  if (Array.isArray(payload.colorSizeRows)) parts.push(`颜色/尺码 ${payload.colorSizeRows.length}色、${colorTotal}件`);
  return `创建订单草稿：${parts.join('；')}`;
}

export function buildOrderUpdateLogDetail(before: OrderBefore, payload: OrderEditPayload): string {
  const parts: string[] = [];
  const addText = (label: string, key: keyof OrderEditPayload) => {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) return;
    const previous = text(before[key as string]);
    const next = text(payload[key]);
    if (previous !== next) parts.push(`${label}「${shown(previous)}」→「${shown(next)}」`);
  };
  const addNumber = (label: string, key: keyof OrderEditPayload) => {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) return;
    const previous = before[key as string] ?? null;
    const next = payload[key] ?? null;
    const previousNumber = previous === null || previous === '' ? null : Number(previous);
    const nextNumber = next === null || next === '' ? null : Number(next);
    const previousComparable = previousNumber != null && Number.isFinite(previousNumber) ? previousNumber : previous;
    const nextComparable = nextNumber != null && Number.isFinite(nextNumber) ? nextNumber : next;
    if (String(previousComparable ?? '') !== String(nextComparable ?? '')) {
      parts.push(`${label} ${shown(previousComparable)}→${shown(nextComparable)}`);
    }
  };
  const addDate = (label: string, key: 'orderDate' | 'customerDueDate') => {
    if (!Object.prototype.hasOwnProperty.call(payload, key)) return;
    const dateOnly = (value: unknown): string => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
      return text(value).slice(0, 10);
    };
    const previous = dateOnly(before[key]);
    const next = dateOnly(payload[key]);
    if (previous !== next) parts.push(`${label}「${shown(previous)}」→「${shown(next)}」`);
  };

  addText('SKU', 'skuCode');
  addNumber('客户档案', 'customerId');
  addText('客户名称', 'customerName');
  addNumber('合作方式', 'collaborationTypeId');
  addNumber('订单类型', 'orderTypeId');
  addText('业务员', 'salesperson');
  addText('跟单员', 'merchandiser');
  addNumber('数量', 'quantity');
  addNumber('出厂价', 'exFactoryPrice');
  addNumber('销售价', 'salePrice');
  addText('工艺项目', 'processItem');
  addDate('下单日期', 'orderDate');
  addDate('客户交期', 'customerDueDate');
  addText('加工厂', 'factoryName');
  if (Object.prototype.hasOwnProperty.call(payload, 'imageUrl') && text(before.imageUrl) !== text(payload.imageUrl)) {
    parts.push(text(payload.imageUrl) ? '产品图已更新' : '产品图已清空');
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'colorSizeHeaders')) {
    appendStructuredChange(parts, '尺码列', before.colorSizeHeaders, payload.colorSizeHeaders);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'colorSizeRows')) {
    appendStructuredChange(parts, '颜色/尺码明细', before.colorSizeRows, payload.colorSizeRows, (value) => (
      `${listCount(value)}色、${totalColorSizeQuantity(value)}件`
    ));
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'materials')) {
    appendStructuredChange(
      parts,
      '物料明细',
      comparableMaterials(before.materials),
      comparableMaterials(payload.materials),
    );
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'sizeInfoMetaHeaders')) {
    appendStructuredChange(parts, '尺寸资料表头', before.sizeInfoMetaHeaders, payload.sizeInfoMetaHeaders);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'sizeInfoRows')) {
    appendStructuredChange(parts, '尺寸资料', before.sizeInfoRows, payload.sizeInfoRows);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'processItems')) {
    appendStructuredChange(parts, '工艺明细', before.processItems, payload.processItems);
  }
  addText('修改备注', 'revisionNotes');
  addText('生产要求', 'productionRequirement');
  if (Object.prototype.hasOwnProperty.call(payload, 'packagingHeaders')) {
    appendStructuredChange(parts, '包装资料表头', before.packagingHeaders, payload.packagingHeaders);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'packagingCells')) {
    appendStructuredChange(parts, '包装资料', before.packagingCells, payload.packagingCells);
  }
  addText('包装方式', 'packagingMethod');
  if (Object.prototype.hasOwnProperty.call(payload, 'attachments')) {
    appendStructuredChange(parts, '附件', before.attachments, payload.attachments);
  }

  return `修改订单：${parts.length ? parts.join('；') : '未修改任何字段'}`;
}

export function buildCostDraftLogDetail(
  previousSnapshot: Record<string, unknown> | undefined,
  nextSnapshot: Record<string, unknown>,
  previousPrice: number,
  nextPrice: number,
): string {
  const previous = previousSnapshot ?? {};
  const sections: Array<[string, string]> = [
    ['materialRows', '物料成本'],
    ['processItemRows', '工艺成本'],
    ['productionRows', '生产成本'],
    ['productionCostMultiplier', '生产成本系数'],
    ['profitMargin', '利润率'],
  ];
  const changedSections = sections
    .filter(([key]) => changed(previous[key], nextSnapshot[key]))
    .map(([, label]) => label);
  if (!changedSections.length) return '保存成本草稿：未修改成本内容';
  return `保存成本草稿：预计出厂价 ${previousPrice.toFixed(2)}→${nextPrice.toFixed(2)}；变更：${changedSections.join('、')}（未同步订单卡片出厂价）`;
}
