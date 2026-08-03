import type { SelectQueryBuilder } from 'typeorm';
import type { FabricStock } from '../entities/fabric-stock.entity';

export type FabricStockListFilters = {
  name?: string;
  customerName?: string;
  startDate?: string;
  endDate?: string;
  inventoryTypeId?: number | null;
};

export function applyFabricStockListFilters(
  qb: SelectQueryBuilder<FabricStock>,
  params: FabricStockListFilters,
): SelectQueryBuilder<FabricStock> {
  const { name, customerName, startDate, endDate, inventoryTypeId } = params;
  if (name?.trim()) qb.andWhere('s.name LIKE :name', { name: `%${name.trim()}%` });
  if (customerName?.trim()) {
    qb.andWhere('s.customer_name LIKE :customerName', { customerName: `%${customerName.trim()}%` });
  }
  if (inventoryTypeId != null) {
    qb.andWhere('s.inventory_type_id = :inventoryTypeId', { inventoryTypeId });
  }
  if (startDate?.trim()) {
    qb.andWhere('s.created_at >= :createdStart', { createdStart: `${startDate.trim()} 00:00:00` });
  }
  if (endDate?.trim()) {
    qb.andWhere('s.created_at <= :createdEnd', { createdEnd: `${endDate.trim()} 23:59:59` });
  }
  return qb;
}
