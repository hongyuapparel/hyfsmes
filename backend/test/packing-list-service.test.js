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

test('create and update delete quantities outside headers and persist recalculated totals', async () => {
  const fixture = createPackingFixture();
  const { id } = await fixture.service.create(payload({ OSFA: 5, S: 5 }), '');
  assert.deepEqual(fixture.repository('PackingListItem').rows[0].sizeQuantities, { OSFA: 5 });
  assert.equal(fixture.repository('PackingListItem').rows[0].totalQty, 5);
  await fixture.service.update(id, payload({ OSFA: 0, S: 5 }), '');
  assert.deepEqual(fixture.repository('PackingListItem').rows[0].sizeQuantities, {});
  assert.equal(fixture.repository('PackingListItem').rows[0].totalQty, 0);
  assert.equal((await fixture.service.getDetail(id)).boxes[0].items[0].totalQty, 0);
});

test('shipping source groups receive only retained size quantities from detail', async () => {
  const fixture = createPackingFixture();
  const { id } = await fixture.service.create(payload({ OSFA: 5 }), '');
  fixture.repository('PackingListItem').rows[0].sizeQuantities.S = 5;
  fixture.repository('PackingListItem').rows[0].sourceType = 'pending';
  fixture.repository('PackingListItem').rows[0].sourceId = 7;
  const detail = await fixture.service.getDetail(id);
  const ship = new PackingListsShipService({}, {}, fixture.service, {}, {}, {});
  const groups = ship.groupBySource(detail, 'pending');
  assert.deepEqual(ship.buildOutboundItems(groups, detail.sizeHeaders), [{
    id: 7, quantity: 5, sizeBreakdown: { headers: ['OSFA'], rows: [{ colorName: '', quantities: [5] }] },
  }]);
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
  fixture.repository('PackingListItem').rows[0].sizeQuantities.S = 4;
  fixture.repository('PackingListItem').rows[2].sizeQuantities['0'] = 5;
  fixture.repository('PackingListItem').rows[2].totalQty = 104;
  const detail = await fixture.service.getDetail(id);
  assert.deepEqual(detail.sizeHeaders, ['70', '80', '100', '120']);
  assert.deepEqual(detail.boxes.map((b) => b.items[0].totalQty), [128, 61, 99]);
  assert.equal(detail.boxes[0].items[0].sizeQuantities.S, undefined);
  assert.equal(detail.boxes[2].items[0].sizeQuantities['0'], undefined);
  await fixture.service.update(id, detail, 'test');
  assert.deepEqual(fixture.repository('PackingListItem').rows.map((i) => i.totalQty), [128, 61, 99]);
  assert.equal(fixture.repository('PackingListItem').rows[0].sizeQuantities.S, undefined);
  assert.equal(fixture.repository('PackingListItem').rows[2].sizeQuantities['0'], undefined);
});

test('copy-to-draft does not revive legacy zero totals or deleted sizes', async () => {
  const fixture = createPackingFixture();
  const { id } = await fixture.service.create(payload({ OSFA: 5 }), '');
  const source = fixture.repository('PackingListItem').rows[0];
  source.sizeQuantities = { OSFA: 0 };
  source.totalQty = 5;
  const copy = await fixture.service.copyToDraft(id, { boxFrom: 1, boxTo: 1 });
  assert.equal((await fixture.service.getDetail(copy.id)).boxes[0].items[0].totalQty, 0);
  source.sizeQuantities = { OSFA: 5, S: 5 };
  const nextCopy = await fixture.service.copyToDraft(id, { boxFrom: 1, boxTo: 1 });
  const copiedItem = (await fixture.service.getDetail(nextCopy.id)).boxes[0].items[0];
  assert.deepEqual(copiedItem.sizeQuantities, { OSFA: 5 });
  assert.equal(copiedItem.totalQty, 5);
});
