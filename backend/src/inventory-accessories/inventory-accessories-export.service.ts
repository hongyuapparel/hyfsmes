import { BadRequestException, Injectable } from '@nestjs/common';
import { SystemOptionsService } from '../system-options/system-options.service';
import { formatDateTimeForResponse } from '../common/date-time.util';
import {
  buildMaterialStockWorkbook,
  type MaterialStockExportLine,
} from '../common/material-stock-export-workbook';
import { assertMaterialStockExportCapacity } from '../common/material-stock-export-capacity';
import { InventoryStockExportMode } from '../common/inventory-stock-export.dto';
import { prepareFinishedStockImages } from '../finished-goods-stock/finished-goods-stock-export-image';
import type { InventoryAccessory } from '../entities/inventory-accessory.entity';
import { InventoryAccessoriesService } from './inventory-accessories.service';

export type InventoryAccessoriesExportParams = {
  mode: InventoryStockExportMode;
  name?: string;
  category?: string;
  customerName?: string;
  salesperson?: string;
  startDate?: string;
  endDate?: string;
  selectedIds?: number[];
};

const text = (value: unknown) => String(value ?? '').trim() || '-';

export function buildAccessoryStockExportLines(
  items: InventoryAccessory[],
  warehouseLabels: Map<number, string>,
): MaterialStockExportLine[] {
  return items.flatMap((item) => {
    const base = {
      itemId: Number(item.id),
      name: text(item.name),
      imageUrl: item.imageUrls?.find((url) => !!String(url ?? '').trim()) || String(item.imageUrl ?? '').trim(),
      category: text(item.category),
      unit: text(item.unit),
      customerName: text(item.customerName),
      salesperson: text(item.salesperson),
      supplierName: '-',
      inventoryType: '-',
      warehouse: item.warehouseId != null ? warehouseLabels.get(item.warehouseId) ?? '-' : '-',
      location: text(item.location),
      remark: text(item.remark),
      createdAt: formatDateTimeForResponse(item.createdAt),
    };
    const headers = item.isSized && Array.isArray(item.sizeHeaders) ? item.sizeHeaders : [];
    if (headers.length === 0) {
      return [{ ...base, sizeName: '-', quantity: Number(item.quantity) || 0 }];
    }
    const quantities = Array.isArray(item.sizeQuantities) ? item.sizeQuantities : [];
    const sizedLines = headers
      .map((header, index) => ({ header: String(header ?? '').trim(), quantity: Number(quantities[index]) || 0 }))
      .filter((entry) => entry.header && entry.header !== '合计')
      .map((entry) => ({ ...base, sizeName: entry.header, quantity: entry.quantity }));
    return sizedLines.length > 0
      ? sizedLines
      : [{ ...base, sizeName: '-', quantity: Number(item.quantity) || 0 }];
  });
}

@Injectable()
export class InventoryAccessoriesExportService {
  constructor(
    private readonly stockService: InventoryAccessoriesService,
    private readonly systemOptionsService: SystemOptionsService,
  ) {}

  async exportWorkbook(params: InventoryAccessoriesExportParams) {
    const requestedIds = params.mode === InventoryStockExportMode.Selected && Array.isArray(params.selectedIds)
      ? params.selectedIds
      : [];
    const selectedIds = requestedIds
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);
    if (params.mode === InventoryStockExportMode.Selected && requestedIds.length === 0) {
      throw new BadRequestException('请选择要导出的辅料库存数据');
    }
    if (selectedIds.length !== requestedIds.length) {
      throw new BadRequestException('选中的辅料库存数据无效，请刷新页面后重试');
    }
    if (params.startDate && params.endDate && params.startDate > params.endDate) {
      throw new BadRequestException('创建时间的开始日期不能晚于结束日期');
    }
    const [items, warehouseOptions] = await Promise.all([
      this.stockService.getRowsForExport({ ...params, selectedIds }),
      this.systemOptionsService.findAllByType('warehouses'),
    ]);
    const warehouseLabels = new Map(warehouseOptions.map((option) => [option.id, option.value]));
    const lines = buildAccessoryStockExportLines(items, warehouseLabels);
    if (lines.length === 0) throw new BadRequestException('没有可导出的辅料库存数据');
    assertMaterialStockExportCapacity(lines, '辅料库存');
    const prepared = await prepareFinishedStockImages(lines.map((line) => line.imageUrl));
    return buildMaterialStockWorkbook('accessories', lines, prepared);
  }
}
