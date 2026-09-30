const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),mysql=require('mysql2/promise');

test('daily submission: opening is not submission, carryover, exact history, repeat editing and permissions for all report roles',async()=>{
 const e=require('dotenv').parse(fs.readFileSync('.env'));
 assert.equal(e.MYSQL_DATABASE,'erp_work_report_0203');assert.ok(['localhost','127.0.0.1'].includes(e.MYSQL_HOST));assert.equal(e.PORT,'3013');
 const db=await mysql.createConnection({host:e.MYSQL_HOST,user:e.MYSQL_USER,password:e.MYSQL_PASSWORD,database:e.MYSQL_DATABASE});
 const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
 const ago=n=>new Date(Date.parse(today+'T12:00:00Z')-n*86400000).toISOString().slice(0,10);
 async function login(username){const r=await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'ReportPreview2026!'})});assert.equal(r.status,201);return (await r.json()).access_token;}
 const admin=await login('report_preview_0203');
 async function api(path,token,body){const r=await fetch('http://127.0.0.1:3013/work-reports/'+path,{method:body?'PUT':'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 try{
  assert.equal((await api('submissions?start=invalid&end='+today,admin)).status,400);
  assert.equal((await api('submissions?start='+ago(32)+'&end='+today,admin)).status,400);
  for(const role of ['merchandiser','purchase','pattern','cutting','sewing','finishing','inventory']){
   const username='report_qa_'+role,token=await login(username),[[user]]=await db.query('SELECT id FROM users WHERE username=?',[username]),id=user.id;
   const backups=[];for(const table of ['work_report_plans','work_report_snapshots']){const [rows]=await db.query('SELECT * FROM '+table+' WHERE owner_id=?',[id]);backups.push([table,rows]);}
   try{
    await db.query('DELETE FROM work_report_snapshots WHERE owner_id=?',[id]);
    const task={id:'submission-carryover',owner:String(id),order:'',orders:[],section:'other',title:'上次安排：确认部门进度',date:ago(1),status:'todo',completedDate:'',history:[]};
    const json=JSON.stringify([task]);
    await db.query('INSERT INTO work_report_plans(owner_id,version,tasks) VALUES (?,1,?) ON DUPLICATE KEY UPDATE version=1,tasks=VALUES(tasks)',[id,json]);
    for(const date of [ago(1),ago(3)])await db.query('INSERT INTO work_report_snapshots(owner_id,report_date,tasks) VALUES (?,?,?)',[id,date,json]);
    const read=async(date=today)=>(await api(id+'?date='+date,token)).data;
    let report=await read();assert.equal(report.submitted,false);assert.deepEqual(report.tasks,[task]);
    const submitted=async()=>{const r=await api('submissions?start='+ago(3)+'&end='+today,token);assert.equal(r.status,200);return r.data.filter(r=>r.ownerId===id);};
    assert.deepEqual((await submitted()).map(r=>r.reportDate),[ago(1),ago(3)]);
    assert.equal((await read(ago(2))).submitted,false);assert.deepEqual((await read(ago(2))).tasks,[]);
    const draft={...task,sourceIds:[task.id],done:false,end:false};
    const invalid=await api(id+'/plan',token,{version:1,drafts:[{...draft,date:'bad'}],reportDate:today});assert.equal(invalid.status,400);assert.equal((await read()).submitted,false);
    const wrongDay=await api(id+'/plan',token,{version:1,drafts:[draft],reportDate:ago(1)});assert.equal(wrongDay.status,400);
    const payload={version:1,drafts:[draft],automaticPlans:[],reportDate:today};
    const saved=await api(id+'/plan',token,payload);assert.equal(saved.status,200,JSON.stringify(saved.data));assert.equal(saved.data.submitted,true);
    report=await read();assert.equal(report.submitted,true);assert.equal(report.tasks.find(t=>t.status==='todo').title,task.title);
    assert.deepEqual((await submitted()).map(r=>r.reportDate),[today,ago(1),ago(3)]);
    assert.equal((await api(id+'/plan',token,payload)).status,409);
    const live=report.tasks.find(t=>t.status==='todo');const changed={...live,sourceIds:[live.id],title:'今日核对后修改安排',date:today,done:false,end:false};
    const edit=await api(id+'/plan',token,{version:report.version,drafts:[changed],reportDate:today});assert.equal(edit.status,200);
    assert.equal((await read()).tasks.find(t=>t.status==='todo').title,changed.title);
    assert.deepEqual((await read(ago(1))).tasks,[task]);
    const other=(await api('people',token)).data.find(p=>p.username==='report_preview_0203');
    assert.equal((await api(other.id+'/plan',token,{version:0,drafts:[],reportDate:today})).status,403);
    report=await read();assert.equal((await api(id+'/plan',admin,{version:report.version,drafts:[{...changed,title:'管理员代编辑'}],reportDate:today})).status,200);
    assert.equal((await read()).tasks.find(t=>t.status==='todo').title,'管理员代编辑');
    console.log(role+': open/cancel semantics, unchanged submission, re-edit, exact history and admin permissions passed');
   }finally{for(const [table,rows]of backups){await db.query('DELETE FROM '+table+' WHERE owner_id=?',[id]);for(const row of rows)await db.query('INSERT INTO '+table+' SET ?',{...row,tasks:typeof row.tasks==='string'?row.tasks:JSON.stringify(row.tasks)});}}
  }
 }finally{await db.end();}
});
