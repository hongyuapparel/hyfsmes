const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),mysql=require('mysql2/promise');
test('admin edits another report repeatedly without changing ownership; normal users cannot',async()=>{
 const e=require('dotenv').parse(fs.readFileSync('.env'));assert.equal(e.MYSQL_DATABASE,'erp_work_report_0203');assert.ok(['localhost','127.0.0.1'].includes(e.MYSQL_HOST));const db=await mysql.createConnection({host:e.MYSQL_HOST,user:e.MYSQL_USER,password:e.MYSQL_PASSWORD,database:e.MYSQL_DATABASE});
 const login=await(await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'report_preview_0203',password:'ReportPreview2026!'})})).json();const headers={Authorization:'Bearer '+login.access_token,'Content-Type':'application/json'};const [users]=await db.query("SELECT id FROM users WHERE username='report_qa_purchase'");const id=users[0].id;
 const [admins]=await db.query("SELECT id FROM users WHERE username='report_preview_0203'");const adminId=admins[0].id;
 const [adminBefore]=await db.query('SELECT version,tasks FROM work_report_plans WHERE owner_id=?',[adminId]);
 const [before]=await db.query('SELECT * FROM work_report_plans WHERE owner_id=?',[id]);const [snapshots]=await db.query('SELECT * FROM work_report_snapshots WHERE owner_id=?',[id]);
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());const read=async()=>{const r=await fetch('http://127.0.0.1:3013/work-reports/'+id+'?date='+date,{headers});assert.equal(r.status,200);return r.json()};
 try{let report=await read();const keys=report.automatic.flatMap(g=>g.rows.map(r=>r.planKey).filter(Boolean));assert.ok(keys.length>1);assert.equal(new Set(keys).size,keys.length);
 const drafts=report.tasks.filter(t=>!t.automaticKey&&t.status==='todo').map(t=>({...t,sourceIds:[t.id],orders:t.orders||[],done:false,end:false}));
 const save=async plans=>{const r=await fetch('http://127.0.0.1:3013/work-reports/'+id+'/plan',{method:'PUT',headers,body:JSON.stringify({version:report.version,drafts,automaticPlans:plans})});assert.equal(r.status,200,await r.text());report=await read()};
 await save([{key:keys[0],title:'确认交期',date:''},{key:keys[1],title:'',date}]);assert.equal(report.tasks.find(t=>t.automaticKey===keys[0]).date,'');assert.equal(report.tasks.find(t=>t.automaticKey===keys[1]).title,'');
 assert.ok(report.tasks.filter(t=>t.automaticKey).every(t=>t.owner===String(id)));
 const stale=await fetch('http://127.0.0.1:3013/work-reports/'+id+'/plan',{method:'PUT',headers,body:JSON.stringify({version:report.version-1,drafts,automaticPlans:[]})});assert.equal(stale.status,409);
 await save([{key:keys[0],title:'再次编辑',date:''}]);assert.equal(report.tasks.find(t=>t.automaticKey===keys[0]).title,'再次编辑');
 const normal=await(await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'report_employee_0203',password:'ReportPreview2026!'})})).json();
 assert.equal((await fetch('http://127.0.0.1:3013/work-reports/'+id+'/plan',{method:'PUT',headers:{Authorization:'Bearer '+normal.access_token,'Content-Type':'application/json'},body:JSON.stringify({version:report.version,drafts:[],automaticPlans:[]})})).status,403);
 const [adminAfter]=await db.query('SELECT version,tasks FROM work_report_plans WHERE owner_id=?',[adminId]);assert.deepEqual(adminAfter,adminBefore);
 await save([{key:keys[0],title:'',date:''},{key:keys[1],title:'',date:''}]);assert.ok(!report.tasks.some(t=>keys.slice(0,2).includes(t.automaticKey)));
 const bad=await fetch('http://127.0.0.1:3013/work-reports/'+id+'/plan',{method:'PUT',headers,body:JSON.stringify({version:report.version,drafts,automaticPlans:[{key:'not-authorized',title:'',date:''}]})});assert.equal(bad.status,400);
 }finally{await db.query('DELETE FROM work_report_snapshots WHERE owner_id=?',[id]);for(const row of snapshots)await db.query('INSERT INTO work_report_snapshots SET ?',{...row,tasks:typeof row.tasks==='string'?row.tasks:JSON.stringify(row.tasks)});await db.query('DELETE FROM work_report_plans WHERE owner_id=?',[id]);for(const row of before)await db.query('INSERT INTO work_report_plans SET ?',{...row,tasks:typeof row.tasks==='string'?row.tasks:JSON.stringify(row.tasks)});await db.end();}
});
