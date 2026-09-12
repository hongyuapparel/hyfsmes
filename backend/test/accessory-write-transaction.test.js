const assert = require('node:assert/strict');
const test = require('node:test');
const { accessoryWriteFixture } = require('./helpers/accessory-write-fixture.cjs');
const { runAccessoryWrite } = require('../dist/inventory-accessories/inventory-accessory-write');

test('新建同名拒绝；补货只修改明确ID，旧重名不串货', async () => {
  const f = accessoryWriteFixture();
  f.state.stocks.push({ ...f.state.stocks[0], id: 2, quantity: 4 });
  await assert.rejects(f.service.create({ name: 'QA事务', quantity: 2, salesperson: 'QA' }), /名称已存在/);
  await f.service.restock(2, { quantity: 3, name: '伪造名称', location: '伪造货架' });
  assert.equal(f.state.stocks[0].quantity, 10); assert.equal(f.state.stocks[1].quantity, 7);
  assert.equal(f.state.stocks[1].name, 'QA事务'); assert.equal(f.state.stocks[1].location, undefined);
  assert.equal(f.state.logs[0].accessoryId, 2);
  assert.deepEqual([f.state.logs[0].beforeSnapshot.quantity, f.state.logs[0].afterSnapshot.quantity], [4, 7]);
});

test('目标不存在不能变成新建，非法数量不落库', async () => {
  const f = accessoryWriteFixture();
  await assert.rejects(f.service.restock(999, { quantity: 1 }), /不存在/);
  for (const quantity of [0, -1, 0.5, Infinity]) await assert.rejects(f.service.restock(1, { quantity }));
  assert.equal(f.state.stocks.length, 1); assert.equal(f.state.stocks[0].quantity, 10);
  assert.equal(f.state.logs.length, 0);
});

test('改名不允许重复，旧重名保持名称仍可编辑其他资料', async () => {
  const f = accessoryWriteFixture();
  f.state.stocks.push({ ...f.state.stocks[0], id: 2 });
  await f.service.update(2, { name: 'QA事务', remark: '旧资料补充' });
  assert.equal(f.state.stocks[1].remark, '旧资料补充');
  await f.service.update(2, { name: '另一种辅料' });
  await assert.rejects(f.service.update(2, { name: 'QA事务' }), /重复名称/);
});

test('仅对已回滚的死锁重试整个事务，最多三次', async () => {
  for (const nested of [false, true]) {
    let attempts = 0;
    let writes = 0;
    const failure = Object.assign(new Error('deadlock'), nested
      ? { driverError: { code: 'ER_LOCK_DEADLOCK' } } : { code: 'ER_LOCK_DEADLOCK' });
    const manager = { transaction: async (isolation, callback) => {
      assert.equal(isolation, 'REPEATABLE READ');
      attempts++;
      const result = await callback({ getRepository: () => ({}) });
      if (attempts < 3) throw failure;
      return result;
    } };
    assert.equal(await runAccessoryWrite(manager, async () => ++writes), 3);
    assert.equal(attempts, 3);
    attempts = 0;
    manager.transaction = async () => { attempts++; throw failure; };
    await assert.rejects(runAccessoryWrite(manager, async () => {}), error => error === failure);
    assert.equal(attempts, 3);
  }
});

test('连接异常、锁等待超时、日志失败和提交结果不明都不自动重试', async () => {
  for (const code of ['ECONNRESET', 'PROTOCOL_CONNECTION_LOST', 'ER_LOCK_WAIT_TIMEOUT', 'ER_NO_SUCH_TABLE', undefined]) {
    let attempts = 0;
    const failure = Object.assign(new Error('write failure'), { code });
    const manager = { transaction: async () => { attempts++; throw failure; } };
    await assert.rejects(runAccessoryWrite(manager, async () => {}), error => error === failure);
    assert.equal(attempts, 1);
  }
});

test('并发补货分别累计且日志前后衔接，所有读写使用事务', async () => {
  const f = accessoryWriteFixture();
  await Promise.all([f.inbound(), f.inbound()]);
  assert.equal(f.state.stocks[0].quantity, 12);
  assert.deepEqual(f.state.logs.map(l => [l.beforeSnapshot.quantity, l.afterSnapshot.quantity]), [[10, 11], [11, 12]]);
  assert.deepEqual(f.isolations, ['REPEATABLE READ', 'REPEATABLE READ']);
  assert.deepEqual(f.locks, ['pessimistic_write', 'pessimistic_write']);
});

test('同名首次新建竞争只允许一条，不把第二次新建偷偷当补货', async () => {
  const f = accessoryWriteFixture(null);
  const create = () => f.service.create({ name: 'QA事务', quantity: 1, unit: '个', salesperson: 'QA' });
  const result = await Promise.allSettled([create(), create()]);
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(f.state.stocks.length, 1);
  assert.equal(f.state.stocks[0].quantity, 1);
  assert.deepEqual(f.state.logs.map(l => l.action), ['create']);
});

for (const code of ['ER_NO_SUCH_TABLE', 'ER_DATA_TOO_LONG']) {
  test(`补货日志写入失败 ${code} 全部回滚，重新提交只入库一次`, async () => {
    const f = accessoryWriteFixture();
    const before = structuredClone(f.state);
    f.failLogs(Object.assign(new Error('injected log failure'), { code }));
    await assert.rejects(f.inbound());
    assert.deepEqual(f.state, before);
    f.failLogs(null);
    await f.inbound();
    assert.equal(f.state.stocks[0].quantity, 11);
    assert.equal(f.state.logs.length, 1);
  });
}

test('新增、编辑、删除的日志失败，均保留原库存状态', async () => {
  for (const action of ['create', 'update', 'remove']) {
    const f = accessoryWriteFixture();
    const before = structuredClone(f.state);
    f.failLogs(new Error('log storage unavailable'));
    const run = action === 'create' ? () => f.service.create({ name: '新辅料', quantity: 1, salesperson: 'QA' })
      : action === 'update' ? () => f.service.update(1, { remark: '新备注' })
      : () => f.service.remove(1, 'QA');
    await assert.rejects(run());
    assert.deepEqual(f.state, before);
  }
});

test('入库与不改变数量的编辑竞争不会用旧数量覆盖新库存', async () => {
  const f = accessoryWriteFixture();
  await Promise.all([f.inbound(), f.service.update(1, { remark: 'QA货架修改' })]);
  assert.equal(f.state.stocks[0].quantity, 11);
  assert.equal(f.state.stocks[0].remark, 'QA货架修改');
  assert.equal(f.state.logs[1].beforeSnapshot.quantity, 11);
});

test('手动及订单自动扣料遇到日志表缺失，库存和出库记录一起回滚', async () => {
  for (const outboundType of ['manual', 'order_auto']) {
    const f = accessoryWriteFixture();
    const before = structuredClone(f.state);
    f.failLogs(Object.assign(new Error('missing log table'), { code: 'ER_NO_SUCH_TABLE' }));
    await assert.rejects(f.service.outbound({ accessoryId: 1, quantity: 2, outboundType,
      enforceAvailableStock: outboundType === 'manual', operatorUsername: 'QA' }));
    assert.deepEqual(f.state, before);
  }
});
