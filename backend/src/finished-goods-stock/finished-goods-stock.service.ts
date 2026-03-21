import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { InboundPending } from '../entities/inbound-pending.entity';
import { Order } from '../entities/order.entity';
import { FinishedGoodsOutbound } from '../entities/finished-goods-outbound.entity';
import { Product } from '../entities/product.entity';
import { FinishedGoodsStockColorImage } from '../entities/finished-goods-stock-color-image.entity';
import { FinishedGoodsStockAdjustLog } from '../entities/finished-goods-stock-adjust-log.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { User, UserStatus } from '../entities/user.entity';
import { Role } from '../entities/role.entity';

export interface FinishedStockRow {
  id: number;
  orderId: number | null;
  orderNo: string;
  customerName: string;
  skuCode: string;
  quantity: number;
  unitPrice: string;
  warehouseId: number | null;
  inventoryTypeId: number | null;
  department: string;
  location: string;
  imageUrl: string;
  createdAt: string;
  type: 'pending' | 'stored';
}

@Injectable()
export class FinishedGoodsStockService {
  constructor(
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(FinishedGoodsOutbound)
    private readonly outboundRepo: Repository<FinishedGoodsOutbound>,
    @InjectRepository(FinishedGoodsStockColorImage)
    private readonly colorImageRepo: Repository<FinishedGoodsStockColorImage>,
    @InjectRepository(FinishedGoodsStockAdjustLog)
    private readonly adjustLogRepo: Repository<FinishedGoodsStockAdjustLog>,
    @InjectRepository(InboundPending)
    private readonly pendingRepo: Repository<InboundPending>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
  ) {}

  private isTableMissingError(e: unknown, tableName: string): boolean {
    const msg = String((e as any)?.message || '');
    return msg.includes('Table') && msg.includes(tableName) && msg.includes("doesn't exist");
  }

  private normalizeOrderUnitPrice(v: unknown): string {
    const n = Number(v);
    if (!Number.isFinite(n)) return '0';
    return n.toFixed(2);
  }

  /** 手动新增成品库存（仓库直接入库）；订单号可选，不填则不关联订单 */
  async createManual(dto: {
    orderNo?: string;
    skuCode: string;
    quantity: number;
    unitPrice?: string | number;
    warehouseId?: number | null;
    inventoryTypeId?: number | null;
    department: string;
    location: string;
    imageUrl?: string;
  }): Promise<FinishedGoodsStock> {
    const orderNo = dto.orderNo?.trim();
    const q = Number(dto.quantity);
    if (!Number.isInteger(q) || q <= 0) {
      throw new NotFoundException('数量必须为正整数');
    }
    let orderId: number | null = null;
    let customerId: number | null = null;
    let customerName = '';
    let orderExFactoryPrice: string | number | null = null;
    if (orderNo) {
      const order = await this.orderRepo.findOne({ where: { orderNo } });
      if (!order) {
        throw new NotFoundException('订单不存在');
      }
      orderId = order.id;
      customerId = order.customerId ?? null;
      customerName = order.customerName?.trim() ?? '';
      orderExFactoryPrice = order.exFactoryPrice ?? '0';
    }
    const unitPriceStr =
      dto.unitPrice != null && dto.unitPrice !== ''
        ? this.normalizeOrderUnitPrice(dto.unitPrice)
        : this.normalizeOrderUnitPrice(orderExFactoryPrice);
    const stock = this.stockRepo.create({
      orderId,
      skuCode: dto.skuCode?.trim() ?? '',
      quantity: q,
      unitPrice: unitPriceStr,
      warehouseId: dto.warehouseId != null ? Number(dto.warehouseId) : null,
      inventoryTypeId: dto.inventoryTypeId != null ? Number(dto.inventoryTypeId) : null,
      department: dto.department?.trim() ?? '',
      location: dto.location?.trim() ?? '',
      customerId,
      customerName,
      imageUrl: dto.imageUrl?.trim() ?? '',
    });
    return this.stockRepo.save(stock);
  }

