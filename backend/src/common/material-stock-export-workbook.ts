import * as ExcelJS from 'exceljs';
import { createWpsCellImageFormula, embedWpsCellImages } from '../finished-goods-stock/finished-goods-stock-cell-image';
import {
  getExportImageIdentity,
  type PreparedFinishedStockImages,
} from '../finished-goods-stock/finished-goods-stock-export-image';

export type MaterialStockExportKind = 'accessories' | 'fabric';

export type MaterialStockExportLine = {
  itemId: number;
  name: string;
  imageUrl: string;
  category: string;
  sizeName: string;
  quantity: number;
  unit: string;
  customerName: string;
  salesperson: string;
  supplierName: string;
  inventoryType: string;
  warehouse: string;
  location: string;
  remark: string;
  createdAt: string;
};

type ExportColumn = {
  header: string;
  key: keyof MaterialStockExportLine | 'image';
  width: number;
};

type WorkbookSpec = {
  worksheetName: string;
  columns: ExportColumn[];
  quantityColumn: number;
  mergeColumns: number[];
};

type FailedImageEntry = {
  name: string;
  imageUrl: string;
};

const ACCESSORY_SPEC: WorkbookSpec = {
  worksheetName: '辅料库存明细',
  columns: [
    { header: '名称', key: 'name', width: 20 },
    { header: '图片', key: 'image', width: 15 },
    { header: '类别', key: 'category', width: 14 },
    { header: '尺码', key: 'sizeName', width: 12 },
    { header: '数量', key: 'quantity', width: 12 },
    { header: '单位', key: 'unit', width: 10 },
    { header: '客户', key: 'customerName', width: 20 },
    { header: '业务员', key: 'salesperson', width: 14 },
    { header: '仓库', key: 'warehouse', width: 18 },
    { header: '存放地址', key: 'location', width: 18 },
    { header: '备注', key: 'remark', width: 24 },
    { header: '创建时间', key: 'createdAt', width: 20 },
  ],
  quantityColumn: 5,
  mergeColumns: [1, 2, 3, 6, 7, 8, 9, 10, 11, 12],
};

const FABRIC_SPEC: WorkbookSpec = {
  worksheetName: '面料库存明细',
  columns: [
    { header: '面料名称', key: 'name', width: 22 },
    { header: '图片', key: 'image', width: 15 },
    { header: '数量', key: 'quantity', width: 12 },
    { header: '单位', key: 'unit', width: 10 },
    { header: '客户', key: 'customerName', width: 20 },
    { header: '供应商', key: 'supplierName', width: 20 },
    { header: '库存类型', key: 'inventoryType', width: 16 },
    { header: '仓库', key: 'warehouse', width: 18 },
    { header: '存放地址', key: 'location', width: 18 },
    { header: '备注', key: 'remark', width: 24 },
    { header: '创建时间', key: 'createdAt', width: 20 },
  ],
  quantityColumn: 3,
  mergeColumns: [],
};

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

function collectFailedImages(
  lines: MaterialStockExportLine[],
  prepared: PreparedFinishedStockImages,
): FailedImageEntry[] {
  const failures = new Map<string, FailedImageEntry>();
  lines.forEach((line) => {
    const sourceKey = getExportImageIdentity(line.imageUrl);
    const failedUrl = prepared.failedImages.get(sourceKey);
    if (failedUrl && !failures.has(sourceKey)) {
      failures.set(sourceKey, { name: line.name, imageUrl: failedUrl });
    }
  });
  return Array.from(failures.values());
}

function addFailureWorksheet(workbook: ExcelJS.Workbook, failures: FailedImageEntry[]) {
  if (failures.length === 0) return;
  const worksheet = workbook.addWorksheet('图片加载失败', { views: [{ state: 'frozen', ySplit: 1 }] });
  worksheet.columns = [
    { header: '名称', key: 'name', width: 24 },
    { header: '图片地址', key: 'imageUrl', width: 60 },
    { header: '失败原因', key: 'reason', width: 34 },
  ];
  styleHeader(worksheet.getRow(1));
  failures.forEach((failure) => {
    const row = worksheet.addRow({
      name: failure.name,
      imageUrl: failure.imageUrl,
      reason: '服务器未找到图片，或图片格式无法解析',
    });
    row.height = 28;
    row.alignment = { vertical: 'middle', wrapText: true };
  });
  worksheet.autoFilter = { from: 'A1', to: `C${failures.length + 1}` };
  applyBorders(worksheet);
}

