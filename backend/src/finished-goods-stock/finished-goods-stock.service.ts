import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FinishedGoodsStock } from '../entities/finished-goods-stock.entity';
import { InboundPending } from '../entities/inbound-pending.entity';
import { Order } from '../entities/order.entity';
import { FinishedGoodsOutbound } from '../entities/finished-goods-outbound.entity';

export interface FinishedStockRow {
  id: number;
  orderId: number;
  orderNo: string;
  customerName: string;
  skuCode: string;
  quantity: number;
  warehouseId: number | null;
  inventoryTypeId: number | null;
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
    @InjectRepository(FinishedGoodsOutbound)
    private readonly outboundRepo: Repository<FinishedGoodsOutbound>,
    @InjectRepository(InboundPending)
    private readonly pendingRepo: Repository<InboundPending>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
  ) {}

  /** 手动新增成品库存（仓库直接入库） */
  async createManual(dto: {
    orderNo: string;
    skuCode: string;
    quantity: number;
    warehouseId?: number | null;
    inventoryTypeId?: number | null;
    department: string;
    location: string;
    imageUrl?: string;
  }): Promise<FinishedGoodsStock> {
    const orderNo = dto.orderNo?.trim();
    if (!orderNo) {
      throw new NotFoundException('订单号不能为空');
    }
    const order = await this.orderRepo.findOne({ where: { orderNo } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    const q = Number(dto.quantity);
    if (!Number.isInteger(q) || q <= 0) {
      throw new NotFoundException('数量必须为正整数');
    }
    const stock = this.stockRepo.create({
      orderId: order.id,
      skuCode: dto.skuCode?.trim() ?? '',
      quantity: q,
      warehouseId: dto.warehouseId != null ? Number(dto.warehouseId) : null,
      inventoryTypeId: dto.inventoryTypeId != null ? Number(dto.inventoryTypeId) : null,
      department: dto.department?.trim() ?? '',
      location: dto.location?.trim() ?? '',
      customerId: order.customerId ?? null,
      customerName: order.customerName?.trim() ?? '',
      imageUrl: dto.imageUrl?.trim() ?? '',
    });
    return this.stockRepo.save(stock);
  }

  async getList(params: {
    tab?: string;
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    inventoryTypeId?: number | null;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: FinishedStockRow[]; total: number; page: number; pageSize: number }> {
    const { tab = 'all', orderNo, skuCode, customerName, inventoryTypeId, page = 1, pageSize = 20 } = params;

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
      if (customerName?.trim()) {
        countQb.andWhere('o.customer_name LIKE :customerName', {
          customerName: `%${customerName.trim()}%`,
        });
      }
      const pendingTotal = await countQb.getCount();

      const pendingQb = this.pendingRepo
        .createQueryBuilder('p')
        .innerJoin(Order, 'o', 'o.id = p.order_id')
        .where('p.status = :status', { status: 'pending' })
        .select([
          'p.id AS id',
          'p.order_id AS orderId',
          'o.order_no AS orderNo',
          'o.customer_name AS customerName',
          'p.sku_code AS skuCode',
          'p.quantity AS quantity',
          'p.created_at AS createdAt',
        ]);
      if (orderNo?.trim()) {
        pendingQb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
      }
      if (skuCode?.trim()) {
        pendingQb.andWhere('p.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
      }
      if (customerName?.trim()) {
        pendingQb.andWhere('o.customer_name LIKE :customerName', {
          customerName: `%${customerName.trim()}%`,
        });
      }
      pendingQb.orderBy('p.created_at', 'DESC');
      const pendingRows = await pendingQb.getRawMany<{
        id: number;
        orderId: number;
        orderNo: string;
        customerName: string;
        skuCode: string;
        quantity: number;
        createdAt: Date;
      }>();
      const pendingList: FinishedStockRow[] = pendingRows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        orderNo: r.orderNo ?? '',
        customerName: r.customerName ?? '',
        skuCode: r.skuCode ?? '',
        quantity: r.quantity ?? 0,
        warehouseId: null,
        inventoryTypeId: null,
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
          's.customer_name AS customerName',
          's.sku_code AS skuCode',
          's.quantity AS quantity',
          's.warehouse_id AS warehouseId',
          's.inventory_type_id AS inventoryTypeId',
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
      if (customerName?.trim()) {
        stockQb.andWhere('s.customer_name LIKE :customerName', {
          customerName: `%${customerName.trim()}%`,
        });
      }
      if (inventoryTypeId != null) {
        stockQb.andWhere('s.inventory_type_id = :inventoryTypeId', { inventoryTypeId });
      }
      stockQb.orderBy('s.created_at', 'DESC');
      const storedCount = await stockQb.getCount();
      const storedRows = await stockQb
        .offset(tab === 'stored' ? (page - 1) * pageSize : 0)
        .limit(tab === 'stored' ? pageSize : 10000)
        .getRawMany<{
          id: number;
          orderId: number;
          orderNo: string;
          customerName: string;
          skuCode: string;
          quantity: number;
          warehouseId: number | null;
          inventoryTypeId: number | null;
          department: string;
          location: string;
          createdAt: Date;
        }>();
      const storedList: FinishedStockRow[] = storedRows.map((r) => ({
        id: r.id,
        orderId: r.orderId,
        orderNo: r.orderNo ?? '',
        customerName: r.customerName ?? '',
        skuCode: r.skuCode ?? '',
        quantity: r.quantity ?? 0,
        warehouseId: r.warehouseId ?? null,
        inventoryTypeId: r.inventoryTypeId ?? null,
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
  async outbound(id: number, quantity: number, operatorUsername: string, remark: string): Promise<void> {
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
    const order = await this.orderRepo.findOne({ where: { id: stock.orderId } });
    if (!order) throw new NotFoundException('订单不存在');

    stock.quantity -= q;
    if (stock.quantity === 0) {
      await this.stockRepo.remove(stock);
    } else {
      await this.stockRepo.save(stock);
    }

    const out = this.outboundRepo.create({
      finishedStockId: id,
      orderId: stock.orderId,
      orderNo: order.orderNo ?? '',
      skuCode: stock.skuCode ?? '',
      customerName: stock.customerName ?? '',
      quantity: q,
      operatorUsername: (operatorUsername ?? '').trim(),
      remark: (remark ?? '').trim(),
    });
    await this.outboundRepo.save(out);
  }

  async getOutboundRecords(params: {
    orderNo?: string;
    skuCode?: string;
    customerName?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ list: FinishedGoodsOutbound[]; total: number; page: number; pageSize: number }> {
    const { orderNo, skuCode, customerName, startDate, endDate, page = 1, pageSize = 20 } = params;
    const qb = this.outboundRepo.createQueryBuilder('o');
    if (orderNo?.trim()) qb.andWhere('o.order_no LIKE :orderNo', { orderNo: `%${orderNo.trim()}%` });
    if (skuCode?.trim()) qb.andWhere('o.sku_code LIKE :skuCode', { skuCode: `%${skuCode.trim()}%` });
    if (customerName?.trim()) {
      qb.andWhere('o.customer_name LIKE :customerName', { customerName: `%${customerName.trim()}%` });
    }
    if (startDate?.trim()) qb.andWhere('o.created_at >= :start', { start: `${startDate.trim()} 00:00:00` });
    if (endDate?.trim()) qb.andWhere('o.created_at <= :end', { end: `${endDate.trim()} 23:59:59` });
    qb.orderBy('o.created_at', 'DESC');
    const total = await qb.getCount();
    const list = await qb
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getMany();
    return { list, total, page, pageSize };
  }
}
