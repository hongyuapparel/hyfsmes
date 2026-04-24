import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { errMsg } from '../common/http-exception.filter';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InboundPending } from '../entities/inbound-pending.entity';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { FinishedGoodsOutbound } from '../entities/finished-goods-outbound.entity';
import { Order } from '../entities/order.entity';
import { Role } from '../entities/role.entity';
import { Product } from '../entities/product.entity';
import { User, UserStatus } from '../entities/user.entity';
import { UserRole } from '../entities/user-role.entity';

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
}

type PendingOutboundItemInput = {
  id: number;
  quantity: number;
  sizeBreakdown?: any;
};

@Injectable()
export class InventoryPendingService {
  private readonly logger = new Logger(InventoryPendingService.name);

  constructor(
    @InjectRepository(InboundPending)
    private readonly pendingRepo: Repository<InboundPending>,
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
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
        .getRawMany<any>();
      const list: PendingListItem[] = rows.map((r: any) => ({
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
      }>();

    const list: PendingListItem[] = rows.map((r) => ({
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
    }));

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
  ): Promise<void> {
    if (!ids?.length) {
      throw new NotFoundException('请选择待仓处理记录');
    }
    const pendings = await this.pendingRepo.find({
      where: { id: In(ids), status: 'pending' },
    });
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
      const stock = this.stockRepo.create({
        orderId: p.orderId,
        skuCode: p.skuCode,
        quantity: p.quantity,
        unitPrice: order?.exFactoryPrice != null ? String(order.exFactoryPrice) : '0',
        warehouseId: warehouseId != null ? Number(warehouseId) : null,
        inventoryTypeId: inventoryTypeId != null ? Number(inventoryTypeId) : null,
        department: department?.trim() ?? '',
        location: location?.trim() ?? '',
        customerId: order?.customerId ?? null,
        customerName: order?.customerName?.trim() ?? '',
        imageUrl: img,
      });
      await this.stockRepo.save(stock);
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
        const txStockRepo = manager.getRepository(FinishedGoodsStock);
        const txOutboundRepo = manager.getRepository(FinishedGoodsOutbound);

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
          const stockInsertRes: any = await manager.query(stockInsertSql, stockInsertParams);
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
