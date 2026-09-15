import { BadRequestException } from '@nestjs/common';
import type { Repository } from 'typeorm';
import { InventoryAccessory } from '../entities/inventory-accessory.entity';
import { InventoryAccessoryOutbound } from '../entities/inventory-accessory-outbound.entity';
import { mapOutboundRawRow, type AccessoryOutboundRawRow } from './inventory-accessory.helpers';

function validateDates(start?: string, end?: string): void {
  for (const value of [start, end]) {
    if (!value) continue;
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException('出库日期必须是有效的 YYYY-MM-DD 日期');
    }
  }
  if (start && end && start > end) throw new BadRequestException('出库开始日期不能晚于结束日期');
}

export async function getAccessoryOutboundRecords(repo: Repository<InventoryAccessoryOutbound>, params: {
    accessoryId?: number;
    orderNo?: string;
    outboundType?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{
    list: Array<
      Omit<InventoryAccessoryOutbound, 'createdAt'> & {
        createdAt: string;
        accessoryName: string | null;
        imageUrl?: string;
        customerName?: string;
        category?: string;
      }
    >;
    total: number;
    page: number;
    pageSize: number;
  }> {
    const { accessoryId, orderNo, outboundType, startDate, endDate, page = 1, pageSize = 20 } = params;
    validateDates(startDate, endDate);
    const qb = repo
      .createQueryBuilder('r')
      .leftJoin(InventoryAccessory, 'a', 'a.id = r.accessory_id')
      .select([
        'r.id AS id',
        'r.accessory_id AS accessoryId',
        'a.name AS accessoryName',
        'r.order_id AS orderId',
        'r.order_no AS orderNo',
        'r.outbound_type AS outboundType',
        'r.quantity AS quantity',
        'r.before_quantity AS beforeQuantity',
        'r.after_quantity AS afterQuantity',
        'r.operator_username AS operatorUsername',
        'r.remark AS remark',
        'r.created_at AS createdAt',
        'r.size_outbound AS sizeOutbound',
        "COALESCE(a.image_url, '') AS imageUrl",
        "COALESCE(a.customer_name, '') AS customerName",
        "COALESCE(a.category, '') AS category",
      ]);
    if (accessoryId) qb.andWhere('r.accessory_id = :accessoryId', { accessoryId });
    if (orderNo?.trim()) qb.andWhere('r.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    if (outboundType?.trim()) qb.andWhere('r.outbound_type = :outboundType', { outboundType: outboundType.trim() });
    if (startDate) qb.andWhere('r.created_at >= :outboundStart', { outboundStart: `${startDate} 00:00:00` });
    if (endDate) qb.andWhere('r.created_at < DATE_ADD(:outboundEnd, INTERVAL 1 DAY)', { outboundEnd: `${endDate} 00:00:00` });
    qb.orderBy('r.created_at', 'DESC').addOrderBy('r.id', 'DESC');

    const total = await qb.getCount();
    const list = await qb
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<AccessoryOutboundRawRow>();
    const rows = list.map(mapOutboundRawRow);
    return { list: rows, total, page, pageSize };
  }
