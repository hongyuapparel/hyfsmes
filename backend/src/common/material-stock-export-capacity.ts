import { BadRequestException } from '@nestjs/common';
import { getExportImageIdentity } from '../finished-goods-stock/finished-goods-stock-export-image';
import type { MaterialStockExportLine } from './material-stock-export-workbook';

export const MATERIAL_STOCK_EXPORT_MAX_DETAIL_ROWS = 10_000;
export const MATERIAL_STOCK_EXPORT_MAX_UNIQUE_IMAGES = 750;

export function assertMaterialStockExportCapacity(
  lines: MaterialStockExportLine[],
  inventoryLabel: string,
): void {
  if (lines.length > MATERIAL_STOCK_EXPORT_MAX_DETAIL_ROWS) {
    throw new BadRequestException(
      `${inventoryLabel}导出明细超过 ${MATERIAL_STOCK_EXPORT_MAX_DETAIL_ROWS} 行，请缩小筛选范围后重试`,
    );
  }

  const uniqueImages = new Set(
    lines
      .map((line) => getExportImageIdentity(line.imageUrl))
      .filter(Boolean),
  );
  if (uniqueImages.size > MATERIAL_STOCK_EXPORT_MAX_UNIQUE_IMAGES) {
    throw new BadRequestException(
      `${inventoryLabel}导出图片超过 ${MATERIAL_STOCK_EXPORT_MAX_UNIQUE_IMAGES} 张，请缩小筛选范围后重试`,
    );
  }
}
