require('reflect-metadata');
const assert = require('node:assert/strict');
const test = require('node:test');
const { OrderStatusReportService } = require('../dist/order-status-config/order-status-report.service');
const { SystemOptionsService } = require('../dist/system-options/system-options.service');

for (const method of ['getSlaReport', 'getProfitReport']) {
  test(`${method}: 父类型包含子孙类型，叶子精确筛选，清空恢复全部`, async () => {
    const nodes = [{ id: 1 }, { id: 2 }, { id: 3, parentId: 2 }, { id: 4, parentId: 3 }];
    const options = Object.create(SystemOptionsService.prototype);
    options.repo = { find: async () => nodes };
    options.getOptionLabelsByIds = async () => ({});
    const orders = nodes.map(({ id }) => ({
      id, orderTypeId: id, status: 'draft', orderNo: `O-${id}`, createdAt: new Date('2026-09-01T00:00:00Z'),
    }));
    const emptyRepo = {
      find: async () => [],
      createQueryBuilder() {
        return {
          innerJoinAndSelect() { return this; },
          where() { return this; },
          orderBy() { return this; },
          addOrderBy() { return this; },
          getMany: async () => [],
        };
      },
    };
    const service = Object.create(OrderStatusReportService.prototype);
    for (const key of ['statusRepo', 'slaRepo', 'historyRepo', 'transitionRepo', 'orderCostSnapshotRepo',
      'orderCuttingRepo', 'orderSewingRepo', 'orderFinishingRepo', 'orderCraftRepo', 'orderPatternRepo',
      'orderExtRepo', 'orderOperationLogRepo']) service[key] = emptyRepo;
    service.systemOptionsService = options;
    service.orderRepo = {
      createQueryBuilder() {
        let ids;
        return {
          where() { return this; },
          andWhere(sql, params) {
            if (sql.includes('o.order_type_id')) {
              ids = params.orderTypeIds ?? [params.orderTypeId];
            }
            return this;
          },
          orderBy() { return this; },
          addOrderBy() { return this; },
          getMany: async () => orders.filter((order) => !ids || ids.includes(order.orderTypeId)),
        };
      },
    };
    for (const [orderTypeId, expected] of [[2, [2, 3, 4]], [4, [4]], [undefined, [1, 2, 3, 4]]]) {
      const result = await service[method]({ orderTypeId });
      assert.deepEqual(result.list.map((row) => row.orderId).sort(), expected);
      assert.equal(result.summary.total, expected.length);
    }
  });
}
