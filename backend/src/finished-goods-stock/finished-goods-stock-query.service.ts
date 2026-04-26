import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { Order } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import { FinishedGoodsStockAdjustLog } from '../entities/finished-goods-stock-adjust-log.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { User, UserStatus } from '../entities/user.entity';
import { Role } from '../entities/role.entity';
import { UserRole } from '../entities/user-role.entity';
import type { ColorSizeSnapshot, FinishedGoodsStockDetailResult, FinishedStockRow } from './finished-goods-stock.types';
import { FinishedGoodsStockListQueryService } from './finished-goods-stock-list-query.service';
import {
  formatDateTimeForResponse,
  isTableMissingError,
  normalizeOrderUnitPrice,
  parseStoredColorSizeSnapshot,
  scaleColorSizeRowsToQuantity,
} from './finished-goods-stock-query.utils';

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
};

type StockListQueryResult = {
  list: FinishedStockRow[];
  total: number;
  page: number;
  pageSize: number;
  totalQuantity: number;
};

@Injectable()
export class FinishedGoodsStockQueryService {
  constructor(
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(FinishedGoodsStockColorImage)
    private readonly colorImageRepo: Repository<FinishedGoodsStockColorImage>,
    @InjectRepository(FinishedGoodsStockAdjustLog)
    private readonly adjustLogRepo: Repository<FinishedGoodsStockAdjustLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    private readonly listQueryService: FinishedGoodsStockListQueryService,
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
    const snapshot = parseStoredColorSizeSnapshot(stock.colorSizeSnapshot);
    if (snapshot) return snapshot;
    if (stock.orderId == null) return null;

    const ext = await this.orderExtRepo.findOne({ where: { orderId: stock.orderId } });
    const headers = Array.isArray(ext?.colorSizeHeaders)
      ? ext.colorSizeHeaders.map((header) => String(header ?? '').trim()).filter((header) => header.length > 0)
      : [];
    const baseRows = Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : [];
    if (!headers.length || !baseRows.length) return null;
    return {
      headers,
      rows: scaleColorSizeRowsToQuantity(
        headers,
        baseRows.map((row) => {
          const rowRecord = row as Record<string, unknown> | null;
          return {
            colorName: rowRecord?.colorName as string | undefined,
            quantities: Array.isArray(rowRecord?.quantities) ? rowRecord?.quantities : [],
          };
        }),
        stock.quantity,
      ),
    };
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
        const normalized = String(header ?? '').trim();
        if (normalized && !headers.includes(normalized)) headers.push(normalized);
      });
    }
    return headers;
  }

  private async getDetailInternal(id: number): Promise<FinishedGoodsStockDetailResult> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) throw new NotFoundException('库存记录不存在');

    const [order, product, ext] = await Promise.all([
      stock.orderId != null ? this.orderRepo.findOne({ where: { id: stock.orderId } }) : Promise.resolve(null),
      stock.skuCode?.trim()
        ? this.productRepo.findOne({ where: { skuCode: stock.skuCode.trim() } })
        : Promise.resolve(null),
      stock.orderId != null ? this.orderExtRepo.findOne({ where: { orderId: stock.orderId } }) : Promise.resolve(null),
    ]);

    let colorImages: FinishedGoodsStockColorImage[] = [];
    let logs: FinishedGoodsStockAdjustLog[] = [];
    try {
      colorImages = await this.colorImageRepo.find({ where: { finishedStockId: id }, order: { updatedAt: 'DESC' } });
    } catch (error) {
      if (!isTableMissingError(error, 'finished_goods_stock_color_images')) throw error;
    }
    try {
      logs = await this.adjustLogRepo.find({ where: { finishedStockId: id }, order: { createdAt: 'DESC' }, take: 50 });
    } catch (error) {
      if (!isTableMissingError(error, 'finished_goods_stock_adjust_logs')) throw error;
    }

    const snap = parseStoredColorSizeSnapshot(stock.colorSizeSnapshot);
    let headers: string[] = [];
    let mappedRows: Array<{ colorName: string; quantities: number[] }> = [];
    if (snap) {
      stock.colorSizeSnapshot = snap;
      headers = snap.headers.map((header) => String(header ?? '').trim()).filter((header) => header.length > 0);
      mappedRows = snap.rows.map((row) => ({
        colorName: String(row.colorName ?? ''),
        quantities: Array.isArray(row.quantities)
          ? row.quantities.map((quantity) => {
              const n = Number(quantity);
              return Number.isFinite(n) ? n : 0;
            })
          : [],
      }));
    } else {
      headers = Array.isArray(ext?.colorSizeHeaders) ? ext.colorSizeHeaders : [];
      const rows = Array.isArray(ext?.colorSizeRows) ? ext.colorSizeRows : [];
      mappedRows = rows.map((row) => {
        const rowRecord = row as Record<string, unknown> | null;
        const quantities = Array.isArray(rowRecord?.quantities) ? rowRecord.quantities : [];
        return {
          colorName: String(rowRecord?.colorName ?? ''),
          quantities: quantities.map((quantity) => {
            const n = Number(quantity);
            return Number.isFinite(n) ? n : 0;
          }),
        };
      });
    }
    const colors = mappedRows.map((row) => row.colorName).filter((value) => value);
    const groupSizeHeaders = await this.getSkuGroupSizeHeaders(stock);

    const stockUnitPrice = Number(stock.unitPrice);
    const orderUnitPrice = Number(order?.exFactoryPrice);
    const resolvedUnitPrice =
      Number.isFinite(stockUnitPrice) && stockUnitPrice > 0
        ? stockUnitPrice
        : Number.isFinite(orderUnitPrice)
          ? orderUnitPrice
          : 0;
    stock.unitPrice = normalizeOrderUnitPrice(resolvedUnitPrice);

    return {
      stock,
      orderNo: order?.orderNo ?? '',
      productImageUrl: product?.imageUrl?.trim() || stock.imageUrl?.trim() || '',
      colorImages: colorImages.map((row) => ({
        colorName: row.colorName ?? '',
        imageUrl: row.imageUrl ?? '',
        updatedAt: formatDateTimeForResponse(row.updatedAt),
      })),
      adjustLogs: logs.map((row) => ({
        id: row.id,
        operatorUsername: row.operatorUsername ?? '',
        before: row.before ?? null,
        after: row.after ?? null,
        remark: row.remark ?? '',
        createdAt: formatDateTimeForResponse(row.createdAt),
      })),
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
