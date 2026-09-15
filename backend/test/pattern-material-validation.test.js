require('reflect-metadata');
const test = require('node:test');
const assert = require('node:assert/strict');
const { validatePatternMaterials: validate } = require('../dist/production-pattern/pattern-material-validation');
const { ProductionPatternService } = require('../dist/production-pattern/production-pattern.service');
const valid = [{ materialName: '主布', usagePerPiece: 0.018 }];

test('名称和正数用量足够，不强制幅宽、裁片数量及备注，空白占位不阻塞', () => {
  assert.doesNotThrow(() => validate([...valid, {}]));
});
test('没有有效物料不能完成', () => {
  for (const rows of [null, [], [{}]]) assert.throws(() => validate(rows), /至少一条/);
});
test('逐行指出名称和用量缺项，零、负数及非法数值不能通过', () => {
  assert.throws(() => validate([{ usagePerPiece: 1 }, { materialName: '里布' }]), /第 1 行.*名称；第 2 行.*用量/);
  for (const usagePerPiece of [0, -1, NaN, Infinity, null]) {
    assert.throws(() => validate([{ materialName: '主布', usagePerPiece }]), /第 1 行/);
  }
});
function service(status = 'in_progress', materialsJson) {
  const calls = [];
  const logs = [];
  const pattern = { orderId: 1, status, materialsJson };
  const order = { id: 1, orderNo: 'TEST', status: 'pending_pattern' };
  const s = Object.create(ProductionPatternService.prototype);
  const qb = { addSelect() { return this; }, where() { return this; }, async getOne() { return pattern; } };
  Object.assign(s, {
    orderRepo: { findOne: async () => order, save: async () => calls.push('order') },
    patternRepo: { findOne: async () => pattern, createQueryBuilder: () => qb, save: async () => calls.push('pattern') },
    orderExtRepo: { findOne: async () => ({ materials: valid }) },
    orderWorkflowService: { resolveNextStatus: async () => { calls.push('workflow'); return 'pending_process'; } },
    orderLogRepo: { create: v => v, save: async v => { logs.push(v); calls.push('log'); } },
    userRepo: { findOne: async () => null },
    hasPatternMaterialsColumns: async () => true,
    appendStatusHistory: async () => calls.push('history'),
  });
  s.orderRepo.manager = { transaction: async callback => {
    const before = structuredClone(pattern); const beforeOrder = structuredClone(order); const callCount = calls.length; const logCount = logs.length;
    try { return await callback({ getRepository: entity => ({ Order: s.orderRepo, OrderPattern: s.patternRepo, OrderOperationLog: s.orderLogRepo, SystemOption: { find: async () => [] } })[entity.name] }); }
    catch (error) {
      for (const key of Object.keys(pattern)) delete pattern[key];
      for (const key of Object.keys(order)) delete order[key];
      Object.assign(pattern, before); Object.assign(order, beforeOrder);
      calls.length = callCount; logs.length = logCount; throw error;
    }
  } };
  return { s, calls, pattern, order, logs };
}
test('自动带入订单用料，保存纸样版本后不被订单变化覆盖', async () => {
  const { s, pattern } = service();
  assert.deepEqual((await s.getPatternMaterials(1)).materials[0].usagePerPiece, 0.018);
  pattern.materialsJson = [{ materialName: '实用主布', usagePerPiece: 1.2 }];
  assert.equal((await s.getPatternMaterials(1)).materials[0].usagePerPiece, 1.2);
});
test('自动带入但尚未保存，不能直接通过完成接口', async () => {
  const { s, calls } = service();
  await assert.rejects(s.completePattern(1, ''), /请先填写并保存/);
  assert.deepEqual(calls, []);
});
test('未完成允许保存草稿，但缺用量仍不能完成', async () => {
  const { s, calls } = service();
  await s.savePatternMaterials(1, [{ materialName: '主布' }]);
  calls.length = 0;
  await assert.rejects(s.completePattern(1, ''), /第 1 行/);
  assert.deepEqual(calls, []);
});
test('已保存完整用料允许完成，并推进状态', async () => {
  const { s, pattern, order, calls } = service('in_progress', valid);
  await s.completePattern(1, 'sample.jpg');
  assert.equal(pattern.status, 'completed');
  assert.equal(order.status, 'pending_process');
  assert.ok(calls.includes('history'));
});
test('已完成修改缺项不写入；有效修改保留完成时间与状态并记日志', async () => {
  const { s, pattern, calls, logs } = service('completed', valid);
  pattern.completedAt = '2026-09-02';
  s.patternRepo.findOne = async () => ({ ...pattern, materialsJson: undefined, materialsRemark: undefined });
  await assert.rejects(s.savePatternMaterials(1, [{ materialName: '主布' }]), /用量/);
  assert.deepEqual(calls, []);
  await s.savePatternMaterials(1, [{ materialName: '主布', usagePerPiece: 2 }]);
  assert.equal(pattern.status, 'completed');
  assert.equal(pattern.completedAt, '2026-09-02');
  assert.ok(calls.includes('log'));
  assert.match(logs[0].detail, /0.018.*→.*2/);
  assert.equal(logs[0].action, 'production_pattern_update');
});

