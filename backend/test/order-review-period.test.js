require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { OrderStatusReportService } = require('../dist/order-status-config/order-status-report.service');
const { OrderMutationService } = require('../dist/orders/order-mutation.service');
const date = (day, hour = 0) => new Date(Date.UTC(2026, 8, day, hour));

async function report(events, status, overrides = {}, logs = []) {
  const service = Object.create(OrderStatusReportService.prototype);
  const history = events.map(([code, day, hour], id) => ({ id, orderId: 1, status: { code }, enteredAt: date(day, hour) }));
  const order = { id: 1, status, createdAt: date(1), statusTime: history.at(-1)?.enteredAt, ...overrides };
  const empty = { find: async () => [] };
  for (const key of ['transitionRepo', 'orderCostSnapshotRepo', 'orderCuttingRepo', 'orderSewingRepo', 'orderFinishingRepo', 'orderCraftRepo', 'orderPatternRepo', 'orderExtRepo']) service[key] = empty;
  service.statusRepo = { find: async () => [{ id: 1, code: 'pending_review', label: '待审单' }] };
  service.slaRepo = { find: async () => [{ orderStatusId: 1, limitHours: '24' }] };
  service.orderOperationLogRepo = { find: async () => logs };
  service.systemOptionsService = { getOptionLabelsByIds: async () => ({}) };
  const qb = (rows) => ({ where() { return this; }, andWhere() { return this; }, innerJoinAndSelect() { return this; }, orderBy() { return this; }, addOrderBy() { return this; }, getMany: async () => rows });
  service.historyRepo = { createQueryBuilder: () => qb(history) };
  service.orderRepo = { createQueryBuilder: () => qb([order]) };
  return (await service.getSlaReport({})).list[0];
}

test('旧轮次超期，退回等六天，新轮次一小时通过：只计一小时', async () => {
  const row = await report([['pending_review', 1], ['draft', 3], ['pending_review', 9], ['pending_purchase', 9, 1]], 'pending_purchase', { orderDate: date(9) });
  assert.equal(row.reviewAt, date(9).toISOString());
  assert.equal(row.orderDate, date(9).toISOString());
  assert.equal(row.reviewDurationHours, 1);
  assert.equal(row.reviewJudge, '未超期');
});
test('旧轮次一小时，新轮次48小时：不能漏掉新轮次超期', async () => {
  const row = await report([['pending_review', 1], ['draft', 1, 1], ['pending_review', 7], ['pending_purchase', 9]], 'pending_purchase');
  assert.equal(row.reviewDurationHours, 48);
  assert.equal(row.reviewJudge, '超期');
});
test('重新提交尚未审单：旧退回记录不能当本次通过', async () => {
  const row = await report([['pending_review', 1], ['draft', 3], ['pending_review', 9]], 'pending_review');
  assert.equal(row.reviewAt, date(9).toISOString());
  assert.equal(row.reviewDurationHours, null);
  assert.equal(row.reviewJudge, '进行中');
});
test('退回草稿：无正在执行的审单判定', async () => {
  const row = await report([['pending_review', 1], ['draft', 3]], 'draft');
  assert.equal(row.reviewAt, null);
  assert.equal(row.reviewDurationHours, null);
  assert.equal(row.reviewJudge, '-');
});
test('只有建单时间和通过日志：不凭空生成192小时审单耗时', async () => {
  const row = await report([], 'pending_purchase', {}, [{ id: 1, orderId: 1, action: 'review', detail: '审核订单：pending_review -> pending_purchase', createdAt: date(9) }]);
  assert.equal(row.reviewDurationHours, null);
  assert.equal(row.reviewJudge, '-');
});
test('历史缺失时根据本次提交与明确通过日志恢复，不用旧通过记录', async () => {
  const row = await report([], 'pending_purchase', { orderDate: date(9) }, [
    { id: 1, orderId: 1, action: 'review', detail: '审核退回：pending_review -> draft', createdAt: date(3) },
    { id: 2, orderId: 1, action: 'submit', createdAt: date(9) },
    { id: 3, orderId: 1, action: 'review', detail: '审核订单：pending_review -> pending_purchase', createdAt: date(9, 2) },
  ]);
  assert.equal(row.reviewDurationHours, 2);
  assert.equal(row.reviewJudge, '未超期');
});
test('草稿再次提交更新下单时间，同时保留建单时间并追加历史', async () => {
  const service = Object.create(OrderMutationService.prototype);
  const order = { id: 1, orderNo: 'TEST', status: 'draft', createdAt: date(1), orderDate: date(2) };
  const actions = [];
  service.orderQueryService = { findOne: async () => order };
  service.orderRepo = { save: async (value) => value };
  service.orderWorkflowService = { resolveNextStatus: async () => 'pending_review' };
  service.orderStatusService = { addLog: async (_order, _actor, action) => actions.push(action), appendStatusHistory: async (_id, status) => actions.push(status) };
  service.touchSuppliersActiveByOrderId = async () => {};
  const before = Date.now();
  const saved = await service.submit(1, { userId: 1, username: 'test' });
  assert.ok(saved.orderDate.getTime() >= before && saved.orderDate.getTime() <= Date.now());
  assert.equal(saved.createdAt, order.createdAt);
  assert.equal(saved.status, 'pending_review');
  assert.deepEqual(actions, ['submit', 'pending_review']);
});

test('同一秒退回再提交，按历史ID配对本轮通过，不能取同秒旧退回', async () => {
  const row = await report([['pending_review', 1], ['draft', 9], ['pending_review', 9], ['pending_purchase', 9, 1]], 'pending_purchase');
  assert.equal(row.reviewDurationHours, 1);
  assert.equal(row.reviewJudge, '未超期');
});
test('审单耗时重算不改变客户交期超期判定', async () => {
  const row = await report([['pending_review', 1], ['draft', 3], ['pending_review', 9], ['pending_purchase', 9, 1]], 'pending_purchase', { customerDueDate: date(1) });
  assert.equal(row.reviewJudge, '未超期');
  assert.equal(row.isOverdue, true);
});
