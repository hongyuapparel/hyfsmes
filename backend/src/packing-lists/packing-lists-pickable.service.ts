import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InboundPending } from '../entities/inbound-pending.entity';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';

export interface PickableQuery {
  customerName?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}

export interface PickableLine {
  sourceType: 'pending' | 'finished';
  sourceId: number;
  orderNo: string;
  styleNo: string;
  customerName: string;
  colorName: string;
  imageUrl: string;
  sizeQuantities: Record<string, number>;
  totalQty: number;
  hasSnapshot: boolean;
}

interface ColorSizeSnapshot {
  headers: string[];
  rows: Array<{ colorName: string; quantities: number[] }>;
}

function parseSnapshot(raw: unknown): ColorSizeSnapshot | null {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (value == null || typeof value !== 'object') return null;
  const snapshot = value as { headers?: unknown; rows?: unknown };
  if (!Array.isArray(snapshot.headers) || !Array.isArray(snapshot.rows)) return null;
  return {
    headers: snapshot.headers.map((h) => String(h ?? '').trim()),
    rows: (snapshot.rows as Array<{ colorName?: unknown; quantities?: unknown }>).map((r) => ({
      colorName: String(r?.colorName ?? '').trim(),
      quantities: Array.isArray(r?.quantities) ? r.quantities.map((q) => Math.max(0, Math.trunc(Number(q) || 0))) : [],
    })),
  };
}

function snapshotRowToLine(headers: string[], row: { colorName: string; quantities: number[] }): { sizeQuantities: Record<string, number>; totalQty: number } {
  const sizeQuantities: Record<string, number> = {};
  let totalQty = 0;
  for (let i = 0; i < headers.length; i++) {
    const qty = row.quantities[i] ?? 0;
    if (headers[i] && qty > 0) {
      sizeQuantities[headers[i]] = qty;
      totalQty += qty;
    }
  }
  return { sizeQuantities, totalQty };
}

