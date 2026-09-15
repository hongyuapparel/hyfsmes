const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),mysql=require('mysql2/promise');
test('manual order plans persist text-only, date-only, edits and cleared optional fields',async()=>{
 const e=require('dotenv').parse(fs.readFileSync('.env'));assert.equal(e.MYSQL_DATABASE,'erp_work_report_0203');assert.ok(['localhost','127.0.0.1'].includes(e.MYSQL_HOST));
 const db=await mysql.createConnection({host:e.MYSQL_HOST,user:e.MYSQL_USER,password:e.MYSQL_PASSWORD,database:e.MYSQL_DATABASE});
 const login=await(await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'report_preview_0203',password:'ReportPreview2026!'})})).json();
 const headers={Authorization:'Bearer '+login.access_token,'Content-Type':'application/json'};
 const [users]=await db.query("SELECT id FROM users WHERE username='report_qa_merchandiser'");const id=users[0].id;
 const [before]=await db.query('SELECT * FROM work_report_plans WHERE owner_id=?',[id]);const [snapshots]=await db.query('SELECT * FROM work_report_snapshots WHERE owner_id=?',[id]);
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
 const read=async()=>{const r=await fetch('http://127.0.0.1:3013/work-reports/'+id+'?date='+date,{headers});assert.equal(r.status,200);return r.json()};
 try {
  let report=await read();
  const existing=report.tasks.filter(t=>!t.automaticKey&&t.status==='todo').map(t=>({...t,sourceIds:[t.id],done:false,end:false}));
  const catalog=await(await fetch('http://127.0.0.1:3013/work-reports/orders',{headers})).json();
  const orders=catalog.filter(o=>o.orderType==='sample'&&!existing.some(t=>t.orders.includes(o.no))).slice(0,2);assert.equal(orders.length,2);
  const extra=orders.map((o,i)=>({id:'save-check-'+i,order:o.no,orders:[o.no],sourceIds:[],section:'sample',title:i?'':'保存回读测试',date:i?date:'',done:false,end:false}));
  const save=async drafts=>{const r=await fetch('http://127.0.0.1:3013/work-reports/'+id+'/plan',{method:'PUT',headers,body:JSON.stringify({version:report.version,drafts})});assert.equal(r.status,200,await r.text());report=await read()};
  await save([...existing,...extra]);
  const first=()=>report.tasks.find(t=>t.status==='todo'&&t.order===orders[0].no);
  const second=()=>report.tasks.find(t=>t.status==='todo'&&t.order===orders[1].no);
  assert.equal(first().title,'保存回读测试');assert.equal(first().date,'');assert.equal(second().date,date);assert.equal(second().title,'');
  const edit=()=>report.tasks.filter(t=>!t.automaticKey&&t.status==='todo').map(t=>({...t,sourceIds:[t.id],done:false,end:false}));
  await save(edit().map(t=>t.order===orders[0].no?{...t,title:'再次编辑回读测试',date}:t));assert.equal(first().title,'再次编辑回读测试');assert.equal(first().date,date);
  await save(edit().map(t=>orders.some(o=>o.no===t.order)?{...t,title:'',date:''}:t));assert.equal(first().title,'');assert.equal(second().date,'');
 }finally {
  for(const [table,rows] of [['work_report_snapshots',snapshots],['work_report_plans',before]]){await db.query('DELETE FROM '+table+' WHERE owner_id=?',[id]);for(const row of rows)await db.query('INSERT INTO '+table+' SET ?',{...row,tasks:typeof row.tasks==='string'?row.tasks:JSON.stringify(row.tasks)});}
  await db.end();
 }
});
