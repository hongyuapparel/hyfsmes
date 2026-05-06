import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { Order } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import { FinishedGoodsStockAdjustLog } from '../entities/finished-goods-stock-adjust-log.entity';
import { FinishedGoodsOutbound } from '../entities/finished-goods-outbound.entity';
import { User, UserStatus } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import type { ColorSizeSnapshot, FinishedGoodsStockDetailResult, FinishedStockRow } from './finished-goods-stock.types';
import { FinishedGoodsStockListQueryService } from './finished-goods-stock-list-query.service';
import { FinishedGoodsStockInboundQueryService } from './finished-goods-stock-inbound-query.service';
import {
  formatDateTimeForResponse,
  isTableMissingError,
  normalizeOrderUnitPrice,
  parseStoredColorSizeSnapshot,
} from './finished-goods-stock-query.utils';
import {
  buildFinishedStockAdjustLogSummary,
  getFinishedStockAdjustLogSourceOrderNo,
} from './finished-goods-stock-log-summary';
import { getSizeHeaderKey, normalizeSizeHeader, remapQuantitiesBySizeHeaders, sortSizeHeaders } from './size-header-order.util';

type StockListQueryParams = {
  tab?: string;
  orderNo?: string;
  skuCode?: string;
  customerName?: string;
  inventoryTypeId?: number | null;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
  paginateByVisibleGroup?: boolean;
};

type StockListQueryResult = {
  list: FinishedStockRow[];
  total: number;
  page: number;
  pageSize: number;
  totalQuantity: number;
  totalAmount: number;
};

@Injectable()
export class FinishedGoodsStockQueryService {
  constructor(
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(FinishedGoodsStockColorImage)
    private readonly colorImageRepo: Repository<FinishedGoodsStockColorImage>,
    @InjectRepository(FinishedGoodsStockAdjustLog)
    private readonly adjustLogRepo: Repository<FinishedGoodsStockAdjustLog>,
    @InjectRepository(FinishedGoodsOutbound)
    private readonly outboundRepo: Repository<FinishedGoodsOutbound>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    private readonly listQueryService: FinishedGoodsStockListQueryService,
    private readonly inboundQueryService: FinishedGoodsStockInboundQueryService,
  ) {}

  getList(params: StockListQueryParams): Promise<StockListQueryResult> {
    return this.listQueryService.getList(params);
  }

  getDetail(id: number) {
    return this.getDetailInternal(id);
  }

  getPickupUserOptions() {
    return this.getPickupUserOptionsInternal();
  }

  private async buildCurrentStockSnapshot(stock: FinishedGoodsStock): Promise<ColorSizeSnapshot | null> {
    return this.inboundQueryService.buildCurrentStockSnapshot(stock);
  }

  private async getSkuGroupSizeHeaders(stock: FinishedGoodsStock): Promise<string[]> {
    const sku = String(stock.skuCode ?? '').trim();
    if (!sku) return [];

    const customerName = String(stock.customerName ?? '').trim();
    const groupStocks = await this.stockRepo
      .createQueryBuilder('s')
      .where('s.skuCode = :sku', { sku })
      .andWhere('s.customerName = :customerName', { customerName })
      .orderBy('s.id', 'DESC')
      .getMany();
    const headers: string[] = [];
    for (const item of groupStocks) {
      const snapshot = await this.buildCurrentStockSnapshot(item);
      snapshot?.headers.forEach((header) => {
        const normalized = normalizeSizeHeader(header);
        if (normalized && !headers.some((item) => getSizeHeaderKey(item) === getSizeHeaderKey(normalized))) headers.push(normalized);
      });
    }
    return sortSizeHeaders(headers);
  }

  private async getSkuCustomerStockIds(stock: FinishedGoodsStock): Promise<number[]> {
    const sku = String(stock.skuCode ?? '').trim();
    if (!sku) return [stock.id];
    const customerName = String(stock.customerName ?? '').trim();
    const groupStocks = await this.stockRepo
      .createQueryBuilder('s')
      .select(['s.id'])
      .where('s.skuCode = :sku', { sku })
      .andWhere('s.customerName = :customerName', { customerName })
      .getMany();
    const ids = groupStocks.map((item) => item.id).filter((item) => Number.isInteger(item) && item > 0);
    return Array.from(new Set([stock.id, ...ids]));
  }

  private getLogSnapshotText(snapshot: Record<string, unknown> | null | undefined, key: string): string {
    return snapshot && typeof snapshot === 'object' ? String(snapshot[key] ?? '').trim() : '';
  }

