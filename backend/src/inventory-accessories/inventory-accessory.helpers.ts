import { InventoryAccessory } from '../entities/inventory-accessory.entity';
import { InventoryAccessoryOutbound } from '../entities/inventory-accessory-outbound.entity';
import { getSizeHeaderKey, normalizeSizeHeader, normalizeSizeMatrix } from '../common/size-headers.util';

export type AccessorySizeBreakdown = { headers: string[]; quantities: number[] };

export type AccessoryOutboundRawRow = {
  id: number | string;
  accessoryId: number | string;
  orderId: number | string | null;
  orderNo: string | null;
  outboundType: 'manual' | 'order_auto' | null;
  quantity: number | string | null;
  beforeQuantity: number | string | null;
  afterQuantity: number | string | null;
  operatorUsername: string | null;
  remark: string | null;
  createdAt: Date | string | null;
  imageUrl: string | null;
  customerName: string | null;
  category: string | null;
  sizeOutbound: string | AccessorySizeBreakdown | null;
};

export type AccessoryOutboundNegative = { size: string | null; after: number };

export type InventoryAccessoryOutboundParams = {
  accessoryId: number;
  quantity: number;
  outboundType: 'order_auto' | 'manual';
  operatorUsername: string;
  remark?: string;
  orderId?: number | null;
  orderNo?: string;
  /** 分码辅料按码出库明细（headers/quantities 为正数，下标对齐） */
  sizeOutbound?: AccessorySizeBreakdown;
};

export type InventoryAccessoryOutboundResult = {
  accessory: InventoryAccessory;
  record: InventoryAccessoryOutbound;
  /** 本次出库后被扣成负数的项（待订购信号） */
  negatives: AccessoryOutboundNegative[];
};

export function parseSizeBreakdown(value: unknown): AccessorySizeBreakdown | null {
  let raw: unknown = value;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return null;
    try {
      raw = JSON.parse(text);
    } catch {
      return null;
    }
  }
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as { headers?: unknown; quantities?: unknown };
  if (!Array.isArray(obj.headers) || !Array.isArray(obj.quantities)) return null;
  const headers = obj.headers.map((h) => String(h ?? ''));
  const quantities = obj.quantities.map((q) => Number(q) || 0);
  if (!headers.length) return null;
  return { headers, quantities };
}

/** 把 total 按各桶现有数量比例（最大余数法）拆分成整数扣减量，合计 = total */
export function distributeProportional(weights: number[], total: number): number[] {
  const n = weights.length;
  const result = new Array<number>(n).fill(0);
  if (n === 0 || total <= 0) return result;
  const positive = weights.map((w) => Math.max(0, Number(w) || 0));
  const weightSum = positive.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) {
    result[0] = total;
    return result;
  }
  const raw = positive.map((w) => (total * w) / weightSum);
  const floored = raw.map((r) => Math.floor(r));
  let remainder = total - floored.reduce((a, b) => a + b, 0);
  const byFrac = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; remainder > 0 && k < byFrac.length; k++, remainder--) {
    floored[byFrac[k].i] += 1;
  }
  return floored;
}

export interface SizedOutboundOutcome {
  headers: string[];
  quantities: number[];
  total: number;
  deduct: AccessorySizeBreakdown;
  negatives: AccessoryOutboundNegative[];
}

/**
 * 对分码辅料按码扣减：缺码动态补码后扣成负数（R5），返回新各码、本次扣减明细、以及扣后为负的码。
 * 允许负库存，不抛错。
 */
export function applySizedOutbound(
  currentHeaders: string[] | null | undefined,
  currentQuantities: number[] | null | undefined,
  deductHeaders: string[],
  deductQuantities: number[],
): SizedOutboundOutcome {
  const headers = [...(currentHeaders ?? [])];
  const quantities = [...(currentQuantities ?? [])].map((q) => Number(q) || 0);
  const keyToIndex = new Map<string, number>();
  headers.forEach((h, i) => keyToIndex.set(getSizeHeaderKey(h), i));

  const deductedKeys = new Set<string>();
  deductHeaders.forEach((h, di) => {
    const d = Number(deductQuantities[di]) || 0;
    if (d === 0) return;
    const key = getSizeHeaderKey(h);
    deductedKeys.add(key);
    let idx = keyToIndex.get(key);
    if (idx == null) {
      headers.push(normalizeSizeHeader(h) || String(h));
      quantities.push(0);
      idx = headers.length - 1;
      keyToIndex.set(key, idx);
    }
    quantities[idx] = quantities[idx] - d;
  });

  const norm = normalizeSizeMatrix(headers, quantities);
  const negatives: AccessoryOutboundNegative[] = [];
  norm.headers.forEach((h, i) => {
    if (deductedKeys.has(getSizeHeaderKey(h)) && norm.quantities[i] < 0) {
      negatives.push({ size: h, after: norm.quantities[i] });
    }
  });
  const normDeduct = normalizeSizeMatrix(deductHeaders, deductQuantities);
  return {
    headers: norm.headers,
    quantities: norm.quantities,
    total: norm.total,
    deduct: { headers: normDeduct.headers, quantities: normDeduct.quantities },
    negatives,
  };
}

export function toAccessorySnapshot(item: InventoryAccessory): Record<string, unknown> {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    quantity: item.quantity,
    isSized: !!item.isSized,
    sizeHeaders: Array.isArray(item.sizeHeaders) ? item.sizeHeaders : null,
    sizeQuantities: Array.isArray(item.sizeQuantities) ? item.sizeQuantities : null,
    unit: item.unit,
    warehouseId: item.warehouseId,
    location: item.location,
    customerName: item.customerName,
    salesperson: item.salesperson,
    imageUrl: item.imageUrl,
    imageUrls: Array.isArray(item.imageUrls) ? item.imageUrls : [],
    remark: item.remark,
  };
}

export function mapOutboundRawRow(r: AccessoryOutboundRawRow) {
  return {
    id: Number(r.id),
    accessoryId: Number(r.accessoryId),
    orderId: r.orderId != null ? Number(r.orderId) : null,
    orderNo: r.orderNo ?? '',
    outboundType: r.outboundType ?? 'manual',
    quantity: Number(r.quantity) || 0,
    sizeOutbound: parseSizeBreakdown(r.sizeOutbound),
    beforeQuantity: Number(r.beforeQuantity) || 0,
    afterQuantity: Number(r.afterQuantity) || 0,
    operatorUsername: r.operatorUsername ?? '',
    remark: r.remark ?? '',
    createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
    imageUrl: r.imageUrl ?? '',
    customerName: r.customerName ?? '',
    category: r.category ?? '',
  };
}
