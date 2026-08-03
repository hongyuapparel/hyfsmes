const assert = require('node:assert/strict');
const test = require('node:test');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');

const {
  buildMaterialStockWorkbook,
} = require('../dist/common/material-stock-export-workbook');
const {
  buildAccessoryStockExportLines,
} = require('../dist/inventory-accessories/inventory-accessories-export.service');
const {
  buildFabricStockExportLines,
} = require('../dist/fabric-stock/fabric-stock-export.service');
const { FabricStockExportDto } = require('../dist/fabric-stock/fabric-stock-export.dto');
const { FabricStockService } = require('../dist/fabric-stock/fabric-stock.service');
const { InventoryAccessoriesExportDto } = require('../dist/inventory-accessories/inventory-accessories-export.dto');
const {
  assertMaterialStockExportCapacity,
  MATERIAL_STOCK_EXPORT_MAX_UNIQUE_IMAGES,
} = require('../dist/common/material-stock-export-capacity');

const imageUrl = '/uploads/material-export.png';
const missingImageUrl = '/uploads/material-export-missing.png';
const imageId = 'ID_MATERIAL_EXPORT';
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function preparedImages({ missing = false } = {}) {
  const cellImage = { id: imageId, buffer: pngBuffer, widthPx: 1, heightPx: 1 };
  return {
    imageBySourceKey: new Map([[imageUrl, cellImage]]),
    failedImages: missing ? new Map([[missingImageUrl, missingImageUrl]]) : new Map(),
    cellImages: [cellImage],
  };
}

test('辅料导出按尺码展开，并合并同一库存的名称与嵌入图片', async () => {
  const items = [{
    id: 1,
    name: '品牌洗水唛',
    category: '洗水唛',
    quantity: 15,
    isSized: true,
    sizeHeaders: ['S', 'M'],
    sizeQuantities: [5, 10],
    unit: '个',
    warehouseId: 2,
    location: 'A-02',
    remark: '测试备注',
    imageUrl,
    imageUrls: [imageUrl],
    customerName: '客户A',
    salesperson: '业务员A',
    createdAt: new Date('2026-08-02T08:00:00+08:00'),
  }];
  const lines = buildAccessoryStockExportLines(items, new Map([[2, '辅料仓']]));
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((line) => [line.sizeName, line.quantity]), [['S', 5], ['M', 10]]);

  const result = await buildMaterialStockWorkbook('accessories', lines, preparedImages());
  assert.equal(result.rowCount, 2);
  assert.equal(result.failedImageCount, 0);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  const detail = workbook.getWorksheet('辅料库存明细');
  assert.ok(detail);
  assert.deepEqual(detail.getRow(1).values.slice(1), [
    '名称', '图片', '类别', '尺码', '数量', '单位', '客户', '业务员', '仓库', '存放地址', '备注', '创建时间',
  ]);
  assert.equal(detail.getCell('A3').master.address, 'A2');
  assert.equal(detail.getCell('B3').master.address, 'B2');
  assert.equal(detail.getCell('D2').value, 'S');
  assert.equal(detail.getCell('D3').value, 'M');
  assert.match(detail.getCell('B2').value.formula, /DISPIMG/);
  assert.equal(detail.getCell('A4').value, '合计');
  assert.equal(detail.getCell('E4').value, 15);

  const zip = await JSZip.loadAsync(result.buffer);
  assert.ok(zip.file('xl/cellimages.xml'));
  assert.ok(zip.file('xl/media/cellimage1.png'));
});

test('辅料尺码配置仅有合计时仍保留库存汇总行', () => {
  const items = [{
    id: 3,
    name: '备用纽扣',
    category: '纽扣',
    quantity: 8,
    isSized: true,
    sizeHeaders: ['合计'],
    sizeQuantities: [8],
  }];

  const lines = buildAccessoryStockExportLines(items, new Map());

  assert.equal(lines.length, 1);
  assert.equal(lines[0].sizeName, '-');
  assert.equal(lines[0].quantity, 8);
});

