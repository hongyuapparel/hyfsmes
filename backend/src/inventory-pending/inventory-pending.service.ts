import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { errMsg } from '../common/http-exception.filter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InboundPending } from '../entities/inbound-pending.entity';
import { Order } from '../entities/order.entity';
import { Role } from '../entities/role.entity';
import { Product } from '../entities/product.entity';
import { User, UserStatus } from '../entities/user.entity';
import { UserRole } from '../entities/user-role.entity';
import { FinishedGoodsStockService } from '../finished-goods-stock/finished-goods-stock.service';

export interface PendingListItem {
  id: number;
  tabType: 'pending' | 'shipped';
  orderId: number;
  orderNo: string;
  customerName: string;
  skuCode: string;
  imageUrl: string;
  quantity: number;
  sourceType: string;
  pickupUserName: string;
  operatorUsername: string;
  remark: string;
  createdAt: string;
  /** 本批入库/次品的颜色×尺码真值快照（来自尾部入库登记） */
  colorSizeSnapshot: { headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> } | null;
}

type PendingOutboundItemInput = {
  id: number;
  quantity: number;
  sizeBreakdown?: unknown;
};

type PendingShippedRawRow = {
  id: number | string;
  orderId: number | string | null;
  orderNo: string | null;
  customerName: string | null;
  skuCode: string | null;
  imageUrl: string | null;
  quantity: number | string | null;
  pickupUserName: string | null;
  operatorUsername: string | null;
  remark: string | null;
  createdAt: Date | string | null;
};

@Injectable()
export class InventoryPendingService {
  private readonly logger = new Logger(InventoryPendingService.name);

  constructor(
    @InjectRepository(InboundPending)
    private readonly pendingRepo: Repository<InboundPending>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    private readonly finishedGoodsStockService: FinishedGoodsStockService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
  ) {}

  private async resolvePickupUser(pickupUserId?: number | null): Promise<{ pickupId: number | null; pickupUserName: string }> {
    if (pickupUserId == null) {
      return { pickupId: null, pickupUserName: '' };
    }
    const salespersonRole = await this.roleRepo.findOne({ where: { code: 'salesperson' } });
    if (!salespersonRole) throw new NotFoundException('未配置业务员角色');
    const pickupUser = await this.userRepo.findOne({
      where: { id: Number(pickupUserId), status: UserStatus.ACTIVE },
      select: ['id', 'username', 'displayName', 'roleId', 'status'],
    });
    if (!pickupUser) throw new NotFoundException('领取人不存在或不是在职业务员');
    const link = await this.userRoleRepo.findOne({ where: { userId: pickupUser.id, roleId: salespersonRole.id } });
    if (!(pickupUser.roleId === salespersonRole.id || !!link)) {
      throw new NotFoundException('领取人不存在或不是在职业务员');
    }
    return {
      pickupId: pickupUser.id,
      pickupUserName: (pickupUser.displayName?.trim() || pickupUser.username || '').trim(),
    };
  }

