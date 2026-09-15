const { InventoryAccessory } = require('../../dist/entities/inventory-accessory.entity');
const { InventoryAccessoryOutbound } = require('../../dist/entities/inventory-accessory-outbound.entity');
const { InventoryAccessoriesService } = require('../../dist/inventory-accessories/inventory-accessories.service');

// Deterministic transaction double; actual MySQL locking is covered by the isolated integration test.
function accessoryWriteFixture(initial = { id: 1, name: 'QA事务', quantity: 10, unit: '个', isSized: false }) {
  let state = { stocks: initial ? [structuredClone(initial)] : [], logs: [], outbounds: [] };
  let logFailure = null;
  let queue = Promise.resolve();
  const locks = [], isolations = [];
  function repositories(getState) {
    const stock = {
      create: row => ({ ...row }),
      async save(row) {
        const data = getState();
        row.id ??= Math.max(0, ...data.stocks.map(s => s.id)) + 1;
        const i = data.stocks.findIndex(s => s.id === row.id);
        if (i < 0) data.stocks.push(structuredClone(row));
        else data.stocks[i] = structuredClone(row);
        return row;
      },
      async remove(row) { getState().stocks = getState().stocks.filter(s => s.id !== row.id); },
      async findOne({ where }) { return structuredClone(getState().stocks.find(s => s.id === where.id) ?? null); },
      createQueryBuilder() {
        let params = {};
        return {
          setLock(lock) { locks.push(lock); return this; },
          where(_sql, values) { params = values; return this; },
          orderBy() { return this; },
          async getOne() {
            return structuredClone(getState().stocks.find(s => params.id !== undefined ? s.id === params.id : s.name === params.name) ?? null);
          },
        };
      },
    };
    const log = { create: row => row, async save(row) {
      if (logFailure) throw logFailure;
      getState().logs.push(structuredClone(row)); return row;
    } };
    const outbound = { create: row => row, async save(row) { getState().outbounds.push(structuredClone(row)); return row; } };
    return { stock, log, outbound, getRepository: entity => entity === InventoryAccessory ? stock : entity === InventoryAccessoryOutbound ? outbound : log };
  }
  const global = repositories(() => state);
  global.stock.manager = {
    async transaction(isolation, callback) {
      if (typeof isolation === 'function') { callback = isolation; isolation = undefined; }
      isolations.push(isolation);
      const previous = queue;
      let release;
      queue = new Promise(resolve => { release = resolve; });
      await previous;
      const draft = structuredClone(state);
      try { const result = await callback(repositories(() => draft)); state = draft; return result; }
      finally { release(); }
    },
  };
  const service = new InventoryAccessoriesService(global.stock, global.outbound, global.log, {});
  return { service, locks, isolations, get state() { return state; }, failLogs(error) { logFailure = error; },
    inbound: overrides => service.restock(1, { quantity: 1, unit: '个', operatorUsername: 'QA', ...overrides }),
  };
}
module.exports = { accessoryWriteFixture };
