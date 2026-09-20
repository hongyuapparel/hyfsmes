const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const mysql=require('mysql2/promise'),dotenv=require('dotenv');
test('isolated ERP report integration: permissions, persistence, conflict, historical snapshots, actual business counts',async()=>{
 const e=dotenv.parse(fs.readFileSync('.env'));assert.equal(e.MYSQL_DATABASE,'erp_work_report_0203');assert.ok(['localhost','127.0.0.1'].includes(e.MYSQL_HOST));
 const db=await mysql.createConnection({host:e.MYSQL_HOST,user:e.MYSQL_USER,password:e.MYSQL_PASSWORD,database:e.MYSQL_DATABASE});
 async function login(username){const r=await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'ReportPreview2026!'})});assert.equal(r.status,201);return (await r.json()).access_token}
 const admin=await login('report_preview_0203'),employee=await login('report_employee_0203');
 async function api(path,token=admin,method='GET',body){const r=await fetch('http://127.0.0.1:3013/work-reports/'+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()}}
 const backups=[];let ownerId;
 try {
  const people=await api('people');assert.equal(people.status,200);assert.ok(people.data.length>10);
  const own=(await api('people',employee)).data;assert.equal(own.length,1);
  const me=people.data.find(p=>p.username==='report_preview_0203');assert.ok(me);ownerId=me.id;for(const table of ['work_report_plans','work_report_snapshots']){const [rows]=await db.query('SELECT * FROM '+table+' WHERE owner_id=?',[ownerId]);backups.push([table,rows]);}
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
  assert.equal((await api(me.id+'?date='+date,employee)).status,403);
  assert.equal((await api(me.id+'?date=invalid')).status,400);
  // Only disposable preview account report rows are cleared; business orders remain untouched.
  await db.query('DELETE FROM work_report_snapshots WHERE owner_id=?',[me.id]);
  await db.query('DELETE FROM work_report_plans WHERE owner_id=?',[me.id]);
  const catalog=(await api('orders')).data;
  const pair=catalog.filter(o=>o.orderType==='sample').slice(0,2);assert.equal(pair.length,2);
  const drafts=[
   {id:'new-orders',section:'sample',order:pair[0].no,orders:pair.map(o=>o.no),sourceIds:[],title:'联调：两款共同确认资料',date,done:false},
   {id:'new-other',section:'other',order:'',orders:[],sourceIds:[],title:'联调：需要仓管协助查找样衣',date,done:false,needsHelp:true}
  ];
  const saved=await api('mine',admin,'PUT',{version:0,drafts});assert.equal(saved.status,200);assert.equal(saved.data.tasks.length,2);
  assert.equal((await api('mine',admin,'PUT',{version:0,drafts})).status,409);
  const read=(await api(me.id+'?date='+date)).data;assert.equal(read.version,1);assert.equal(read.tasks.length,2);
  const edit=read.tasks.map(t=>({...t,sourceIds:[t.id],done:false,end:false}));
  const original=edit.find(t=>t.section==='sample');
  const split=pair.map((o,i)=>({...original,id:i?'split-test':original.id,order:o.no,orders:[o.no],title:i?original.title:'联调：安排尾部查货',done:!i}));
  const after=await api('mine',admin,'PUT',{version:1,drafts:[...split,edit.find(t=>t.section==='other')]});assert.equal(after.status,200);
  const completed=after.data.tasks.filter(t=>t.status==='done');assert.equal(completed.length,1);assert.deepEqual(completed[0].orders,[pair[0].no]);
  assert.equal(after.data.tasks.filter(t=>t.status==='todo').length,3);
  assert.equal((await api('mine',admin,'PUT',{version:2,drafts:[]})).status,400);
  const historical=await api(me.id+'?date=2020-01-01');assert.equal(historical.data.tasks.length,0);assert.equal(historical.data.historicalMissing,true);
  const [snap]=await db.query('SELECT report_date,tasks FROM work_report_snapshots WHERE owner_id=?',[me.id]);assert.equal(snap.length,1);
  for(const code of ['pattern','cutting','sewing','purchase']) {
    const p=people.data.find(p=>p.codes.split(',').includes(code));assert.ok(p,code+' person');
    let selectedDate=date;
    if(code!=='purchase'){const [latest]=await db.query('SELECT DATE_FORMAT(MAX(completed_at),"%Y-%m-%d") d FROM order_'+code);selectedDate=latest[0].d||date}
    if(code==='purchase'){
      const [materials]=await db.query('SELECT e.materials FROM order_ext e JOIN orders o ON o.id=e.order_id WHERE o.deleted_at IS NULL AND e.materials IS NOT NULL');
      const all=materials.flatMap(r=>typeof r.materials==='string'?JSON.parse(r.materials):r.materials).filter(m=>m.purchaseStatus==='completed'&&m.purchaseCompletedAt);
      selectedDate=all.map(m=>m.purchaseCompletedAt.slice(0,10)).sort().at(-1);
      assert.ok(selectedDate);
    }
    const report=await api(p.id+'?date='+selectedDate);assert.equal(report.status,200,JSON.stringify(report.data));assert.ok(report.data.automatic.length);
    if(code==='purchase') assert.ok(report.data.automatic.find(g=>g.title==='当天采购完成（部门）').rows.length>0);
    if(code==='pattern'){
      const [counts]=await db.query('SELECT COUNT(*) n FROM order_pattern p JOIN orders o ON o.id=p.order_id WHERE o.deleted_at IS NULL AND p.status="completed" AND DATE(p.completed_at)=? AND p.pattern_master IN (?,?)',[selectedDate,p.name,p.username]);
      assert.equal(report.data.automatic.find(g=>g.title.includes(code==='pattern'?'样品完成':'完成')).rows.length,counts[0].n);assert.ok(counts[0].n>0);
    }
    if(code==='cutting'||code==='sewing'){
     const [counts]=await db.query('SELECT COUNT(*) n FROM order_'+code+' p JOIN orders o ON o.id=p.order_id WHERE o.deleted_at IS NULL AND p.status="completed" AND DATE(p.completed_at)=?',[selectedDate]);
     assert.equal(report.data.automatic.find(g=>g.title.includes(code==='pattern'?'样品完成':'完成')).rows.length,counts[0].n);assert.ok(counts[0].n>0);
    }
    console.log(code,selectedDate,report.data.automatic.map(g=>({title:g.title,count:g.rows.length})));
  }
  console.log('Reports persisted for preview account '+me.id+'; real orders unchanged.');
 }finally{for(const [table,rows]of backups){await db.query('DELETE FROM '+table+' WHERE owner_id=?',[ownerId]);for(const row of rows)await db.query('INSERT INTO '+table+' SET ?',{...row,tasks:typeof row.tasks==='string'?row.tasks:JSON.stringify(row.tasks)});}await db.end()}
});
