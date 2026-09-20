import { BadRequestException } from '@nestjs/common';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { prepareFinishedStockImages, getExportImageIdentity } from '../finished-goods-stock/finished-goods-stock-export-image';
import { createWpsCellImageFormula, embedWpsCellImages } from '../finished-goods-stock/finished-goods-stock-cell-image';
import { MATERIAL_STOCK_EXPORT_MAX_DETAIL_ROWS, MATERIAL_STOCK_EXPORT_MAX_UNIQUE_IMAGES } from './material-stock-export-capacity';
import type { OutboundExportDto } from './outbound-export.dto';

export type OutboundExportColumn = { header: string; key: string; width: number; money?: boolean };
export type OutboundExportLine = {
  key: string;
  imageUrl: string;
  values: Record<string, string | number | null>;
};
type Query = Omit<OutboundExportDto, 'mode' | 'selectedKeys'> & { ids?: number[]; page: number; pageSize: number };

export async function collectOutboundExportRows<Row extends { id: number; exportKey?: string }>(
  dto: OutboundExportDto,
  load: (query: Query) => Promise<{ list: Row[]; total: number }>,
): Promise<Row[]> {
  for (const date of [dto.startDate, dto.endDate]) {
    if (!date) continue;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('出库日期无效');
    }
  }
  if (dto.startDate && dto.endDate && dto.startDate > dto.endDate) throw new BadRequestException('开始日期不能晚于结束日期');
  const { mode, selectedKeys, ...filters } = dto;
  if (mode !== 'selected' && mode !== 'filtered') throw new BadRequestException('请选择导出范围');
  if (mode === 'selected' && (!selectedKeys?.length || selectedKeys.some(key => !/^[1-9]\d*(?::\d+)?$/.test(key)))) {
    throw new BadRequestException('请选择有效的出库记录');
  }
  const ids = mode === 'selected' ? [...new Set(selectedKeys!.map(key => Number(key.split(':')[0])))] : undefined;
  if (ids?.some(id => !Number.isSafeInteger(id))) throw new BadRequestException('出库记录编号无效');
  const result = await load({ ...(mode === 'selected' ? { ids } : filters), page: 1, pageSize: MATERIAL_STOCK_EXPORT_MAX_DETAIL_ROWS + 1 });
  if (result.total > MATERIAL_STOCK_EXPORT_MAX_DETAIL_ROWS) throw new BadRequestException('出库记录超过10000行，请缩小筛选范围');
  const wanted = new Set(selectedKeys);
  const rows = mode === 'selected' ? result.list.filter(row => wanted.has(row.exportKey ?? String(row.id))) : result.list;
  if (mode === 'selected' && rows.length !== wanted.size) throw new BadRequestException('部分选中记录已变化或不可用，请刷新后重新选择');
  if (!rows.length) throw new BadRequestException('没有可导出的出库记录');
  return rows;
}

export async function buildOutboundWorkbook(title: string, columns: OutboundExportColumn[], lines: OutboundExportLine[]) {
  if (lines.length > MATERIAL_STOCK_EXPORT_MAX_DETAIL_ROWS) throw new BadRequestException('导出记录过多，请缩小范围');
  const urls = lines.map(line => line.imageUrl);
  if (new Set(urls.filter(Boolean).map(getExportImageIdentity)).size > MATERIAL_STOCK_EXPORT_MAX_UNIQUE_IMAGES) {
    throw new BadRequestException('导出图片超过750张，请缩小筛选范围');
  }
  if (lines.some(line => Object.values(line.values).some(value => typeof value === 'string' && value.length > 32767))) {
    throw new BadRequestException('记录文字超过Excel单元格限制，请缩小范围并检查超长备注');
  }
  const prepared = await prepareFinishedStockImages(urls);
  const book = new ExcelJS.Workbook();
  book.creator = '鸿宇服饰 ERP';
  const sheet = book.addWorksheet(title, { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = columns;
  const header = sheet.getRow(1);
  header.height = 28;
  header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF24549B' } };
  header.alignment = { horizontal: 'center', vertical: 'middle' };
  for (const line of lines) {
    const row = sheet.addRow(line.values);
    const image = prepared.imageBySourceKey.get(getExportImageIdentity(line.imageUrl));
    row.getCell('image').value = image ? createWpsCellImageFormula(image.id) : line.imageUrl ? '图片加载失败' : '无图片';
    row.height = Math.min(240, Math.max(64, ...Object.values(line.values).map(value => typeof value === 'string' ? value.split('\n').length * 16 : 0)));
    row.alignment = { vertical: 'middle', wrapText: true };
    columns.forEach(column => { if (column.money) row.getCell(column.key).numFmt = column.key === 'unitPrice' ? '¥#,##0.0000' : '¥#,##0.00'; });
  }
  sheet.autoFilter = { from: 'A1', to: { row: lines.length + 1, column: columns.length } };
  if (prepared.failedImages.size) {
    const failures = book.addWorksheet('图片加载失败');
    failures.columns = [{ header: '记录标识', key: 'key', width: 20 }, { header: '图片地址', key: 'url', width: 70 }];
    lines.forEach(line => { if (prepared.failedImages.has(getExportImageIdentity(line.imageUrl))) failures.addRow({ key: line.key, url: line.imageUrl }); });
  }
  const buffer = await embedWpsCellImages(Buffer.from(await book.xlsx.writeBuffer()), prepared.cellImages);
  return { buffer, rowCount: lines.length, failedImageCount: prepared.failedImages.size };
}

export function sendOutboundWorkbook(res: Response, result: { buffer: Buffer; rowCount: number; failedImageCount: number }) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="inventory-outbounds.xlsx"');
  res.setHeader('X-Export-Row-Count', String(result.rowCount));
  res.setHeader('X-Image-Failures', String(result.failedImageCount));
  res.send(result.buffer);
}