  async getList(params: {
    tab?: string;
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    inventoryTypeId?: number | null;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: FinishedStockRow[]; total: number; page: number; pageSize: number }> {
    const { tab = 'all', orderNo, skuCode, customerName, inventoryTypeId, page = 1, pageSize = 20 } = params;

    const list: FinishedStockRow[] = [];
    let total = 0;

    if (tab === 'pending' || tab === 'all') {
      const countQb = this.pendingRepo
        .createQueryBuilder('p')
        .innerJoin(Order, 'o', 'o.id = p.order_id')
        .where('p.status = :status', { status: 'pending' });
      if (orderNo?.trim()) {
        countQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      }
      if (skuCode?.trim()) {
        countQb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      }
      if (customerName?.trim()) {
        countQb.andWhere('o.customer_name LIKE :customerName', {
          customerName: `%${customerName.trim()}%`,
        });
      }
      const pendingTotal = await countQb.getCount();

      const pendingQb = this.pendingRepo
        .createQueryBuilder('p')
        .innerJoin(Order, 'o', 'o.id = p.order_id')
        .where('p.status = :status', { status: 'pending' })
        .select([
          'p.id AS id',
          'p.order_id AS orderId',
          'o.order_no AS orderNo',
          'o.customer_name AS customerName',
          'p.sku_code AS skuCode',
          'p.quantity AS quantity',
          'p.created_at AS createdAt',
        ]);
      if (orderNo?.trim()) {
        pendingQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      }
      if (skuCode?.trim()) {
        pendingQb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      }
      if (customerName?.trim()) {
        pendingQb.andWhere('o.customer_name LIKE :customerName', {
          customerName: `%${customerName.trim()}%`,
        });
      }
      pendingQb.orderBy('p.created_at', 'DESC');
      const pendingRows = await pendingQb.getRawMany<{
        id: number;
        orderId: number;
        orderNo: string;
        customerName: string;
        skuCode: string;
        quantity: number;
        createdAt: Date;
      }>();
      const pendingList: FinishedStockRow[] = pendingRows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        orderNo: r.orderNo ?? '',
        customerName: r.customerName ?? '',
        skuCode: r.skuCode ?? '',
        quantity: r.quantity ?? 0,
        unitPrice: '0',
        warehouseId: null,
        inventoryTypeId: null,
        department: '',
        location: '',
        imageUrl: '',
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
        type: 'pending',
      }));
      if (tab === 'pending') {
        total = pendingTotal;
        const start = (page - 1) * pageSize;
        return {
          list: pendingList.slice(start, start + pageSize),
          total,
          page,
          pageSize,
        };
      }
      list.push(...pendingList);
      total += pendingTotal;
    }

    if (tab === 'stored' || tab === 'all') {
      const stockQb = this.stockRepo
        .createQueryBuilder('s')
        .leftJoin(Order, 'o', 'o.id = s.order_id')
        .leftJoin(Product, 'pr', 'pr.sku_code = s.sku_code')
        .select([
          's.id AS id',
          's.order_id AS orderId',
          'COALESCE(o.order_no, \'\') AS orderNo',
          's.customer_name AS customerName',
          's.sku_code AS skuCode',
          's.quantity AS quantity',
          `CASE
            WHEN s.unit_price IS NOT NULL AND s.unit_price > 0 THEN s.unit_price
            WHEN o.ex_factory_price IS NOT NULL AND o.ex_factory_price > 0 THEN o.ex_factory_price
            ELSE 0
          END AS unitPrice`,
          's.warehouse_id AS warehouseId',
          's.inventory_type_id AS inventoryTypeId',
          's.department AS department',
          's.location AS location',
          'COALESCE(NULLIF(s.image_url, \'\'), pr.image_url, \'\') AS imageUrl',
          's.created_at AS createdAt',
        ]);
      if (orderNo?.trim()) {
        stockQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      }
      if (skuCode?.trim()) {
        stockQb.andWhere('s.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      }
      if (customerName?.trim()) {
        stockQb.andWhere('s.customer_name LIKE :customerName', {
          customerName: `%${customerName.trim()}%`,
        });
      }
      if (inventoryTypeId != null) {
        stockQb.andWhere('s.inventory_type_id = :inventoryTypeId', { inventoryTypeId });
      }
      stockQb.orderBy('s.created_at', 'DESC');
      const storedCount = await stockQb.getCount();
      const storedRows = await stockQb
        .offset(tab === 'stored' ? (page - 1) * pageSize : 0)
        .limit(tab === 'stored' ? pageSize : 10000)
        .getRawMany<{
          id: number;
          orderId: number | null;
          orderNo: string;
          customerName: string;
          skuCode: string;
          quantity: number;
          unitPrice: string;
          warehouseId: number | null;
          inventoryTypeId: number | null;
          department: string;
          location: string;
          imageUrl: string;
          createdAt: Date;
        }>();
      const storedList: FinishedStockRow[] = storedRows.map((r) => ({
        id: r.id,
        orderId: r.orderId ?? null,
        orderNo: r.orderNo ?? '',
        customerName: r.customerName ?? '',
        skuCode: r.skuCode ?? '',
        quantity: r.quantity ?? 0,
        unitPrice: r.unitPrice ?? '0',
        warehouseId: r.warehouseId ?? null,
        inventoryTypeId: r.inventoryTypeId ?? null,
        department: r.department ?? '',
        location: r.location ?? '',
        imageUrl: r.imageUrl ?? '',
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
        type: 'stored',
      }));
      if (tab === 'stored') {
        return {
          list: storedList,
          total: storedCount,
          page,
          pageSize,
        };
      }
      list.push(...storedList);
      total += storedCount;
    }

    if (tab === 'all') {
      list.sort((a, b) => {
        const da = a.createdAt || '';
        const db = b.createdAt || '';
        return db.localeCompare(da);
      });
      const start = (page - 1) * pageSize;
      return {
        list: list.slice(start, start + pageSize),
        total,
        page,
        pageSize,
      };
    }

    return { list: [], total: 0, page, pageSize };
  }

  /** 出库：减少已入库成品数量 */
  async outbound(
    id: number,
    quantity: number,
    operatorUsername: string,
    remark: string,
    pickupUserId?: number | null,
    sizeBreakdown?: any,
  ): Promise<void> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) {
      throw new NotFoundException('库存记录不存在');
    }
    const q = Number(quantity);
    if (!Number.isInteger(q) || q <= 0) {
      throw new NotFoundException('出库数量必须为正整数');
    }
    if (q > stock.quantity) {
      throw new NotFoundException('出库数量不能大于当前库存');
    }
    const [order, product] = await Promise.all([
      stock.orderId != null ? this.orderRepo.findOne({ where: { id: stock.orderId } }) : Promise.resolve(null),
      stock.skuCode?.trim() ? this.productRepo.findOne({ where: { skuCode: stock.skuCode.trim() } }) : Promise.resolve(null),
    ]);

    let pickupUserName = '';
    let pickupId: number | null = null;
    if (pickupUserId != null) {
      const salespersonRole = await this.roleRepo.findOne({ where: { code: 'salesperson' } });
      if (!salespersonRole) throw new NotFoundException('未配置业务员角色');
      const pickupUser = await this.userRepo.findOne({
        where: { id: Number(pickupUserId), roleId: salespersonRole.id, status: UserStatus.ACTIVE },
      });
      if (!pickupUser) throw new NotFoundException('领走人不存在或不是在职业务员');
      pickupId = pickupUser.id;
      pickupUserName = (pickupUser.displayName?.trim() || pickupUser.username || '').trim();
    }

    try {
      await this.stockRepo.manager.transaction(async (manager) => {
        const txStockRepo = manager.getRepository(FinishedGoodsStock);
        const txOutboundRepo = manager.getRepository(FinishedGoodsOutbound);
        const txStock = await txStockRepo.findOne({ where: { id } });
        if (!txStock) throw new NotFoundException('库存记录不存在');
        if (q > txStock.quantity) throw new NotFoundException('出库数量不能大于当前库存');

        txStock.quantity -= q;
        if (txStock.quantity === 0) {
          await txStockRepo.remove(txStock);
        } else {
          await txStockRepo.save(txStock);
        }

        const out = txOutboundRepo.create({
          finishedStockId: id,
          orderId: stock.orderId,
          orderNo: order?.orderNo ?? '',
          skuCode: stock.skuCode ?? '',
          imageUrl: stock.imageUrl?.trim() || product?.imageUrl?.trim() || '',
          customerName: stock.customerName ?? '',
          quantity: q,
          department: stock.department?.trim() ?? '',
          warehouseId: stock.warehouseId ?? null,
          inventoryTypeId: stock.inventoryTypeId ?? null,
          pickupUserId: pickupId,
          pickupUserName,
          sizeBreakdown: sizeBreakdown ?? null,
          operatorUsername: (operatorUsername ?? '').trim(),
          remark: (remark ?? '').trim(),
        });
        await txOutboundRepo.save(out);
      });
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      if (msg.includes("Table") && msg.includes("finished_goods_outbound") && msg.includes("doesn't exist")) {
        throw new InternalServerErrorException(
          "出库记录表不存在，请先执行 backend/scripts/create-finished-goods-outbound.sql",
        );
      }
      throw e;
    }
  }

  async getOutboundRecords(params: {
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    list: Array<
      Omit<FinishedGoodsOutbound, 'createdAt'> & {
        createdAt: string;
        imageUrl?: string;
      }
    >;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { orderNo, skuCode, customerName, startDate, endDate, page = 1, pageSize = 20 } = params;
    const buildQb = (withSnapshotImage: boolean) => {
      const qb = this.outboundRepo
        .createQueryBuilder('o')
        // 兼容历史表排序规则不一致，避免 Illegal mix of collations
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
      list = await qb
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getRawMany<any>();
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (!(msg.includes("Unknown column") && msg.includes('o.image_url'))) throw e;
      const qb = buildQb(false);
      total = await qb.getCount();
      list = await qb
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getRawMany<any>();
    }
    const rows = list.map((r: any) => ({
      id: Number(r.id),
      finishedStockId: Number(r.finishedStockId),
      orderId: r.orderId != null ? Number(r.orderId) : null,
      orderNo: r.orderNo ?? '',
      skuCode: r.skuCode ?? '',
      imageUrl: r.imageUrl || r.imageUrlSnapshot || '',
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
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
    }));
    return { list: rows, total, page, pageSize };
  }

  async getDetail(id: number): Promise<{
    stock: FinishedGoodsStock;
    orderNo: string;
    productImageUrl: string;
    colorImages: Array<{ colorName: string; imageUrl: string; updatedAt: string }>;
    adjustLogs: Array<{ id: number; operatorUsername: string; before: any; after: any; remark: string; createdAt: string }>;
    colorSize: { headers: string[]; colors: string[]; rows: Array<{ colorName: string; quantities: number[] }> };
  }> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) throw new NotFoundException('库存记录不存在');

    const [order, product, ext] = await Promise.all([
      stock.orderId != null ? this.orderRepo.findOne({ where: { id: stock.orderId } }) : Promise.resolve(null),
      stock.skuCode?.trim() ? this.productRepo.findOne({ where: { skuCode: stock.skuCode.trim() } }) : Promise.resolve(null),
      stock.orderId != null ? this.orderExtRepo.findOne({ where: { orderId: stock.orderId } }) : Promise.resolve(null),
    ]);
    let colorImages: FinishedGoodsStockColorImage[] = [];
    let logs: FinishedGoodsStockAdjustLog[] = [];
    try {
      colorImages = await this.colorImageRepo.find({ where: { finishedStockId: id }, order: { updatedAt: 'DESC' } });
    } catch (e) {
      if (!this.isTableMissingError(e, 'finished_goods_stock_color_images')) throw e;
    }
    try {
      logs = await this.adjustLogRepo.find({ where: { finishedStockId: id }, order: { createdAt: 'DESC' }, take: 50 });
    } catch (e) {
      if (!this.isTableMissingError(e, 'finished_goods_stock_adjust_logs')) throw e;
    }

    const headers = Array.isArray(ext?.colorSizeHeaders) ? ext!.colorSizeHeaders! : [];
    const rows = Array.isArray(ext?.colorSizeRows) ? ext!.colorSizeRows! : [];
    const colors = rows.map((r: any) => String(r?.colorName ?? '')).filter((v) => v);
    const mappedRows = rows.map((r: any) => ({
      colorName: String(r?.colorName ?? ''),
      quantities: Array.isArray(r?.quantities)
        ? r.quantities.map((q: unknown) => {
            const n = Number(q);
            return Number.isFinite(n) ? n : 0;
          })
        : [],
    }));

    const stockUnitPrice = Number(stock.unitPrice);
    const orderUnitPrice = Number(order?.exFactoryPrice);
    const resolvedUnitPrice =
      Number.isFinite(stockUnitPrice) && stockUnitPrice > 0
        ? stockUnitPrice
        : Number.isFinite(orderUnitPrice)
          ? orderUnitPrice
          : 0;
    stock.unitPrice = this.normalizeOrderUnitPrice(resolvedUnitPrice);

    return {
      stock,
      orderNo: order?.orderNo ?? '',
      productImageUrl: product?.imageUrl ?? '',
      colorImages: colorImages.map((r) => ({
        colorName: r.colorName ?? '',
        imageUrl: r.imageUrl ?? '',
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 19).replace('T', ' ') : '',
      })),
      adjustLogs: logs.map((l) => ({
        id: l.id,
        operatorUsername: l.operatorUsername ?? '',
        before: l.before ?? null,
        after: l.after ?? null,
        remark: l.remark ?? '',
        createdAt: l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
      })),
      colorSize: { headers, colors, rows: mappedRows },
    };
  }

  async updateMeta(
    id: number,
    dto: {
      department?: string;
      inventoryTypeId?: number | null;
      warehouseId?: number | null;
      location?: string;
      imageUrl?: string;
      remark?: string;
    },
    operatorUsername: string,
  ): Promise<FinishedGoodsStock> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) throw new NotFoundException('库存记录不存在');

    const before = {
      department: stock.department ?? '',
      inventoryTypeId: stock.inventoryTypeId ?? null,
      warehouseId: stock.warehouseId ?? null,
      location: stock.location ?? '',
    };

    if (dto.department !== undefined) stock.department = (dto.department ?? '').trim();
    if (dto.inventoryTypeId !== undefined) stock.inventoryTypeId = dto.inventoryTypeId != null ? Number(dto.inventoryTypeId) : null;
    if (dto.warehouseId !== undefined) stock.warehouseId = dto.warehouseId != null ? Number(dto.warehouseId) : null;
    if (dto.location !== undefined) stock.location = (dto.location ?? '').trim();
    if (dto.imageUrl !== undefined) stock.imageUrl = (dto.imageUrl ?? '').trim();

    const saved = await this.stockRepo.save(stock);

    const after = {
      department: saved.department ?? '',
      inventoryTypeId: saved.inventoryTypeId ?? null,
      warehouseId: saved.warehouseId ?? null,
      location: saved.location ?? '',
    };

    const changed =
      before.department !== after.department ||
      before.inventoryTypeId !== after.inventoryTypeId ||
      before.warehouseId !== after.warehouseId ||
      before.location !== after.location;

    if (changed) {
      try {
        await this.adjustLogRepo.save(
          this.adjustLogRepo.create({
            finishedStockId: id,
            operatorUsername: (operatorUsername ?? '').trim(),
            before,
            after,
            remark: (dto.remark ?? '').trim(),
          }),
        );
      } catch (e) {
        if (!this.isTableMissingError(e, 'finished_goods_stock_adjust_logs')) throw e;
      }
    }

    return saved;
  }

  async upsertColorImage(
    id: number,
    dto: { colorName: string; imageUrl: string },
  ): Promise<void> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) throw new NotFoundException('库存记录不存在');
    const colorName = (dto.colorName ?? '').trim();
    if (!colorName) throw new NotFoundException('颜色不能为空');
    const imageUrl = (dto.imageUrl ?? '').trim();

    try {
      const existing = await this.colorImageRepo.findOne({ where: { finishedStockId: id, colorName } });
      if (!imageUrl) {
        if (existing) {
          await this.colorImageRepo.remove(existing);
        }
        return;
      }
      if (existing) {
        existing.imageUrl = imageUrl;
        await this.colorImageRepo.save(existing);
        return;
      }
      await this.colorImageRepo.save(this.colorImageRepo.create({ finishedStockId: id, colorName, imageUrl }));
    } catch (e) {
      if (this.isTableMissingError(e, 'finished_goods_stock_color_images')) {
        throw new InternalServerErrorException(
          '库存详情图片表不存在，请先执行 backend/scripts/create-finished-goods-stock-detail-tables.sql',
        );
      }
      throw e;
    }
  }

  /** 领走人下拉：仅业务员角色的在职账号 */
  async getPickupUserOptions(): Promise<Array<{ id: number; username: string; displayName: string }>> {
    const role = await this.roleRepo.findOne({ where: { code: 'salesperson' } });
    if (!role) return [];
    const users = await this.userRepo.find({
      where: { roleId: role.id, status: UserStatus.ACTIVE },
      order: { displayName: 'ASC' },
    });
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName ?? '',
    }));
  }
}
