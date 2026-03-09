import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { InboundPending } from '../entities/inbound-pending.entity';
import { Order } from '../entities/order.entity';

export interface FinishedStockRow {
  id: number;
  orderId: number;
  orderNo: string;
  skuCode: string;
  quantity: number;
  warehouse: string;
  department: string;
  location: string;
  createdAt: string;
  type: 'pending' | 'stored';
}

@Injectable()
export class FinishedGoodsStockService {
  constructor(
    @InjectRepository(FinishedGoodsStock)
    private readonly stockRepo: Repository<FinishedGoodsStock>,
    @InjectRepository(InboundPending)
    private readonly pendingRepo: Repository<InboundPending>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  async getList(params: {
    tab?: string;
    orderNo?: string;
    skuCode?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: FinishedStockRow[]; total: number; page: number; pageSize: number }> {
    const { tab = 'all', orderNo, skuCode, page = 1, pageSize = 20 } = params;

    const list: FinishedStockRow[] = [];
    let total = 0;

    if (tab === 'pending' || tab === 'all') {
      const countQb = this.pendingRepo
        .createQueryBuilder('p')
        .innerJoin(Order, 'o', 'o.id = p.order_id')
        .where('p.status = :status', { status: 'pending' });
      if (orderNo?.trim()) {
        countQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      }
      if (skuCode?.trim()) {
        countQb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      }
      const pendingTotal = await countQb.getCount();

      const pendingQb = this.pendingRepo
        .createQueryBuilder('p')
        .innerJoin(Order, 'o', 'o.id = p.order_id')
        .where('p.status = :status', { status: 'pending' })
        .select(['p.id AS id', 'p.order_id AS orderId', 'o.order_no AS orderNo', 'p.sku_code AS skuCode', 'p.quantity AS quantity', 'p.created_at AS createdAt']);
      if (orderNo?.trim()) {
        pendingQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      }
      if (skuCode?.trim()) {
        pendingQb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      }
      pendingQb.orderBy('p.created_at', 'DESC');
      const pendingRows = await pendingQb.getRawMany<{ id: number; orderId: number; orderNo: string; skuCode: string; quantity: number; createdAt: Date }>();
      const pendingList: FinishedStockRow[] = pendingRows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        orderNo: r.orderNo ?? '',
        skuCode: r.skuCode ?? '',
        quantity: r.quantity ?? 0,
        warehouse: '',
        department: '',
        location: '',
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
        type: 'pending',
      }));
      if (tab === 'pending') {
        total = pendingTotal;
        const start = (page - 1) * pageSize;
        return {
          list: pendingList.slice(start, start + pageSize),
          total,
          page,
          pageSize,
        };
      }
      list.push(...pendingList);
      total += pendingTotal;
    }

    if (tab === 'stored' || tab === 'all') {
      const stockQb = this.stockRepo
        .createQueryBuilder('s')
        .innerJoin(Order, 'o', 'o.id = s.order_id')
        .select([
          's.id AS id',
          's.order_id AS orderId',
          'o.order_no AS orderNo',
          's.sku_code AS skuCode',
          's.quantity AS quantity',
          's.warehouse AS warehouse',
          's.department AS department',
          's.location AS location',
          's.created_at AS createdAt',
        ]);
      if (orderNo?.trim()) {
        stockQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      }
      if (skuCode?.trim()) {
        stockQb.andWhere('s.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      }
      stockQb.orderBy('s.created_at', 'DESC');
      const storedCount = await stockQb.getCount();
      const storedRows = await stockQb
        .offset(tab === 'stored' ? (page - 1) * pageSize : 0)
        .limit(tab === 'stored' ? pageSize : 10000)
        .getRawMany<{ id: number; orderId: number; orderNo: string; skuCode: string; quantity: number; warehouse: string; department: string; location: string; createdAt: Date }>();
      const storedList: FinishedStockRow[] = storedRows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        orderNo: r.orderNo ?? '',
        skuCode: r.skuCode ?? '',
        quantity: r.quantity ?? 0,
        warehouse: r.warehouse ?? '',
        department: r.department ?? '',
        location: r.location ?? '',
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ') : '',
        type: 'stored',
      }));
      if (tab === 'stored') {
        return {
          list: storedList,
          total: storedCount,
          page,
          pageSize,
        };
      }
      list.push(...storedList);
      total += storedCount;
    }

    if (tab === 'all') {
      list.sort((a, b) => {
        const da = a.createdAt || '';
        const db = b.createdAt || '';
        return db.localeCompare(da);
      });
      const start = (page - 1) * pageSize;
      return {
        list: list.slice(start, start + pageSize),
        total,
        page,
        pageSize,
      };
    }

    return { list: [], total: 0, page, pageSize };
  }

  /** 出库：减少已入库成品数量 */
  async outbound(id: number, quantity: number): Promise<void> {
    const stock = await this.stockRepo.findOne({ where: { id } });
    if (!stock) {
      throw new NotFoundException('库存记录不存在');
    }
    const q = Number(quantity);
    if (!Number.isInteger(q) || q <= 0) {
      throw new NotFoundException('出库数量必须为正整数');
    }
    if (q > stock.quantity) {
      throw new NotFoundException('出库数量不能大于当前库存');
    }
    stock.quantity -= q;
    if (stock.quantity === 0) {
      await this.stockRepo.remove(stock);
    } else {
      await this.stockRepo.save(stock);
    }
  }
}
