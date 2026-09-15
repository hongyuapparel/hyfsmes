const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),mysql=require('mysql2/promise');
test('real pattern report separates completed samples and handoffs without changing plan keys',async()=>{
 const e=require('dotenv').parse(fs.readFileSync('.env'));assert.equal(e.MYSQL_DATABASE,'erp_work_report_0203');assert.ok(['localhost','127.0.0.1'].includes(e.MYSQL_HOST));
 const db=await mysql.createConnection({host:e.MYSQL_HOST,user:e.MYSQL_USER,password:e.MYSQL_PASSWORD,database:e.MYSQL_DATABASE});
 try {
  const [[person]]=await db.query("SELECT id,username,display_name FROM users WHERE display_name='吴小勇'");assert.ok(person);
  const login=await(await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'report_preview_0203',password:'ReportPreview2026!'})})).json();
  const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
  const response=await fetch('http://127.0.0.1:3013/work-reports/'+person.id+'?date='+date,{headers:{Authorization:'Bearer '+login.access_token}});assert.equal(response.status,200);const report=await response.json();
  const samples=report.automatic.find(g=>g.title==='今日样品完成（负责订单）');const patterns=report.automatic.find(g=>g.title==='今日纸样完成');assert.ok(samples);assert.ok(patterns);
  const [[expected]]=await db.query("SELECT COUNT(*) n FROM order_pattern p JOIN orders o ON o.id=p.order_id WHERE o.deleted_at IS NULL AND p.status='completed' AND DATE(p.completed_at)=? AND p.pattern_master IN (?,?)",[date,person.display_name,person.username]);assert.equal(samples.rows.length,expected.n);assert.ok(samples.rows.every(r=>r.title==='样品完成'));
  assert.equal(new Set(patterns.rows.map(r=>r.orderId)).size,patterns.rows.length);
  for(const row of patterns.rows){const [[log]]=await db.query("SELECT COUNT(*) n FROM order_operation_logs WHERE action='production_pattern_assign' AND order_id=? AND DATE(created_at)=?",[row.orderId,date]);assert.ok(log.n>0);assert.ok(row.factory);}
  const queue=report.automatic.find(g=>g.title==='当前纸样队列');assert.ok(queue.rows.every(r=>r.planKey.startsWith('当前纸样队列:')));assert.ok(queue.rows.every(r=>['部门待分单','本人纸样制作中','样品制作中（负责订单）'].includes(r.title)));
  console.log('吴小勇',date,'纸样完成',patterns.rows.length,'样品完成',samples.rows.length,'待办',queue.rows.length);
 }finally{await db.end()}
});
