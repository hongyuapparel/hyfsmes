import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FinishedGoodsOutbound } from '../entities/finished-goods-outbound.entity';
import { Product } from '../entities/product.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import type { ColorSizeSnapshot, FinishedGoodsOutboundListResult } from './finished-goods-stock.types';

@Injectable()
export class FinishedGoodsStockReportService {
  constructor(
    @InjectRepository(FinishedGoodsOutbound)
    private readonly outboundRepo: Repository<FinishedGoodsOutbound>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(FinishedGoodsStockColorImage)
    private readonly colorImageRepo: Repository<FinishedGoodsStockColorImage>,
  ) {}

  private formatDateTimeForResponse(value: unknown): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value as any);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private isTableMissingError(e: unknown, tableName: string): boolean {
    const msg = String((e as any)?.message || '');
    return msg.includes('Table') && msg.includes(tableName) && msg.includes("doesn't exist");
  }

  private parseStoredColorSizeSnapshot(raw: unknown): ColorSizeSnapshot | null {
    if (raw == null || raw === '') return null;
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw) as unknown;
      } catch {
        return null;
      }
    }
    if (!parsed || typeof parsed !== 'object') return null;
    const rec = parsed as Record<string, unknown>;
    const headersRaw = Array.isArray(rec.headers) ? rec.headers : [];
    const headers = headersRaw.map((h) => String(h ?? '').trim()).filter((h) => h.length > 0);
    const rowsRaw = Array.isArray(rec.rows) ? rec.rows : [];
    if (!headers.length || !rowsRaw.length) return null;
    const rows: Array<{ colorName: string; quantities: number[] }> = [];
    for (const item of rowsRaw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const colorName = String(row.colorName ?? '').trim();
      const sourceValues = Array.isArray(row.quantities)
        ? row.quantities
        : Array.isArray(row.values)
          ? row.values
          : [];
      const quantities = headers.map((_, i) => {
        const n = Number(sourceValues[i]);
        return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
      });
      rows.push({ colorName, quantities });
    }
    if (!rows.length) return null;
    return { headers, rows };
  }

  private async getColorImageMapsForStocks(stockIds: number[]): Promise<Map<number, Map<string, string>>> {
    const result = new Map<number, Map<string, string>>();
    const ids = Array.from(new Set(stockIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (!ids.length) return result;
    try {
      const rows = await this.colorImageRepo.find({ where: { finishedStockId: In(ids) } });
      rows.forEach((row) => {
        const stockId = Number(row.finishedStockId);
        const colorName = String(row.colorName ?? '').trim();
        const imageUrl = String(row.imageUrl ?? '').trim();
        if (!stockId || !colorName || !imageUrl) return;
        let map = result.get(stockId);
        if (!map) {
          map = new Map<string, string>();
          result.set(stockId, map);
        }
        if (!map.has(colorName)) map.set(colorName, imageUrl);
      });
    } catch (e) {
      if (!this.isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
    }
    return result;
  }

  private pickColorImageForSnapshot(
    snapshot: { rows: Array<{ colorName: string }> } | null,
    colorImages: Map<string, string> | undefined,
  ): string {
    if (!colorImages?.size) return '';
    const colorNames = snapshot?.rows.map((row) => String(row.colorName ?? '').trim()).filter(Boolean) ?? [];
    for (const colorName of colorNames) {
      const imageUrl = colorImages.get(colorName);
      if (imageUrl) return imageUrl;
    }
    return Array.from(colorImages.values()).find((imageUrl) => !!imageUrl) ?? '';
  }

  async getOutboundRecords(params: {
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<FinishedGoodsOutboundListResult> {
    const { orderNo, skuCode, customerName, startDate, endDate, page = 1, pageSize = 20 } = params;
    const buildQb = (withSnapshotImage: boolean) => {
      const qb = this.outboundRepo
        .createQueryBuilder('o')
        .leftJoin(Product, 'p', 'p.sku_code COLLATE utf8mb4_general_ci = o.sku_code COLLATE utf8mb4_general_ci')
        .select([
          'o.id AS id',
          'o.finished_stock_id AS finishedStockId',
          'o.order_id AS orderId',
          'o.order_no AS orderNo',
          'o.sku_code AS skuCode',
          ...(withSnapshotImage ? ['o.image_url AS imageUrlSnapshot'] : []),
          'o.customer_name AS customerName',
          'o.quantity AS quantity',
          'o.department AS department',
          'o.warehouse_id AS warehouseId',
          'o.inventory_type_id AS inventoryTypeId',
          'o.pickup_user_id AS pickupUserId',
          'o.pickup_user_name AS pickupUserName',
          'o.size_breakdown AS sizeBreakdown',
          'o.operator_username AS operatorUsername',
          'o.remark AS remark',
          'o.created_at AS createdAt',
          withSnapshotImage
            ? "COALESCE(NULLIF(o.image_url, ''), p.image_url, '') AS imageUrl"
            : "COALESCE(p.image_url, '') AS imageUrl",
        ]);
      if (orderNo?.trim()) qb.andWhere('o.order_no COLLATE utf8mb4_general_ci LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      if (skuCode?.trim()) qb.andWhere('o.sku_code COLLATE utf8mb4_general_ci LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      if (customerName?.trim()) {
        qb.andWhere('o.customer_name COLLATE utf8mb4_general_ci LIKE :customerName', { customerName: `%${customerName.trim()}%` });
      }
      if (startDate?.trim()) qb.andWhere('o.created_at >= :start', { start: `${startDate.trim()} 00:00:00` });
      if (endDate?.trim()) qb.andWhere('o.created_at <= :end', { end: `${endDate.trim()} 23:59:59` });
      qb.orderBy('o.created_at', 'DESC');
      return qb;
    };
    let total = 0;
    let list: any[] = [];
    try {
      const qb = buildQb(true);
      total = await qb.getCount();
      list = await qb.skip((page - 1) * pageSize).take(pageSize).getRawMany<any>();
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!(msg.includes('Unknown column') && msg.includes('o.image_url'))) throw e;
      const qb = buildQb(false);
      total = await qb.getCount();
      list = await qb.skip((page - 1) * pageSize).take(pageSize).getRawMany<any>();
    }

    const rows = list.map((r: any) => ({
      id: Number(r.id),
      finishedStockId: Number(r.finishedStockId),
      orderId: r.orderId != null ? Number(r.orderId) : null,
      orderNo: r.orderNo ?? '',
      skuCode: r.skuCode ?? '',
      imageUrl: String(r.imageUrlSnapshot ?? '').trim(),
      productImageUrl: String(r.imageUrl ?? '').trim(),
      customerName: r.customerName ?? '',
      quantity: Number(r.quantity) || 0,
      department: r.department ?? '',
      warehouseId: r.warehouseId != null ? Number(r.warehouseId) : null,
      inventoryTypeId: r.inventoryTypeId != null ? Number(r.inventoryTypeId) : null,
      pickupUserId: r.pickupUserId != null ? Number(r.pickupUserId) : null,
      pickupUserName: r.pickupUserName ?? '',
      sizeBreakdown: r.sizeBreakdown ?? null,
      operatorUsername: r.operatorUsername ?? '',
      remark: r.remark ?? '',
      createdAt: this.formatDateTimeForResponse(r.createdAt),
    }));

    const rowsMissingImage = rows.filter((row) => !String(row.imageUrl ?? '').trim());
    if (rowsMissingImage.length) {
      const colorImageMaps = await this.getColorImageMapsForStocks(rowsMissingImage.map((row) => row.finishedStockId));
      rowsMissingImage.forEach((row) => {
        row.imageUrl =
          this.pickColorImageForSnapshot(
            this.parseStoredColorSizeSnapshot(row.sizeBreakdown),
            colorImageMaps.get(row.finishedStockId),
          ) || row.productImageUrl || '';
      });
    }
    rows.forEach((row) => {
      if (!String(row.imageUrl ?? '').trim()) row.imageUrl = row.productImageUrl || '';
      delete (row as any).productImageUrl;
    });
    return { list: rows, total, page, pageSize };
  }
}
