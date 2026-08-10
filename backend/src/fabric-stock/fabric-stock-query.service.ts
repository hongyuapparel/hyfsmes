import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { InventoryStockExportMode } from '../common/inventory-stock-export.dto';
import { FabricStock } from '../entities/fabric-stock.entity';
import { Supplier } from '../entities/supplier.entity';
import { SystemOption } from '../entities/system-option.entity';
import { SystemOptionsService } from '../system-options/system-options.service';
import { applyFabricStockListFilters, type FabricStockListFilters } from './fabric-stock-list-query';
import { calculateFabricAmount } from './fabric-stock-valuation';

export type FabricStockListRow = FabricStock & {
  supplierName: string;
  warehouseLabel: string;
  inventoryTypeLabel: string;
  amount: string | null;
};

@Injectable()
export class FabricStockQueryService {
  constructor(
    @InjectRepository(FabricStock) private readonly stockRepo: Repository<FabricStock>,
    @InjectRepository(Supplier) private readonly supplierRepo: Repository<Supplier>,
    private readonly systemOptionsService: SystemOptionsService,
  ) {}

  private buildWarehouseIdToLabelMap(options: SystemOption[]): Map<number, string> {
    const byId = new Map(options.map((option) => [option.id, option]));
    const labels = new Map<number, string>();
    for (const option of options) {
      const path: string[] = [];
      let current: SystemOption | undefined = option;
      while (current) {
        path.unshift(current.value);
        current = current.parentId != null ? byId.get(current.parentId) : undefined;
      }
      labels.set(option.id, path.join(' > '));
    }
    return labels;
  }

  async decorate(items: FabricStock[]): Promise<FabricStockListRow[]> {
    if (!items.length) return [];
    const supplierIds = Array.from(new Set(items.map((item) => item.supplierId).filter((id): id is number => id != null && id > 0)));
    const [warehouseOptions, inventoryTypeOptions, suppliers] = await Promise.all([
      this.systemOptionsService.findAllByType('warehouses'),
      this.systemOptionsService.findAllByType('inventory_types'),
      supplierIds.length ? this.supplierRepo.find({ where: { id: In(supplierIds) } }) : Promise.resolve([]),
    ]);
    const warehouseLabels = this.buildWarehouseIdToLabelMap(warehouseOptions);
    const warehouseIds = new Set(warehouseOptions.map((option) => option.id));
    const inventoryTypeLabels = new Map(inventoryTypeOptions.map((option) => [option.id, option.value]));
    const supplierNames = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));
    return items.map((item) => ({
      ...item,
      supplierName: item.supplierId != null ? supplierNames.get(item.supplierId) ?? '' : '',
      warehouseLabel: item.warehouseId != null && warehouseIds.has(item.warehouseId) ? warehouseLabels.get(item.warehouseId) ?? '' : '',
      inventoryTypeLabel: item.inventoryTypeId != null ? inventoryTypeLabels.get(item.inventoryTypeId) ?? '' : '',
      amount: calculateFabricAmount(item.quantity, item.unitPrice),
    }));
  }

  async getList(params: FabricStockListFilters & { skipTotal?: boolean; sortField?: string; sortOrder?: string; page?: number; pageSize?: number }) {
    const { skipTotal = false, sortField, sortOrder, page = 1, pageSize = 20 } = params;
    const qb = applyFabricStockListFilters(this.stockRepo.createQueryBuilder('s'), params);
    const totals = skipTotal ? null : await qb.clone()
      .select('COALESCE(SUM(s.quantity), 0)', 'totalQuantity')
      .addSelect('COALESCE(SUM(CASE WHEN s.unit_price IS NOT NULL THEN s.quantity * s.unit_price ELSE 0 END), 0)', 'totalAmount')
      .addSelect('COALESCE(SUM(CASE WHEN s.unit_price IS NULL THEN 1 ELSE 0 END), 0)', 'unpricedCount')
      .addSelect('COALESCE(SUM(CASE WHEN s.unit_price IS NULL THEN s.quantity ELSE 0 END), 0)', 'unpricedQuantity')
      .getRawOne<Record<'totalQuantity' | 'totalAmount' | 'unpricedCount' | 'unpricedQuantity', string | number | null>>();
    this.applySort(qb, sortField, sortOrder);
    const total = skipTotal ? 0 : await qb.getCount();
    const items = await qb.skip((page - 1) * pageSize).take(pageSize).getMany();
    return {
      list: await this.decorate(items),
      total,
      totalQuantity: Number(totals?.totalQuantity ?? 0) || 0,
      totalAmount: Number(totals?.totalAmount ?? 0) || 0,
      unpricedCount: Number(totals?.unpricedCount ?? 0) || 0,
      unpricedQuantity: Number(totals?.unpricedQuantity ?? 0) || 0,
      page,
      pageSize,
    };
  }

  async getRowsForExport(params: FabricStockListFilters & {
    mode: InventoryStockExportMode;
    selectedIds?: number[];
    sortField?: 'quantity' | 'unitPrice' | 'amount';
    sortOrder?: 'asc' | 'desc';
  }): Promise<FabricStockListRow[]> {
    const selectedIds = Array.from(new Set(params.selectedIds ?? []));
    const qb = this.stockRepo.createQueryBuilder('s');
    if (params.mode === InventoryStockExportMode.Selected) qb.andWhere('s.id IN (:...selectedIds)', { selectedIds });
    else applyFabricStockListFilters(qb, params);
    this.applySort(qb, params.sortField, params.sortOrder);
    return this.decorate(await qb.getMany());
  }

  async getOne(id: number): Promise<FabricStockListRow> {
    const item = await this.stockRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('面料记录不存在');
    const [row] = await this.decorate([item]);
    return row;
  }

  private applySort(qb: ReturnType<Repository<FabricStock>['createQueryBuilder']>, sortField?: string, sortOrder?: string): void {
    if (['quantity', 'unitPrice', 'amount'].includes(sortField ?? '') && (sortOrder === 'asc' || sortOrder === 'desc')) {
      const field = sortField === 'amount' ? 's.quantity * s.unit_price' : sortField === 'unitPrice' ? 's.unit_price' : 's.quantity';
      qb.orderBy(field, sortOrder === 'asc' ? 'ASC' : 'DESC').addOrderBy('s.created_at', 'DESC').addOrderBy('s.id', 'DESC');
      return;
    }
    qb.orderBy('s.created_at', 'DESC').addOrderBy('s.id', 'DESC');
  }
}
