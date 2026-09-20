const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),mysql=require('mysql2/promise');

test('all roles carry yesterday plans into today without overwriting history',async()=>{
 const e=require('dotenv').parse(fs.readFileSync('.env'));
 assert.equal(e.MYSQL_DATABASE,'erp_work_report_0203');assert.ok(['localhost','127.0.0.1'].includes(e.MYSQL_HOST));
 const db=await mysql.createConnection({host:e.MYSQL_HOST,user:e.MYSQL_USER,password:e.MYSQL_PASSWORD,database:e.MYSQL_DATABASE});
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
 const yesterday=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10);
 try {for(const role of ['merchandiser','purchase','pattern','cutting','sewing','finishing','inventory']){
  const username='report_qa_'+role;
  const login=await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:role==='merchandiser'?'report_preview_0203':username,password:'ReportPreview2026!'})});assert.equal(login.status,201);
  const headers={Authorization:'Bearer '+(await login.json()).access_token,'Content-Type':'application/json'};
  const [users]=await db.query('SELECT id FROM users WHERE username=?',[username]);const id=users[0].id;
  const backups=[];for(const table of ['work_report_plans','work_report_snapshots']){const [rows]=await db.query('SELECT * FROM '+table+' WHERE owner_id=?',[id]);backups.push([table,rows]);}
  const read=async date=>{const r=await fetch('http://127.0.0.1:3013/work-reports/'+id+'?date='+date,{headers});assert.equal(r.status,200);return r.json()};
  try {
   const initial=await read(today);
   let order='',section='other',automaticKey;
   if(role==='merchandiser'){
    const catalog=await(await fetch('http://127.0.0.1:3013/work-reports/orders',{headers})).json();const o=catalog.find(o=>o.active);assert.ok(o);order=o.no;section=o.orderType;
   }else{automaticKey=initial.automatic.flatMap(g=>g.rows).find(r=>r.planKey)?.planKey;assert.ok(automaticKey);}
   const task={id:'carryover-check',owner:String(id),order,orders:order?[order]:[],section,title:'昨天安排：确认进度',date:yesterday,status:'todo',completedDate:'',recordedDate:yesterday,history:[],...(automaticKey?{automaticKey}:{})};
   const json=JSON.stringify([task]);
   await db.query('INSERT INTO work_report_plans(owner_id,version,tasks) VALUES (?,1,?) ON DUPLICATE KEY UPDATE version=1,tasks=VALUES(tasks)',[id,json]);
   await db.query('INSERT INTO work_report_snapshots(owner_id,report_date,tasks) VALUES (?,?,?) ON DUPLICATE KEY UPDATE tasks=VALUES(tasks)',[id,yesterday,json]);
   let report=await read(today);assert.deepEqual(report.tasks,[task]);
   const changed={...task,title:'今天修改：安排交接',date:today,sourceIds:[task.id],done:false,end:false};
   const payload={version:report.version,drafts:automaticKey?[]:[changed],automaticPlans:automaticKey?[{key:automaticKey,title:changed.title,date:today}]:[]};
   const saved=await fetch('http://127.0.0.1:3013/work-reports/'+id+'/plan',{method:'PUT',headers,body:JSON.stringify(payload)});assert.equal(saved.status,200,await saved.text());
   report=await read(today);assert.ok(report.tasks.some(t=>t.status==='todo'&&t.title===changed.title&&t.date===today));
   assert.deepEqual((await read(yesterday)).tasks,[task]);
   console.log(role+': yesterday retained, today editable, original due date carried');
  }finally{
   for(const [table,rows] of backups){await db.query('DELETE FROM '+table+' WHERE owner_id=?',[id]);for(const row of rows)await db.query('INSERT INTO '+table+' SET ?',{...row,tasks:typeof row.tasks==='string'?row.tasks:JSON.stringify(row.tasks)});}
  }
 }}finally{await db.end();}
});
