const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('report readers can view other departments but cannot edit others or settings',async()=>{
 const env=require('dotenv').parse(fs.readFileSync('.env'));assert.equal(env.MYSQL_DATABASE,'erp_work_report_0203');assert.ok(['localhost','127.0.0.1'].includes(env.MYSQL_HOST));
 const login=await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'report_employee_0203',password:'ReportPreview2026!'})});assert.equal(login.status,201);
 const token=(await login.json()).access_token,headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const get=path=>fetch('http://127.0.0.1:3013/work-reports/'+path,{headers});
 const people=await(await get('people')).json();assert.ok(people.length>1);const other=people.find(p=>p.username==='report_preview_0203');assert.ok(other);
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
 assert.equal((await get(other.id+'?date='+date)).status,200);
 assert.equal((await get('orders')).status,200);
 assert.equal((await get('settings')).status,403);
 const save=await fetch('http://127.0.0.1:3013/work-reports/'+other.id+'/plan',{method:'PUT',headers,body:JSON.stringify({version:0,drafts:[],automaticPlans:[]})});assert.equal(save.status,403);
 const settings=await fetch('http://127.0.0.1:3013/work-reports/settings',{method:'PUT',headers,body:'{}'});assert.equal(settings.status,403);
 assert.equal((await fetch('http://127.0.0.1:3013/work-reports/people')).status,401);
});

test('finishing ends at warehouse handoff; packing-list shipment belongs to warehouse reports',async()=>{
 const env=require('dotenv').parse(fs.readFileSync('.env'));assert.equal(env.MYSQL_DATABASE,'erp_work_report_0203');assert.ok(['localhost','127.0.0.1'].includes(env.MYSQL_HOST));
 const db=await require('mysql2/promise').createConnection({host:env.MYSQL_HOST,user:env.MYSQL_USER,password:env.MYSQL_PASSWORD,database:env.MYSQL_DATABASE});
 try {
  const login=await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'report_employee_0203',password:'ReportPreview2026!'})});assert.equal(login.status,201);
  const headers={Authorization:'Bearer '+(await login.json()).access_token};
  const get=async path=>{const r=await fetch('http://127.0.0.1:3013/work-reports/'+path,{headers});assert.equal(r.status,200);return r.json()};
  const people=await get('people');const tail=people.find(p=>p.codes.split(',').includes('finishing')),warehouse=people.find(p=>p.codes.split(',').includes('inventory')),merchandiser=people.find(p=>p.codes.split(',').includes('merchandiser'));
  assert.ok(tail&&warehouse&&merchandiser);
  const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
  const [[last]]=await db.query("SELECT DATE_FORMAT(MAX(completed_at),'%Y-%m-%d') date FROM order_finishing WHERE status='inbound'");assert.ok(last.date);
  for(const date of new Set([today,last.date])){
   const report=await get(tail.id+'?date='+date);assert.ok(report.automatic.some(g=>g.title==='当前尾部待办（部门）'));
   const completed=report.automatic.find(g=>g.title==='当天尾部完成（部门）');assert.ok(completed);assert.ok(completed.note.includes('待仓处理'));
   assert.ok(!report.automatic.some(g=>g.title.includes('出货')||g.rows.some(r=>r.title.startsWith('装箱单 '))));
   if(date===last.date)assert.ok(completed.rows.length>0,'historical finishing completions must remain visible');
  }
  const warehouseReport=await get(warehouse.id+'?date='+today);assert.ok(warehouseReport.automatic.some(g=>g.title==='当前仓库待处理（部门）'));assert.ok(warehouseReport.automatic.some(g=>g.title==='今日出货（部门）'));
  const merchandiserReport=await get(merchandiser.id+'?date='+today);assert.ok(merchandiserReport.automatic.some(g=>g.title==='今日出货（跟进订单）'));
 }finally{await db.end()}
});