function addLineRows(
  worksheet: ExcelJS.Worksheet,
  lines: MaterialStockExportLine[],
  spec: WorkbookSpec,
) {
  lines.forEach((line) => {
    const values: Record<string, string | number> = {};
    spec.columns.forEach((column) => {
      values[column.key] = column.key === 'image' ? '' : line[column.key];
    });
    const row = worksheet.addRow(values);
    row.height = 28;
    row.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    row.getCell(spec.quantityColumn).numFmt = '#,##0.##';
  });
}

function addImagesAndMerges(
  worksheet: ExcelJS.Worksheet,
  lines: MaterialStockExportLine[],
  spec: WorkbookSpec,
  prepared: PreparedFinishedStockImages,
) {
  let groupStart = 0;
  while (groupStart < lines.length) {
    let groupEnd = groupStart;
    while (
      groupEnd + 1 < lines.length
      && lines[groupEnd + 1].itemId === lines[groupStart].itemId
      && getExportImageIdentity(lines[groupEnd + 1].imageUrl) === getExportImageIdentity(lines[groupStart].imageUrl)
    ) {
      groupEnd += 1;
    }
    const startRow = groupStart + 2;
    const endRow = groupEnd + 2;
    if (endRow > startRow) {
      spec.mergeColumns.forEach((column) => worksheet.mergeCells(startRow, column, endRow, column));
    }
    const line = lines[groupStart];
    const imageCell = worksheet.getCell(startRow, 2);
    imageCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    if (!line.imageUrl) {
      imageCell.value = '无图片';
    } else {
      const cellImage = prepared.imageBySourceKey.get(getExportImageIdentity(line.imageUrl));
      imageCell.value = cellImage ? createWpsCellImageFormula(cellImage.id) : '图片加载失败';
      if (cellImage && startRow === endRow) worksheet.getRow(startRow).height = 64;
    }
    groupStart = groupEnd + 1;
  }
}

export async function buildMaterialStockWorkbook(
  kind: MaterialStockExportKind,
  sourceLines: MaterialStockExportLine[],
  prepared: PreparedFinishedStockImages,
): Promise<{ buffer: Buffer; failedImageCount: number; rowCount: number }> {
  const spec = kind === 'accessories' ? ACCESSORY_SPEC : FABRIC_SPEC;
  const lines = [...sourceLines];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '鸿宇服饰 ERP';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(spec.worksheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  worksheet.columns = spec.columns.map((column) => ({
    header: column.header,
    key: column.key,
    width: column.width,
  }));
  worksheet.getColumn(1).numFmt = '@';
  styleHeader(worksheet.getRow(1));
  addLineRows(worksheet, lines, spec);
  addImagesAndMerges(worksheet, lines, spec, prepared);
  worksheet.autoFilter = { from: 'A1', to: `${worksheet.getColumn(spec.columns.length).letter}${lines.length + 1}` };

  const totalQuantity = lines.reduce((sum, line) => sum + line.quantity, 0);
  const totalRow = worksheet.addRow({ name: '合计', quantity: totalQuantity });
  totalRow.height = 28;
  totalRow.font = { bold: true };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF0F8' } };
  totalRow.alignment = { horizontal: 'center', vertical: 'middle' };
  totalRow.getCell(spec.quantityColumn).numFmt = '#,##0.##';
  applyBorders(worksheet);

  const failedImages = collectFailedImages(lines, prepared);
  addFailureWorksheet(workbook, failedImages);
  const rawBuffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const buffer = await embedWpsCellImages(rawBuffer, prepared.cellImages);
  return { buffer, failedImageCount: failedImages.length, rowCount: lines.length };
}