@Injectable()
export class PackingListsPickableService {
  constructor(
    @InjectRepository(InboundPending) private readonly pendingRepo: Repository<InboundPending>,
    @InjectRepository(FinishedGoodsStock) private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(FinishedGoodsStockColorImage) private readonly colorImageRepo: Repository<FinishedGoodsStockColorImage>,
    @InjectRepository(Order) private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt) private readonly orderExtRepo: Repository<OrderExt>,
  ) {}

  async getPendingPickable(query: PickableQuery): Promise<{ list: PickableLine[]; total: number }> {
    const qb = this.pendingRepo
      .createQueryBuilder('p')
      .addSelect('p.color_size_snapshot')
      .leftJoin(Order, 'o', 'o.id = p.order_id')
      .where('p.status = :status', { status: 'pending' })
      .andWhere("(p.source_type IS NULL OR p.source_type = 'normal')");
    if (query.customerName?.trim()) {
      qb.andWhere('o.customer_name LIKE :customerName', { customerName: `%${query.customerName.trim()}%` });
    }
    if (query.keyword?.trim()) {
      qb.andWhere('(p.sku_code LIKE :keyword OR o.order_no LIKE :keyword)', { keyword: `%${query.keyword.trim()}%` });
    }
    qb.orderBy('p.id', 'DESC');

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const total = await qb.getCount();
    const rows: Array<{
      id: string;
      orderId: string;
      skuCode: string;
      quantity: string;
      colorSizeSnapshot: unknown;
      orderNo: string | null;
      customerName: string | null;
    }> = await qb
      .select('p.id', 'id')
      .addSelect('p.order_id', 'orderId')
      .addSelect('p.sku_code', 'skuCode')
      .addSelect('p.quantity', 'quantity')
      .addSelect('p.color_size_snapshot', 'colorSizeSnapshot')
      .addSelect('o.order_no', 'orderNo')
      .addSelect('o.customer_name', 'customerName')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany();

    const orderIds = Array.from(new Set(rows.map((r) => Number(r.orderId)).filter((id) => Number.isInteger(id) && id > 0)));
    const colorImageByOrder = new Map<number, Map<string, string>>();
    if (orderIds.length) {
      const exts = await this.orderExtRepo.find({ where: { orderId: In(orderIds) } });
      for (const ext of exts) {
        const map = new Map<string, string>();
        for (const row of ext.colorSizeRows ?? []) {
          const colorName = (row.colorName ?? '').trim();
          const imageUrl = (row.imageUrl ?? '').trim();
          if (colorName && imageUrl && !map.has(colorName)) map.set(colorName, imageUrl);
        }
        colorImageByOrder.set(ext.orderId, map);
      }
    }

    const list: PickableLine[] = [];
    for (const raw of rows) {
      const sourceId = Number(raw.id);
      const orderId = Number(raw.orderId);
      const base = {
        sourceType: 'pending' as const,
        sourceId,
        orderNo: raw.orderNo ?? '',
        styleNo: raw.skuCode ?? '',
        customerName: raw.customerName ?? '',
      };
      const snapshot = parseSnapshot(raw.colorSizeSnapshot);
      if (!snapshot || !snapshot.rows.length) {
        list.push({ ...base, colorName: '', imageUrl: '', sizeQuantities: {}, totalQty: Number(raw.quantity) || 0, hasSnapshot: false });
        continue;
      }
      const imageMap = colorImageByOrder.get(orderId);
      for (const row of snapshot.rows) {
        const { sizeQuantities, totalQty } = snapshotRowToLine(snapshot.headers, row);
        if (totalQty <= 0) continue;
        list.push({
          ...base,
          colorName: row.colorName,
          imageUrl: imageMap?.get(row.colorName) ?? '',
          sizeQuantities,
          totalQty,
          hasSnapshot: true,
        });
      }
    }
    return { list, total };
  }

  async getFinishedPickable(query: PickableQuery): Promise<{ list: PickableLine[]; total: number }> {
    const qb = this.stockRepo
      .createQueryBuilder('s')
      .leftJoin(Order, 'o', 'o.id = s.order_id')
      .where('s.quantity > 0');
    if (query.customerName?.trim()) {
      qb.andWhere('s.customer_name LIKE :customerName', { customerName: `%${query.customerName.trim()}%` });
    }
    if (query.keyword?.trim()) {
      qb.andWhere('(s.sku_code LIKE :keyword OR o.order_no LIKE :keyword)', { keyword: `%${query.keyword.trim()}%` });
    }
    qb.orderBy('s.id', 'DESC');

    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const total = await qb.getCount();
    const rows: Array<{
      id: string;
      skuCode: string;
      quantity: string;
      customerName: string;
      imageUrl: string | null;
      colorSizeSnapshot: unknown;
      orderNo: string | null;
    }> = await qb
      .select('s.id', 'id')
      .addSelect('s.sku_code', 'skuCode')
      .addSelect('s.quantity', 'quantity')
      .addSelect('s.customer_name', 'customerName')
      .addSelect('s.image_url', 'imageUrl')
      .addSelect('s.color_size_snapshot', 'colorSizeSnapshot')
      .addSelect('o.order_no', 'orderNo')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany();

    const stockIds = rows.map((r) => Number(r.id)).filter((id) => Number.isInteger(id) && id > 0);
    const colorImageByStock = new Map<number, Map<string, string>>();
    if (stockIds.length) {
      const images = await this.colorImageRepo.find({ where: { finishedStockId: In(stockIds) } });
      for (const image of images) {
        const colorName = (image.colorName ?? '').trim();
        const imageUrl = (image.imageUrl ?? '').trim();
        if (!colorName || !imageUrl) continue;
        const map = colorImageByStock.get(image.finishedStockId) ?? new Map<string, string>();
        if (!map.has(colorName)) map.set(colorName, imageUrl);
        colorImageByStock.set(image.finishedStockId, map);
      }
    }

    const list: PickableLine[] = [];
    for (const raw of rows) {
      const sourceId = Number(raw.id);
      const fallbackImage = (raw.imageUrl ?? '').trim();
      const base = {
        sourceType: 'finished' as const,
        sourceId,
        orderNo: raw.orderNo ?? '',
        styleNo: raw.skuCode ?? '',
        customerName: raw.customerName ?? '',
      };
      const snapshot = parseSnapshot(raw.colorSizeSnapshot);
      if (!snapshot || !snapshot.rows.length) {
        list.push({ ...base, colorName: '', imageUrl: fallbackImage, sizeQuantities: {}, totalQty: Number(raw.quantity) || 0, hasSnapshot: false });
        continue;
      }
      const imageMap = colorImageByStock.get(sourceId);
      for (const row of snapshot.rows) {
        const { sizeQuantities, totalQty } = snapshotRowToLine(snapshot.headers, row);
        if (totalQty <= 0) continue;
        list.push({
          ...base,
          colorName: row.colorName,
          imageUrl: imageMap?.get(row.colorName) || fallbackImage,
          sizeQuantities,
          totalQty,
          hasSnapshot: true,
        });
      }
    }
    return { list, total };
  }
}
