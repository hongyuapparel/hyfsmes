import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, SelectQueryBuilder } from 'typeorm';
import { formatDateTimeForResponse } from '../common/date-time.util';
import { FabricOutbound } from '../entities/fabric-outbound.entity';
import { FabricStock } from '../entities/fabric-stock.entity';
import { SystemOption } from '../entities/system-option.entity';
import { User } from '../entities/user.entity';

export type FabricOutboundFilters = {
  name?: string;
  customerName?: string;
  inventoryTypeId?: number | null;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
};

export type FabricOutboundListRow = {
  id: number;
  fabricStockId: number;
  name: string;
  customerName: string;
  unit: string;
  inventoryTypeId: number | null;
  inventoryTypeLabel: string;
  quantity: string;
  unitPrice: string | null;
  amount: string | null;
  photoUrl: string;
  remark: string;
  pickupUserId: number | null;
  pickupUserName: string;
  nameFromCurrentStock: boolean;
  customerNameFromCurrentStock: boolean;
  unitFromCurrentStock: boolean;
  inventoryTypeFromCurrentStock: boolean;
  createdAt: string;
};

function applyFilters(
  qb: SelectQueryBuilder<FabricOutbound>,
  params: FabricOutboundFilters,
): SelectQueryBuilder<FabricOutbound> {
  if (params.name?.trim()) {
    qb.andWhere("COALESCE(NULLIF(o.name_snapshot, ''), NULLIF(s.name, ''), '') LIKE :name", {
      name: `%${params.name.trim()}%`,
    });
  }
  if (params.customerName?.trim()) {
    qb.andWhere("COALESCE(o.customer_name_snapshot, s.customer_name, '') LIKE :customerName", {
      customerName: `%${params.customerName.trim()}%`,
    });
  }
  if (params.inventoryTypeId != null) {
    qb.andWhere('COALESCE(o.inventory_type_id, s.inventory_type_id) = :inventoryTypeId', {
      inventoryTypeId: params.inventoryTypeId,
    });
  }
  if (params.startDate?.trim()) qb.andWhere('o.created_at >= :start', { start: `${params.startDate.trim()} 00:00:00` });
  if (params.endDate?.trim()) qb.andWhere('o.created_at <= :end', { end: `${params.endDate.trim()} 23:59:59` });
  return qb;
}

