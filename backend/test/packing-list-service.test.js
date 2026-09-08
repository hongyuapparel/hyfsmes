const assert = require('node:assert/strict');
const test = require('node:test');
const { createPackingFixture } = require('./packing-list-fixture');
const { PackingListsShipService } = require('../dist/packing-lists/packing-lists-ship.service');

const payload = (sizeQuantities, totalQty = 10) => ({ sizeHeaders: ['OSFA'],
  boxes: [{ items: [{ styleNo: 'manual-test', sourceType: 'manual', sizeQuantities, totalQty }] }],
});

test('create/update/read roundtrip: 5 -> 0 -> blank -> manual quantity, no stale total', async () => {
  const { service, repository } = createPackingFixture();
  const { id } = await service.create(payload({ OSFA: 5 }), 'test');
  assert.equal((await service.getDetail(id)).boxes[0].items[0].totalQty, 5);
  assert.equal(repository('PackingListItem').rows[0].totalQty, 5);
  await service.update(id, payload({ OSFA: 0 }), 'test');
  assert.equal((await service.getDetail(id)).boxes[0].items[0].totalQty, 0);
  await service.update(id, payload({}, 0), 'test');
  assert.equal((await service.getDetail(id)).boxes[0].items[0].totalQty, 0);
  await service.update(id, payload({}, 7), 'test');
  assert.equal((await service.getDetail(id)).boxes[0].items[0].totalQty, 7);
});

test('create and update reject hidden positive quantities BEFORE transactions or deletions', async () => {
  const fixture = createPackingFixture();
  await assert.rejects(fixture.service.create(payload({ OSFA: 5, S: 5 }), ''), /未显示尺码/);
  assert.equal(fixture.transactions, 0);
  const { id } = await fixture.service.create(payload({ OSFA: 5 }), '');
  const before = await fixture.service.getDetail(id);
  await assert.rejects(fixture.service.update(id, payload({ OSFA: 0, S: 5 }), ''), /未显示尺码/);
  assert.equal(fixture.transactions, 1);
  assert.deepEqual(await fixture.service.getDetail(id), before);
});

test('legacy hidden quantities block ship before inventory access, including manual-only packing', async () => {
  const fixture = createPackingFixture();
  const { id } = await fixture.service.create(payload({ OSFA: 5 }), '');
  fixture.repository('PackingListItem').rows[0].sizeQuantities.S = 5;
  const ship = new PackingListsShipService({}, {}, fixture.service, {}, {}, {});
  await assert.rejects(ship.ship(id, 'test'), /未显示尺码/);
  assert.equal(fixture.transactions, 1);
  assert.equal((await fixture.service.getDetail(id)).status, 'draft');
});

test('saved snapshot 128/61/99 stays 288; stored obsolete totals are not trusted on read', async () => {
  const fixture = createPackingFixture();
  const data = { sizeHeaders: ['70', '80', '100', '120'], boxes: [
    { items: [{ styleNo: 'KR157', colorName: '蓝色', sizeQuantities: { 80: 44, 100: 42, 120: 42 }, totalQty: 132 }] },
    { items: [{ styleNo: 'KR157', colorName: '粉色', sizeQuantities: { 80: 13, 100: 24, 120: 24 }, totalQty: 61 }] },
    { items: [{ styleNo: 'KR158', colorName: '白色', sizeQuantities: { 70: 51, 80: 48 }, totalQty: 104 }] },
  ] };
  const { id } = await fixture.service.create(data, '');
  assert.deepEqual(fixture.repository('PackingListItem').rows.map((i) => i.totalQty), [128, 61, 99]);
  fixture.repository('PackingListItem').rows[0].totalQty = 132;
  assert.deepEqual((await fixture.service.getDetail(id)).boxes.map((b) => b.items[0].totalQty), [128, 61, 99]);
});

test('copy-to-draft does not revive legacy zero totals and rejects hidden quantities', async () => {
  const fixture = createPackingFixture();
  const { id } = await fixture.service.create(payload({ OSFA: 5 }), '');
  const source = fixture.repository('PackingListItem').rows[0];
  source.sizeQuantities = { OSFA: 0 };
  source.totalQty = 5;
  const copy = await fixture.service.copyToDraft(id, { boxFrom: 1, boxTo: 1 });
  assert.equal((await fixture.service.getDetail(copy.id)).boxes[0].items[0].totalQty, 0);
  source.sizeQuantities = { OSFA: 5, S: 5 };
  const before = fixture.transactions;
  await assert.rejects(fixture.service.copyToDraft(id, { boxFrom: 1, boxTo: 1 }), /未显示尺码/);
  assert.equal(fixture.transactions, before);
});
