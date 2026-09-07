require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { judgePatternCustomerDueDate: judge } = require('../dist/production-pattern/pattern-time-rating');
const { ProductionPatternService } = require('../dist/production-pattern/production-pattern.service');
const { ProductionPatternController } = require('../dist/production-pattern/production-pattern.controller');

for (const [name, due, end, completed, now, expected] of [
  ['截图 20263426：提前一天完成', '2026-09-03', '2026-09-02 14:41:28', true, '2026-10-01T00:00:00Z', '未超期'],
  ['截图 20263425：提前一天完成', '2026-09-03', '2026-09-02 14:41:33', true, '2026-09-07T00:00:00Z', '未超期'],
  ['截图 20263424：提前两天完成', '2026-09-04', '2026-09-02 14:41:39', true, '2026-09-07T00:00:00Z', '未超期'],
  ['交期当天最后一秒', '2026-09-03', '2026-09-03 23:59:59', true, null, '未超期'],
  ['交期次日零点', '2026-09-03', '2026-09-04 00:00:00', true, null, '超期'],
  ['未完成且已过交期', '2026-09-03', null, false, '2026-09-03T16:00:00Z', '已超期'],
  ['未完成且今天是交期', '2026-09-03', null, false, '2026-09-03T15:59:59Z', '进行中'],
  ['未完成且尚未到交期', '2026-09-10', null, false, '2026-09-03T16:00:00Z', '进行中'],
  ['不采用未完成订单残留的完成日期', '2026-09-03', '2026-09-02', false, '2026-09-07T00:00:00Z', '已超期'],
  ['缺交期', null, '2026-09-02', true, null, '未填写交期'],
  ['非法交期', '2026-02-30', '2026-09-02', true, null, '未填写交期'],
  ['缺完成时间', '2026-09-03', null, true, null, '无法判定'],
  ['无效完成时间', '2026-09-03', 'invalid', true, null, '无法判定'],
  ['UTC 完成时间转为北京时间跨日', '2026-09-03', '2026-09-03T16:00:00Z', true, null, '超期'],
  ['北京时间带时区', '2026-09-03', '2026-09-03T23:59:59+08:00', true, null, '未超期'],
  ['跨年', '2026-12-31', '2027-01-01 00:00:00', true, null, '超期'],
  ['闰日', '2028-02-29', '2028-02-29 23:59:59', true, null, '未超期'],
]) {
  test(name, () => {
    const result = judge(due, end, completed, now ? new Date(now) : undefined);
    assert.equal(result.timeRating, expected);
    assert.ok(result.timeRatingReason);
  });
}

function createService() {
  const orders = [
    { id: 1, orderNo: '20263426', quantity: 1, customerDueDate: '2026-09-03', orderDate: '2026-08-29', status: 'completed' },
    { id: 2, orderNo: 'LATE', quantity: 2, customerDueDate: '2026-09-01', orderDate: '2026-08-29', status: 'completed' },
  ];
  const patterns = orders.map((order) => ({ orderId: order.id, status: 'completed', completedAt: '2026-09-02 14:41:28' }));
  const qb = {};
  for (const name of ['where', 'andWhere', 'orderBy', 'addOrderBy']) qb[name] = () => qb;
  qb.getMany = async () => orders;
  const service = new ProductionPatternService({ createQueryBuilder: () => qb }, { find: async () => patterns });
  service.getEnteredAtMap = async () => new Map([[1, '2026-08-31 10:01:21'], [2, '2026-08-31 10:01:21']]);
  return service;
}

test('真实列表组装链路：不依赖内部时限，分页、数量、分类、日期筛选和导出一致', async () => {
  const service = createService();
  const first = await service.getPatternList({ page: 1, pageSize: 1 });
  assert.equal(first.total, 2);
  assert.equal(first.totalQuantity, 3);
  assert.equal(first.list[0].timeRating, '未超期');
  const second = await service.getPatternList({ page: 2, pageSize: 1 });
  assert.equal(second.list[0].timeRating, '超期');
  assert.deepEqual(await service.getPatternTabCounts({}), { all: 2, pending_assign: 0, in_progress: 0, completed: 2 });
  assert.equal((await service.getPatternList({ tab: 'in_progress' })).total, 0);
  assert.equal((await service.getPatternList({ completedStart: '2026-09-03' })).total, 0);
  const exported = await service.getPatternExportRows({});
  assert.deepEqual(exported.map((row) => row.timeRating), ['未超期', '超期']);
});

test('CSV 导出包含到纸样时间、交期判定、依据，且状态显示中文', async () => {
  const controller = new ProductionPatternController(createService());
  let csv = '';
  const response = { setHeader() {}, send(text) { csv = text; } };
  await controller.exportItems(...Array(12).fill(undefined), response);
  assert.match(csv, /到纸样时间/);
  assert.match(csv, /客户交期判定/);
  assert.match(csv, /判定依据/);
  assert.match(csv, /2026-08-31 10:01:21/);
  assert.match(csv, /未超期/);
  assert.match(csv, /样品完成/);
});
