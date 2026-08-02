import * as ExcelJS from 'exceljs';
import type { FinishedStockExportLine } from './finished-goods-stock-export.service';
import { createWpsCellImageFormula, embedWpsCellImages } from './finished-goods-stock-cell-image';
import {
  getExportImageIdentity,
  type PreparedFinishedStockImages,
} from './finished-goods-stock-export-image';

type DisplayGroup = {
  startIndex: number;
  endIndex: number;
  imageUrl: string;
  imageKey: string;
};

type FailedImageEntry = {
  imageUrl: string;
  skuCodes: Set<string>;
  colorNames: Set<string>;
};

const normalizeKey = (value: unknown) => String(value ?? '').trim().toLocaleLowerCase();
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

function getResolvedImageKey(line: FinishedStockExportLine, prepared: PreparedFinishedStockImages): string {
  const sourceKey = getExportImageIdentity(line.imageUrl);
  return prepared.imageBySourceKey.get(sourceKey)?.id || sourceKey || `__missing__:${normalizeKey(line.colorName)}`;
}

function orderLines(
  lines: FinishedStockExportLine[],
  prepared: PreparedFinishedStockImages,
): FinishedStockExportLine[] {
  return [...lines].sort((a, b) => {
    const sku = a.skuCode.localeCompare(b.skuCode, 'zh-CN', { numeric: true, sensitivity: 'base' });
    if (sku !== 0) return sku;
    const color = a.colorName.localeCompare(b.colorName, 'zh-CN', { numeric: true, sensitivity: 'base' });
    if (color !== 0) return color;
    const image = getResolvedImageKey(a, prepared).localeCompare(getResolvedImageKey(b, prepared), 'zh-CN');
    if (image !== 0) return image;
    return a.stockId - b.stockId;
  });
}

