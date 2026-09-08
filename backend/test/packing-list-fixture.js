// 隔离仓储替身：运行真正的装箱单服务，不连接任何数据库。
require('reflect-metadata');
const { PackingListsService } = require('../dist/packing-lists/packing-lists.service');

function createPackingFixture() {
  const repositories = new Map();
  let transactions = 0;
  const manager = {
    transaction: async (fn) => { transactions++; return fn(manager); },
    getRepository: (entity) => repository(entity.name),
    query: async () => repository('PackingList').rows.slice(-1).map(({ code }) => ({ code })),
  };
  function repository(name) {
    if (repositories.has(name)) return repositories.get(name);
    let nextId = 1;
    const repo = {
      rows: [], manager,
      create: (row) => ({ ...row }),
      save: async (input) => {
        if (Array.isArray(input)) return Promise.all(input.map(repo.save));
        const row = structuredClone({ ...input, id: input.id ?? nextId++ });
        const index = repo.rows.findIndex((r) => r.id === row.id);
        if (index < 0) repo.rows.push(row); else repo.rows[index] = row;
        return structuredClone(row);
      },
      find: async ({ where = {} } = {}) => structuredClone(repo.rows.filter((row) =>
        Object.entries(where).every(([key, value]) => value?._type === 'in' ? value.value.includes(row[key]) : row[key] === value))),
      findOne: async (options) => (await repo.find(options))[0] ?? null,
      update: async (where, values) => {
        for (const row of repo.rows) if (row.id === where.id) Object.assign(row, structuredClone(values));
      },
      delete: async (where) => {
        repo.rows = repo.rows.filter((row) => !Object.entries(where).every(([key, value]) => row[key] === value));
      },
    };
    repositories.set(name, repo);
    return repo;
  }
  const service = new PackingListsService(repository('PackingList'), repository('PackingListBox'),
    repository('PackingListItem'), repository('PackingListLog'), { find: async () => [] });
  return { service, repository, get transactions() { return transactions; } };
}
module.exports = { createPackingFixture };
