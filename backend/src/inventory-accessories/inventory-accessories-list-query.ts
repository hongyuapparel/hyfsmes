import type { SelectQueryBuilder } from 'typeorm';
import type { InventoryAccessory } from '../entities/inventory-accessory.entity';

export type InventoryAccessoryListFilters = {
  name?: string;
  category?: string;
  customerName?: string;
  salesperson?: string;
  startDate?: string;
  endDate?: string;
};

export function applyInventoryAccessoryListFilters(
  qb: SelectQueryBuilder<InventoryAccessory>,
  params: InventoryAccessoryListFilters,
): SelectQueryBuilder<InventoryAccessory> {
  const { name, category, customerName, salesperson, startDate, endDate } = params;
  if (name?.trim()) qb.andWhere('a.name LIKE :name', { name: `%${name.trim()}%` });
  if (category?.trim()) qb.andWhere('a.category = :category', { category: category.trim() });
  if (customerName?.trim()) {
    qb.andWhere('a.customer_name LIKE :customerName', { customerName: `%${customerName.trim()}%` });
  }
  if (salesperson?.trim()) {
    qb.andWhere('a.salesperson = :salesperson', { salesperson: salesperson.trim() });
  }
  if (startDate?.trim()) {
    qb.andWhere('a.created_at >= :createdStart', { createdStart: `${startDate.trim()} 00:00:00` });
  }
  if (endDate?.trim()) {
    qb.andWhere('a.created_at <= :createdEnd', { createdEnd: `${endDate.trim()} 23:59:59` });
  }
  return qb;
}
