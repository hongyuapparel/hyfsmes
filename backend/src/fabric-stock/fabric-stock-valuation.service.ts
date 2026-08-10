import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { In } from 'typeorm';
import { DataSource } from 'typeorm';
import { FabricStock } from '../entities/fabric-stock.entity';
import { FabricStockOperationLog } from '../entities/fabric-stock-operation-log.entity';
import { calculateFabricAmount, normalizeFabricUnitPrice } from './fabric-stock-valuation';

export type FabricBatchPriceInput = { id: number; unitPrice: unknown };

function valuationSnapshot(stock: FabricStock): Record<string, unknown> {
  return {
    id: stock.id,
    name: stock.name,
    quantity: stock.quantity,
    unit: stock.unit,
    unitPrice: stock.unitPrice,
    amount: calculateFabricAmount(stock.quantity, stock.unitPrice),
  };
}

@Injectable()
export class FabricStockValuationService {
  constructor(private readonly dataSource: DataSource) {}

  async batchUpdatePrices(items: FabricBatchPriceInput[], operatorUsername: string): Promise<{ updated: number }> {
    if (!Array.isArray(items) || items.length === 0) throw new BadRequestException('请选择要补价的面料库存');
    if (items.length > 200) throw new BadRequestException('单次最多补价 200 条库存');
    const ids = items.map((item) => Number(item.id));
    if (ids.some((id) => !Number.isInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
      throw new BadRequestException('补价库存数据无效，请刷新页面后重试');
    }
    const prices = new Map<number, string>();
    items.forEach((item) => {
      const price = normalizeFabricUnitPrice(item.unitPrice);
      if (price == null) throw new BadRequestException('批量补价的每一行都必须填写单价');
      prices.set(Number(item.id), price);
    });

    return this.dataSource.transaction(async (manager) => {
      const stockRepo = manager.getRepository(FabricStock);
      const logRepo = manager.getRepository(FabricStockOperationLog);
      const stocks = await stockRepo
        .createQueryBuilder('stock')
        .setLock('pessimistic_write')
        .where({ id: In(ids) })
        .getMany();
      if (stocks.length !== ids.length) throw new NotFoundException('部分面料库存已不存在，请刷新页面后重试');
      const byId = new Map(stocks.map((stock) => [stock.id, stock]));
      const logs: FabricStockOperationLog[] = [];
      const saves: FabricStock[] = [];
      ids.forEach((id) => {
        const stock = byId.get(id)!;
        const before = valuationSnapshot(stock);
        stock.unitPrice = prices.get(id)!;
        saves.push(stock);
        logs.push(logRepo.create({
          fabricStockId: stock.id,
          operatorUsername: String(operatorUsername ?? '').trim(),
          action: 'reprice',
          beforeSnapshot: before,
          afterSnapshot: valuationSnapshot(stock),
          remark: '批量补价',
        }));
      });
      await stockRepo.save(saves);
      await logRepo.save(logs);
      return { updated: saves.length };
    });
  }
}
