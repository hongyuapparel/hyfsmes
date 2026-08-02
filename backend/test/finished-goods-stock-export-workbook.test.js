const assert = require('node:assert/strict');
const test = require('node:test');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');

const {
  buildFinishedStockWorkbook,
} = require('../dist/finished-goods-stock/finished-goods-stock-export-workbook');
const {
  buildFinishedStockExportLines,
} = require('../dist/finished-goods-stock/finished-goods-stock-export.service');
const {
  resolveExportImagePath,
} = require('../dist/finished-goods-stock/finished-goods-stock-export-image');

const imageUrl = '/uploads/export-test.png';
const missingImageUrl = '/uploads/export-missing.png';
const imageId = 'ID_EXPORT_TEST';
const pngBuffer = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function makeLine(overrides) {
  return {
    stockId: 1,
    customerName: '测试客户',
    skuCode: 'SKU-001',
    colorName: '蓝色',
    sizeName: 'M',
    imageUrl,
    quantity: 2,
    unitPrice: 12.34,
    totalPrice: 24.68,
    inventoryType: '生产成品',
    warehouse: '成品仓',
    department: '业务部',
    location: 'A-01',
    createdAt: '2026-08-01 10:00:00',
    ...overrides,
  };
}

test('库存导出保持列顺序、合并图片并生成失败清单', async () => {
  const cellImage = { id: imageId, buffer: pngBuffer, widthPx: 1, heightPx: 1 };
  const prepared = {
    imageBySourceKey: new Map([[imageUrl, cellImage]]),
    failedImages: new Map([[missingImageUrl, missingImageUrl]]),
    cellImages: [cellImage],
  };
  const lines = [
    makeLine({ sizeName: 'M' }),
    makeLine({ stockId: 2, sizeName: 'L', quantity: 3, totalPrice: 37.02 }),
    makeLine({
      stockId: 3,
      skuCode: 'SKU-002',
      colorName: '红色',
      sizeName: 'S',
      imageUrl: missingImageUrl,
      quantity: 1,
      totalPrice: 12.34,
    }),
  ];

  const result = await buildFinishedStockWorkbook(lines, prepared);
  assert.equal(result.rowCount, 3);
  assert.equal(result.failedImageCount, 1);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(result.buffer);
  const detail = workbook.getWorksheet('成品库存明细');
  assert.ok(detail);
  assert.deepEqual(detail.getRow(1).values.slice(1), [
    'SKU', '图片', '颜色', '尺码', '数量', '出厂价', '总价', '库存类型', '仓库', '部门', '客户', '存放地址', '入库时间',
  ]);
  assert.equal(detail.getCell('J2').value, '业务部');
  assert.equal(detail.getCell('K2').value, '测试客户');
  assert.equal(detail.getCell('L2').value, 'A-01');
  assert.equal(detail.getCell('A3').master.address, 'A2');
  assert.equal(detail.getCell('B3').master.address, 'B2');
  assert.equal(detail.getCell('C3').master.address, 'C2');
  assert.match(detail.getCell('B2').value.formula, /DISPIMG/);
  assert.equal(detail.getCell('B4').value, '图片加载失败');
  assert.equal(detail.getCell('E2').numFmt, '#,##0');
  assert.equal(detail.getCell('F2').numFmt, '¥#,##0.00');
  assert.equal(detail.getCell('G2').numFmt, '¥#,##0.00');
  assert.equal(detail.getCell('A5').value, '合计');
  assert.equal(detail.getCell('E5').value, 6);
  assert.equal(detail.getCell('G5').value, 74.04);

  const failures = workbook.getWorksheet('图片加载失败');
  assert.ok(failures);
  assert.deepEqual(failures.getRow(1).values.slice(1), ['SKU', '颜色', '图片地址', '失败原因']);
  assert.equal(failures.getCell('A2').value, 'SKU-002');
  assert.equal(failures.getCell('B2').value, '红色');
  assert.equal(failures.getCell('C2').value, missingImageUrl);

  const zip = await JSZip.loadAsync(result.buffer);
  assert.ok(zip.file('xl/cellimages.xml'));
  assert.ok(zip.file('xl/_rels/cellimages.xml.rels'));
  assert.ok(zip.file('xl/media/cellimage1.png'));
  const cellImagesXml = await zip.file('xl/cellimages.xml').async('string');
  assert.match(cellImagesXml, new RegExp(imageId));
});

test('父行选中导出全部颜色，子行选中只导出指定颜色', () => {
  const stock = {
    id: 10,
    customerName: '客户A',
    skuCode: 'SKU-010',
    quantity: 10,
    unitPrice: '8.5',
    inventoryTypeId: 1,
    warehouseId: 2,
    department: '部门A',
    location: 'B-01',
    imageUrl: '/uploads/product.png',
    productImageUrl: '/uploads/product-fallback.png',
    createdAt: '2026-08-01 11:00:00',
    type: 'stored',
    sizeBreakdown: {
      headers: ['S', 'M', '合计'],
      rows: [
        { colorName: '蓝色', values: [2, 3, 5] },
        { colorName: '红色', values: [1, 4, 5] },
      ],
    },
    colorImages: [
      { colorName: '蓝色', imageUrl: '/uploads/blue.png' },
      { colorName: '红色', imageUrl: '/uploads/red.png' },
    ],
  };
  const inventoryTypes = new Map([[1, '生产成品']]);
  const warehouses = new Map([[2, '成品仓']]);

  const parentLines = buildFinishedStockExportLines(
    [stock],
    [{ id: 10, colorName: '' }],
    inventoryTypes,
    warehouses,
  );
  assert.equal(parentLines.length, 4);
  assert.deepEqual(new Set(parentLines.map((line) => line.colorName)), new Set(['蓝色', '红色']));
  assert.equal(parentLines.reduce((sum, line) => sum + line.quantity, 0), 10);

  const childLines = buildFinishedStockExportLines(
    [stock],
    [{ id: 10, colorName: '蓝色' }],
    inventoryTypes,
    warehouses,
  );
  assert.equal(childLines.length, 2);
  assert.ok(childLines.every((line) => line.colorName === '蓝色'));
  assert.ok(childLines.every((line) => line.imageUrl === '/uploads/blue.png'));
  assert.equal(childLines.reduce((sum, line) => sum + line.quantity, 0), 5);
});

test('export image paths allow safe upload subdirectories and reject traversal', () => {
  const root = 'C:\\erp\\backend\\uploads';
  const nested = resolveExportImagePath('/api/uploads/migration-old/example.jpg', root);
  assert.deepEqual(nested, {
    originalPath: 'C:\\erp\\backend\\uploads\\migration-old\\example.jpg',
    thumbnailPath: 'C:\\erp\\backend\\uploads\\migration-old\\small_example.jpg',
  });

  assert.equal(resolveExportImagePath('/api/uploads/../secrets.txt', root), null);
  assert.equal(resolveExportImagePath('/api/uploads/%2e%2e/secrets.txt', root), null);
  assert.equal(resolveExportImagePath('/api/uploads/C:%5Csecrets.txt', root), null);
});
