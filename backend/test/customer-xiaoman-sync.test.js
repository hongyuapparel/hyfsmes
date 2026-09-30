require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { CustomerXiaomanSyncService } = require('../dist/customers/customer-xiaoman-sync.service');
const { customerProfile } = require('../dist/xiaoman/xiaoman-customer-profile');

const item = { company_id: 17, serial_id: 'AU001', name: 'New Company', update_time: '2026-09-27 08:00:00' };
const detail = { ...item, country: 'AU', country_name: '澳大利亚', tel: ['123'], customers: [
  { name: 'Elysha Newitt', main_customer_flag: 1 }, { name: 'Other Contact' },
] };

test('真实小满电话号码兼容字符串和数组，不把字符串电话号码清空', () => {
  assert.equal(customerProfile({ ...detail, tel: ' 123 ' }).contactInfo, '123');
  assert.equal(customerProfile({ ...detail, tel: ['123', '456'] }).contactInfo, '123; 456');
});
function fixture(snapshot = [customerProfile(detail, item)]) {
  let state = { id: 1, snapshot, lastSuccessAt: new Date(0), lastError: null };
  const locals = [{ id: 1, customerId: 'AU001', companyName: 'Old', contactPerson: 'Old', country: 'Old',
    contactInfo: 'Old', salesperson: 'Alex', productGroupId: 4 }];
  let calls = 0;
  const updates = [];
  const runner = { connect: async () => {}, release: async () => {}, query: async () => [{ acquired: 1 }] };
  const stateRepo = {
    findOneBy: async () => state, findOne: async () => state,
    upsert: async (patch) => { state = { ...state, ...patch }; },
    manager: { connection: { createQueryRunner: () => runner } },
  };
  const repo = { find: async () => locals, update: async (id, patch) => Object.assign(locals.find((r) => r.id === id), patch) };
  const xiaoman = {
    getCompanyList: async () => { calls++; return { list: [item], total: 1 }; },
    getCompanyDetail: async () => { calls++; return detail; },
  };
  const customers = { update: async (id, patch) => { updates.push({ id, patch }); } };
  const service = new CustomerXiaomanSyncService(stateRepo, repo, xiaoman, customers);
  service.logger = { log() {}, error() {} };
  return { service, locals, updates, xiaoman, runner, stateRepo, state: () => state, calls: () => calls };
}

test('公司、编号、主/次联系人搜索与分页、清空一致，搜索零次小满请求', async () => {
  const f = fixture();
  for (const keyword of ['New Company', 'AU001', 'elysha', 'OTHER CONTACT']) {
    assert.equal((await f.service.getList(1, 20, keyword)).total, 1);
  }
  assert.equal((await f.service.getList(2, 1, 'elysha')).list.length, 0);
  assert.equal((await f.service.getList(1, 20, 'not found')).total, 0);
  assert.equal((await f.service.getList(1, 20, '')).total, 1);
  assert.equal(f.calls(), 0);
  assert.equal('contactInfo' in (await f.service.getList()).list[0], false);
});

test('1771 条客户联系人索引查询不会等待后台网络请求', async () => {
  const rows = Array.from({ length: 1771 }, (_, i) => ({ ...customerProfile(detail, item), company_id: i + 1 }));
  const f = fixture(rows);
  f.service.running = true;
  f.xiaoman.getCompanyList = () => { throw new Error('搜索不应调用小满'); };
  const start = performance.now();
  for (let i = 0; i < 100; i++) assert.equal((await f.service.getList(1, 20, 'Elysha')).total, 1771);
  assert.ok(performance.now() - start < 1000, '100 次本地检索应在 1 秒内完成');
});

test('增量同步绑定旧编号并仅覆盖约定四字段，6 小时内不重复拉取', async () => {
  const f = fixture();
  await f.service.sync();
  assert.equal(f.calls(), 1);
  assert.equal(f.locals[0].xiaomanCompanyId, '17');
  assert.deepEqual(f.updates[0].patch, { company_name: 'New Company', contact_person: 'Elysha Newitt', contact_info: '123', country: '澳大利亚' });
  assert.equal(f.locals[0].salesperson, 'Alex');
  assert.equal(f.locals[0].productGroupId, 4);
  await f.service.sync();
  assert.equal(f.calls(), 1);
});

test('小满编号改变后继续按固定 ID 同步，不按名称创建或合并客户', async () => {
  const f = fixture();
  f.locals[0].xiaomanCompanyId = '17';
  f.locals[0].customerId = 'old serial';
  await f.service.sync();
  assert.equal(f.updates.length, 1);
  assert.equal(f.locals.length, 1);
});

test('每日复查详情，所有联系人进入搜索索引', async () => {
  const f = fixture([{ ...customerProfile(detail, item), fetchedAt: 0 }]);
  await f.service.sync();
  assert.equal(f.calls(), 2);
  assert.equal((await f.service.getList(1, 20, 'Other Contact')).total, 1);
});

test('失败保留完整旧索引和成功时间，下一轮可重试', async () => {
  const f = fixture();
  f.xiaoman.getCompanyList = async () => { throw new Error('接口超时'); };
  await f.service.sync();
  assert.equal(f.state().lastError, '接口超时');
  assert.equal(+f.state().lastSuccessAt, 0);
  assert.equal((await f.service.getList(1, 20, 'Elysha')).total, 1);
  f.xiaoman.getCompanyList = async () => ({ list: [item], total: 1 });
  await f.service.sync();
  assert.equal(f.state().lastError, null);
});

test('首次索引未完成明确提示，不能把缺资料伪装为没有联系人', async () => {
  await assert.rejects(fixture(null).service.getList(1, 20, 'Elysha'), /首次准备中/);
});

test('首次初始化保留公司和编号搜索，联系人未准备完成时明确提示', async () => {
  const f = fixture([{ ...customerProfile(detail, item), fetchedAt: 0 }]);
  assert.equal((await f.service.getList(1, 20, 'New Company')).total, 1);
  assert.equal((await f.service.getList(1, 20, 'AU001')).total, 1);
  await assert.rejects(f.service.getList(1, 20, 'Elysha'), /公司名称和客户编号搜索仍可使用/);
});

test('分页中途失败及详情残缺不会发布不完整索引或清空客户', async () => {
  const f = fixture([{ ...customerProfile(detail, item), fetchedAt: 0 }]);
  f.xiaoman.getCompanyDetail = async () => ({ company_id: 17, name: 'New' });
  await f.service.sync();
  assert.match(f.state().lastError, /不完整/);
  assert.equal(f.updates.length, 0);
  assert.equal(f.state().snapshot[0].contactPerson, 'Elysha Newitt');
  let page = 0;
  f.xiaoman.getCompanyList = async () => ({ list: ++page === 1 ? [item] : [], total: 2 });
  await f.service.sync();
  assert.match(f.state().lastError, /分页不完整/);
});

test('重复运行和其他实例持锁时不调用小满', async () => {
  const f = fixture();
  f.service.running = true;
  await f.service.sync();
  f.service.running = false;
  f.runner.query = async () => [{ acquired: 0 }];
  await f.service.sync();
  assert.equal(f.calls(), 0);
});