  private isDetailLogForStockGroup(log: FinishedGoodsStockAdjustLog, stock: FinishedGoodsStock, stockIds: number[]): boolean {
    if (stockIds.includes(log.finishedStockId)) return true;
    const sku = String(stock.skuCode ?? '').trim();
    if (!sku) return false;
    const beforeSku = this.getLogSnapshotText(log.before, 'skuCode');
    const afterSku = this.getLogSnapshotText(log.after, 'skuCode');
    if (beforeSku !== sku && afterSku !== sku) return false;
    const customerName = String(stock.customerName ?? '').trim();
    if (!customerName) return true;
    const beforeCustomer = this.getLogSnapshotText(log.before, 'customerName');
    const afterCustomer = this.getLogSnapshotText(log.after, 'customerName');
    return (!beforeCustomer && !afterCustomer) || beforeCustomer === customerName || afterCustomer === customerName;
  }

  private async getDetailAdjustLogs(stock: FinishedGoodsStock): Promise<FinishedGoodsStockAdjustLog[]> {
    const stockIds = await this.getSkuCustomerStockIds(stock);
    const [directLogs, recentLogs] = await Promise.all([
      this.adjustLogRepo.find({ where: { finishedStockId: In(stockIds) }, order: { createdAt: 'DESC' }, take: 100 }),
      this.adjustLogRepo.find({ order: { createdAt: 'DESC' }, take: 500 }),
    ]);
    const map = new Map<number, FinishedGoodsStockAdjustLog>();
    directLogs.forEach((log) => map.set(log.id, log));
    recentLogs
      .filter((log) => this.isDetailLogForStockGroup(log, stock, stockIds))
      .forEach((log) => map.set(log.id, log));
    return Array.from(map.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 100);
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

  private asLogRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }

  private getLogSnapshotNumber(snapshot: unknown, key: string): number | null {
    const value = Number(this.asLogRecord(snapshot)[key]);
    return Number.isFinite(value) ? value : null;
  }

  private isOutboundLog(log: FinishedGoodsStockAdjustLog): boolean {
    const action = this.getLogSnapshotText(log.after, 'logAction') || this.getLogSnapshotText(log.before, 'logAction');
    return action === 'outbound' || String(log.remark ?? '').includes('出库');
  }

  private getOutboundLogQuantity(log: FinishedGoodsStockAdjustLog): number | null {
    const beforeQuantity = this.getLogSnapshotNumber(log.before, 'quantity');
    const afterQuantity = this.getLogSnapshotNumber(log.after, 'quantity');
    if (beforeQuantity == null || afterQuantity == null || beforeQuantity <= afterQuantity) return null;
    return Math.max(0, Math.trunc(beforeQuantity - afterQuantity));
  }

  private formatQuantity(value: number): string {
    return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  }

  private buildOutboundBreakdownSummary(snapshot: ColorSizeSnapshot | null, quantity: number, remark: string): string {
    const prefix = remark.trim() || '成品出库';
    if (!snapshot?.headers.length || !snapshot.rows.length) return `${prefix} -${this.formatQuantity(quantity)}件`;
    const rowSummaries = snapshot.rows
      .map((row) => {
        const deltas = snapshot.headers
          .map((header, index) => ({
            header,
            quantity: Math.max(0, Math.trunc(Number(row.quantities[index]) || 0)),
          }))
          .filter((item) => item.quantity > 0)
          .map((item) => `${item.header} -${this.formatQuantity(item.quantity)}件`);
        if (!deltas.length) return '';
        const colorName = String(row.colorName ?? '').trim();
        return colorName ? `${colorName}：${deltas.join('、')}` : deltas.join('、');
      })
      .filter(Boolean);
    return rowSummaries.length ? `${prefix} ${rowSummaries.join('；')}` : `${prefix} -${this.formatQuantity(quantity)}件`;
  }

