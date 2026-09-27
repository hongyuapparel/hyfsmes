require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const { DataSource } = require('typeorm');
const { Customer } = require('../dist/entities/customer.entity');
const { Order } = require('../dist/entities/order.entity');
const { CustomersService } = require('../dist/customers/customers.service');
const { OrderQueryService } = require('../dist/orders/order-query.service');
const { OrderMutationService } = require('../dist/orders/order-mutation.service');

// 仅允许本机 MySQL；连接级临时表遮蔽真实表，所有写入仅在临时表内。
test('客户改名：真实 MySQL 事务、历史订单、搜索统计及旧表单保存', {
  skip: !process.env.CUSTOMER_SYNC_TEST_ENV,
}, async () => {
  const env = require('dotenv').parse(readFileSync(process.env.CUSTOMER_SYNC_TEST_ENV));
  assert.ok(['localhost', '127.0.0.1'].includes(env.MYSQL_HOST));
  const db = new DataSource({
    type: 'mysql', host: env.MYSQL_HOST, port: Number(env.MYSQL_PORT || 3306),
    username: env.MYSQL_USER, password: env.MYSQL_PASSWORD, database: env.MYSQL_DATABASE,
    entities: [Customer, Order], synchronize: false, logging: false,
  });
  await db.initialize();
  const runner = db.createQueryRunner();
  try {
    await runner.connect();
    for (const table of ['customers', 'orders']) {
      const [schema] = await runner.query(`SHOW CREATE TABLE \`${table}\``);
      await runner.query(schema['Create Table'].replace(/^CREATE TABLE /, 'CREATE TEMPORARY TABLE '));
    }
    const customerRepo = runner.manager.getRepository(Customer);
    const orderRepo = runner.manager.getRepository(Order);
    const customer = await customerRepo.save(customerRepo.create({ customerId: 'SYNC-1', companyName: '旧名' }));
    const other = await customerRepo.save(customerRepo.create({ customerId: 'SYNC-2', companyName: '另一客户' }));
    const fixtures = [
      { orderNo: 'SYNC-1', customerId: customer.id, status: 'draft', quantity: 2 },
      { orderNo: 'SYNC-2', customerId: customer.id, status: 'completed', quantity: 3 },
      { orderNo: 'SYNC-3', customerId: customer.id, deletedAt: new Date(), quantity: 4 },
      { orderNo: 'SYNC-4', customerId: null, quantity: 5 },
      { orderNo: 'SYNC-5', customerId: other.id, quantity: 6 },
    ];
    const orders = await orderRepo.save(fixtures.map((row) => orderRepo.create({
      customerName: '旧名', updatedAt: new Date('2026-01-01T00:00:00Z'), ...row,
    })));
    const empty = { find: async () => [], findOne: async () => null };
    const query = Object.create(OrderQueryService.prototype);
    Object.assign(query, {
      orderRepo, userRepo: empty, productRepo: empty, orderExtRepo: empty,
      orderCuttingRepo: empty, orderSewingRepo: empty, orderFinishingRepo: empty,
      orderRemarkRepo: { createQueryBuilder() {
        const qb = { getRawMany: async () => [] };
        for (const key of ['select', 'addSelect', 'where', 'groupBy']) qb[key] = () => qb;
        return qb;
      } },
    });
    const customers = Object.create(CustomersService.prototype);
    Object.assign(customers, { customerRepo, systemOptionsService: {} });

    // 模拟此前已经改过客户档案、订单副本未同步的历史情况。
    await customerRepo.update(customer.id, { companyName: '历史新名' });
    assert.equal((await query.findOne(orders[0].id)).customerName, '历史新名');
    const firstPage = await query.findAll({ customer: '历史新名', pageSize: 1 });
    assert.equal(firstPage.total, 2);
    assert.equal(firstPage.totalQuantity, 5);
    assert.equal(firstPage.list[0].customerName, '历史新名');
    assert.equal((await query.findAll({ customer: '历史新名', page: 2, pageSize: 1 })).list.length, 1);
    assert.deepEqual(await query.countByStatus({ customer: '历史新名' }), {
      total: 2, byStatus: { completed: 1, draft: 1 },
    });
    assert.equal((await query.findAll({ customer: '不存在' })).total, 0);
    assert.equal((await query.findAll({ customer: '' })).total, 4);
    assert.equal((await query.findAll({ customer: '历史新名', deletedOnly: true })).total, 1);

    await customers.update(customer.id, { company_name: '新名称', contact_person: '新联系人' });
    for (const before of orders.slice(0, 3)) {
      const after = await orderRepo.findOneByOrFail({ id: before.id });
      assert.equal(after.customerName, '新名称');
      assert.equal(after.status, before.status);
      assert.equal(+after.updatedAt, +before.updatedAt);
    }
    for (const before of orders.slice(3)) {
      assert.equal((await orderRepo.findOneByOrFail({ id: before.id })).customerName, '旧名');
    }
    await assert.rejects(customers.update(customer.id, { company_name: '另一客户' }));
    assert.equal((await customerRepo.findOneByOrFail({ id: customer.id })).companyName, '新名称');

    // 模拟事务中订单更新失败，客户修改必须一起回滚。
    await runner.query("ALTER TABLE orders ADD CONSTRAINT sync_name_guard CHECK (customer_name <> '拒绝名')");
    await assert.rejects(customers.update(customer.id, { company_name: '拒绝名' }));
    assert.equal((await customerRepo.findOneByOrFail({ id: customer.id })).companyName, '新名称');

    const mutation = Object.create(OrderMutationService.prototype);
    Object.assign(mutation, {
      orderRepo, orderQueryService: query,
      orderStatusService: { isAdminUser: async () => true, addLog: async () => {}, appendStatusHistory: async () => {} },
      orderExtRepo: { ...empty, create: (row) => row, save: async (row) => row },
      orderCostSnapshotRepo: empty,
      orderCostSnapshotService: { syncCostSnapshotFromOrder: async () => {} },
      suppliersService: { touchLastActiveByNames: async () => {} },
    });
    // 只隔离日志等无关流程，真实调用编辑入口及 MySQL 保存。
    mutation.touchSuppliersActiveByOrderId = async () => {};
    const saved = await mutation.updateDraft(orders[0].id, { customerName: '旧名' }, { userId: 1 });
    assert.equal(saved.customerName, '新名称');
    assert.equal((await query.findOne(saved.id)).customerName, '新名称');
    const created = await mutation.createDraft({ customerId: customer.id, customerName: '旧名' }, { userId: 1 });
    assert.equal(created.customerName, '新名称');
    await orderRepo.update(orders[1].id, { customerName: '旧名' });
    const [copied] = await mutation.copyManyToDraft([orders[1].id], { userId: 1 });
    assert.equal(copied.customerName, '新名称');
    assert.equal(copied.status, 'draft');
    await customers.update(customer.id, { company_name: 'Later Skater' });
    await customers.update(customer.id, { company_name: 'LATER SKATER' });
    assert.equal((await orderRepo.findOneByOrFail({ id: saved.id })).customerName, 'LATER SKATER');
    // 在同一组隔离临时表内验收发布 SQL，包含已改名的旧副本。
    await orderRepo.update(orders[1].id, { customerName: '过时副本' });
    const migration = readFileSync(require('node:path').join(__dirname, '../scripts/sync-order-customer-names.sql'), 'utf8');
    for (const sql of migration.split(';').map((part) => part.trim()).filter(Boolean)) await runner.query(sql);
    assert.equal((await orderRepo.findOneByOrFail({ id: orders[1].id })).customerName, 'LATER SKATER');
    assert.equal((await orderRepo.findOneByOrFail({ id: orders[3].id })).customerName, '旧名');
  } finally {
    // 关闭连接后临时表自动消失，不执行任何真实表删除。
    await runner.release();
    await db.destroy();
  }
});
