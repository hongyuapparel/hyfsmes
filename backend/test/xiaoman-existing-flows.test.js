require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { XiaomanService } = require('../dist/xiaoman/xiaoman.service');
const { CustomersService } = require('../dist/customers/customers.service');
const { customerProfile } = require('../dist/xiaoman/xiaoman-customer-profile');

test('已有小满导入：联系人兼容字段、合作日期、分组和导入人保留；固定 ID 防重复', async () => {
  const rows = [];
  const service = Object.create(CustomersService.prototype);
  service.customerRepo = {
    findOne: async ({ where }) => rows.find((row) => where.some((cond) => Object.entries(cond).every(([k, v]) => row[k] === v))),
    create: (row) => row,
    save: async (row) => { rows.push(row); return row; },
  };
  const detail = { company_id: 123, serial_id: 'AU01', name: 'Company', country_name: '澳大利亚',
    contact_person: 'Legacy Contact', tel: '12345', cooperation_date: '2026-01-05', product_group_names: '服装/上衣' };
  service.xiaomanService = { getCompanyDetailsBatch: async () => [detail] };
  service.getProductGroups = async () => [{ id: 8, path: '服装/上衣' }];
  service.userRepo = { findOne: async () => ({ displayName: 'Alex', username: 'alex' }) };
  assert.deepEqual(await service.importFromXiaoman([123], { userId: 1 }), { imported: 1, skipped: 0, errors: [] });
  assert.deepEqual({ name: rows[0].companyName, contact: rows[0].contactPerson, phone: rows[0].contactInfo,
    salesperson: rows[0].salesperson, group: rows[0].productGroupId, xiaomanId: rows[0].xiaomanCompanyId },
  { name: 'Company', contact: 'Legacy Contact', phone: '12345', salesperson: 'Alex', group: 8, xiaomanId: '123' });
  assert.equal(rows[0].cooperationDate.toISOString().slice(0, 10), '2026-01-05');
  detail.serial_id = 'CHANGED';
  assert.deepEqual(await service.importFromXiaoman([123], { userId: 1 }), { imported: 0, skipped: 1, errors: [] });
  assert.equal(rows.length, 1);
});

test('联系人字段兼容既有导入格式', () => {
  for (const [extra, expected] of [
    [{ contacts: [{ contact_name: 'Contact' }] }, 'Contact'],
    [{ main_contact: { name: 'Main' } }, 'Main'],
    [{ customers: [{ name: 'First' }, { nickname: 'Nick', name: 'Name', main_customer_flag: 1 }] }, 'Nick'],
    [{ contact_nickname: 'Old Nick' }, 'Old Nick'],
    [{ linkman: 'Linkman' }, 'Linkman'],
  ]) assert.equal(customerProfile({ company_id: 1, name: 'Co', ...extra }).contactPerson, expected);
});

test('装箱单小满订单搜索保留 5 分钟缓存、并发去重和公司信息解析；company/invoices 授权分离', async () => {
  const originalFetch = global.fetch;
  let invoiceCalls = 0;
  const scopes = [];
  global.fetch = async (url, options) => {
    if (url.endsWith('/access_token')) {
      const body = JSON.parse(options.body);
      scopes.push(body.scope);
      return { text: async () => JSON.stringify({ access_token: `test-${body.scope}`, expires_in: 3600 }) };
    }
    if (url.includes('/invoices/order/list')) {
      invoiceCalls++;
      assert.equal(options.headers.Authorization, 'Bearer test-invoices');
      return { text: async () => JSON.stringify({ code: 200, data: { list: [
        { order_id: 1, order_no: 'PO001', name: 'Sample', company: { company_id: 7, name: 'ACME' } },
        { order_id: 2, order_no: 'PO002', name: 'Bulk', company_id: 8, company_name: 'Other' },
      ] } }) };
    }
    assert.equal(options.headers.Authorization, 'Bearer test-company');
    return { text: async () => JSON.stringify({ code: 200, data: { company_id: 7, country: 'AU' } }) };
  };
  try {
    const api = new XiaomanService({ get: (key) => ({ XIAOMAN_CLIENT_ID: 'test', XIAOMAN_CLIENT_SECRET: 'test' })[key] });
    const [first, second] = await Promise.all([api.getOrderList(1, 20, 'ACME'), api.getOrderList(1, 20, 'PO002')]);
    assert.equal(first.list[0].company_id, 7);
    assert.equal(second.list[0].order_no, 'PO002');
    assert.equal((await api.getOrderList(2, 1)).list[0].order_no, 'PO002');
    assert.equal(invoiceCalls, 1);
    assert.equal(await api.getCompanyCountry(7), 'AU');
    assert.deepEqual(scopes, ['invoices', 'company']);
  } finally { global.fetch = originalFetch; }
});
