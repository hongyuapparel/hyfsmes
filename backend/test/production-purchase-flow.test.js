require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { ProductionPurchaseService } = require('../dist/production-purchase/production-purchase.service');
const { ProductionPurchaseQueryService } = require('../dist/production-purchase/production-purchase-query.service');
const { OrderMutationService } = require('../dist/orders/order-mutation.service');

function fixture(materials = [{}], nextStatus = 'pending_pattern') {
  let state = { orders: [{ id: 1, orderNo: 'TEST', status: 'pending_purchase' }],
    extensions: [{ orderId: 1, materials }], history: [], logs: [] };
  const repo = (name, target = state) => ({
    findOne: async ({ where }) => structuredClone((name === 'Order' ? target.orders : target.extensions)
      .find(row => Object.entries(where).every(([key, value]) => row[key] === value)) ?? null),
    save: async row => {
      const list = name === 'Order' ? target.orders : name === 'OrderExt' ? target.extensions : name === 'OrderStatusHistory' ? target.history : target.logs;
      const key = name === 'Order' ? 'id' : 'orderId';
      const index = ['Order', 'OrderExt'].includes(name) ? list.findIndex(r => r[key] === row[key]) : -1;
      if (index < 0) list.push(structuredClone(row)); else list[index] = structuredClone(row);
      return row;
    },
    create: row => row,
  });
  const manager = { transaction: async fn => {
    const draft = structuredClone(state);
    const result = await fn({getRepository: entity => entity.name === 'OrderStatus'
      ? {findOne: async () => ({id: 3})} : repo(entity.name, draft)});
    state = draft;
    return result;
  }};
  const logRepo = {create: row=>row, save: async row=>state.logs.push(row)};
  const service = new ProductionPurchaseService(
    {...repo('Order'), manager}, repo('OrderExt'), {}, {},
    {findOne: async()=>({displayName:'采购测试员',username:'buyer'})}, logRepo,
    {resolveNextStatus: async()=>nextStatus}, {touchLastActiveByNames:async()=>{}},
    {findAllByType:async()=>[{id:1,value:'外采采购'},{id:2,value:'公司库存'}]}, {}, {}, {},
  );
  return {service, state:()=>state};
}
const item = (materialIndex = 0, purchaseStatus = 'purchasing') => ({orderId:1,materialIndex,
  supplierName:'测试供应商',actualPurchaseQuantity:12.5,unitPrice:'8',otherCost:'2',remark:'测试凭证',
  imageUrl:'/uploads/test.jpg',purchaseStatus});

test('采购中不流转、不填完成时间，到货保留登记并推进样品', async()=>{
  const f = fixture();
  await f.service.registerPurchaseBatch({items:[item()],actorUserId:9});
  const before = f.state().extensions[0].materials[0];
  assert.equal(before.purchaseStatus,'purchasing'); assert.equal(before.purchaseCompletedAt,null);
  assert.equal(before.purchaseAmount,'102.00'); assert.equal(f.state().orders[0].status,'pending_purchase');
  assert.match(f.state().logs[0].detail,/采购中/);
  await f.service.registerPurchaseBatch({items:[{orderId:1,materialIndex:0}],completeOnly:true,actorUserId:9});
  const after = f.state().extensions[0].materials[0];
  assert.deepEqual({...after,purchaseStatus:before.purchaseStatus,purchaseCompletedAt:null},before);
  assert.ok(after.purchaseCompletedAt); assert.equal(f.state().orders[0].status,'pending_pattern');
  assert.equal(f.state().history.length,1); assert.match(f.state().logs[1].detail,/到货完成/);
  assert.equal(f.state().logs[1].operatorUsername,'采购测试员');
});

test('现货直接完成，大货沿配置进入裁床', async()=>{
  const f = fixture([{}],'pending_cutting');
  await f.service.registerPurchaseBatch({items:[item(0,'completed')]});
  assert.equal(f.state().orders[0].status,'pending_cutting');
  assert.ok(f.state().extensions[0].materials[0].purchaseCompletedAt);
});

