const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),mysql=require('mysql2/promise');
const {applyReportBatch}=require('../dist/work-reports/work-report-plan');

test('persisted source authorizes only its own order and section, including after reclassification',()=>{
 const old={id:'saved',owner:'52',order:'A',orders:['A'],section:'sample',title:'原安排',date:'',status:'todo',completedDate:'',history:[]};
 const row={...old,sourceIds:['saved'],done:false,end:true};
 const context={owner:'52',today:'2026-09-27',orders:[{no:'A',orderType:'bulk'}]};
 assert.equal(applyReportBatch([old],[row],()=> 'history',context).find(t=>t.id==='saved').status,'ended');
 assert.throws(()=>applyReportBatch([old],[{...row,orders:['B'],order:'B'}],()=> 'id',context),/订单 B/);
 assert.throws(()=>applyReportBatch([{...old,owner:'other'}],[row],()=> 'id',context),/订单 A/);
 assert.throws(()=>applyReportBatch([old],[{...row,section:'bulk'}],()=> 'id',{...context,orders:[]}),/订单 A/);
 assert.throws(()=>applyReportBatch([],[{...row,sourceIds:[]}],()=> 'id',context),/订单 A/);
});

test('ordinary owner can save and end existing plans after order access changes; new orders stay protected',async()=>{
 const e=require('dotenv').parse(fs.readFileSync('.env'));
 assert.equal(e.MYSQL_DATABASE,'erp_work_report_0203');assert.ok(['localhost','127.0.0.1'].includes(e.MYSQL_HOST));
 const db=await mysql.createConnection({host:e.MYSQL_HOST,user:e.MYSQL_USER,password:e.MYSQL_PASSWORD,database:e.MYSQL_DATABASE,dateStrings:true});
 const [users]=await db.query("SELECT id FROM users WHERE username='report_employee_0203'");const owner=users[0].id;
 const [before]=await db.query('SELECT * FROM work_report_plans WHERE owner_id=?',[owner]);
 const [snapshots]=await db.query('SELECT * FROM work_report_snapshots WHERE owner_id=?',[owner]);
 const json=v=>typeof v==='string'?v:JSON.stringify(v);
 try {
  const login=await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'report_employee_0203',password:'ReportPreview2026!'})});assert.equal(login.status,201);
  const headers={Authorization:'Bearer '+(await login.json()).access_token,'Content-Type':'application/json'};
  const catalog=await(await fetch('http://127.0.0.1:3013/work-reports/orders',{headers})).json();
  const foreign=catalog.filter(o=>o.orderType==='sample'&&o.merchandiser&&!o.merchandiser.includes('报告联调'));assert.ok(foreign.length>=2);
  const make=(id,no)=>({id,owner:String(owner),order:no,orders:[no],section:'sample',title:'昨日安排',date:'2026-09-23',status:'todo',completedDate:'',history:[]});
  const tasks=[make('existing-reassigned',foreign[0].no),make('existing-unavailable','__REPORT_REMOVED_ORDER__')];
  await db.query('INSERT INTO work_report_plans(owner_id,version,tasks) VALUES (?,1,?) ON DUPLICATE KEY UPDATE version=1,tasks=VALUES(tasks)',[owner,JSON.stringify(tasks)]);
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
  const read=async()=>{const r=await fetch(`http://127.0.0.1:3013/work-reports/${owner}?date=${date}`,{headers});assert.equal(r.status,200);return r.json()};
  const save=(version,drafts)=>fetch(`http://127.0.0.1:3013/work-reports/${owner}/plan`,{method:'PUT',headers,body:JSON.stringify({version,drafts})});
  let drafts=tasks.map(t=>({...t,sourceIds:[t.id],done:false,end:t.id==='existing-unavailable'}));drafts[0].title='今天修改的下一步';drafts[0].date=date;
  let response=await save(1,drafts);assert.equal(response.status,200,await response.text());
  let report=await read();assert.equal(report.version,2);assert.equal(report.tasks.find(t=>t.id==='existing-reassigned').title,'今天修改的下一步');assert.equal(report.tasks.find(t=>t.id==='existing-unavailable').status,'ended');
  drafts=report.tasks.filter(t=>t.status==='todo').map(t=>({...t,sourceIds:[t.id],done:false,end:false}));
  const bad={...make('forged-new',foreign[1].no),sourceIds:[],done:false,end:false};
  response=await save(2,[...drafts,bad]);assert.equal(response.status,400);assert.ok((await response.text()).includes(foreign[1].no));assert.equal((await read()).version,2);
  response=await save(2,[{...drafts[0],sourceIds:['someone-elses-task']}]);assert.equal(response.status,400);
  response=await save(2,[{...drafts[0],end:true}]);assert.equal(response.status,200,await response.text());
  report=await read();assert.equal(report.version,3);assert.ok(report.tasks.every(t=>t.status!=='todo'));assert.ok(report.tasks.some(t=>t.status==='deferred'&&t.title==='昨日安排'));
 } finally {
  await db.query('DELETE FROM work_report_snapshots WHERE owner_id=?',[owner]);for(const row of snapshots)await db.query('INSERT INTO work_report_snapshots SET ?',{...row,tasks:json(row.tasks)});
  await db.query('DELETE FROM work_report_plans WHERE owner_id=?',[owner]);for(const row of before)await db.query('INSERT INTO work_report_plans SET ?',{...row,tasks:json(row.tasks)});
  await db.end();
 }
});