  private async getOutboundDetailSummaryMap(logs: FinishedGoodsStockAdjustLog[]): Promise<Map<number, string>> {
    const outboundLogs = logs.filter((log) => this.isOutboundLog(log));
    const stockIds = Array.from(new Set(outboundLogs.map((log) => log.finishedStockId).filter((id) => Number.isInteger(id) && id > 0)));
    if (!stockIds.length) return new Map();
    const outbounds = await this.outboundRepo.find({
      where: { finishedStockId: In(stockIds) },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
    const result = new Map<number, string>();
    outboundLogs.forEach((log) => {
      const logTime = log.createdAt.getTime();
      const expectedQuantity = this.getOutboundLogQuantity(log);
      const matched = outbounds
        .filter((row) => {
          if (row.finishedStockId !== log.finishedStockId) return false;
          if (Math.abs(row.createdAt.getTime() - logTime) > 3000) return false;
          return expectedQuantity == null || Math.max(0, Math.trunc(Number(row.quantity) || 0)) === expectedQuantity;
        })
        .sort((a, b) => Math.abs(a.createdAt.getTime() - logTime) - Math.abs(b.createdAt.getTime() - logTime))[0];
      if (!matched) return;
      const quantity = expectedQuantity ?? Math.max(0, Math.trunc(Number(matched.quantity) || 0));
      const snapshot = parseStoredColorSizeSnapshot(matched.sizeBreakdown);
      if (!snapshot) return;
      result.set(log.id, this.buildOutboundBreakdownSummary(snapshot, quantity, String(log.remark ?? '')));
    });
    return result;
  }

  private async getDetailInternal(id: number): Promise<FinishedGoodsStockDetailResult> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) throw new NotFoundException('库存记录不存在');

    const [order, product] = await Promise.all([
      stock.orderId != null ? this.orderRepo.findOne({ where: { id: stock.orderId } }) : Promise.resolve(null),
      stock.skuCode?.trim()
        ? this.productRepo.findOne({ where: { skuCode: stock.skuCode.trim() } })
        : Promise.resolve(null),
    ]);

    let colorImages: FinishedGoodsStockColorImage[] = [];
    let logs: FinishedGoodsStockAdjustLog[] = [];
    try {
      colorImages = await this.colorImageRepo.find({ where: { finishedStockId: id }, order: { updatedAt: 'DESC' } });
    } catch (error) {
      if (!isTableMissingError(error, 'finished_goods_stock_color_images')) throw error;
    }
    try {
      logs = await this.getDetailAdjustLogs(stock);
    } catch (error) {
      if (!isTableMissingError(error, 'finished_goods_stock_adjust_logs')) throw error;
    }

    const snap = await this.buildCurrentStockSnapshot(stock);
    let headers: string[] = [];
    let mappedRows: Array<{ colorName: string; quantities: number[] }> = [];
    if (snap) {
      stock.colorSizeSnapshot = snap;
      headers = sortSizeHeaders(snap.headers.map(normalizeSizeHeader).filter((header) => header.length > 0));
      mappedRows = snap.rows.map((row) => ({
        colorName: String(row.colorName ?? ''),
        quantities: remapQuantitiesBySizeHeaders(snap.headers, Array.isArray(row.quantities) ? row.quantities : [], headers),
      }));
    }
    const colors = mappedRows.map((row) => row.colorName).filter((value) => value);
    const groupSizeHeaders = await this.getSkuGroupSizeHeaders(stock);
    const latestRemark = logs.find((row) => String(row.remark ?? '').trim())?.remark?.trim() ?? '';

    const stockUnitPrice = Number(stock.unitPrice);
    const orderUnitPrice = Number(order?.exFactoryPrice);
    const resolvedUnitPrice =
      Number.isFinite(stockUnitPrice) && stockUnitPrice > 0
        ? stockUnitPrice
        : Number.isFinite(orderUnitPrice)
          ? orderUnitPrice
          : 0;
    stock.unitPrice = normalizeOrderUnitPrice(resolvedUnitPrice);
    const operatorDisplayNameMap = await this.getOperatorDisplayNameMap(logs.map((row) => row.operatorUsername));
    const outboundDetailSummaryMap = await this.getOutboundDetailSummaryMap(logs);

    return {
      stock: { ...stock, remark: latestRemark },
      orderNo: order?.orderNo ?? '',
      productImageUrl: product?.imageUrl?.trim() || stock.imageUrl?.trim() || '',
      colorImages: colorImages.map((row) => ({
        colorName: row.colorName ?? '',
        imageUrl: row.imageUrl ?? '',
        updatedAt: formatDateTimeForResponse(row.updatedAt),
      })),
      adjustLogs: logs.map((row) => {
        const sourceOrderNo = getFinishedStockAdjustLogSourceOrderNo({
          before: row.before,
          after: row.after,
          remark: row.remark,
        });
        const summary = outboundDetailSummaryMap.get(row.id) ?? buildFinishedStockAdjustLogSummary({
          before: row.before,
          after: row.after,
          remark: row.remark,
          sourceOrderNo,
        });
        return {
          id: row.id,
          operatorUsername: operatorDisplayNameMap.get(String(row.operatorUsername ?? '').trim()) ?? row.operatorUsername ?? '',
          before: row.before ?? null,
          after: row.after ?? null,
          remark: row.remark ?? '',
          sourceOrderNo,
          summary,
          summaries: summary ? [summary] : [],
          createdAt: formatDateTimeForResponse(row.createdAt),
        };
      }),
      colorSize: { headers, colors, rows: mappedRows },
      groupSizeHeaders,
    };
  }

  private async getPickupUserOptionsInternal(): Promise<Array<{ id: number; username: string; displayName: string }>> {
    const role = await this.roleRepo.findOne({ where: { code: 'salesperson' } });
    if (!role) return [];
    const links = await this.userRoleRepo.find({ where: { roleId: role.id }, select: ['userId'] });
    const userIds = Array.from(new Set(links.map((item) => item.userId)));
    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('(u.role_id = :rid OR u.id IN (:...ids))', { rid: role.id, ids: userIds.length ? userIds : [0] })
      .orderBy('u.display_name', 'ASC')
      .getMany();
    return users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName ?? '',
    }));
  }
}
