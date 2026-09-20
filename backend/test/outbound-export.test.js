const assert = require('node:assert/strict');
const test = require('node:test');
const ExcelJS = require('exceljs');
const JSZip = require('jszip');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const { OutboundExportDto } = require('../dist/common/outbound-export.dto');
const { collectOutboundExportRows, buildOutboundWorkbook } = require('../dist/common/outbound-export-workbook');
const { outboundColumns, fabricOutboundLine, pendingOutboundLine } = require('../dist/common/outbound-export-rows');

test('导出参数拒绝空选择、重复行、错误类型和额外字段', () => {
  for (const payload of [
    { mode: 'selected' }, { mode: 'selected', selectedKeys: [] },
    { mode: 'selected', selectedKeys: ['3:0', '3:0'] },
    { mode: 'selected', selectedKeys: [3] }, { mode: 'selected', selectedKeys: ['0'] },
    { mode: 'filtered', pageSize: 100000 }, { mode: 'filtered', inventoryTypeId: -1 },
  ]) assert.ok(validateSync(plainToInstance(OutboundExportDto, payload), { whitelist: true, forbidNonWhitelisted: true }).length);
  assert.equal(validateSync(plainToInstance(OutboundExportDto, { mode: 'selected', selectedKeys: ['3:0', '3:1'] })).length, 0);
});

test('同一出库编号多颜色，只导出勾选的颜色行；不把当前筛选带入所选导出', async () => {
  const rows = [{ id: 3, exportKey: '3:0' }, { id: 3, exportKey: '3:1' }];
  const result = await collectOutboundExportRows({ mode: 'selected', selectedKeys: ['3:1'], skuCode: 'other' }, async query => {
    assert.deepEqual(query, { ids: [3], page: 1, pageSize: 10001 });
    return { list: rows, total: 2 };
  });
  assert.deepEqual(result, [rows[1]]);
});

test('筛选导出完整结果而不是当前一页', async () => {
  const rows = Array.from({ length: 25 }, (_, index) => ({ id: index + 1 }));
  const result = await collectOutboundExportRows({ mode: 'filtered', name: '布', startDate: '2026-09-01' }, async query => {
    assert.equal(query.name, '布'); assert.equal(query.startDate, '2026-09-01');
    assert.equal(query.page, 1); assert.equal(query.pageSize, 10001);
    return { list: rows, total: 25 };
  });
  assert.equal(result.length, 25);
});

test('失效选择、空结果、超限、非法日期和不安全编号不会生成误导性文件', async () => {
  const empty = async () => ({ list: [], total: 0 });
  await assert.rejects(collectOutboundExportRows({ mode: 'selected', selectedKeys: ['3'] }, empty), /刷新/);
  await assert.rejects(collectOutboundExportRows({ mode: 'filtered' }, empty), /没有可导出/);
  await assert.rejects(collectOutboundExportRows({ mode: 'filtered' }, async () => ({ list: [], total: 10001 })), /10000/);
  for (const filters of [{ startDate: '2026-02-30' }, { startDate: '2026-09-02', endDate: '2026-09-01' }]) {
    await assert.rejects(collectOutboundExportRows({ mode: 'filtered', ...filters }, empty), /日期/);
  }
  await assert.rejects(collectOutboundExportRows({ mode: 'selected', selectedKeys: ['99999999999999999999'] }, empty), /编号/);
});

test('待仓已发货缺少实际明细时不生成计划尺码；面料零价与未计价分开', () => {
  assert.equal(pendingOutboundLine({ id: 1, detailStatus: 'missing', colorSizeSnapshot: { headers: ['S'], rows: [{ colorName: '红', quantities: [99] }] } }).values.detail, '未留存完整明细');
  const row = { id: 2, quantity: '1.5', unitPrice: 0, amount: 0, nameFromCurrentStock: true };
  assert.equal(fabricOutboundLine(row).values.unitPrice, 0);
  assert.equal(fabricOutboundLine({ ...row, unitPrice: null }).values.unitPrice, '未计价');
  assert.match(fabricOutboundLine(row).values.sourceNote, /关联库存现有信息/);
});

test('实际 XLSX 保留嵌入图片、数值零、备注文本，并列出图片失败记录', async () => {
  const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const result = await buildOutboundWorkbook('面料出库记录', outboundColumns.fabric, [
    { key: '1', imageUrl: image, values: { name: '面料 A', quantity: 1.5, unitPrice: 0, amount: 0, remark: '=1+1' } },
    { key: '2', imageUrl: '/uploads/__not_found_outbound_test__.png', values: { name: '面料 B', quantity: 3, unitPrice: '未计价', amount: '未计价' } },
  ]);
  assert.equal(result.rowCount, 2); assert.equal(result.failedImageCount, 1);
  const book = new ExcelJS.Workbook(); await book.xlsx.load(result.buffer);
  const sheet = book.getWorksheet('面料出库记录');
  assert.equal(sheet.getCell('I2').value, 0); assert.equal(sheet.getCell('J2').value, 0);
  assert.equal(sheet.getCell('K2').value, '=1+1'); assert.equal(sheet.getCell('I3').value, '未计价');
  assert.match(sheet.getCell('C2').value.formula, /DISPIMG/);
  assert.equal(book.getWorksheet('图片加载失败').getCell('A2').value, '2');
  const zip = await JSZip.loadAsync(result.buffer);
  assert.ok(zip.file('xl/cellimages.xml'));
  assert.ok(Object.keys(zip.files).some(name => name.startsWith('xl/media/')));
});

test('成品查询生成稳定的颜色行键，并在导出时限制数据库读取规模', async () => {
  const { FinishedGoodsStockReportService } = require('../dist/finished-goods-stock/finished-goods-stock-report.service');
  let limit;
  const qb = { leftJoin() { return this; }, select() { return this; }, andWhere() { return this; },
    orderBy() { return this; }, addOrderBy() { return this; }, limit(value) { limit = value; return this; },
    async getRawMany() { return [{ id: 9, quantity: 3, finishedStockId: 2,
      sizeBreakdown: { headers: ['S'], rows: [{ colorName: '红', quantities: [1] }, { colorName: '蓝', quantities: [2] }] },
    }]; },
  };
  const repo = { createQueryBuilder: () => qb };
  const service = new FinishedGoodsStockReportService(repo, {}, { find: async () => [] }, { find: async () => [] });
  const result = await service.getOutboundRecords({ ids: [9], exportRowLimit: 10000, pageSize: 10001 });
  assert.equal(limit, 10001);
  assert.deepEqual(result.list.map(row => [row.exportKey, row.quantity]), [['9:0', 1], ['9:1', 2]]);
  qb.getRawMany = async () => [{ id: 9 }, { id: 10 }];
  await assert.rejects(service.getOutboundRecords({ exportRowLimit: 1 }), /超过1行/);
});
