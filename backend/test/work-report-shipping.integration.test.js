const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),mysql=require('mysql2/promise');
test('report shipment totals match confirmed packing list items on latest shipping day',async()=>{
 const e=require('dotenv').parse(fs.readFileSync('.env'));assert.equal(e.MYSQL_DATABASE,'erp_work_report_0203');assert.ok(['localhost','127.0.0.1'].includes(e.MYSQL_HOST));
 const db=await mysql.createConnection({host:e.MYSQL_HOST,user:e.MYSQL_USER,password:e.MYSQL_PASSWORD,database:e.MYSQL_DATABASE});
 try {
  const [[latest]]=await db.query("SELECT DATE_FORMAT(MAX(shipped_at),'%Y-%m-%d') date FROM packing_lists WHERE status='shipped'");assert.ok(latest.date,'Need confirmed packing list data');
  const [[expected]]=await db.query("SELECT COUNT(*) n,COALESCE(SUM(i.total_qty),0) qty FROM packing_list_items i JOIN packing_lists p ON p.id=i.packing_list_id WHERE p.status='shipped' AND DATE(p.shipped_at)=?",[latest.date]);
  const login=await(await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'report_qa_finishing',password:'ReportPreview2026!'})})).json();const headers={Authorization:'Bearer '+login.access_token};
  const [users]=await db.query("SELECT id FROM users WHERE username='report_qa_finishing'");
  const r=await fetch('http://127.0.0.1:3013/work-reports/'+users[0].id+'?date='+latest.date,{headers});assert.equal(r.status,200);const report=await r.json();const group=report.automatic.find(g=>g.title==='今日出货（部门）');assert.ok(group);assert.equal(group.rows.length,expected.n);assert.equal(group.rows.reduce((n,r)=>n+Number(r.quantity),0),Number(expected.qty));console.log('Confirmed shipping day',latest.date,'items',expected.n,'pieces',expected.qty);
 }finally{await db.end()}
});
