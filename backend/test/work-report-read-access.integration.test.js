const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('report readers can view other departments but cannot edit others or settings',async()=>{
 const env=require('dotenv').parse(fs.readFileSync('.env'));assert.equal(env.MYSQL_DATABASE,'erp_work_report_0203');assert.ok(['localhost','127.0.0.1'].includes(env.MYSQL_HOST));
 const login=await fetch('http://127.0.0.1:3013/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'report_employee_0203',password:'ReportPreview2026!'})});assert.equal(login.status,201);
 const token=(await login.json()).access_token,headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
 const get=path=>fetch('http://127.0.0.1:3013/work-reports/'+path,{headers});
 const people=await(await get('people')).json();assert.ok(people.length>1);const other=people.find(p=>p.username==='report_preview_0203');assert.ok(other);
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date());
 assert.equal((await get(other.id+'?date='+date)).status,200);
 assert.equal((await get('orders')).status,200);
 assert.equal((await get('settings')).status,403);
 const save=await fetch('http://127.0.0.1:3013/work-reports/'+other.id+'/plan',{method:'PUT',headers,body:JSON.stringify({version:0,drafts:[],automaticPlans:[]})});assert.equal(save.status,403);
 const settings=await fetch('http://127.0.0.1:3013/work-reports/settings',{method:'PUT',headers,body:'{}'});assert.equal(settings.status,403);
 assert.equal((await fetch('http://127.0.0.1:3013/work-reports/people')).status,401);
});
