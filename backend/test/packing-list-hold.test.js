const assert = require('node:assert/strict');
const test = require('node:test');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const { Reflector } = require('@nestjs/core');
const { createHoldFixture } = require('./packing-hold-fixture');
const { SetPackingListHoldDto } = require('../dist/packing-lists/dto');
const { PackingListsShipService } = require('../dist/packing-lists/packing-lists-ship.service');
const { PackingListsController } = require('../dist/packing-lists/packing-lists.controller');
const { PermissionGuard } = require('../dist/auth/permission.guard');

const payload = (customerName = '客户 A', qty = 5) => ({ customerName, serviceManager: '业务员甲', packDate: '2026-06-27',
  sizeHeaders: ['OSFA'], boxes: [{ weightKg: 1, items: [{ styleNo: 'SKU-A', sizeQuantities: { OSFA: qty }, totalQty: qty }] }],
});
const query = (status = '') => ({ status, page: 1, pageSize: 20 });

test('单条/批量移入、移回，草稿/滞留/全部数量和分页统计保持一致', async () => {
  const f = createHoldFixture();
  const first = await f.service.create(payload(), '业务员甲');
  const second = await f.service.create(payload('客户 B', 7), '业务员甲');
  const originalItems = structuredClone(f.repository('PackingListItem').rows);
  const originalBoxes = structuredClone(f.repository('PackingListBox').rows);
  assert.deepEqual(await f.hold.setHold({ ids: [first.id, second.id], status: 'held', reason: ' 等尾款 ' }, '业务员甲'), { changed: 2 });
  assert.equal((await f.service.getList(query('draft'))).total, 0);
  const held = await f.service.getList({ ...query('held'), pageSize: 1 });
  assert.equal(held.total, 2);
  assert.equal(held.list.length, 1);
  assert.deepEqual(held.summary, { boxCount: 2, totalQty: 12 });
  assert.equal(held.list[0].holdReason, '等尾款');
  assert.deepEqual((await f.service.getList(query())).summary, { boxCount: 2, totalQty: 12 });
  const filtered = await f.service.getList({ ...query('held'), customerName: '客户 A', keyword: 'SKU-A', serviceManager: '业务员甲', dateFrom: '2026-06-27', dateTo: '2026-06-27' });
  assert.equal(filtered.total, 1);
  assert.deepEqual(filtered.summary, { boxCount: 1, totalQty: 5 });
  await f.hold.setHold({ ids: [first.id], status: 'draft' }, '仓管乙');
  const resumed = await f.service.getDetail(first.id);
  assert.equal(resumed.status, 'draft');
  assert.equal(resumed.holdReason, '');
  assert.equal(resumed.shippedAt, null);
  assert.deepEqual(f.repository('PackingListItem').rows, originalItems);
  assert.deepEqual(f.repository('PackingListBox').rows, originalBoxes);
  const logs = await f.service.getLogs(first.id);
  assert.deepEqual(logs.slice(-2).map((log) => log.action), ['hold', 'resume']);
  assert.equal(logs.at(-1).operatorUsername, '仓管乙');
  assert.match(logs.at(-1).summary, /等尾款/);
  assert.ok(logs.at(-1).createdAt instanceof Date);
  assert.ok(f.queries.some((entry) => entry.lock === 'pessimistic_write'));
  assert.ok(f.queries.some((entry) => entry.sql === 'pl.status = :status' && entry.params.status === 'held'));
});

test('已发货/不存在/日志失败均回滚整批；重复请求不新增记录或覆盖原因', async () => {
  const f = createHoldFixture();
  const a = await f.service.create(payload(), '');
  const b = await f.service.create(payload(), '');
  f.repository('PackingList').rows[1].status = 'shipped';
  await assert.rejects(f.hold.setHold({ ids: [a.id, b.id], status: 'held' }, ''), /本次未作任何修改/);
  await assert.rejects(f.hold.setHold({ ids: [a.id, 999], status: 'held' }, ''), /不存在/);
  assert.equal((await f.service.getDetail(a.id)).status, 'draft');
  const logRepo = f.repository('PackingListLog'), save = logRepo.save;
  logRepo.save = async () => { throw new Error('audit failed'); };
  await assert.rejects(f.hold.setHold({ ids: [a.id], status: 'held' }, ''), /audit failed/);
  assert.equal((await f.service.getDetail(a.id)).status, 'draft');
  logRepo.save = save;
  await f.hold.setHold({ ids: [a.id], status: 'held', reason: '等通知' }, '甲');
  const count = logRepo.rows.length;
  assert.deepEqual(await f.hold.setHold({ ids: [a.id, a.id], status: 'held', reason: '不应覆盖' }, '乙'), { changed: 0 });
  assert.equal(logRepo.rows.length, count);
  assert.equal((await f.service.getDetail(a.id)).holdReason, '等通知');
});

test('滞留可保存但不解除；滞留禁止发货，恢复后仍走原发货服务', async () => {
  const f = createHoldFixture();
  const { id } = await f.service.create(payload(), '');
  await f.hold.setHold({ ids: [id], status: 'held' }, '');
  await f.service.update(id, payload(), '');
  assert.equal((await f.service.getDetail(id)).status, 'held');
  const ship = new PackingListsShipService(f.repository('PackingList'), {}, f.service, {}, {}, {});
  await assert.rejects(ship.ship(id, '甲'), /移回草稿/);
  await f.hold.setHold({ ids: [id], status: 'draft' }, '');
  await ship.ship(id, '甲');
  assert.equal((await f.service.getDetail(id)).status, 'shipped');
  assert.ok((await f.service.getDetail(id)).shippedAt instanceof Date);
});

test('发货预检通过后被标记滞留，事务内锁检查仍阻止出库', async () => {
  const f = createHoldFixture();
  const { id } = await f.service.create(payload(), '');
  const oldDetail = await f.service.getDetail(id);
  await f.hold.setHold({ ids: [id], status: 'held' }, '');
  const ship = new PackingListsShipService(f.repository('PackingList'), {}, { getDetail: async () => oldDetail }, {}, {}, {});
  await assert.rejects(ship.ship(id, ''), /已标记滞留/);
  assert.equal((await f.service.getDetail(id)).status, 'held');
});

test('DTO 校验：空选择、非法状态、非法 ID、超长原因不接受', () => {
  for (const data of [{ ids: [], status: 'held' }, { ids: [0], status: 'held' }, { ids: [1], status: 'shipped' },
    { ids: [1], status: 'held', reason: '长'.repeat(501) }, { ids: Array(101).fill(1), status: 'held' }]) {
    assert.ok(validateSync(plainToInstance(SetPackingListHoldDto, data)).length > 0);
  }
  assert.equal(validateSync(plainToInstance(SetPackingListHoldDto, { ids: [1], status: 'held' })).length, 0);
});

test('分类沿用页面权限，不能绕过单独的确认发货权限', async () => {
  const dataSource = { getRepository: (entity) => ({
    findOne: async () => ({ roleId: 1 }),
    find: async () => entity.name === 'RolePermission' ? [{ permission: { routePath: '/inventory/packing' } }] : [],
  }) };
  const guard = new PermissionGuard(new Reflector(), dataSource);
  const context = (handler) => ({ getHandler: () => handler, getClass: () => PackingListsController,
    switchToHttp: () => ({ getRequest: () => ({ user: { userId: 1 } }) }) });
  assert.equal(await guard.canActivate(context(PackingListsController.prototype.setHold)), true);
  await assert.rejects(guard.canActivate(context(PackingListsController.prototype.ship)), /无权限/);
});
