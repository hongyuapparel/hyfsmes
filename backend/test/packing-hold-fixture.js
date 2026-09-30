// 真实装箱单服务 + 内存仓储，供状态回归和浏览器隔离测试；不连接数据库。
const { createPackingFixture } = require('./packing-list-fixture');
const { PackingListsHoldService } = require('../dist/packing-lists/packing-lists-hold.service');

function createHoldFixture() {
  const fixture = createPackingFixture();
  const names = ['PackingList', 'PackingListBox', 'PackingListItem', 'PackingListLog'];
  const repo = fixture.repository;
  const manager = repo('PackingList').manager;
  const transaction = manager.transaction;
  const queries = [];
  manager.transaction = (fn) => transaction(async () => {
    const snapshot = names.map((name) => structuredClone(repo(name).rows));
    try { return await fn(manager); }
    catch (error) { names.forEach((name, i) => { repo(name).rows = snapshot[i]; }); throw error; }
  });
  for (const name of names) {
    const save = repo(name).save;
    repo(name).save = (input) => save(Array.isArray(input) ? input : {
      createdAt: new Date(), ...(name === 'PackingList' ? { holdReason: '', shippedAt: null } : {}), ...input,
    });
    repo(name).createQueryBuilder = () => builder(name);
  }
  function builder(name, initial = {}) {
    const state = { filters: [], offset: 0, limit: Infinity, order: 'id', direction: 'ASC', ...initial };
    const qb = {
      where: (sql, params) => { state.filters = [{ sql, params }]; return qb; },
      andWhere: (sql, params) => { state.filters.push({ sql, params }); return qb; },
      orderBy: (field, direction) => { state.order = field.includes('pack_date') ? 'packDate' : 'id'; state.direction = direction; return qb; },
      addOrderBy: () => qb, select: () => qb, addSelect: () => qb,
      groupBy: (field) => { state.group = field; return qb; },
      setLock: (lock) => { queries.push({ lock }); return qb; },
      skip: (offset) => { state.offset = offset; return qb; }, take: (limit) => { state.limit = limit; return qb; },
      clone: () => builder(name, structuredClone(state)),
      getMany: async () => structuredClone(filtered().slice(state.offset, state.offset + state.limit)),
      getOne: async () => structuredClone(filtered()[0] ?? null),
      getCount: async () => filtered().length,
      getRawOne: async () => {
        const ids = new Set(filtered().map((row) => row.id));
        return { boxCount: repo('PackingListBox').rows.filter((b) => ids.has(b.packingListId)).length,
          totalQty: repo('PackingListItem').rows.filter((i) => ids.has(i.packingListId)).reduce((s, i) => s + i.totalQty, 0) };
      },
      getRawMany: async () => {
        const groups = new Map();
        if (state.group === 'pl.status') {
          for (const row of filtered()) groups.set(row.status, (groups.get(row.status) ?? 0) + 1);
          return [...groups].map(([status, count]) => ({ status, count: String(count) }));
        }
        for (const row of filtered()) {
          const value = groups.get(row.packingListId) ?? { listId: row.packingListId, boxCount: 0, totalWeight: 0, totalQty: 0, styles: new Set() };
          value.boxCount++;
          value.totalWeight += Number(row.weightKg) || 0;
          value.totalQty += row.totalQty || 0;
          if (row.styleNo) value.styles.add(row.styleNo);
          groups.set(row.packingListId, value);
        }
        return [...groups.values()].map(({ styles, ...row }) => ({ ...row, styleNos: [...styles].join('\n') }));
      },
    };
    function filtered() {
      queries.push(...state.filters);
      return repo(name).rows.filter((row) => state.filters.every(({ sql, params = {} }) => {
        if (params.ids) return params.ids.includes(name === 'PackingList' ? row.id : row.packingListId);
        if (params.id) return row.id === params.id;
        if (params.status) return row.status === params.status;
        if (params.customerName) return row.customerName.includes(params.customerName.replaceAll('%', ''));
        if (params.keyword) return repo('PackingListItem').rows.some((i) => i.packingListId === row.id && i.styleNo.includes(params.keyword.replaceAll('%', '')));
        if (params.xom) return row.xiaomanOrderNo.includes(params.xom.replaceAll('%', ''));
        if (params.serviceManager) return row.serviceManager === params.serviceManager;
        if (params.dateFrom) return row.packDate >= params.dateFrom;
        if (params.dateTo) return row.packDate <= params.dateTo;
        throw new Error(`Unsupported test query: ${sql}`);
      })).sort((a, b) => {
        const compare = String(a[state.order] ?? '').localeCompare(String(b[state.order] ?? ''), undefined, { numeric: true });
        return state.direction === 'DESC' ? -compare : compare;
      });
    }
    return qb;
  }
  return { ...fixture, hold: new PackingListsHoldService(repo('PackingList')), queries };
}
module.exports = { createHoldFixture };
