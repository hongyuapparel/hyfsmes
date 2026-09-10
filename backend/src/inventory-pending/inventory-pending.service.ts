import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { InboundPending } from '../entities/inbound-pending.entity';
import { Order } from '../entities/order.entity';
import { Role } from '../entities/role.entity';
import { Product } from '../entities/product.entity';
import { User, UserStatus } from '../entities/user.entity';
import { UserRole } from '../entities/user-role.entity';
import { FinishedGoodsStockService } from '../finished-goods-stock/finished-goods-stock.service';
import { applyPendingOutboundSizeDeduction, getPendingDetailStatus } from './inventory-pending-outbound.helpers';
import { parseStoredColorSizeSnapshot } from '../finished-goods-stock/finished-goods-stock-query.utils';
import { getPendingInventoryList, type PendingListQuery, type PendingListItem } from './inventory-pending-query.helpers';
export type { PendingListItem } from './inventory-pending-query.helpers';

type PendingOutboundItemInput = {
  id: number;
  quantity: number;
  sizeBreakdown?: unknown;
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

  private async loadOrdersRequiringColorSizeDetail(
    manager: EntityManager,
    orderIds: number[],
  ): Promise<Set<number>> {
    const unique = Array.from(new Set(orderIds.filter((id) => Number.isInteger(id) && id > 0)));
    if (!unique.length) return new Set();
    const rows = (await manager.query(
      `SELECT order_id AS orderId, color_size_headers AS headers
       FROM order_ext WHERE order_id IN (${unique.map(() => '?').join(',')})`,
      unique,
    )) as Array<{ orderId: number | string; headers: unknown }>;
    const required = new Set<number>();
    for (const row of rows) {
      let headers = row.headers;
      if (typeof headers === 'string') {
        try {
          headers = JSON.parse(headers) as unknown;
        } catch {
          headers = null;
        }
      }
      if (Array.isArray(headers) && headers.some((header) => String(header ?? '').trim())) {
        required.add(Number(row.orderId));
      }
    }
    return required;
  }

  private assertRecordedDetail(
    pending: InboundPending,
    snapshot: PendingListItem['colorSizeSnapshot'],
    requiresDetail: boolean,
  ): void {
    if (getPendingDetailStatus(snapshot, pending.quantity, requiresDetail) === 'missing') {
      throw new BadRequestException(
        `订单 ${pending.skuCode || pending.id} 的本批颜色尺码明细未留存或与待处理数量不一致，请先在尾部纠错中按实际数据补录`,
      );
    }
  }

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

  async getList(params: PendingListQuery) {
    return getPendingInventoryList(this.pendingRepo, params, (manager, ids) => this.loadOrdersRequiringColorSizeDetail(manager, ids));
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
      .addSelect('p.colorSizeSnapshot')
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
    const detailRequiredOrderIds = await this.loadOrdersRequiringColorSizeDetail(this.pendingRepo.manager, orderIds);
    for (const p of pendings) {
      const order = orderMap.get(p.orderId);
      const snapshot = parseStoredColorSizeSnapshot((p as { colorSizeSnapshot?: unknown }).colorSizeSnapshot);
      this.assertRecordedDetail(p, snapshot, detailRequiredOrderIds.has(p.orderId));
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
          colorSize: snapshot,
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
    transactionManager?: EntityManager,
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

    const pendings = await this.pendingRepo
      .createQueryBuilder('p')
      .where('p.id IN (:...ids) AND p.status = :status', { ids: uniqueIds, status: 'pending' })
      .addSelect('p.colorSizeSnapshot')
      .getMany();
    if (pendings.length !== uniqueIds.length) {
      throw new NotFoundException('存在待仓处理记录不存在或已失效');
    }
    const pendingMap = new Map(pendings.map((pending) => [pending.id, pending]));
    const orderIds = Array.from(new Set(pendings.map((pending) => pending.orderId).filter((id): id is number => id > 0)));
    const detailRequiredOrderIds = await this.loadOrdersRequiringColorSizeDetail(this.pendingRepo.manager, orderIds);

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
      const currentSnapshot = parseStoredColorSizeSnapshot(
        (pending as { colorSizeSnapshot?: unknown }).colorSizeSnapshot,
      );
      this.assertRecordedDetail(pending, currentSnapshot, detailRequiredOrderIds.has(pending.orderId));
      if (!currentSnapshot && item.sizeBreakdown != null) {
        throw new BadRequestException(`订单 ${pending.skuCode || pending.id} 没有已登记的颜色尺码明细，不能提交分码出库数据`);
      }
      // 预检尺码（与事务内同一规则），尽早失败避免半写入
      applyPendingOutboundSizeDeduction({
        label: `记录 ${pending.skuCode || pending.id}`,
        pendingQty: pending.quantity ?? 0,
        shipQty: item.quantity,
        currentSnapshot,
        outgoingSizeBreakdown: item.sizeBreakdown,
      });
    }

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

    const execute = async (manager: EntityManager): Promise<void> => {
        const txPendingRepo = manager.getRepository(InboundPending);
        const txDetailRequiredOrderIds = await this.loadOrdersRequiringColorSizeDetail(manager, orderIds);

        for (const item of normalizedItems) {
          const txPending = await txPendingRepo
            .createQueryBuilder('p')
            .where('p.id = :id AND p.status = :status', { id: item.id, status: 'pending' })
            .addSelect('p.colorSizeSnapshot')
            .setLock('pessimistic_write')
            .getOne();
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
          const label = `记录 ${txPending.skuCode || txPending.id}`;
          const currentSnapshot = parseStoredColorSizeSnapshot(
            (txPending as { colorSizeSnapshot?: unknown }).colorSizeSnapshot,
          );
          this.assertRecordedDetail(
            txPending,
            currentSnapshot,
            txDetailRequiredOrderIds.has(txPending.orderId),
          );
          if (!currentSnapshot && item.sizeBreakdown != null) {
            throw new BadRequestException(`订单 ${txPending.skuCode || txPending.id} 没有已登记的颜色尺码明细，不能提交分码出库数据`);
          }
          const { remainingSnapshot, outgoingSnapshot } = applyPendingOutboundSizeDeduction({
            label,
            pendingQty: txPending.quantity ?? 0,
            shipQty: item.quantity,
            currentSnapshot,
            outgoingSizeBreakdown: item.sizeBreakdown,
          });
          const sizeBreakdownJson =
            outgoingSnapshot != null
              ? JSON.stringify(outgoingSnapshot)
              : item.sizeBreakdown != null
                ? JSON.stringify(item.sizeBreakdown)
                : null;

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
            sizeBreakdownJson,
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
            const updateSql = 'UPDATE inbound_pending SET quantity = ?, color_size_snapshot = ? WHERE id = ?';
            const updateParams = [
              remainQty,
              remainingSnapshot != null ? JSON.stringify(remainingSnapshot) : null,
              txPending.id,
            ];
            this.logger.log(`[doOutbound] step=update_pending_quantity_snapshot table=inbound_pending sql=${updateSql}`);
            this.logger.log(
              `[doOutbound] step=update_pending_quantity_snapshot parameters=${JSON.stringify(updateParams)}`,
            );
            await manager.query(updateSql, updateParams);
          }
        }
    };
    if (transactionManager) await execute(transactionManager);
    else await this.pendingRepo.manager.transaction(execute);
  }
}
