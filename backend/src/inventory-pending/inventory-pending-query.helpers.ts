import { EntityManager, Repository } from 'typeorm';
import { InboundPending } from '../entities/inbound-pending.entity';
import { Order } from '../entities/order.entity';
import { Product } from '../entities/product.entity';
import { User } from '../entities/user.entity';
import { parseStoredColorSizeSnapshot } from '../finished-goods-stock/finished-goods-stock-query.utils';
import { getPendingDetailStatus } from './inventory-pending-outbound.helpers';
import { formatDateTimeForResponse } from '../common/date-time.util';

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
  detailStatus: 'recorded' | 'missing' | 'not_applicable' | 'unknown';
}

type PendingShippedRawRow = {
  colorSizeSnapshot: unknown;
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

export type PendingListQuery = { tab?: string; orderNo?: string; skuCode?: string; page?: number; pageSize?: number };

export async function getPendingInventoryList(
  pendingRepo: Repository<InboundPending>,
  params: PendingListQuery,
  loadOrdersRequiringColorSizeDetail: (manager: EntityManager, orderIds: number[]) => Promise<Set<number>>,
): Promise<{ list: PendingListItem[]; total: number; page: number; pageSize: number }> {
    const { tab = 'pending', orderNo, skuCode, page = 1, pageSize = 20 } = params;
    if (tab === 'shipped') {
      const qb = pendingRepo.manager
        .createQueryBuilder()
        .from('finished_goods_outbound', 'fo')
        .leftJoin(Order, 'o', 'o.id = fo.order_id')
        .leftJoin(User, 'actor', 'actor.username = fo.operator_username')
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
          'COALESCE(NULLIF(actor.display_name, \'\'), fo.operator_username, \'\') AS operatorUsername',
          'fo.size_breakdown AS colorSizeSnapshot',
          'COALESCE(fo.remark, \'\') AS remark',
          'fo.created_at AS createdAt',
        ]);
      if (orderNo?.trim()) qb.andWhere('COALESCE(o.order_no, fo.order_no, \'\') LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      if (skuCode?.trim()) qb.andWhere('fo.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      qb.orderBy('fo.created_at', 'DESC');

      const countQb = pendingRepo.manager
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
        createdAt: formatDateTimeForResponse(r.createdAt),
        colorSizeSnapshot: parseStoredColorSizeSnapshot(r.colorSizeSnapshot),
        // 历史发货未保存是否需要尺码，不能用当前订单配置推断当时缺失原因。
        detailStatus: parseStoredColorSizeSnapshot(r.colorSizeSnapshot)
          ? getPendingDetailStatus(parseStoredColorSizeSnapshot(r.colorSizeSnapshot), Number(r.quantity), true)
          : 'unknown',
      }));
      return { list, total, page, pageSize };
    }

    const qb = pendingRepo
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

    const countQb = pendingRepo
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
      const parsed = parseStoredColorSizeSnapshot(raw);
      return parsed ? { headers: parsed.headers, rows: parsed.rows } : null;
    };

    const orderIds = Array.from(new Set(rows.map((row) => Number(row.orderId)).filter((id) => id > 0)));
    const detailRequiredOrderIds = await loadOrdersRequiringColorSizeDetail(pendingRepo.manager, orderIds);

    const list: PendingListItem[] = rows.map((r) => {
      const snapshot = parseSnapshot(r.colorSizeSnapshot);
      const requiresDetail = detailRequiredOrderIds.has(Number(r.orderId));
      const detailStatus: PendingListItem['detailStatus'] = getPendingDetailStatus(snapshot, r.quantity, requiresDetail);
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
        createdAt: formatDateTimeForResponse(r.createdAt),
        colorSizeSnapshot: snapshot,
        detailStatus,
      };
    });

    return { list, total, page, pageSize };
  }
