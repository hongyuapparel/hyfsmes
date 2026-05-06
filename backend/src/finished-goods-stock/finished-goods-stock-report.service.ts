import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FinishedGoodsOutbound } from '../entities/finished-goods-outbound.entity';
import { Product } from '../entities/product.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import { User } from '../entities/user.entity';
import type { ColorSizeSnapshot, FinishedGoodsOutboundListResult } from './finished-goods-stock.types';

type OutboundRawRow = {
  id: string | number;
  finishedStockId: string | number;
  orderId: string | number | null;
  orderNo: string | null;
  skuCode: string | null;
  imageUrlSnapshot?: string | null;
  customerName: string | null;
  quantity: string | number;
  department: string | null;
  warehouseId: string | number | null;
  inventoryTypeId: string | number | null;
  pickupUserId: string | number | null;
  pickupUserName: string | null;
  sizeBreakdown: unknown;
  operatorUsername: string | null;
  remark: string | null;
  createdAt: string | Date | null;
  imageUrl: string | null;
};

type OutboundResponseRow = FinishedGoodsOutboundListResult['list'][number] & {
  productImageUrl?: string;
};

@Injectable()
export class FinishedGoodsStockReportService {
  constructor(
    @InjectRepository(FinishedGoodsOutbound)
    private readonly outboundRepo: Repository<FinishedGoodsOutbound>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(FinishedGoodsStockColorImage)
    private readonly colorImageRepo: Repository<FinishedGoodsStockColorImage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  private formatDateTimeForResponse(value: unknown): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value as string | number);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  private isTableMissingError(e: unknown, tableName: string): boolean {
    const msg = String((e as { message?: unknown } | null)?.message || '');
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

  private getSnapshotTotal(snapshot: ColorSizeSnapshot | null): number {
    if (!snapshot) return 0;
    return snapshot.rows.reduce(
      (sum, row) =>
        sum +
        row.quantities.reduce((rowSum, quantity) => rowSum + Math.max(0, Math.trunc(Number(quantity) || 0)), 0),
      0,
    );
  }

  private async getOperatorDisplayNameMap(operatorUsernames: string[]): Promise<Map<string, string>> {
    const names = Array.from(new Set(operatorUsernames.map((item) => String(item ?? '').trim()).filter(Boolean)));
    if (!names.length) return new Map();
    const users = await this.userRepo.find({
      where: { username: In(names) },
      select: ['username', 'displayName'],
    });
    return new Map(
      users.map((user) => [
        user.username,
        (user.displayName?.trim() || user.username || '').trim(),
      ]),
    );
  }

  private withResolvedImage(
    row: OutboundResponseRow,
    colorImages: Map<string, string> | undefined,
  ): OutboundResponseRow {
    const imageUrl =
      this.pickColorImageForSnapshot(row.sizeBreakdown, colorImages) ||
      String(row.imageUrl ?? '').trim() ||
      row.productImageUrl ||
      '';
    return { ...row, imageUrl };
  }

  private splitOutboundRowByColor(
    row: OutboundResponseRow,
    colorImages: Map<string, string> | undefined,
  ): OutboundResponseRow[] {
    const snapshot = row.sizeBreakdown;
    if (!snapshot?.headers.length || !snapshot.rows.length) return [this.withResolvedImage(row, colorImages)];
    const activeRows = snapshot.rows.filter((item) =>
      item.quantities.some((quantity) => Math.max(0, Math.trunc(Number(quantity) || 0)) > 0),
    );
    if (activeRows.length <= 1) return [this.withResolvedImage(row, colorImages)];
    return activeRows.map((item) => {
      const singleSnapshot: ColorSizeSnapshot = {
        headers: [...snapshot.headers],
        rows: [{ colorName: item.colorName, quantities: [...item.quantities] }],
      };
      return this.withResolvedImage(
        {
          ...row,
          quantity: this.getSnapshotTotal(singleSnapshot),
          sizeBreakdown: singleSnapshot,
        },
        colorImages,
      );
    });
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
    let list: OutboundRawRow[] = [];
    try {
      const qb = buildQb(true);
      list = await qb.getRawMany<OutboundRawRow>();
    } catch (e: unknown) {
      const msg = String((e as { message?: unknown } | null)?.message || '');
      if (!(msg.includes('Unknown column') && msg.includes('o.image_url'))) throw e;
      const qb = buildQb(false);
      list = await qb.getRawMany<OutboundRawRow>();
    }

    const operatorDisplayNameMap = await this.getOperatorDisplayNameMap(
      list.map((row) => String(row.operatorUsername ?? '')),
    );
    const rows: OutboundResponseRow[] = list.map((r) => {
      const operatorUsername = String(r.operatorUsername ?? '').trim();
      return {
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
      sizeBreakdown: this.parseStoredColorSizeSnapshot(r.sizeBreakdown),
      operatorUsername: operatorDisplayNameMap.get(operatorUsername) ?? operatorUsername,
      remark: r.remark ?? '',
      createdAt: this.formatDateTimeForResponse(r.createdAt),
      };
    });

    const rowsNeedingColorImages = rows.filter(
      (row) => row.sizeBreakdown?.rows?.length || !String(row.imageUrl ?? '').trim(),
    );
    const colorImageMaps = rowsNeedingColorImages.length
      ? await this.getColorImageMapsForStocks(rowsNeedingColorImages.map((row) => row.finishedStockId))
      : new Map<number, Map<string, string>>();
    const expandedRows = rows.flatMap((row) => this.splitOutboundRowByColor(row, colorImageMaps.get(row.finishedStockId)));
    expandedRows.forEach((row) => {
      if (!String(row.imageUrl ?? '').trim()) row.imageUrl = row.productImageUrl || '';
      delete row.productImageUrl;
    });
    const safePage = Math.max(1, Math.trunc(Number(page) || 1));
    const safePageSize = Math.max(1, Math.trunc(Number(pageSize) || 20));
    const start = (safePage - 1) * safePageSize;
    return {
      list: expandedRows.slice(start, start + safePageSize),
      total: expandedRows.length,
      page: safePage,
      pageSize: safePageSize,
    };
  }
}