test('旧客户端未传状态时默认采购中，不能提前流转',async()=>{
  const f=fixture(); const legacy=item(); delete legacy.purchaseStatus;
  await f.service.registerPurchaseBatch({items:[legacy]});
  assert.equal(f.state().orders[0].status,'pending_purchase');
  assert.equal(f.state().extensions[0].materials[0].purchaseStatus,'purchasing');
});

test('多物料混合到货只在全部完成后流转', async()=>{
  const f = fixture([{},{}]);
  await f.service.registerPurchaseBatch({items:[item(0,'completed'),item(1)]});
  assert.equal(f.state().orders[0].status,'pending_purchase');
  await f.service.registerPurchaseBatch({items:[{orderId:1,materialIndex:1}],completeOnly:true});
  assert.equal(f.state().orders[0].status,'pending_pattern');
});

test('待领料不能通过采购到货操作绕过', async()=>{
  const f = fixture([{}, {materialSourceId:2,pickStatus:'pending'}]);
  await f.service.registerPurchaseBatch({items:[item(0,'completed')]});
  assert.equal(f.state().orders[0].status,'pending_purchase');
  await assert.rejects(f.service.registerPurchaseBatch({items:[item(1,'completed')]}),/领料/);
});

test('批量含无效物料整体回滚；重复到货不会重复推进或写日志', async()=>{
  const f = fixture([{},{}]);
  await f.service.registerPurchaseBatch({items:[item(0)]});
  const before = structuredClone(f.state());
  await assert.rejects(f.service.registerPurchaseBatch({items:[{orderId:1,materialIndex:0},{orderId:1,materialIndex:1}],completeOnly:true}),/仅采购中/);
  assert.deepEqual(f.state(),before);
  await f.service.registerPurchaseBatch({items:[{orderId:1,materialIndex:0}],completeOnly:true});
  const completed = structuredClone(f.state());
  await assert.rejects(f.service.registerPurchaseBatch({items:[{orderId:1,materialIndex:0}],completeOnly:true}),/不能重复/);
  assert.deepEqual(f.state(),completed);
});

test('无供应商、无效数量/状态、重复行、缺流程均拒绝且不保存', async()=>{
  for (const items of [[{...item(),supplierName:''}],[{...item(),actualPurchaseQuantity:-1}],
    [{...item(),purchaseStatus:'unknown'}],[item(),item()]]) {
    const f=fixture(); await assert.rejects(f.service.registerPurchaseBatch({items}));
    assert.equal(f.state().extensions[0].materials[0].purchaseStatus,undefined);
  }
  const f=fixture([{}],null);
  await assert.rejects(f.service.registerPurchaseBatch({items:[item(0,'completed')]}),/流转规则/);
  assert.equal(f.state().extensions[0].materials[0].purchaseStatus,undefined);
});

test('采购中复制为新单清除登记，原单补用量保留进度',()=>{
  const service = Object.create(OrderMutationService.prototype);
  const material={materialName:'布',purchaseStatus:'purchasing',actualPurchaseQuantity:10,purchaseAmount:'20',purchaseCompletedAt:null};
  const [copy]=service.resetMaterialOperationFieldsForNewDraft([material]);
  assert.equal(copy.purchaseStatus,undefined); assert.equal(copy.purchaseAmount,undefined);
  const [edited]=service.preserveMaterialOperationFields([{materialName:'布',usagePerPiece:0.5}],[material]);
  assert.equal(edited.purchaseStatus,'purchasing'); assert.equal(edited.actualPurchaseQuantity,10);
});

test('列表及计数不会把采购中计入等待采购或完成',async()=>{
  const q=Object.create(ProductionPurchaseQueryService.prototype);
  q.getPurchaseExportRows=async()=>[
    {processRoute:'purchase',purchaseStatus:'pending'}, {processRoute:'purchase',purchaseStatus:'purchasing'},
    {processRoute:'purchase',purchaseStatus:'completed'}, {processRoute:'picking',pickStatus:'pending'},
  ];
  assert.deepEqual(await q.getPurchaseTabCounts({}),{all:4,pending:1,purchasing:1,picking:1,completed:1});
});