  async getPickupUserOptions(): Promise<Array<{ id: number; username: string; displayName: string }>> {
    const role = await this.roleRepo.findOne({ where: { code: 'salesperson' } });
    if (!role) return [];
    const links = await this.userRoleRepo.find({ where: { roleId: role.id }, select: ['userId'] });
    const userIds = Array.from(new Set(links.map((x) => x.userId)));
    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.status = :status', { status: UserStatus.ACTIVE })
      .andWhere('(u.role_id = :rid OR u.id IN (:...ids))', { rid: role.id, ids: userIds.length ? userIds : [0] })
      .orderBy('u.display_name', 'ASC')
      .getMany();
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName ?? '',
    }));
  }

  async getList(params: {
    tab?: string;
    orderNo?: string;
    skuCode?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: PendingListItem[]; total: number; page: number; pageSize: number }> {
    const { tab = 'pending', orderNo, skuCode, page = 1, pageSize = 20 } = params;
    if (tab === 'shipped') {
      const qb = this.pendingRepo.manager
        .createQueryBuilder()
        .from('finished_goods_outbound', 'fo')
        .leftJoin(Order, 'o', 'o.id = fo.order_id')
        .where('fo.remark = :remark', { remark: '待仓直发' })
        .select([
          'fo.id AS id',
          'fo.order_id AS orderId',
          'COALESCE(o.order_no, fo.order_no, \'\') AS orderNo',
          'COALESCE(fo.customer_name, \'\') AS customerName',
          'COALESCE(fo.sku_code, \'\') AS skuCode',
          'COALESCE(o.image_url, \'\') AS imageUrl',
          'fo.quantity AS quantity',
          '\'normal\' AS sourceType',
          'COALESCE(fo.pickup_user_name, \'\') AS pickupUserName',
          'COALESCE(fo.operator_username, \'\') AS operatorUsername',
          'COALESCE(fo.remark, \'\') AS remark',
          'fo.created_at AS createdAt',
        ]);
      if (orderNo?.trim()) qb.andWhere('COALESCE(o.order_no, fo.order_no, \'\') LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      if (skuCode?.trim()) qb.andWhere('fo.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      qb.orderBy('fo.created_at', 'DESC');

      const countQb = this.pendingRepo.manager
        .createQueryBuilder()
        .from('finished_goods_outbound', 'fo')
        .leftJoin(Order, 'o', 'o.id = fo.order_id')
        .where('fo.remark = :remark', { remark: '待仓直发' });
      if (orderNo?.trim()) countQb.andWhere('COALESCE(o.order_no, fo.order_no, \'\') LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      if (skuCode?.trim()) countQb.andWhere('fo.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      const total = await countQb.getCount();

      const rows = await qb
        .offset((page - 1) * pageSize)
        .limit(pageSize)
        .getRawMany<PendingShippedRawRow>();
      const list: PendingListItem[] = rows.map((r) => ({
        id: Number(r.id),
        tabType: 'shipped',
        orderId: Number(r.orderId) || 0,
        orderNo: r.orderNo ?? '',
        customerName: r.customerName ?? '',
        skuCode: r.skuCode ?? '',
        imageUrl: r.imageUrl ?? '',
        quantity: Number(r.quantity) || 0,
        sourceType: 'normal',
        pickupUserName: r.pickupUserName ?? '',
        operatorUsername: r.operatorUsername ?? '',
        remark: r.remark ?? '',
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
        colorSizeSnapshot: null,
      }));
      return { list, total, page, pageSize };
    }

    const qb = this.pendingRepo
      .createQueryBuilder('p')
      .innerJoin(Order, 'o', 'o.id = p.order_id')
      .leftJoin(Product, 'pr', 'pr.sku_code = p.sku_code')
      .where('p.status = :status', { status: 'pending' })
      .select([
        'p.id AS id',
        'p.order_id AS orderId',
        'o.order_no AS orderNo',
        'o.customer_name AS customerName',
        'p.sku_code AS skuCode',
        'pr.image_url AS imageUrl',
        'p.quantity AS quantity',
        'p.source_type AS sourceType',
        'p.created_at AS createdAt',
        'p.color_size_snapshot AS colorSizeSnapshot',
      ]);

    if (orderNo?.trim()) {
      qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    }
    if (skuCode?.trim()) {
      qb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    }
    qb.orderBy('p.created_at', 'DESC');

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
    const total = await countQb.getCount();

    const rows = await qb
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<{
        id: number;
        orderId: number;
        orderNo: string;
        customerName: string;
        skuCode: string;
        imageUrl: string;
        quantity: number;
        sourceType: string;
        createdAt: Date;
        colorSizeSnapshot: unknown;
      }>();

    const parseSnapshot = (raw: unknown): PendingListItem['colorSizeSnapshot'] => {
      if (raw == null) return null;
      let parsed: unknown = raw;
      if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch { return null; }
      }
      if (!parsed || typeof parsed !== 'object') return null;
      const rec = parsed as { headers?: unknown; rows?: unknown };
      const headers = Array.isArray(rec.headers) ? rec.headers.map((h) => String(h ?? '')) : [];
      const rowsArr = Array.isArray(rec.rows) ? rec.rows : [];
      const rowsOut: Array<{ colorName: string; quantities: number[] }> = [];
      for (const item of rowsArr) {
        if (!item || typeof item !== 'object') continue;
        const r = item as { colorName?: unknown; quantities?: unknown };
        const colorName = String(r.colorName ?? '').trim();
        const q = Array.isArray(r.quantities) ? r.quantities : [];
        rowsOut.push({ colorName, quantities: q.map((n) => Math.max(0, Math.trunc(Number(n) || 0))) });
      }
      return headers.length > 0 && rowsOut.length > 0 ? { headers, rows: rowsOut } : null;
    };

    // 兜底：commit 521389ba 之前完成入库的订单，inbound_pending.color_size_snapshot
    // 全为 NULL；同一订单的 order_finishing.*_by_color / *_qty_row 通常已有数据。
    // 该订单只有一条同 sourceType 的 pending 时，把累计真值直接当作"本批"显示，
    // 让 hover 至少看到尺码/颜色明细，不再卡在"未留存"。
    const fallbackTargets = rows
      .map((r) => ({ id: Number(r.id), orderId: Number(r.orderId), sourceType: String(r.sourceType ?? 'normal'), hasSnapshot: r.colorSizeSnapshot != null }))
      .filter((r) => !r.hasSnapshot && r.orderId > 0);
    const orderIdsForFallback = Array.from(new Set(fallbackTargets.map((r) => r.orderId)));
    const fallbackByOrder = new Map<number, {
      headers: string[];
      normalByColor: Array<{ colorName: string; quantities: number[] }> | null;
      defectByColor: Array<{ colorName: string; quantities: number[] }> | null;
      normalRow: number[] | null;
      defectRow: number[] | null;
    }>();
    const pendingCountByOrderType = new Map<string, number>();
    if (orderIdsForFallback.length > 0) {
      const countRows = (await this.pendingRepo.manager.query(
        `SELECT order_id AS orderId, source_type AS sourceType, COUNT(*) AS cnt
         FROM inbound_pending WHERE order_id IN (${orderIdsForFallback.map(() => '?').join(',')}) AND status = 'pending'
         GROUP BY order_id, source_type`,
        orderIdsForFallback,
      )) as Array<{ orderId: number | string; sourceType: string; cnt: number | string }>;
      for (const c of countRows) {
        pendingCountByOrderType.set(`${Number(c.orderId)}|${c.sourceType}`, Number(c.cnt));
      }
      const finRows = (await this.pendingRepo.manager.query(
        `SELECT f.order_id AS orderId,
                f.tail_inbound_quantities_by_color AS inboundByColor,
                f.defect_quantities_by_color AS defectByColor,
                f.tail_inbound_qty_row AS inboundRow,
                f.defect_quantity_row AS defectRow,
                e.color_size_headers AS headers
         FROM order_finishing f
         LEFT JOIN order_ext e ON e.order_id = f.order_id
         WHERE f.order_id IN (${orderIdsForFallback.map(() => '?').join(',')})`,
        orderIdsForFallback,
      )) as Array<{
        orderId: number | string;
        inboundByColor: unknown;
        defectByColor: unknown;
        inboundRow: unknown;
        defectRow: unknown;
        headers: unknown;
      }>;
      const parseJsonArr = (raw: unknown): unknown[] | null => {
        if (raw == null) return null;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') {
          try { const j = JSON.parse(raw); return Array.isArray(j) ? j : null; } catch { return null; }
        }
        return null;
      };
      const parseByColorList = (raw: unknown): Array<{ colorName: string; quantities: number[] }> | null => {
        const arr = parseJsonArr(raw);
        if (!arr || arr.length === 0) return null;
        const out: Array<{ colorName: string; quantities: number[] }> = [];
        for (const item of arr) {
          if (!item || typeof item !== 'object') continue;
          const it = item as { colorName?: unknown; quantities?: unknown };
          const name = String(it.colorName ?? '').trim();
          const qs = Array.isArray(it.quantities) ? it.quantities : [];
          out.push({ colorName: name, quantities: qs.map((n) => Math.max(0, Math.trunc(Number(n) || 0))) });
        }
        return out.length > 0 ? out : null;
      };
      const parseNumberRow = (raw: unknown): number[] | null => {
        const arr = parseJsonArr(raw);
        if (!arr || arr.length === 0) return null;
        return arr.map((n) => Math.max(0, Math.trunc(Number(n) || 0)));
      };
      const parseHeaders = (raw: unknown): string[] => {
        const arr = parseJsonArr(raw);
        if (!arr) return [];
        return arr.map((h) => String(h ?? ''));
      };
      for (const f of finRows) {
        fallbackByOrder.set(Number(f.orderId), {
          headers: parseHeaders(f.headers),
          normalByColor: parseByColorList(f.inboundByColor),
          defectByColor: parseByColorList(f.defectByColor),
          normalRow: parseNumberRow(f.inboundRow),
          defectRow: parseNumberRow(f.defectRow),
        });
      }
    }

    const buildFallbackSnapshot = (
      orderId: number,
      sourceType: string,
      quantity: number,
    ): PendingListItem['colorSizeSnapshot'] => {
      const f = fallbackByOrder.get(orderId);
      if (!f) return null;
      // 仅当该订单 + 该 sourceType 的 pending 只有一条时，累计真值即"本批"真值；
      // 多条时无法可靠拆分到批次，回退不输出（保留"未留存"提示，不做估算）。
      if ((pendingCountByOrderType.get(`${orderId}|${sourceType}`) ?? 0) !== 1) return null;
      const headers = f.headers;
      if (headers.length === 0) return null;
      const sizeLen = headers.length;
      const byColor = sourceType === 'defect' ? f.defectByColor : f.normalByColor;
      if (byColor && byColor.length > 0) {
        const rows = byColor.map((r) => {
          const q = Array.from({ length: sizeLen }, (_, i) => Math.max(0, Math.trunc(Number(r.quantities[i]) || 0)));
          return { colorName: r.colorName || '-', quantities: q };
        });
        const grand = rows.reduce((s, r) => s + r.quantities.reduce((a, b) => a + b, 0), 0);
        if (grand === quantity) return { headers, rows };
      }
      const oneRow = sourceType === 'defect' ? f.defectRow : f.normalRow;
      if (oneRow && oneRow.length > 0) {
        // 后端写入的 _qty_row 末尾可能含合计列（headers.length + 1），剪到 sizeLen
        const perSize = Array.from({ length: sizeLen }, (_, i) => Math.max(0, Math.trunc(Number(oneRow[i]) || 0)));
        const total = perSize.reduce((a, b) => a + b, 0);
        if (total === quantity) {
          return { headers, rows: [{ colorName: '-', quantities: perSize }] };
        }
      }
      return null;
    };

    const list: PendingListItem[] = rows.map((r) => {
      const parsed = parseSnapshot(r.colorSizeSnapshot);
      const snapshot = parsed ?? buildFallbackSnapshot(Number(r.orderId), String(r.sourceType ?? 'normal'), Number(r.quantity) || 0);
      return {
        id: r.id,
        tabType: 'pending',
        orderId: r.orderId,
        orderNo: r.orderNo ?? '',
        customerName: r.customerName ?? '',
        skuCode: r.skuCode ?? '',
        imageUrl: r.imageUrl ?? '',
        quantity: r.quantity ?? 0,
        sourceType: r.sourceType ?? 'normal',
        pickupUserName: '',
        operatorUsername: '',
        remark: '',
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
        colorSizeSnapshot: snapshot,
      };
    });

    return { list, total, page, pageSize };
  }

  /** 执行入库：选中记录填写仓库、库存类型、部门、位置，写入成品库存并标记待入库完成；可选传 imageUrl */
  async doInbound(
    ids: number[],
    warehouseId: number | null,
    inventoryTypeId: number | null,
    department: string,
    location: string,
    imageUrl?: string,
    operatorUsername = '',
  ): Promise<void> {
    if (!ids?.length) {
      throw new NotFoundException('请选择待仓处理记录');
    }
    const pendings = await this.pendingRepo
      .createQueryBuilder('p')
      .where('p.id IN (:...ids) AND p.status = :status', { ids, status: 'pending' })
      .addSelect('p.color_size_snapshot')
      .getMany();
    if (pendings.length === 0) {
      throw new NotFoundException('未找到有效的待仓处理记录');
    }
    const img = imageUrl?.trim() ?? '';

    // 预加载订单以获取客户信息
    const orderIds = Array.from(
      new Set(pendings.map((p) => p.orderId).filter((id) => typeof id === 'number' && id > 0)),
    );
    const orders = orderIds.length
      ? await this.orderRepo.find({
          where: { id: In(orderIds) },
        })
      : [];
    const orderMap = new Map<number, Order>();
    for (const o of orders) {
      orderMap.set(o.id, o);
    }
    for (const p of pendings) {
      const order = orderMap.get(p.orderId);
      // 优先使用 inbound_pending 上的颜色×尺码 snapshot（尾部入库登记的真值）；
      // 缺失时（老数据）回退到 createManual 内部的 buildOrderColorSizeSnapshot 兜底反推。
      const snapshot = (p as { colorSizeSnapshot?: { headers: string[]; rows: Array<{ colorName: string; quantities: number[] }> } | null }).colorSizeSnapshot ?? null;
      await this.finishedGoodsStockService.createManual(
        {
          orderNo: order?.orderNo ?? '',
          skuCode: p.skuCode,
          quantity: p.quantity,
          unitPrice: order?.exFactoryPrice != null ? String(order.exFactoryPrice) : '0',
          warehouseId: warehouseId != null ? Number(warehouseId) : null,
          inventoryTypeId: inventoryTypeId != null ? Number(inventoryTypeId) : null,
          department: department?.trim() ?? '',
          location: location?.trim() ?? '',
          imageUrl: img,
          colorSize: snapshot ?? undefined,
        },
        operatorUsername,
      );
      p.status = 'completed';
      await this.pendingRepo.save(p);
    }
  }

  async doOutbound(
    items: PendingOutboundItemInput[],
    operatorUsername: string,
    pickupUserId?: number | null,
  ): Promise<void> {
    const normalizedItems = Array.isArray(items)
      ? items
          .map((item) => ({
            id: Number(item?.id),
            quantity: Number(item?.quantity),
            sizeBreakdown: item?.sizeBreakdown ?? null,
          }))
          .filter((item) => Number.isInteger(item.id) && item.id > 0)
      : [];
    if (!normalizedItems.length) {
      throw new BadRequestException('请选择需要发货的待仓处理记录');
    }
    const uniqueIds = Array.from(new Set(normalizedItems.map((item) => item.id)));
    if (uniqueIds.length !== normalizedItems.length) {
      throw new BadRequestException('同一条待仓处理记录不能重复发货');
    }

    const pendings = await this.pendingRepo.find({
      where: { id: In(uniqueIds), status: 'pending' },
    });
    if (pendings.length !== uniqueIds.length) {
      throw new NotFoundException('存在待仓处理记录不存在或已失效');
    }
    const pendingMap = new Map(pendings.map((pending) => [pending.id, pending]));
    for (const item of normalizedItems) {
      const pending = pendingMap.get(item.id);
      if (!pending) throw new NotFoundException('未找到有效的待仓处理记录');
      if ((pending.sourceType ?? 'normal') === 'defect') {
        throw new BadRequestException('次品记录不支持直接发货');
      }
      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException('发货数量必须为正整数');
      }
      if (item.quantity > (pending.quantity ?? 0)) {
        throw new BadRequestException(`记录 ${pending.skuCode || pending.id} 的发货数量不能大于当前待处理数量`);
      }
    }

    const orderIds = Array.from(new Set(pendings.map((pending) => pending.orderId).filter((id): id is number => id > 0)));
    const skuCodes = Array.from(new Set(pendings.map((pending) => pending.skuCode?.trim()).filter((code): code is string => !!code)));
    const [orders, products, pickupInfo] = await Promise.all([
      orderIds.length ? this.orderRepo.find({ where: { id: In(orderIds) } }) : Promise.resolve([]),
      skuCodes.length ? this.productRepo.find({ where: skuCodes.map((skuCode) => ({ skuCode })) }) : Promise.resolve([]),
      this.resolvePickupUser(pickupUserId),
    ]);
    const orderMap = new Map(orders.map((order) => [order.id, order]));
    const productMap = new Map(products.map((product) => [product.skuCode?.trim() ?? '', product]));
    const customerNames = Array.from(
      new Set(
        pendings.map((pending) => orderMap.get(pending.orderId)?.customerName?.trim() || '__EMPTY__'),
      ),
    );
    if (customerNames.length > 1) {
      throw new BadRequestException('批量发货仅支持选择同一客户的记录');
    }

    try {
      await this.pendingRepo.manager.transaction(async (manager) => {
        const txPendingRepo = manager.getRepository(InboundPending);

        for (const item of normalizedItems) {
          const txPending = await txPendingRepo.findOne({
            where: { id: item.id, status: 'pending' },
          });
          if (!txPending) {
            throw new NotFoundException('未找到有效的待仓处理记录');
          }
          if ((txPending.sourceType ?? 'normal') === 'defect') {
            throw new BadRequestException('次品记录不支持直接发货');
          }
          if (item.quantity > (txPending.quantity ?? 0)) {
            throw new BadRequestException(`记录 ${txPending.skuCode || txPending.id} 的发货数量不能大于当前待处理数量`);
          }

          const pending = pendingMap.get(item.id) ?? txPending;
          const order = orderMap.get(txPending.orderId) ?? null;
          const product = productMap.get(txPending.skuCode?.trim() ?? '') ?? null;
          const resolvedOrderId = Number(order?.id ?? pending.orderId ?? txPending.orderId ?? 0);
          if (!Number.isInteger(resolvedOrderId) || resolvedOrderId <= 0) {
            throw new BadRequestException(`待仓处理记录 ${txPending.id} 缺少有效 order_id，无法发货`);
          }
          const stockInsertSql =
            'INSERT INTO finished_goods_stock (order_id, sku_code, quantity, unit_price, warehouse_id, inventory_type_id, department, location, customer_id, customer_name, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
          const stockInsertParams = [
            resolvedOrderId,
            txPending.skuCode ?? '',
            item.quantity,
            order?.exFactoryPrice != null ? String(order.exFactoryPrice) : '0',
            null,
            null,
            '',
            '',
            order?.customerId ?? null,
            order?.customerName?.trim() ?? '',
            product?.imageUrl?.trim() ?? '',
          ];
          this.logger.log(
            `[doOutbound] step=insert_stock payload=${JSON.stringify({
              order_id: resolvedOrderId,
              sku_code: txPending.skuCode,
              quantity: item.quantity,
            })}`,
          );
          this.logger.log(`[doOutbound] step=insert_stock table=finished_goods_stock sql=${stockInsertSql}`);
          this.logger.log(`[doOutbound] step=insert_stock parameters=${JSON.stringify(stockInsertParams)}`);
          const stockInsertRes = (await manager.query(stockInsertSql, stockInsertParams)) as { insertId?: unknown };
          const savedStockId = Number(stockInsertRes?.insertId ?? 0);
          if (!savedStockId) {
            throw new BadRequestException('待仓处理发货失败：库存记录写入失败');
          }

          // 发货业务与图片解耦：原生 SQL 显式列插入，彻底不依赖 image_url
          const outboundInsertSql =
            'INSERT INTO finished_goods_outbound (finished_stock_id, order_id, order_no, sku_code, customer_name, quantity, department, warehouse_id, inventory_type_id, pickup_user_id, pickup_user_name, size_breakdown, operator_username, remark) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
          const outboundInsertParams = [
            savedStockId,
            resolvedOrderId,
            order?.orderNo ?? '',
            pending.skuCode ?? '',
            order?.customerName?.trim() ?? '',
            item.quantity,
            '',
            null,
            null,
            pickupInfo.pickupId,
            pickupInfo.pickupUserName,
            item.sizeBreakdown != null ? JSON.stringify(item.sizeBreakdown) : null,
            (operatorUsername ?? '').trim(),
            '待仓直发',
          ];
          this.logger.log(
            `[doOutbound] step=insert_outbound payload=${JSON.stringify({
              finished_stock_id: savedStockId,
              order_id: resolvedOrderId,
              order_no: order?.orderNo ?? '',
              sku_code: pending.skuCode ?? '',
              quantity: item.quantity,
            })}`,
          );
          this.logger.log(`[doOutbound] step=insert_outbound table=finished_goods_outbound sql=${outboundInsertSql}`);
          this.logger.log(`[doOutbound] step=insert_outbound parameters=${JSON.stringify(outboundInsertParams)}`);
          await manager.query(outboundInsertSql, outboundInsertParams);

          const deleteStockSql = 'DELETE FROM finished_goods_stock WHERE id = ?';
          const deleteStockParams = [savedStockId];
          this.logger.log(`[doOutbound] step=delete_stock table=finished_goods_stock sql=${deleteStockSql}`);
          this.logger.log(`[doOutbound] step=delete_stock parameters=${JSON.stringify(deleteStockParams)}`);
          await manager.query(deleteStockSql, deleteStockParams);

          if (item.quantity === (txPending.quantity ?? 0)) {
            const completeSql = 'UPDATE inbound_pending SET status = ? WHERE id = ?';
            const completeParams = ['completed', txPending.id];
            this.logger.log(`[doOutbound] step=update_pending_completed table=inbound_pending sql=${completeSql}`);
            this.logger.log(`[doOutbound] step=update_pending_completed parameters=${JSON.stringify(completeParams)}`);
            await manager.query(completeSql, completeParams);
          } else {
            const remainQty = (txPending.quantity ?? 0) - item.quantity;
            const updateSql = 'UPDATE inbound_pending SET quantity = ? WHERE id = ?';
            const updateParams = [remainQty, txPending.id];
            this.logger.log(`[doOutbound] step=update_pending_quantity table=inbound_pending sql=${updateSql}`);
            this.logger.log(`[doOutbound] step=update_pending_quantity parameters=${JSON.stringify(updateParams)}`);
            await manager.query(updateSql, updateParams);
          }
        }
      });
    } catch (e: unknown) {
      const err = e as { table?: unknown; query?: unknown; parameters?: unknown; stack?: unknown } | null;
      this.logger.error(
        `[doOutbound] controller=InventoryPendingController service=InventoryPendingService method=doOutbound failed`,
      );
      this.logger.error(`[doOutbound] table=${String(err?.table || '')} query=${String(err?.query || '')}`);
      this.logger.error(
        `[doOutbound] parameters=${JSON.stringify(err?.parameters ?? [])} message=${errMsg(e)}`,
      );
      this.logger.error(`[doOutbound] stack=${String(err?.stack || '')}`);
      throw e;
    }
  }
}
