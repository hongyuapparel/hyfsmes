const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

// Opt-in: run only against the dedicated local test database and running backend.
test('采购流程：真实 MySQL、接口权限、列表、导出及上下游', {skip:process.env.PURCHASE_INTEGRATION !== '1'}, async(t)=>{
  const mysql = require('mysql2/promise');
  const env = require('dotenv').parse(fs.readFileSync(path.join(__dirname,'../.env')));
  assert.equal(env.MYSQL_HOST,'localhost');
  assert.match(env.MYSQL_DATABASE,/^erp_purchase_test_/);
  const db=await mysql.createConnection({host:env.MYSQL_HOST,port:Number(env.MYSQL_PORT||3306),user:env.MYSQL_USER,password:env.MYSQL_PASSWORD,database:env.MYSQL_DATABASE});
  const base='http://127.0.0.1:3000';
  async function login(username) {
    const res=await fetch(base+'/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,password:'PurchaseTest7532!'})});
    assert.equal(res.status,201); return (await res.json()).access_token;
  }
  const token=await login('purchase_test');
  const patternToken=await login('pattern_test');
  const adminToken=await login('admin_test');
  const prefix=`TEST-PURCHASE-${Date.now()}`;
  const ids=[];
  async function api(url,payload,auth=token) {
    const r=await fetch(base+url,{method:payload?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth}`},...(payload?{body:JSON.stringify(payload)}:{})});
    const text=await r.text(); let data; try{data=JSON.parse(text)}catch{data=text}
    if (r.status === 400) console.log('Rejected:',data.message);
    return {status:r.status,data};
  }
  const register=(items)=>api('/production/purchase/items/register/batch',{items});
  const complete=(items,auth)=>api('/production/purchase/items/complete/batch',{items},auth);
  const ref=(id,index=0)=>({orderId:id,materialIndex:index});
  const purchase=(id,index=0,status='purchasing')=>({...ref(id,index),supplierName:'隔离验收供应商',actualPurchaseQuantity:12.5,unitPrice:'8',otherCost:'2',remark:'验收',imageUrl:'',purchaseStatus:status});
  async function create(type,count=1) {
    const no=prefix+'-'+ids.length;
    const [r]=await db.query("INSERT INTO orders(order_no,sku_code,order_type_id,collaboration_type_id,status,status_time,order_date) VALUES(?,?,?,12,'pending_purchase',NOW(),NOW())",[no,no,type]);
    ids.push(r.insertId);
    await db.query("INSERT INTO order_status_history(order_id,status_id) SELECT ?,id FROM order_statuses WHERE code='pending_purchase'",[r.insertId]);
    await db.query('INSERT INTO order_ext(order_id,materials) VALUES(?,?)',[r.insertId,JSON.stringify(Array.from({length:count},(_,i)=>({materialName:'验收面料'+i,materialSourceId:261,supplierName:'隔离验收供应商',purchaseQuantity:12.5})))]);
    return r.insertId;
  }
  async function state(id) {
    const [[order]]=await db.query('SELECT status FROM orders WHERE id=?',[id]);
    const [[ext]]=await db.query('SELECT materials FROM order_ext WHERE order_id=?',[id]);
    return {status:order.status,materials:typeof ext.materials==='string'?JSON.parse(ext.materials):ext.materials};
  }
  try {
    await t.test('采购中列表、计数、筛选及导出一致；面料未齐不进入纸样',async()=>{
      const id=await create(5,2);
      assert.equal((await register([purchase(id),purchase(id,1,'completed')])).status,201);
      const s=await state(id); assert.equal(s.status,'pending_purchase'); assert.equal(s.materials[0].purchaseCompletedAt,null);
      const query=`?orderNo=${prefix}&tab=purchasing`;
      const list=await api('/production/purchase/items'+query); assert.equal(list.data.total,1); assert.equal(list.data.list[0].purchaseAmount,'102.00');
      const counts=await api('/production/purchase/tab-counts?orderNo='+prefix);
      assert.deepEqual(counts.data,{all:2,pending:0,purchasing:1,picking:0,completed:1});
      const exported=await api('/production/purchase/items/export'+query);
      assert.match(exported.data,/采购中/); assert.equal(exported.data.trim().split('\n').length,2);
      assert.equal((await api('/production/purchase/items'+query+'&supplier=不存在')).data.total,0);
      assert.equal((await api('/production/purchase/items'+query+'&completedStart=2026-01-01')).data.total,0);
      assert.equal((await complete([ref(id)])).status,201);
      const after=await state(id); assert.equal(after.status,'pending_pattern'); assert.ok(after.materials[0].purchaseCompletedAt);
      assert.deepEqual({...after.materials[0],purchaseStatus:'purchasing',purchaseCompletedAt:null},s.materials[0]);
      const doneCounts=await api('/production/purchase/tab-counts?orderNo='+prefix);
      assert.deepEqual(doneCounts.data,{all:2,pending:0,purchasing:0,picking:0,completed:2});
      const [[logs]]=await db.query("SELECT COUNT(*) n FROM order_operation_logs WHERE order_id=? AND detail LIKE '%到货完成%'",[id]); assert.equal(logs.n,1);
      assert.equal((await complete([ref(id)])).status,400);
    });
    await t.test('大货到货后才进入裁床，现货登记可直接进入下一步',async()=>{
      const bulk=await create(4);
      assert.equal((await register([purchase(bulk)])).status,201); assert.equal((await state(bulk)).status,'pending_purchase');
      assert.equal((await complete([ref(bulk)])).status,201); assert.equal((await state(bulk)).status,'pending_cutting');
      const direct=await create(5);
      assert.equal((await register([purchase(direct,0,'completed')])).status,201); assert.equal((await state(direct)).status,'pending_pattern');
    });
    await t.test('采购角色可完成；纸样角色及未登录请求不能完成',async()=>{
      const id=await create(5); await register([purchase(id)]);
      assert.equal((await complete([ref(id)],patternToken)).status,403);
      const unauth=await fetch(base+'/production/purchase/items/complete/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items:[ref(id)]})});
      assert.equal(unauth.status,401); assert.equal((await state(id)).status,'pending_purchase');
    });
    await t.test('跨订单混合无效请求全回滚、并发重复到货只完成一次',async()=>{
      const a=await create(5); const b=await create(5);
      await register([purchase(a)]);
      assert.equal((await complete([ref(a),ref(b)])).status,400);
      assert.equal((await state(a)).materials[0].purchaseStatus,'purchasing');
      const results=await Promise.all([complete([ref(a)]),complete([ref(a)])]);
      assert.deepEqual(results.map(r=>r.status).sort(),[201,400]);
      const [[logs]]=await db.query("SELECT COUNT(*) n FROM order_operation_logs WHERE order_id=? AND detail LIKE '%到货完成%'",[a]); assert.equal(logs.n,1);
    });
    await t.test('纠错采购中数量不改变到货状态，完成后沿用纠错金额',async()=>{
      const id=await create(5); await register([purchase(id)]);
      const edit={...purchase(id),actualPurchaseQuantity:0,unitPrice:'6',otherCost:'0'};
      assert.equal((await api('/production/purchase/items/edit/batch',{items:[edit]},token)).status,403);
      assert.equal((await api('/production/purchase/items/edit/batch',{items:[edit]},adminToken)).status,201);
      const s=await state(id);assert.equal(s.status,'pending_purchase');assert.equal(s.materials[0].purchaseStatus,'purchasing');
      assert.equal(s.materials[0].purchaseCompletedAt,null);assert.equal(s.materials[0].purchaseAmount,'0.00');
      assert.equal((await complete([ref(id)])).status,201);
      assert.equal((await state(id)).materials[0].purchaseAmount,'0.00');
    });
  } finally {
    if(ids.length) for (const table of ['order_operation_logs','order_status_history','order_ext','orders']) {
      await db.query('DELETE FROM ?? WHERE ?? IN (?)',[table,table==='orders'?'id':'order_id',ids]);
    }
    await db.end();
  }
});