test('面料导出保持系统字段顺序，并生成图片失败清单', async () => {
  const items = [{
    id: 2,
    name: '全棉斜纹',
    quantity: '12.50',
    unit: '米',
    customerName: '客户B',
    supplierName: '供应商B',
    inventoryTypeLabel: '大货余料',
    warehouseLabel: '面料仓',
    storageLocation: 'B-03',
    remark: '留样',
    imageUrl: missingImageUrl,
    createdAt: new Date('2026-08-02T09:00:00+08:00'),
  }];
  const lines = buildFabricStockExportLines(items);
  const prepared = preparedImages({ missing: true });
  const result = await buildMaterialStockWorkbook('fabric', lines, prepared);
  assert.equal(result.rowCount, 1);
  assert.equal(result.failedImageCount, 1);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  const detail = workbook.getWorksheet('面料库存明细');
  assert.ok(detail);
  assert.deepEqual(detail.getRow(1).values.slice(1), [
    '面料名称', '图片', '数量', '单位', '客户', '供应商', '库存类型', '仓库', '存放地址', '备注', '创建时间',
  ]);
  assert.equal(detail.getCell('B2').value, '图片加载失败');
  assert.equal(detail.getCell('C2').value, 12.5);
  assert.equal(detail.getCell('A3').value, '合计');
  assert.equal(detail.getCell('C3').value, 12.5);

  const failures = workbook.getWorksheet('图片加载失败');
  assert.ok(failures);
  assert.deepEqual(failures.getRow(1).values.slice(1), ['名称', '图片地址', '失败原因']);
  assert.equal(failures.getCell('A2').value, '全棉斜纹');
  assert.equal(failures.getCell('B2').value, missingImageUrl);
});

test('物料库存导出保持服务端查询顺序', async () => {
  const base = {
    imageUrl: '', category: '-', sizeName: '-', quantity: 1, unit: '件', customerName: '-',
    salesperson: '-', supplierName: '-', inventoryType: '-', warehouse: '-', location: '-',
    remark: '-', createdAt: '2026-08-03 10:00:00',
  };
  const result = await buildMaterialStockWorkbook('fabric', [
    { ...base, itemId: 2, name: 'Z面料' },
    { ...base, itemId: 1, name: 'A面料' },
  ], { imageBySourceKey: new Map(), failedImages: new Map(), cellImages: [] });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  const detail = workbook.getWorksheet('面料库存明细');
  assert.equal(detail.getCell('A2').value, 'Z面料');
  assert.equal(detail.getCell('A3').value, 'A面料');
});

test('面料导出查询继承页面数量排序', async () => {
  const orderCalls = [];
  const queryBuilder = {
    andWhere() { return this; },
    orderBy(field, direction) { orderCalls.push(['orderBy', field, direction]); return this; },
    addOrderBy(field, direction) { orderCalls.push(['addOrderBy', field, direction]); return this; },
    async getMany() { return []; },
  };
  const service = new FabricStockService(
    { createQueryBuilder: () => queryBuilder },
    null,
    null,
    null,
    null,
    null,
  );

  await service.getRowsForExport({ mode: 'filtered', sortField: 'quantity', sortOrder: 'asc' });

  assert.deepEqual(orderCalls, [
    ['orderBy', 's.quantity', 'ASC'],
    ['addOrderBy', 's.created_at', 'DESC'],
    ['addOrderBy', 's.id', 'DESC'],
  ]);
});

test('selected 与 filtered 导出模式执行严格 DTO 校验', () => {
  const validFiltered = plainToInstance(FabricStockExportDto, { mode: 'filtered' });
  assert.equal(validateSync(validFiltered).length, 0);

  const emptySelected = plainToInstance(FabricStockExportDto, { mode: 'selected', selectedIds: [] });
  assert.ok(validateSync(emptySelected).length > 0);

  const malformedSelected = plainToInstance(InventoryAccessoriesExportDto, {
    mode: 'selected',
    selectedIds: '1',
  });
  assert.ok(validateSync(malformedSelected).length > 0);

  const validSelected = plainToInstance(InventoryAccessoriesExportDto, {
    mode: 'selected',
    selectedIds: [1, 2],
  });
  assert.equal(validateSync(validSelected).length, 0);
});

test('物料库存导出拒绝超过容量上限的唯一图片', () => {
  const lines = Array.from({ length: MATERIAL_STOCK_EXPORT_MAX_UNIQUE_IMAGES + 1 }, (_, index) => ({
    itemId: index + 1,
    name: `物料${index + 1}`,
    imageUrl: `/uploads/export-${index + 1}.png`,
  }));
  assert.throws(
    () => assertMaterialStockExportCapacity(lines, '测试库存'),
    /导出图片超过/,
  );
});
