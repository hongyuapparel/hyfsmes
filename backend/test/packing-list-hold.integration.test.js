const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// 显式启用；只在 localhost 新建随机独立库，绝不使用配置中的业务库。
test('滞留分类：真实 MySQL 迁移、筛选、事务回滚和发货竞争', {
  skip: !process.env.PACKING_HOLD_TEST_ENV,
}, async (t) => {
  require('reflect-metadata');
  const mysql = require('mysql2/promise');
  const { DataSource } = require('typeorm');
  const env = require('dotenv').parse(fs.readFileSync(process.env.PACKING_HOLD_TEST_ENV));
  assert.ok(['localhost', '127.0.0.1'].includes(env.MYSQL_HOST));
  const database = `erp_packing_hold_test_${Date.now()}_${process.pid}`;
  assert.match(database, /^erp_packing_hold_test_\d+_\d+$/);
  const connection = { host: env.MYSQL_HOST, port: Number(env.MYSQL_PORT || 3306),
    user: env.MYSQL_USER, password: env.MYSQL_PASSWORD };
  const admin = await mysql.createConnection(connection);
  let created = false, ds;
  try {
    await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4`);
    created = true;
    await admin.changeUser({ database });
    const { PackingList } = require('../dist/entities/packing-list.entity');
    const { PackingListBox } = require('../dist/entities/packing-list-box.entity');
    const { PackingListItem } = require('../dist/entities/packing-list-item.entity');
    const { PackingListLog } = require('../dist/entities/packing-list-log.entity');
    ds = new DataSource({ type: 'mysql', host: connection.host, port: connection.port,
      username: connection.user, password: connection.password, database,
      entities: [PackingList, PackingListBox, PackingListItem, PackingListLog], synchronize: true });
    await ds.initialize();
    const { PackingListsService } = require('../dist/packing-lists/packing-lists.service');
    const { PackingListsHoldService } = require('../dist/packing-lists/packing-lists-hold.service');
    const { PackingListsShipService } = require('../dist/packing-lists/packing-lists-ship.service');
    const repo = ds.getRepository(PackingList);
    const lists = new PackingListsService(repo, ds.getRepository(PackingListBox), ds.getRepository(PackingListItem),
      ds.getRepository(PackingListLog), { find: async () => [] });
    const hold = new PackingListsHoldService(repo);
    const ship = new PackingListsShipService(repo, {}, lists, {}, {}, {});
    const payload = (qty, customerName) => ({ customerName, packDate: '2026-06-27', sizeHeaders: ['OSFA'],
      boxes: [{ items: [{ styleNo: 'TEST-SKU', sizeQuantities: { OSFA: qty }, totalQty: qty }] }] });
    const a = await lists.create(payload(5, '客户甲'), '测试员');
    const b = await lists.create(payload(7, '客户乙'), '测试员');
    const before = await ds.getRepository(PackingListItem).find();
    await t.test('旧库补列可重复执行，既有单据不被改变', async () => {
      await admin.query('ALTER TABLE packing_lists DROP COLUMN hold_reason');
      const sql = fs.readFileSync(path.join(__dirname, '../scripts/add-packing-list-hold-reason.sql'), 'utf8');
      for (let pass = 0; pass < 2; pass++) {
        for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter((s) => s.trim())) await admin.query(statement);
      }
      assert.equal((await lists.getDetail(a.id)).holdReason, '');
      assert.equal((await lists.getDetail(a.id)).status, 'draft');
    });
    await t.test('真实分页汇总和编辑保留状态，移回后允许正常发货', async () => {
      await hold.setHold({ ids: [a.id, b.id], status: 'held', reason: '等尾款' }, '测试员');
      const held = await lists.getList({ status: 'held', page: 1, pageSize: 1 });
      assert.equal(held.total, 2);
      assert.equal(held.list.length, 1);
      assert.deepEqual(held.summary, { boxCount: 2, totalQty: 12 });
      assert.deepEqual((await lists.getList({ status: 'held', customerName: '客户甲' })).summary, { boxCount: 1, totalQty: 5 });
      assert.deepEqual(await ds.getRepository(PackingListItem).find(), before);
      await lists.update(a.id, payload(5, '客户甲'), '测试员');
      assert.equal((await lists.getDetail(a.id)).status, 'held');
      await assert.rejects(ship.ship(a.id, '测试员'), /移回草稿/);
      await hold.setHold({ ids: [a.id, b.id], status: 'draft' }, '测试员');
      await ship.ship(a.id, '测试员');
      assert.equal((await lists.getDetail(a.id)).status, 'shipped');
    });
    await t.test('日志写入失败导致状态事务回滚，混入已发货也整批拒绝', async () => {
      await admin.query("CREATE TRIGGER fail_hold_log BEFORE INSERT ON packing_list_logs FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test log failure'");
      await assert.rejects(hold.setHold({ ids: [b.id], status: 'held' }, '测试员'), /test log failure/);
      await admin.query('DROP TRIGGER fail_hold_log');
      assert.equal((await lists.getDetail(b.id)).status, 'draft');
      await assert.rejects(hold.setHold({ ids: [a.id, b.id], status: 'held' }, '测试员'), /本次未作任何修改/);
      assert.equal((await lists.getDetail(b.id)).status, 'draft');
    });
    await t.test('并发标记和发货被同一行锁互斥，只有一个状态变更成功', async () => {
      const result = await Promise.allSettled([
        hold.setHold({ ids: [b.id], status: 'held' }, '仓管'), ship.ship(b.id, '业务员'),
      ]);
      assert.equal(result.filter((r) => r.status === 'fulfilled').length, 1);
      assert.equal(result.filter((r) => r.status === 'rejected').length, 1);
      const detail = await lists.getDetail(b.id);
      assert.ok(['held', 'shipped'].includes(detail.status));
      const logs = await lists.getLogs(b.id);
      assert.equal(logs[0].action, detail.status === 'held' ? 'hold' : 'ship');
    });
    await t.test('页签按单去重计数：跨页、全部筛选、零结果和状态变更一致', async () => {
      const ids = [];
      for (let i = 1; i <= 25; i++) {
        const body = { ...payload(5, `COUNT-${i % 2 ? '甲' : '乙'}`),
          serviceManager: i % 2 ? 'COUNT-甲' : 'COUNT-乙',
          xiaomanOrderNo: i <= 20 ? 'COUNT-A' : 'COUNT-B', packDate: i <= 20 ? '2026-09-01' : '2026-09-02',
          boxes: [1, 2].map(() => ({ items: [5, 7].map((qty) => ({ styleNo: 'COUNT-SKU', sizeQuantities: { OSFA: qty }, totalQty: qty })) })),
        };
        const { id } = await lists.create(body, '测试员'); ids.push(id);
        if (i > 23) await ship.ship(id, '测试员');
        else if (i > 20) await hold.setHold({ ids: [id], status: 'held' }, '测试员');
      }
      const expected = { all: 25, draft: 20, held: 3, shipped: 2 };
      for (const [status, total] of [['', 25], ['draft', 20], ['held', 3], ['shipped', 2]]) {
        const res = await lists.getList({ customerName: 'COUNT-', status, page: 2, pageSize: 1 });
        assert.deepEqual(res.tabCounts, expected);
        assert.equal(res.total, total);
        assert.equal(res.list.length, 1);
        assert.deepEqual(res.summary, { boxCount: total * 2, totalQty: total * 24 });
      }
      for (const filter of [{ customerName: 'COUNT-甲' }, { serviceManager: 'COUNT-甲' }]) {
        const res = await lists.getList({ customerName: 'COUNT-', status: 'held', ...filter });
        assert.deepEqual(res.tabCounts, { all: 13, draft: 10, held: 2, shipped: 1 });
      }
      assert.deepEqual((await lists.getList({ keyword: 'COUNT-SKU' })).tabCounts, expected);
      for (const filter of [{ xiaomanOrderNo: 'COUNT-B' }, { dateFrom: '2026-09-02', dateTo: '2026-09-02' }]) {
        assert.deepEqual((await lists.getList({ customerName: 'COUNT-', ...filter })).tabCounts,
          { all: 5, draft: 0, held: 3, shipped: 2 });
      }
      const empty = await lists.getList({ customerName: 'COUNT-', keyword: '不存在' });
      assert.deepEqual(empty.tabCounts, { all: 0, draft: 0, held: 0, shipped: 0 });
      assert.equal(empty.total, 0);
      assert.deepEqual(empty.summary, { boxCount: 0, totalQty: 0 });
      await hold.setHold({ ids: ids.slice(0, 2), status: 'held' }, '测试员');
      assert.deepEqual((await lists.getList({ customerName: 'COUNT-' })).tabCounts, { all: 25, draft: 18, held: 5, shipped: 2 });
      await hold.setHold({ ids: ids.slice(0, 2), status: 'draft' }, '测试员');
      await ship.ship(ids[0], '测试员');
      assert.deepEqual((await lists.getList({ customerName: 'COUNT-' })).tabCounts, { all: 25, draft: 19, held: 3, shipped: 3 });
      await lists.remove(ids[1], '测试员');
      assert.deepEqual((await lists.getList({ customerName: 'COUNT-' })).tabCounts, { all: 24, draft: 18, held: 3, shipped: 3 });
    });
  } finally {
    if (ds?.isInitialized) await ds.destroy();
    // 仅清理本次成功创建且名称验证过的测试库；绝不读取 MYSQL_DATABASE 作为删除目标。
    if (created) await admin.query(`DROP DATABASE \`${database}\``);
    await admin.end();
  }
});
