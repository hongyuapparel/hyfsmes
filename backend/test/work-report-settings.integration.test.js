const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const mysql=require('mysql2/promise'),dotenv=require('dotenv');
test('report settings: admin only, validation, persistence, conflict, directory scope, no lost plans',async()=>{
 const e=dotenv.parse(fs.readFileSync('.env'));assert.equal(e.MYSQL_DATABASE,'erp_work_report_0203');assert.ok(['localhost','127.0.0.1'].includes(e.MYSQL_HOST));
 const db=await mysql.createConnection({host:e.MYSQL_HOST,user:e.MYSQL_USER,password:e.MYSQL_PASSWORD,database:e.MYSQL_DATABASE});
 const [before]=await db.query('SELECT * FROM work_report_settings WHERE id=1');
 const [plansBefore]=await db.query('SELECT owner_id,version,tasks FROM work_report_plans ORDER BY owner_id');
 async function login(username){const r=await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'ReportPreview2026!'})});assert.equal(r.status,201);return (await r.json()).access_token}
 const admin=await login('report_preview_0203'),employee=await login('report_employee_0203');
 async function api(path,token=admin,method='GET',body){const r=await fetch('http://127.0.0.1:3013/work-reports/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}}
 let fixtureId=0;
 try {
  assert.equal((await api('settings',employee)).status,403);
  assert.equal((await api('settings',employee,'PUT',{version:0,rules:[]})).status,403);
  const initial=(await api('settings')).data;const me=initial.people.find(p=>p.username==='report_preview_0203');const auto=initial.people.find(p=>p.codes.split(',').includes('pattern'));
  const templates=initial.templates;
  const rules=[{ownerId:me.id,enabled:true,templateId:'general'},{ownerId:auto.id,enabled:true,templateId:'pattern'}];
  for(const bad of [{...rules[0],enabled:'yes'},{...rules[0],templateId:'missing'},{...rules[0],ownerId:999999}])assert.equal((await api('settings',admin,'PUT',{version:initial.version,rules:[bad],templates})).status,400);
  assert.equal((await api('settings',admin,'PUT',{version:initial.version,rules:[rules[0],rules[0]],templates})).status,400);
  const invalidTemplates=templates.map(t=>({...t,manualSections:[],automaticSources:[]}));
  assert.equal((await api('settings',admin,'PUT',{version:initial.version,rules,templates:invalidTemplates})).status,400);
  const saved=await api('settings',admin,'PUT',{version:initial.version,rules,templates});assert.equal(saved.status,200,JSON.stringify(saved.data));
  assert.equal((await api('settings',admin,'PUT',{version:initial.version,rules,templates})).status,409);
  assert.deepEqual((await api('settings')).data.rules,rules);
  const patternReport=await api(auto.id+'?date=2026-06-12');assert.equal(patternReport.status,200);assert.ok(patternReport.data.automatic.length);assert.deepEqual(patternReport.data.template.manualSections,['other']);
  const directory=(await api('directory')).data;assert.deepEqual(directory.people.map(p=>p.id).sort((a,b)=>a-b),[me.id,auto.id].sort((a,b)=>a-b));assert.equal((await api('directory',employee)).data.people.length,0);
  const finishing=initial.people.find(p=>p.codes.split(',').includes('finishing'));assert.ok(finishing);const tail=await api(finishing.id+'?date=2026-06-12');assert.ok(!tail.data.template.manualSections.includes('sample'));
  // Exercise the actual purchase registration endpoint using only a disposable fixture.
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
  const purchasePerson=initial.people.find(p=>p.codes.split(',').includes('purchase'));assert.ok(purchasePerson);
  const fixtureNo='__REPORT_TEMPLATE_TEST_'+Date.now();
  const [created]=await db.query("INSERT INTO orders(order_no,sku_code,status,status_time,order_date) VALUES (?,?,'pending_purchase',NOW(),NOW())",[fixtureNo,fixtureNo]);fixtureId=created.insertId;
  await db.query('INSERT INTO order_ext(order_id,materials) VALUES (?,?)',[fixtureId,JSON.stringify([{materialName:'测试面料',purchaseStatus:'pending',purchaseQuantity:12},{materialName:'测试辅料',purchaseStatus:'pending',purchaseQuantity:3}])]);
  const snapshot=async()=>{const [r]=await db.query('SELECT id,status,updated_at FROM orders WHERE id<>? ORDER BY id',[fixtureId]);return r};const unrelated=await snapshot();
  const first=await api(purchasePerson.id+'?date='+date);assert.equal(first.status,200,JSON.stringify(first.data));
  const ownPending=first.data.automatic[0].rows.filter(r=>r.orderId===fixtureId);assert.equal(ownPending.length,2);assert.equal(ownPending[0].status,'等待采购');assert.deepEqual(await snapshot(),unrelated);
  const registration=await fetch('http://127.0.0.1:3013/production/purchase/items/register',{method:'POST',headers:{Authorization:'Bearer '+admin,'Content-Type':'application/json'},body:JSON.stringify({orderId:fixtureId,materialIndex:0,actualPurchaseQuantity:12,unitPrice:'0',otherCost:'0',remark:'测试说明：已确认采购完成'})});assert.equal(registration.status,201,await registration.text());
  const after=await api(purchasePerson.id+'?date='+date);assert.equal(after.data.automatic[0].rows.filter(r=>r.orderId===fixtureId).length,1);const done=after.data.automatic[1].rows.find(r=>r.orderId===fixtureId);assert.equal(done.status,'采购完成');assert.equal(done.quantity,12);assert.equal(done.remark,'测试说明：已确认采购完成');assert.deepEqual(await snapshot(),unrelated);
  const history=await api(purchasePerson.id+'?date=2026-06-12');assert.equal(history.data.automatic[0].rows.length,0);
  const [plansAfter]=await db.query('SELECT owner_id,version,tasks FROM work_report_plans ORDER BY owner_id');assert.deepEqual(plansAfter,plansBefore);
  const changedTemplates=templates.map(t=>t.id==='pattern'?{...t,automaticSources:[]}:t);
  const changed=await api('settings',admin,'PUT',{version:saved.data.version,rules,templates:changedTemplates});assert.equal(changed.status,200);assert.ok((await api(auto.id+'?date='+date)).data.automatic.length>0);
  assert.equal((await api('settings',admin,'PUT',{version:changed.data.version,rules:[],templates})).status,200);assert.equal((await api('directory')).data.people.length,0);
 }finally{
  if(fixtureId){await db.query('DELETE FROM order_operation_logs WHERE order_id=?',[fixtureId]);await db.query('DELETE FROM order_ext WHERE order_id=?',[fixtureId]);await db.query('DELETE FROM orders WHERE id=? AND order_no LIKE ?', [fixtureId,'__REPORT_TEMPLATE_TEST_%']);}
  // Restore only this isolated preview's settings; never touch orders or work plans.
  if(before.length)await db.query('UPDATE work_report_settings SET version=?,rules=?,updated_at=? WHERE id=1',[before[0].version,before[0].rules==null?null:typeof before[0].rules==='string'?before[0].rules:JSON.stringify(before[0].rules),before[0].updated_at]);
  else await db.query('UPDATE work_report_settings SET version=0,rules=NULL WHERE id=1');
  await db.end();
 }
});
