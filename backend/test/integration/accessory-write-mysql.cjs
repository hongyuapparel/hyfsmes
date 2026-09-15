// Explicit opt-in: node test/integration/accessory-write-mysql.cjs <local .env> erp_qa_85fc
// Never uses the database name from .env. Only uniquely prefixed QA rows are written; no schema changes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DataSource } = require('typeorm');
const { InventoryAccessory } = require('../../dist/entities/inventory-accessory.entity');
const { InventoryAccessoryOperationLog } = require('../../dist/entities/inventory-accessory-operation-log.entity');
const { InventoryAccessoryOutbound } = require('../../dist/entities/inventory-accessory-outbound.entity');
const { InventoryAccessoriesService } = require('../../dist/inventory-accessories/inventory-accessories.service');

async function main() {
  if (process.argv[3] !== 'erp_qa_85fc') throw Error('Explicit isolated QA database required');
  const env = require('dotenv').parse(fs.readFileSync(process.argv[2]));
  if (!['localhost', '127.0.0.1'].includes(env.MYSQL_HOST)) throw Error('Only loopback MySQL is allowed');
  const ds = new DataSource({ type: 'mysql', host: env.MYSQL_HOST, port: Number(env.MYSQL_PORT || 3306),
    username: env.MYSQL_USER, password: env.MYSQL_PASSWORD, database: 'erp_qa_85fc',
    entities: [InventoryAccessory, InventoryAccessoryOperationLog, InventoryAccessoryOutbound],
    synchronize: false, logging: false, extra: { connectionLimit: 12 } });
  await ds.initialize();
  const prefix = `__QA_TX_${Date.now()}_`;
  const results = [];
  try {
    assert.equal((await ds.query('SELECT DATABASE() db'))[0].db, 'erp_qa_85fc');
    const repo = ds.getRepository(InventoryAccessory), logRepo = ds.getRepository(InventoryAccessoryOperationLog);
    const outRepo = ds.getRepository(InventoryAccessoryOutbound);
    const service = new InventoryAccessoriesService(repo, outRepo, logRepo, {});
    const createdIds = new Map();
    const inbound = async (name, extra = {}, target = service) => {
      const dto = { name: prefix + name, quantity: 1, unit: '个', salesperson: 'QA',
        operatorUsername: '__QA_TX__', remark: prefix + '入库验收', ...extra };
      if (createdIds.has(name)) return target.restock(createdIds.get(name), dto);
      const result = await target.create(dto); createdIds.set(name, result.id); return result;
    };
    const state = async id => ({ stock: await repo.findOneBy({ id }),
      logs: await logRepo.find({ where: { accessoryId: id }, order: { id: 'ASC' } }),
      outbounds: await outRepo.find({ where: { accessoryId: id }, order: { id: 'ASC' } }) });
    const check = async (name, run) => { const start = performance.now(); await run(); results.push({ name, passed: true, ms: Math.round(performance.now() - start) }); };
    function withLogFailure(code) {
      const failingManager = new Proxy(ds.manager, { get(target, key) {
        if (key !== 'transaction') return Reflect.get(target, key);
        return (isolation, run) => {
          if (typeof isolation === 'function') { run = isolation; isolation = 'REPEATABLE READ'; }
          return ds.manager.transaction(isolation, tx => run(new Proxy(tx, { get(manager, member) {
            if (member !== 'getRepository') return Reflect.get(manager, member);
            return entity => entity !== InventoryAccessoryOperationLog ? manager.getRepository(entity)
              : new Proxy(manager.getRepository(entity), { get(logs, prop) {
                if (prop === 'save') return async () => { throw Object.assign(new Error('QA injected log failure'), { code }); };
                const value = Reflect.get(logs, prop); return typeof value === 'function' ? value.bind(logs) : value;
              } });
          } })));
        };
      } });
      const isolatedRepo = new Proxy(repo, { get(target, key) {
        if (key === 'manager') return failingManager;
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      } });
      return new InventoryAccessoriesService(isolatedRepo, outRepo, logRepo, {});
    }

    await check('10 路并发补货不丢数量且日志连续', async () => {
      const row = await inbound('并发', { quantity: 10 });
      await Promise.all(Array.from({ length: 10 }, () => inbound('并发')));
      const s = await state(row.id);
      assert.equal(s.stock.quantity, 20);
      assert.deepEqual(s.logs.slice(1).map(l => [l.beforeSnapshot.quantity, l.afterSnapshot.quantity]),
        Array.from({ length: 10 }, (_, i) => [10 + i, 11 + i]));
    });
    await check('同名首次创建及数据库同义名称竞争只保留一条', async () => {
      for (const suffix of ['首次', 'Case']) {
        const names = [prefix + suffix, (prefix + suffix).toLowerCase()];
        const results = await Promise.allSettled(names.map(name => service.create({ name, quantity: 1, unit: '个', salesperson: 'QA', operatorUsername: '__QA_TX__' })));
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        const rows = await repo.createQueryBuilder('a').where('a.name = :name', { name: names[0] }).getMany();
        assert.equal(rows.length, 1); assert.equal(rows[0].quantity, 1);
        assert.equal((await state(rows[0].id)).logs.length, 1);
      }
    });
    await check('分码并发补货与元数据编辑不互相覆盖', async () => {
      const row = await inbound('分码', { isSized: true, sizeHeaders: ['S', 'M'], sizeQuantities: [4, 6] });
      await Promise.all([inbound('分码', { isSized: true, sizeHeaders: ['S', 'M'], sizeQuantities: [1, 2] }),
        inbound('分码', { isSized: true, sizeHeaders: ['S', 'M'], sizeQuantities: [2, 1] }),
        service.update(row.id, { remark: prefix + '修改货架', operatorUsername: '__QA_TX__' })]);
      const s = await state(row.id);
      assert.equal(s.stock.quantity, 16); assert.deepEqual(s.stock.sizeQuantities, [7, 9]);
      assert.equal(s.stock.remark, prefix + '修改货架'); assert.equal(s.logs.length, 4);
    });
    await check('补货和正常手动出库同时提交数量正确', async () => {
      const row = await inbound('进出', { quantity: 10 });
      await Promise.all([inbound('进出', { quantity: 3 }), service.outbound({ accessoryId: row.id, quantity: 2,
        outboundType: 'manual', enforceAvailableStock: true, operatorUsername: '__QA_TX__' })]);
      const s = await state(row.id); assert.equal(s.stock.quantity, 11); assert.equal(s.outbounds.length, 1);
    });
    for (const code of ['ER_NO_SUCH_TABLE', 'ER_DATA_TOO_LONG']) {
      await check(`真实事务内注入 ${code}，新增/补货/编辑/删除/两类出库均回滚`, async () => {
        const faulty = withLogFailure(code), row = await inbound(code), before = await state(row.id);
        await assert.rejects(inbound(code + '_new', {}, faulty));
        assert.equal(await repo.countBy({ name: prefix + code + '_new' }), 0);
        for (const action of [() => inbound(code, {}, faulty),
          () => faulty.update(row.id, { location: '不应保存的货架' }), () => faulty.remove(row.id, '__QA_TX__'),
          ...['manual', 'order_auto'].map(outboundType => () => faulty.outbound({ accessoryId: row.id, quantity: 1,
            outboundType, enforceAvailableStock: outboundType === 'manual', operatorUsername: '__QA_TX__' }))]) {
          await assert.rejects(action()); assert.deepEqual(await state(row.id), before);
        }
        await inbound(code); assert.equal((await state(row.id)).stock.quantity, 2);
        assert.equal((await state(row.id)).logs.length, 2);
      });
    }
    await check('正常手动超库存仍拒绝，订单自动负库存及逐码规则保持', async () => {
      const row = await inbound('自动', { isSized: true, sizeHeaders: ['S', 'M'], sizeQuantities: [1, 2] });
      const before = await state(row.id);
      await assert.rejects(service.outbound({ accessoryId: row.id, quantity: 4, outboundType: 'manual', enforceAvailableStock: true,
        sizeOutbound: { headers: ['S', 'M'], quantities: [2, 2] }, operatorUsername: '__QA_TX__' }));
      assert.deepEqual(await state(row.id), before);
      const result = await service.outbound({ accessoryId: row.id, quantity: 5, outboundType: 'order_auto',
        sizeOutbound: { headers: ['S', 'M'], quantities: [2, 3] }, operatorUsername: '__QA_TX__' });
      assert.equal(result.accessory.quantity, -2); assert.deepEqual(result.accessory.sizeQuantities, [-1, -1]);
      assert.equal((await state(row.id)).outbounds.length, 1);
    });
    await check('多用户同时手动出库按最新库存校验，不穿透为负数', async () => {
      const row = await inbound('抢库存', { quantity: 3 });
      const outcomes = await Promise.allSettled(Array.from({ length: 6 }, () => service.outbound({
        accessoryId: row.id, quantity: 1, outboundType: 'manual', enforceAvailableStock: true,
        operatorUsername: '__QA_TX__',
      })));
      assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 3);
      const s = await state(row.id);
      assert.equal(s.stock.quantity, 0); assert.equal(s.outbounds.length, 3); assert.equal(s.logs.length, 4);
    });
    await check('调用方外层事务失败时，自动扣料及其他写入一起回滚', async () => {
      const row = await inbound('外层事务', { quantity: 2 });
      const before = await state(row.id);
      await assert.rejects(ds.manager.transaction(async manager => {
        await manager.getRepository(InventoryAccessory).update(row.id, { remark: '外层事务尚未完成' });
        await service.outboundInTransaction(manager, { accessoryId: row.id, quantity: 3,
          outboundType: 'order_auto', operatorUsername: '__QA_TX__' });
        throw new Error('QA outer transaction failure');
      }), /QA outer transaction failure/);
      assert.deepEqual(await state(row.id), before);
    });
    console.log(JSON.stringify({ database: 'erp_qa_85fc', prefix, results, retainedQAData: true }, null, 2));
  } finally { await ds.destroy(); }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
