const test=require('node:test'),assert=require('node:assert/strict');
test('each ERP role reads own automatic report; cannot read colleague or settings',async()=>{
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
 for(const [code,label]of Object.entries({merchandiser:null,purchase:'采购',pattern:'纸样',cutting:'裁床',sewing:'车缝',finishing:'尾部',inventory:'仓库'})){
  const login=await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'report_qa_'+code,password:'ReportPreview2026!'})});assert.equal(login.status,201);
  const data=await login.json(),headers={Authorization:'Bearer '+data.access_token};
  const people=await(await fetch('http://127.0.0.1:3013/work-reports/people',{headers})).json();const self=people.find(p=>p.username==='report_qa_'+code);assert.ok(self);
  const r=await fetch('http://127.0.0.1:3013/work-reports/'+self.id+'?date='+date,{headers});assert.equal(r.status,200);const report=await r.json();
  if(label){assert.ok(report.automatic.some(g=>g.title.includes(label)));assert.ok(report.automatic.some(g=>g.title.includes('完成')));assert.ok(report.automatic.some(g=>g.title.includes('当前')));}else {assert.ok(Array.isArray(report.pendingOrders));assert.ok(report.pendingOrders.every(o=>o.active===1));}
  const orders=await(await fetch('http://127.0.0.1:3013/work-reports/orders',{headers})).json();assert.ok(orders.every(o=>typeof o.active==='number'));assert.ok(orders.filter(o=>o.status==='订单完成').every(o=>o.active===0));
  assert.equal((await fetch('http://127.0.0.1:3013/work-reports/49?date='+date,{headers})).status,403);assert.equal((await fetch('http://127.0.0.1:3013/work-reports/settings',{headers})).status,403);
  console.log(code,report.automatic.map(g=>g.title+':'+g.rows.length).join(', '));
 }
});
