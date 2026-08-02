import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemOption } from '../entities/system-option.entity';
import type { FinishedStockRow } from './finished-goods-stock.types';
import { FinishedGoodsStockListQueryService } from './finished-goods-stock-list-query.service';
import { getExportImageIdentity, prepareFinishedStockImages } from './finished-goods-stock-export-image';
import { buildFinishedStockWorkbook } from './finished-goods-stock-export-workbook';

export type FinishedStockExportSelection = {
  id: number;
  colorName?: string;
};

export type FinishedStockExportParams = {
  skuCode?: string;
  customerName?: string;
  inventoryTypeId?: number | null;
  startDate?: string;
  endDate?: string;
  selections?: FinishedStockExportSelection[];
};

export type FinishedStockExportLine = {
  stockId: number;
  customerName: string;
  skuCode: string;
  colorName: string;
  sizeName: string;
  imageUrl: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  inventoryType: string;
  warehouse: string;
  department: string;
  location: string;
  createdAt: string;
};

type WorkbookExportResult = {
  buffer: Buffer;
  failedImageCount: number;
  rowCount: number;
};

const normalizeText = (value: unknown) => String(value ?? '').trim();
const normalizeKey = (value: unknown) => normalizeText(value).toLocaleLowerCase();
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function findColorImage(row: FinishedStockRow, colorName: string): string {
  const colorKey = normalizeKey(colorName);
  if (colorKey) {
    const match = row.colorImages?.find((item) => normalizeKey(item.colorName) === colorKey);
    if (match?.imageUrl) return normalizeText(match.imageUrl);
  }
  return normalizeText(row.imageUrl) || normalizeText(row.productImageUrl);
}

function buildSelectionMap(selections: FinishedStockExportSelection[]): Map<number, Set<string>> {
  const map = new Map<number, Set<string>>();
  selections.forEach((selection) => {
    const id = Number(selection?.id);
    if (!Number.isInteger(id) || id <= 0) return;
    let colors = map.get(id);
    if (!colors) {
      colors = new Set<string>();
      map.set(id, colors);
    }
    colors.add(normalizeKey(selection.colorName));
  });
  return map;
}

export function buildFinishedStockExportLines(
  stocks: FinishedStockRow[],
  selections: FinishedStockExportSelection[],
  inventoryTypeLabels: Map<number, string>,
  warehouseLabels: Map<number, string>,
): FinishedStockExportLine[] {
  const selectionMap = buildSelectionMap(selections);
  const selectedMode = selectionMap.size > 0;
  const lines: FinishedStockExportLine[] = [];

  stocks.forEach((stock) => {
    const stockQuantity = Math.max(0, Math.trunc(Number(stock.quantity) || 0));
    if (stockQuantity <= 0) return;
    const selectedColors = selectionMap.get(Number(stock.id));
    if (selectedMode && !selectedColors) return;
    const unitPrice = Number(stock.unitPrice) || 0;
    const inventoryType = stock.inventoryTypeId != null
      ? inventoryTypeLabels.get(Number(stock.inventoryTypeId)) ?? '-'
      : '-';
    const warehouse = stock.warehouseId != null
      ? warehouseLabels.get(Number(stock.warehouseId)) ?? '-'
      : '-';
    const base = {
      stockId: Number(stock.id),
      customerName: normalizeText(stock.customerName) || '-',
      skuCode: normalizeText(stock.skuCode) || '-',
      unitPrice,
      inventoryType,
      warehouse,
      department: normalizeText(stock.department) || '-',
      location: normalizeText(stock.location) || '-',
      createdAt: normalizeText(stock.createdAt) || '-',
    };
    const breakdown = stock.sizeBreakdown;
    const headers = Array.isArray(breakdown?.headers) ? breakdown!.headers.map(normalizeText) : [];
    const detailRows = Array.isArray(breakdown?.rows) ? breakdown!.rows : [];

    if (headers.length > 0 && detailRows.length > 0) {
      detailRows.forEach((detail) => {
        const colorName = normalizeText(detail.colorName) || '-';
        const colorKey = normalizeKey(detail.colorName);
        if (selectedMode && selectedColors && !selectedColors.has('') && !selectedColors.has(colorKey)) return;
        headers.forEach((sizeName, index) => {
          const quantity = Math.max(0, Math.trunc(Number(detail.values?.[index]) || 0));
          if (quantity <= 0 || normalizeKey(sizeName) === '合计') return;
          lines.push({
            ...base,
            colorName,
            sizeName: sizeName || '-',
            imageUrl: findColorImage(stock, detail.colorName),
            quantity,
            totalPrice: roundMoney(quantity * unitPrice),
          });
        });
      });
      return;
    }

    const selectedColor = selectedColors && !selectedColors.has('')
      ? Array.from(selectedColors)[0]
      : '';
    const colorName = selectedColor || '-';
    lines.push({
      ...base,
      colorName,
      sizeName: '-',
      imageUrl: findColorImage(stock, colorName),
      quantity: stockQuantity,
      totalPrice: roundMoney(stockQuantity * unitPrice),
    });
  });

  return lines.sort((a, b) => {
    const sku = a.skuCode.localeCompare(b.skuCode, 'zh-CN', { numeric: true, sensitivity: 'base' });
    if (sku !== 0) return sku;
    const color = a.colorName.localeCompare(b.colorName, 'zh-CN', { numeric: true, sensitivity: 'base' });
    if (color !== 0) return color;
    const image = getExportImageIdentity(a.imageUrl).localeCompare(getExportImageIdentity(b.imageUrl), 'zh-CN');
    if (image !== 0) return image;
    return a.stockId - b.stockId;
  });
}

@Injectable()
export class FinishedGoodsStockExportService {
  constructor(
    private readonly listQueryService: FinishedGoodsStockListQueryService,
    @InjectRepository(SystemOption)
    private readonly systemOptionRepo: Repository<SystemOption>,
  ) {}

  async exportWorkbook(params: FinishedStockExportParams): Promise<WorkbookExportResult> {
    const requestedSelections = Array.isArray(params.selections) ? params.selections : [];
    const selections = requestedSelections.filter((selection) => {
      const id = Number(selection?.id);
      return Number.isInteger(id) && id > 0;
    });
    if (requestedSelections.length > 0 && selections.length === 0) {
      throw new BadRequestException('选中的库存数据无效，请刷新页面后重试');
    }
    const selectedIds = selections.map((selection) => Number(selection?.id));
    const [stocks, options] = await Promise.all([
      this.listQueryService.getStoredRowsForExport({
        skuCode: params.skuCode,
        customerName: params.customerName,
        inventoryTypeId: params.inventoryTypeId,
        startDate: params.startDate,
        endDate: params.endDate,
        selectedIds,
      }),
      this.systemOptionRepo.find({
        where: [
          { optionType: 'inventory_types' },
          { optionType: 'warehouses' },
        ],
      }),
    ]);
    const inventoryTypeLabels = new Map(
      options
        .filter((option) => option.optionType === 'inventory_types')
        .map((option) => [option.id, option.value]),
    );
    const warehouseLabels = new Map(
      options
        .filter((option) => option.optionType === 'warehouses')
        .map((option) => [option.id, option.value]),
    );
    const lines = buildFinishedStockExportLines(stocks, selections, inventoryTypeLabels, warehouseLabels);
    if (lines.length === 0) throw new BadRequestException('没有可导出的库存数据');

    const preparedImages = await prepareFinishedStockImages(lines.map((line) => line.imageUrl));
    return buildFinishedStockWorkbook(lines, preparedImages);
  }
}
