const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),mysql=require('mysql2/promise');
test('daily completions are dated business records, not current queues',async()=>{
 const e=require('dotenv').parse(fs.readFileSync('.env'));assert.equal(e.MYSQL_DATABASE,'erp_work_report_0203');assert.ok(['localhost','127.0.0.1'].includes(e.MYSQL_HOST));
 const db=await mysql.createConnection({host:e.MYSQL_HOST,user:e.MYSQL_USER,password:e.MYSQL_PASSWORD,database:e.MYSQL_DATABASE});const ids=[];
 try{for(const code of ['pattern','cutting','sewing','finishing']){
  const no='__REPORT_COMPLETION_'+code+'_'+Date.now();const [created]=await db.query("INSERT INTO orders(order_no,sku_code,status,order_date) VALUES (?,?,'completed',NOW())",[no,no]);const id=created.insertId;ids.push(id);
  const table='order_'+code;const extra=code==='pattern'?",pattern_master":code==='sewing'?",sewing_quantity":code==='finishing'?",tail_received_qty":'';
  const value=code==='pattern'?",'报告试用·纸样'":code==='sewing'||code==='finishing'?',12':'';
  await db.query('INSERT INTO '+table+'(order_id,status,completed_at'+extra+') VALUES (?,?,NOW()'+value+')',[id,code==='finishing'?'inbound':'completed']);
  const login=await(await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'report_qa_'+code,password:'ReportPreview2026!'})})).json();const headers={Authorization:'Bearer '+login.access_token};
  const people=await(await fetch('http://127.0.0.1:3013/work-reports/people',{headers})).json();const self=people.find(p=>p.username==='report_qa_'+code);const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
  const read=async d=>{const r=await fetch('http://127.0.0.1:3013/work-reports/'+self.id+'?date='+d,{headers});assert.equal(r.status,200);return r.json()};const report=await read(date);
  assert.ok(report.automatic.some(g=>g.title.includes('完成')&&g.rows.some(r=>r.orderId===id)),code+' completion missing');assert.ok(!report.automatic.some(g=>g.title.includes('当前')&&g.rows.some(r=>r.orderId===id)));
  const past=await read('2026-01-01');assert.ok(!past.automatic.some(g=>g.rows.some(r=>r.orderId===id)));
  console.log(code+' dated completion passed');
 }}finally{for(const id of ids){for(const code of ['pattern','cutting','sewing','finishing'])await db.query('DELETE FROM order_'+code+' WHERE order_id=?',[id]);await db.query("DELETE FROM orders WHERE id=? AND order_no LIKE '__REPORT_COMPLETION_%'",[id]);}await db.end();}
});