function buildDisplayGroups(
  lines: FinishedStockExportLine[],
  prepared: PreparedFinishedStockImages,
): DisplayGroup[] {
  const groups: Array<DisplayGroup & { key: string }> = [];
  lines.forEach((line, index) => {
    const imageKey = getResolvedImageKey(line, prepared);
    const key = `${normalizeKey(line.skuCode)}::${normalizeKey(line.colorName)}::${imageKey}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.endIndex = index;
    } else {
      groups.push({ startIndex: index, endIndex: index, imageUrl: line.imageUrl, imageKey, key });
    }
  });
  return groups.map(({ startIndex, endIndex, imageUrl, imageKey }) => ({ startIndex, endIndex, imageUrl, imageKey }));
}

function collectFailedImages(
  lines: FinishedStockExportLine[],
  prepared: PreparedFinishedStockImages,
): FailedImageEntry[] {
  const entries = new Map<string, FailedImageEntry>();
  lines.forEach((line) => {
    const sourceKey = getExportImageIdentity(line.imageUrl);
    const failedUrl = prepared.failedImages.get(sourceKey);
    if (!failedUrl) return;
    let entry = entries.get(sourceKey);
    if (!entry) {
      entry = { imageUrl: failedUrl, skuCodes: new Set<string>(), colorNames: new Set<string>() };
      entries.set(sourceKey, entry);
    }
    entry.skuCodes.add(line.skuCode);
    entry.colorNames.add(line.colorName);
  });
  return Array.from(entries.values());
}

function styleHeader(row: ExcelJS.Row) {
  row.height = 28;
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF24549B' } };
  row.alignment = { horizontal: 'center', vertical: 'middle' };
}

function applyBorders(worksheet: ExcelJS.Worksheet) {
  worksheet.eachRow((row) => {
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD9E1EC' } },
        left: { style: 'thin', color: { argb: 'FFD9E1EC' } },
        bottom: { style: 'thin', color: { argb: 'FFD9E1EC' } },
        right: { style: 'thin', color: { argb: 'FFD9E1EC' } },
      };
    });
  });
}

function addFailureWorksheet(workbook: ExcelJS.Workbook, failures: FailedImageEntry[]) {
  if (failures.length === 0) return;
  const worksheet = workbook.addWorksheet('图片加载失败', { views: [{ state: 'frozen', ySplit: 1 }] });
  worksheet.columns = [
    { header: 'SKU', key: 'skuCodes', width: 24 },
    { header: '颜色', key: 'colorNames', width: 24 },
    { header: '图片地址', key: 'imageUrl', width: 60 },
    { header: '失败原因', key: 'reason', width: 34 },
  ];
  worksheet.getColumn(1).numFmt = '@';
  styleHeader(worksheet.getRow(1));
  failures.forEach((failure) => {
    const row = worksheet.addRow({
      skuCodes: Array.from(failure.skuCodes).join('、'),
      colorNames: Array.from(failure.colorNames).join('、'),
      imageUrl: failure.imageUrl,
      reason: '服务器未找到图片，或图片格式无法解析',
    });
    row.height = 28;
    row.alignment = { vertical: 'middle', wrapText: true };
  });
  worksheet.autoFilter = { from: 'A1', to: `D${failures.length + 1}` };
  applyBorders(worksheet);
}

export async function buildFinishedStockWorkbook(
  sourceLines: FinishedStockExportLine[],
  prepared: PreparedFinishedStockImages,
): Promise<{ buffer: Buffer; failedImageCount: number; rowCount: number }> {
  const lines = orderLines(sourceLines, prepared);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '鸿宇服饰 ERP';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet('成品库存明细', {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  worksheet.columns = [
    { header: 'SKU', key: 'skuCode', width: 16 },
    { header: '图片', key: 'image', width: 15 },
    { header: '颜色', key: 'colorName', width: 15 },
    { header: '尺码', key: 'sizeName', width: 11 },
    { header: '数量', key: 'quantity', width: 11 },
    { header: '出厂价', key: 'unitPrice', width: 13 },
    { header: '总价', key: 'totalPrice', width: 15 },
    { header: '库存类型', key: 'inventoryType', width: 14 },
    { header: '仓库', key: 'warehouse', width: 18 },
    { header: '部门', key: 'department', width: 18 },
    { header: '客户', key: 'customerName', width: 18 },
    { header: '存放地址', key: 'location', width: 18 },
    { header: '入库时间', key: 'createdAt', width: 20 },
  ];
  worksheet.getColumn(1).numFmt = '@';
  styleHeader(worksheet.getRow(1));

  lines.forEach((line) => {
    const row = worksheet.addRow({ ...line, image: '' });
    row.height = 28;
    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    row.getCell(5).numFmt = '#,##0';
    row.getCell(6).numFmt = '¥#,##0.00';
    row.getCell(7).numFmt = '¥#,##0.00';
  });

  const detailEndRow = lines.length + 1;
  worksheet.autoFilter = { from: 'A1', to: `M${detailEndRow}` };
  buildDisplayGroups(lines, prepared).forEach((group) => {
    const startRow = group.startIndex + 2;
    const endRow = group.endIndex + 2;
    if (endRow > startRow) {
      worksheet.mergeCells(startRow, 1, endRow, 1);
      worksheet.mergeCells(startRow, 2, endRow, 2);
      worksheet.mergeCells(startRow, 3, endRow, 3);
    }
    const imageCell = worksheet.getCell(startRow, 2);
    imageCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    if (!group.imageUrl) {
      imageCell.value = '无图片';
      return;
    }
    const cellImage = prepared.imageBySourceKey.get(getExportImageIdentity(group.imageUrl));
    if (!cellImage) {
      imageCell.value = '图片加载失败';
      return;
    }
    if (startRow === endRow) worksheet.getRow(startRow).height = 64;
    imageCell.value = createWpsCellImageFormula(cellImage.id);
  });

  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const totalPrice = roundMoney(lines.reduce((sum, line) => sum + line.totalPrice, 0));
  const totalRow = worksheet.addRow({ skuCode: '合计', quantity: totalQuantity, totalPrice });
  totalRow.height = 28;
  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF0F8' } };
  totalRow.alignment = { horizontal: 'center', vertical: 'middle' };
  totalRow.getCell(5).numFmt = '#,##0';
  totalRow.getCell(7).numFmt = '¥#,##0.00';
  applyBorders(worksheet);

  const failedImages = collectFailedImages(lines, prepared);
  addFailureWorksheet(workbook, failedImages);
  const rawBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const buffer = await embedWpsCellImages(rawBuffer, prepared.cellImages);
  return { buffer, failedImageCount: failedImages.length, rowCount: lines.length };
}
