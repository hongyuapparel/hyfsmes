import { BadRequestException, Injectable } from '@nestjs/common';
import { formatDateTimeForResponse } from '../common/date-time.util';
import {
  buildMaterialStockWorkbook,
  type MaterialStockExportLine,
} from '../common/material-stock-export-workbook';
import { assertMaterialStockExportCapacity } from '../common/material-stock-export-capacity';
import { InventoryStockExportMode } from '../common/inventory-stock-export.dto';
import { prepareFinishedStockImages } from '../finished-goods-stock/finished-goods-stock-export-image';
import type { FabricStockListRow } from './fabric-stock.service';
import { FabricStockService } from './fabric-stock.service';

export type FabricStockExportParams = {
  mode: InventoryStockExportMode;
  name?: string;
  customerName?: string;
  inventoryTypeId?: number | null;
  startDate?: string;
  endDate?: string;
  selectedIds?: number[];
  sortField?: 'quantity';
  sortOrder?: 'asc' | 'desc';
};

const text = (value: unknown) => String(value ?? '').trim() || '-';

export function buildFabricStockExportLines(items: FabricStockListRow[]): MaterialStockExportLine[] {
  return items.map((item) => ({
    itemId: Number(item.id),
    name: text(item.name),
    imageUrl: String(item.imageUrl ?? '').trim(),
    category: '-',
    sizeName: '-',
    quantity: Number(item.quantity) || 0,
    unit: text(item.unit),
    customerName: text(item.customerName),
    salesperson: '-',
    supplierName: text(item.supplierName),
    inventoryType: text(item.inventoryTypeLabel),
    warehouse: text(item.warehouseLabel),
    location: text(item.storageLocation),
    remark: text(item.remark),
    createdAt: formatDateTimeForResponse(item.createdAt),
  }));
}

@Injectable()
export class FabricStockExportService {
  constructor(private readonly stockService: FabricStockService) {}

  async exportWorkbook(params: FabricStockExportParams) {
    const requestedIds = params.mode === InventoryStockExportMode.Selected && Array.isArray(params.selectedIds)
      ? params.selectedIds
      : [];
    const selectedIds = requestedIds
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);
    if (params.mode === InventoryStockExportMode.Selected && requestedIds.length === 0) {
      throw new BadRequestException('请选择要导出的面料库存数据');
    }
    if (selectedIds.length !== requestedIds.length) {
      throw new BadRequestException('选中的面料库存数据无效，请刷新页面后重试');
    }
    if (params.startDate && params.endDate && params.startDate > params.endDate) {
      throw new BadRequestException('创建时间的开始日期不能晚于结束日期');
    }
    const items = await this.stockService.getRowsForExport({ ...params, selectedIds });
    const lines = buildFabricStockExportLines(items);
    if (lines.length === 0) throw new BadRequestException('没有可导出的面料库存数据');
    assertMaterialStockExportCapacity(lines, '面料库存');
    const prepared = await prepareFinishedStockImages(lines.map((line) => line.imageUrl));
    return buildMaterialStockWorkbook('fabric', lines, prepared);
  }
}