@Injectable()
export class FabricStockOutboundQueryService {
  constructor(
    @InjectRepository(FabricOutbound)
    private readonly outboundRepo: Repository<FabricOutbound>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async getOutboundRecords(params: FabricOutboundFilters): Promise<{
    list: FabricOutboundListRow[];
    total: number;
    totalQuantity: number;
    totalAmount: number;
    unpricedCount: number;
    unpricedQuantity: number;
    page: number;
    pageSize: number;
  }> {
    const { page = 1, pageSize = 20 } = params;
    const base = applyFilters(
      this.outboundRepo
        .createQueryBuilder('o')
        .leftJoin(FabricStock, 's', 's.id = o.fabric_stock_id')
        .leftJoin(
          SystemOption,
          'currentInventoryType',
          "currentInventoryType.id = s.inventory_type_id AND currentInventoryType.option_type = 'inventory_types'",
        ),
      params,
    );
    const totals = await base
      .clone()
      .select('COALESCE(SUM(o.quantity), 0)', 'totalQuantity')
      .addSelect('COALESCE(SUM(CASE WHEN o.amount IS NOT NULL THEN o.amount ELSE 0 END), 0)', 'totalAmount')
      .addSelect('COALESCE(SUM(CASE WHEN o.unit_price IS NULL THEN 1 ELSE 0 END), 0)', 'unpricedCount')
      .addSelect('COALESCE(SUM(CASE WHEN o.unit_price IS NULL THEN o.quantity ELSE 0 END), 0)', 'unpricedQuantity')
      .getRawOne<{
        totalQuantity: string | number | null;
        totalAmount: string | number | null;
        unpricedCount: string | number | null;
        unpricedQuantity: string | number | null;
      }>();
    const total = await base.clone().getCount();
    const rows = await base
      .select([
        'o.id AS id',
        'o.fabric_stock_id AS fabricStockId',
        "COALESCE(NULLIF(o.name_snapshot, ''), NULLIF(s.name, ''), '历史未记录') AS name",
        "COALESCE(o.customer_name_snapshot, s.customer_name, '') AS customerName",
        "COALESCE(NULLIF(o.unit_snapshot, ''), NULLIF(s.unit, ''), '') AS unit",
        'COALESCE(o.inventory_type_id, s.inventory_type_id) AS inventoryTypeId',
        "COALESCE(NULLIF(o.inventory_type_label, ''), NULLIF(currentInventoryType.value, ''), CASE WHEN s.inventory_type_id IS NOT NULL THEN '库存类型已失效' ELSE '历史未记录' END) AS inventoryTypeLabel",
        "CASE WHEN NULLIF(o.name_snapshot, '') IS NULL AND NULLIF(s.name, '') IS NOT NULL THEN 1 ELSE 0 END AS nameFromCurrentStock",
        "CASE WHEN o.customer_name_snapshot IS NULL AND NULLIF(s.customer_name, '') IS NOT NULL THEN 1 ELSE 0 END AS customerNameFromCurrentStock",
        "CASE WHEN NULLIF(o.unit_snapshot, '') IS NULL AND NULLIF(s.unit, '') IS NOT NULL THEN 1 ELSE 0 END AS unitFromCurrentStock",
        "CASE WHEN NULLIF(o.inventory_type_label, '') IS NULL AND s.inventory_type_id IS NOT NULL THEN 1 ELSE 0 END AS inventoryTypeFromCurrentStock",
        'o.quantity AS quantity',
        'o.unit_price AS unitPrice',
        'o.amount AS amount',
        'o.photo_url AS photoUrl',
        'o.remark AS remark',
        'o.pickup_user_id AS pickupUserId',
        'o.created_at AS createdAt',
      ])
      .orderBy('o.created_at', 'DESC')
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<Omit<FabricOutboundListRow, 'pickupUserName' | 'createdAt'> & { createdAt: Date }>();

    const pickupIds = Array.from(new Set(rows.map((row) => Number(row.pickupUserId)).filter((id) => Number.isInteger(id) && id > 0)));
    const users = pickupIds.length ? await this.userRepo.find({ where: { id: In(pickupIds) } }) : [];
    const pickupMap = new Map(users.map((user) => [
      user.id,
      String(user.displayName ?? '').trim() || String(user.username ?? '').trim(),
    ]));
    const list = rows.map((row) => {
      const pickupUserId = Number(row.pickupUserId) > 0 ? Number(row.pickupUserId) : null;
      return {
        ...row,
        inventoryTypeId: Number(row.inventoryTypeId) > 0 ? Number(row.inventoryTypeId) : null,
        unitPrice: row.unitPrice == null ? null : String(row.unitPrice),
        amount: row.amount == null ? null : String(row.amount),
        pickupUserId,
        pickupUserName: pickupUserId == null ? '' : pickupMap.get(pickupUserId) ?? '',
        nameFromCurrentStock: Number(row.nameFromCurrentStock) === 1,
        customerNameFromCurrentStock: Number(row.customerNameFromCurrentStock) === 1,
        unitFromCurrentStock: Number(row.unitFromCurrentStock) === 1,
        inventoryTypeFromCurrentStock: Number(row.inventoryTypeFromCurrentStock) === 1,
        createdAt: formatDateTimeForResponse(row.createdAt),
      };
    });
    return {
      list,
      total,
      totalQuantity: Number(totals?.totalQuantity ?? 0) || 0,
      totalAmount: Number(totals?.totalAmount ?? 0) || 0,
      unpricedCount: Number(totals?.unpricedCount ?? 0) || 0,
      unpricedQuantity: Number(totals?.unpricedQuantity ?? 0) || 0,
      page,
      pageSize,
    };
  }
}
