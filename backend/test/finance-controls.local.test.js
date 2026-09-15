// Local-only integration test. Creates isolated fixtures and removes only its own IDs.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

test('财务：收支、转账、对账、恢复、查重、留痕与权限完整链路', { timeout: 90000 }, async () => {
  const env = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env')));
  assert(['localhost', '127.0.0.1'].includes(env.MYSQL_HOST), '禁止对非本地库运行');
  const db = await mysql.createConnection({ host: env.MYSQL_HOST, port: Number(env.MYSQL_PORT || 3306), user: env.MYSQL_USER, password: env.MYSQL_PASSWORD, database: env.MYSQL_DATABASE, dateStrings: true });
  const marker = '__FINANCE_TEST_' + Date.now();
  const accounts = []; const records = { income: [], expense: [] }; const transferIds = [];
  let userId, roleId, actorUserId;
  try {
    const [[admin]] = await db.query("SELECT u.id FROM users u JOIN roles r ON r.id=u.role_id WHERE r.code='admin' LIMIT 1");
    assert(admin);
    if (process.env.FINANCE_TEST_ROLE === 'finance') {
      const [[financeRole]] = await db.query("SELECT id FROM roles WHERE code='finance'");
      assert(financeRole, '需要现有财务角色');
      const [actor] = await db.query('INSERT INTO users (username,password_hash,display_name,role_id,status) VALUES (?,"NO_LOGIN_PASSWORD",?,?,"active")',[marker+'actor',marker,financeRole.id]);
      actorUserId = actor.insertId;
    }
    const token = jwt.sign({ sub: actorUserId || admin.id, username: marker }, env.JWT_SECRET || 'dev_secret_123456', { expiresIn: '10m' });
    async function api(url, method = 'GET', body, expected = 200, auth = token) {
      const response = await fetch('http://127.0.0.1:3000' + url, { method, headers: { Authorization: 'Bearer ' + auth, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      const json = await response.json();
      assert.equal(response.status, expected, `${method} ${url}: ${JSON.stringify(json)}`);
      return json.data ?? json;
    }
    const options = await api('/finance-settings/options');
    const [[dep]] = await db.query("SELECT id FROM system_options WHERE option_type='org_departments' LIMIT 1");
    for (let i = 0; i < 2; i++) {
      const [result] = await db.query('INSERT INTO finance_fund_accounts (name,account_type,owner,is_enabled,sort_order) VALUES (?,"other",?,1,999)', [marker + i, marker]);
      accounts.push(result.insertId);
    }
    const date = '2026-09-01'; const query = '?dateFrom=2026-09-01&dateTo=2026-09-02';
    const before = await api('/finance/dashboard' + query);
    const base = { occurDate: date, amount: '100.10', fundAccountId: accounts[0], departmentId: dep.id, cashKind: 'operating', sourceName: marker, payeeName: marker, operator: '伪造经办人', incomeTypeId: options.incomeTypes[0].id, expenseTypeId: options.expenseTypes[0].id };
    await api('/finance/income', 'POST', { ...base, amount: 0 }, 400);
    await api('/finance/income', 'POST', { ...base, amount: '1.001' }, 400);
    await api('/finance/income', 'POST', { ...base, occurDate: '2026-02-30' }, 400);
    await api('/finance/income', 'POST', { ...base, fundAccountId: null }, 400);
    await api('/finance/income', 'POST', { ...base, cashKind: 'transfer' }, 400);
    const income = await api('/finance/income', 'POST', { ...base, bankReference: marker + 'receipt' }, 201); records.income.push(income.id);
    await api('/finance/income', 'POST', { ...base, bankReference: marker + 'receipt', duplicateReason: '不能覆盖流水号重复' }, 409);
    await api('/finance/income', 'POST', base, 409);
    const second = await api('/finance/income', 'POST', { ...base, duplicateReason: '同日独立第二笔水单' }, 201); records.income.push(second.id);
    const expense = await api('/finance/expense', 'POST', { ...base, amount: '20.20' }, 201); records.expense.push(expense.id);
    await api('/finance/expense', 'POST', { ...base, amount: '20.20' }, 409);
    let row = await api('/finance/income/' + income.id);
    await api('/finance/income/' + income.id, 'PATCH', { ...base, version: row.version, amount: '101.10', remark: '更新验证' });
    await api('/finance/income/' + income.id, 'PATCH', { ...base, version: row.version }, 409);
    const logs = await api(`/finance/income/${income.id}/history`);
    assert.equal(logs.length, 2); assert.notEqual(logs[0].actor_name, '伪造经办人');
    assert.equal(logs[0].before_data.amount, '100.10'); assert.equal(logs[0].after_data.amount, '101.10');
    // Initial balances and transfers do not inflate company income or expense.
    await api(`/finance/control/accounts/${accounts[0]}/opening`, 'POST', { date, amount: 1000, reason: '隔离银行期初测试' }, 201);
    await api(`/finance/control/accounts/${accounts[1]}/opening`, 'POST', { date, amount: 500, reason: '隔离银行期初测试' }, 201);
    await api('/finance/control/transfers', 'POST', { date, amount: 50, fromId: accounts[0], toId: accounts[0], reference: marker }, 400);
    const transfer = await api('/finance/control/transfers', 'POST', { date, amount: '50.50', fromId: accounts[0], toId: accounts[1], reference: marker }, 201); transferIds.push(transfer.id);
    await api('/finance/control/transfers', 'POST', { date, amount: 50, fromId: accounts[0], toId: accounts[1], reference: marker }, 409);
    const status = await api('/finance/control/accounts');
    assert.equal(status.find(a => a.id === accounts[0]).bookBalance, '1130.50');
    assert.equal(status.find(a => a.id === accounts[1]).bookBalance, '550.50');
    const after = await api('/finance/dashboard' + query);
    assert.equal(Math.round((Number(after.periodSummary.totalIncome) - Number(before.periodSummary.totalIncome)) * 100), 20120);
    assert.equal(Math.round((Number(after.periodSummary.totalExpense) - Number(before.periodSummary.totalExpense)) * 100), 2020);
    assert.equal(Math.round(after.departments.reduce((s, d) => s + Number(d.totalIncome), 0) * 100), Math.round(Number(after.periodSummary.totalIncome) * 100));
    assert.equal(Math.round(after.trend.reduce((s, d) => s + Number(d.totalExpense), 0) * 100), Math.round(Number(after.periodSummary.totalExpense) * 100));
    // Same filter in list, total, page 2 and department drill-down.
    const filtered = await api(`/finance/income${query}&departmentId=${dep.id}&cashKind=operating&pageSize=1`);
    const page2 = await api(`/finance/income${query}&departmentId=${dep.id}&cashKind=operating&pageSize=1&page=2`);
    assert.equal(filtered.totalAmount, page2.totalAmount);
    assert(filtered.list.every(r => r.departmentId === dep.id && r.cashKind === 'operating'));
    // Lock, attempted historical edit/delete/new entry, reversal and recovery.
    await api(`/finance/control/accounts/${accounts[0]}/reconcile`, 'POST', { date: '2026-09-02', amount: 1 }, 409);
    await api(`/finance/control/accounts/${accounts[0]}/reconcile`, 'POST', { date: '2026-09-02', amount: '1130.50' }, 201);
    row = await api('/finance/income/' + income.id);
    await api(`/finance/income/${income.id}`, 'PATCH', { ...base, version: row.version }, 409);
    await api(`/finance/income/${income.id}`, 'DELETE', { version: row.version, reason: '锁定测试' }, 409);
    await api('/finance/expense', 'POST', { ...base, amount: 10 }, 409);
    await api(`/finance/control/transfers/${transfer.id}/void`, 'POST', { reason: '锁定测试' }, 409);
    await api(`/finance/control/accounts/${accounts[0]}/reopen`, 'POST', { reason: '' }, 400);
    await api(`/finance/control/accounts/${accounts[0]}/reopen`, 'POST', { reason: '已核实需调整' }, 201);
    await api(`/finance/income/${income.id}`, 'DELETE', { version: row.version, reason: '测试回收站' });
    await api(`/finance/income/${income.id}`, 'GET', undefined, 404);
    const trash = await api(`/finance/income?deleted=true&fundAccountId=${accounts[0]}`);
    const deleted = trash.list.find(r => r.id === income.id); assert(deleted);
    await api(`/finance/income/${income.id}/restore`, 'POST', { version: deleted.version, reason: '核对确认恢复' }, 201);
    assert.equal((await api(`/finance/income/${income.id}`)).amount, '101.10');
    await api(`/finance/control/transfers/${transfer.id}/void`, 'POST', { reason: '核对后取消隔离转账' }, 201);
    const status2 = await api('/finance/control/accounts');
    assert.equal(status2.find(a => a.id === accounts[0]).bookBalance, '1181.00');
    assert.equal(status2.find(a => a.id === accounts[1]).bookBalance, '500.00');
    // Real workbook contains payroll deductions: preserve negative expenses, never turn them into income.
    const offsetBody = { ...base, occurDate: '2026-09-03', amount: '-414.00', payeeName: marker + 'offset' };
    await api('/finance/expense', 'POST', offsetBody, 400);
    await api('/finance/expense', 'POST', { ...offsetBody, amount: 0, remark: '零金额不应入账' }, 400);
    const offsetBefore = await api('/finance/dashboard?dateFrom=2026-09-03&dateTo=2026-09-03');
    const offset = await api('/finance/expense', 'POST', { ...offsetBody, remark: '个人社保扣款冲减原工资' }, 201); records.expense.push(offset.id);
    const offsetAfter = await api('/finance/dashboard?dateFrom=2026-09-03&dateTo=2026-09-03');
    assert.equal(Math.round((Number(offsetAfter.periodSummary.totalExpense) - Number(offsetBefore.periodSummary.totalExpense)) * 100), -41400);
    assert.equal(offsetAfter.periodSummary.totalIncome, offsetBefore.periodSummary.totalIncome);
    let offsetRow = await api('/finance/expense/' + offset.id);
    assert.equal(offsetRow.amount, '-414.00');
    await api('/finance/expense/' + offset.id, 'PATCH', { version: offsetRow.version, amount: '-415.00', remark: '核实后更正扣款金额' });
    offsetRow = await api('/finance/expense/' + offset.id);
    assert.equal(offsetRow.amount, '-415.00');
    await api('/finance/expense/' + offset.id, 'PATCH', { version: offsetRow.version, remark: '' }, 400);
    await api('/finance/expense/' + offset.id, 'DELETE', { version: offsetRow.version, reason: '验证冲减记录恢复' });
    const offsetTrash = await api(`/finance/expense?deleted=true&fundAccountId=${accounts[0]}`);
    await api(`/finance/expense/${offset.id}/restore`, 'POST', { version: offsetTrash.list.find(r => r.id === offset.id).version, reason: '确认恢复冲减' }, 201);
    assert.equal((await api('/finance/expense/' + offset.id)).amount, '-415.00');
    // Cross-kind references: either entry order, edits, restore and simultaneous writes.
    const crossBody = {...base, amount:'7.13', bankReference:marker+'cross', duplicateReason:'隔离查重测试', remark:'退款冲减'};
    const cross = await api('/finance/income','POST',crossBody,201); records.income.push(cross.id);
    await api('/finance/expense','POST',{...crossBody,amount:'-7.13'},409);
    await api('/finance/control/transfers','POST',{date,amount:7.13,fromId:accounts[1],toId:accounts[0],reference:crossBody.bankReference},409);
    const crossRow = await api('/finance/income/'+cross.id);
    await api('/finance/income/'+cross.id,'DELETE',{version:crossRow.version,reason:'恢复查重测试'});
    const reverse = await api('/finance/expense','POST',{...crossBody,amount:'-7.13'},201); records.expense.push(reverse.id);
    await api('/finance/income','POST',crossBody,409);
    await api('/finance/income/'+cross.id+'/restore','POST',{version:crossRow.version+1,reason:'不可恢复成重复入账'},409);
    const editTarget = await api('/finance/income/'+income.id);
    await api('/finance/income/'+income.id,'PATCH',{version:editTarget.version,bankReference:crossBody.bankReference},409);
    const concurrent = await Promise.all(['income','expense'].map(async kind=>{
      const response=await fetch('http://127.0.0.1:3000/finance/'+kind,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({...crossBody,amount:kind==='income'?'3.17':'-3.17',bankReference:marker+'race'})});
      const json=await response.json(); if(response.status===201) records[kind].push((json.data??json).id);
      return response.status;
    }));
    assert.deepEqual(concurrent.sort(),[201,409]);
    // History beyond 100 entries, filtered totals and void history remain reachable.
    for(let i=0;i<101;i++){
      const created=await api('/finance/control/transfers','POST',{date,amount:1,fromId:accounts[0],toId:accounts[1],reference:marker+'page'+i},201);
      transferIds.push(created.id);
    }
    await api('/finance/expense','POST',{...crossBody,fundAccountId:accounts[1],bankReference:marker+'page0',amount:'-1.00'},409);
    await api('/finance/income','POST',{...crossBody,fundAccountId:accounts[0],bankReference:marker+'page0'},409);
    const pageQuery='/finance/control/transfers?keyword='+marker+'page';
    const first=await api(pageQuery+'&pageSize=100');
    const last=await api(pageQuery+'&pageSize=100&page=2');
    assert.equal(first.total,101); assert.equal(first.list.length,100); assert.equal(last.list.length,1);
    assert(!first.list.some(r=>r.id===last.list[0].id));
    await api('/finance/control/transfers/'+last.list[0].id+'/void','POST',{reason:'分页历史作废测试'},201);
    const voidHistory=await api('/finance/control/history/transfer/'+last.list[0].id);
    assert.equal(voidHistory[0].before_data.amount,voidHistory[0].after_data.amount);
    assert(voidHistory[0].after_data.deleted_at);
    assert.equal((await api(pageQuery)).total,100);
    const voidPage=await api(pageQuery+'&status=void'); assert.equal(voidPage.total,1); assert(voidPage.list[0].deleted_at);
    assert.equal((await api(pageQuery+'&status=all')).total,101);
    assert.equal((await api('/finance/control/transfers?keyword='+marker+'missing')).total,0);
    await api(pageQuery+'&pageSize=101','GET',undefined,400);
    await api(pageQuery+'&status=invalid','GET',undefined,400);
    // Actual route guard: read-only role must not gain create/edit/delete rights.
    const [role] = await db.query('INSERT INTO roles (code,name,status) VALUES (?,?,"active")', [marker, '财务只读测试']); roleId = role.insertId;
    await db.query("INSERT INTO role_permissions (role_id,permission_id) SELECT ?,id FROM permissions WHERE code IN ('menu_finance_income','menu_finance_expense','menu_finance_dashboard')", [roleId]);
    const [user] = await db.query('INSERT INTO users (username,password_hash,display_name,role_id,status) VALUES (?,"NO_LOGIN_PASSWORD",?,?,"active")', [marker, marker, roleId]); userId = user.insertId;
    const readonly = jwt.sign({ sub: userId, username: marker }, env.JWT_SECRET || 'dev_secret_123456', { expiresIn: '5m' });
    await api('/finance/dashboard' + query, 'GET', undefined, 200, readonly);
    await api('/finance-settings/options', 'GET', undefined, 200, readonly);
    await api('/finance/income', 'POST', base, 403, readonly);
    await api(`/finance/income/${income.id}`, 'PATCH', base, 403, readonly);
    await api(`/finance/income/${income.id}`, 'DELETE', {}, 403, readonly);
    await api(`/finance/control/accounts/${accounts[0]}/opening`, 'POST', { date, amount: 1, reason: '权限测试' }, 403, readonly);
    await api('/finance/control/transfers', 'POST', {}, 403, readonly);
    console.log('PASS: validation, duplicate checks, concurrency version, audit, account balances, transfer exclusion, lock/reopen, recycle/restore, dashboard/list totals, read-only permissions');
  } finally {
    // IDs are generated solely by this test. Existing accounts/records/roles are never deleted.
    for (const kind of ['income', 'expense']) for (const id of records[kind]) {
      await db.query('DELETE FROM finance_audit_logs WHERE record_kind=? AND record_id=?', [kind, id]);
      await db.query(`DELETE FROM finance_${kind}_records WHERE id=?`, [id]);
    }
    for (const id of transferIds) { await db.query("DELETE FROM finance_audit_logs WHERE record_kind='transfer' AND record_id=?", [id]); await db.query('DELETE FROM finance_transfers WHERE id=?', [id]); }
    for (const id of accounts) { await db.query("DELETE FROM finance_audit_logs WHERE record_kind='account' AND record_id=?", [id]); await db.query('DELETE FROM finance_fund_accounts WHERE id=? AND owner=?', [id, marker]); }
    if (actorUserId) await db.query('DELETE FROM users WHERE id=? AND username=?', [actorUserId, marker+'actor']);
    if (userId) await db.query('DELETE FROM users WHERE id=? AND username=?', [userId, marker]);
    if (roleId) { await db.query('DELETE FROM role_permissions WHERE role_id=?', [roleId]); await db.query('DELETE FROM roles WHERE id=? AND code=?', [roleId, marker]); }
    await db.end();
  }
});