test('批量检查集中返回全部缺项，合格订单不提前写入', async () => {
  const { s, calls } = service();
  s.orderRepo.find = async () => [1, 2, 3].map(id => ({ id, status: 'pending_pattern' }));
  const rows = [
    { orderId: 1, materialsJson: valid },
    { orderId: 2, materialsJson: [{ materialName: '主布' }] },
    { orderId: 3, materialsJson: [] },
  ];
  s.patternRepo.createQueryBuilder = () => ({ addSelect() { return this; }, where() { return this; }, async getMany() { return rows; } });
  const result = await s.checkCompletion([1, 2, 3]);
  assert.deepEqual(result.issues.map(i => i.orderId), [2, 3]);
  assert.match(result.issues[0].message, /单件用量/);
  assert.deepEqual(calls.filter(call => call !== 'workflow'), []);
  rows[1].materialsJson = valid; rows[2].materialsJson = valid;
  assert.deepEqual(await s.checkCompletion([1, 2, 3]), { issues: [] });
  s.orderWorkflowService.resolveNextStatus = async ({ order }) => order.id === 2 ? null : 'completed';
  const blocked = await s.checkCompletion([1, 2, 3]);
  assert.deepEqual(blocked.issues.map(i => i.orderId), [2]);
  assert.match(blocked.issues[0].message, /流程/);
  await assert.rejects(s.checkCompletion([]), /有效的订单/);
});

test('旧页面保存不覆盖他人新用量，记录失败时保存一起回滚', async () => {
  const { s, calls, pattern } = service('in_progress', valid);
  const initial = await s.getPatternMaterials(1);
  await s.savePatternMaterials(1, [{ materialName: '主布', usagePerPiece: 2 }], '', undefined, initial.version);
  await assert.rejects(s.savePatternMaterials(1, valid, '', undefined, initial.version), /已被其他人修改/);
  assert.equal(pattern.materialsJson[0].usagePerPiece, 2);
  const current = await s.getPatternMaterials(1); const n = calls.length;
  s.orderLogRepo.save = async () => { throw new Error('log unavailable'); };
  await assert.rejects(s.savePatternMaterials(1, valid, '', undefined, current.version), /log unavailable/);
  assert.equal(pattern.materialsJson[0].usagePerPiece, 2); assert.equal(calls.length,n);
});

test('草稿后补用量也记录修改前后，不能漏掉草稿历史', async () => {
  const { s, logs } = service('in_progress', [{ materialName: '草稿布' }]);
  await s.savePatternMaterials(1, valid);
  assert.equal(logs[0].action, 'production_pattern_update');
  assert.match(logs[0].detail, /草稿布.*→.*主布/);
});

test('分配、完成和图片修改遇到记录失败都撤回业务修改', async () => {
  for (const action of ['assign', 'complete', 'image']) {
    const { s, pattern, order, calls } = service(action === 'image' ? 'completed' : 'in_progress', valid);
    const before = structuredClone(pattern);
    s.orderLogRepo.save = async () => { throw new Error('log unavailable'); };
    const run = action === 'assign' ? () => s.assignPattern(1, '纸样甲', '车版乙')
      : action === 'complete' ? () => s.completePattern(1, '') : () => s.editCompletedPattern(1, 'new.jpg');
    await assert.rejects(run(), /log unavailable/);
    assert.deepEqual(pattern, before); assert.equal(order.status, 'pending_pattern'); assert.deepEqual(calls, []);
  }
});

test('完成的纸样不能重新分配或重复完成，空师傅不能分配', async () => {
  const { s, calls } = service('completed', valid);
  await assert.rejects(s.assignPattern(1, '甲', '乙'), /已完成/);
  await assert.rejects(s.completePattern(1, ''), /已完成/);
  const pending = service('in_progress', valid);
  await assert.rejects(pending.s.assignPattern(1, '', '乙'), /请选择/);
  assert.deepEqual(calls, []); assert.deepEqual(pending.calls, []);
});
