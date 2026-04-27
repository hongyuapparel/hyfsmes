import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt } from '../entities/order-ext.entity';
import { OrderFinishing } from '../entities/order-finishing.entity';
import { InboundPending } from '../entities/inbound-pending.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';

@Injectable()
export class ProductionFinishingMutationService {
  private hasTailReceivedQtyRowColumn: boolean | null = null;
  private hasPackagingQtyRowColumns: boolean | null = null;

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderFinishing)
    private readonly finishingRepo: Repository<OrderFinishing>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(InboundPending)
    private readonly inboundPendingRepo: Repository<InboundPending>,
    private readonly orderWorkflowService: OrderWorkflowService,
  ) {}

  private async hasTailReceivedQtyRow(): Promise<boolean> {
    if (this.hasTailReceivedQtyRowColumn != null) return this.hasTailReceivedQtyRowColumn;
    try {
      const rows = await this.finishingRepo.query("SHOW COLUMNS FROM `order_finishing` LIKE 'tail_received_qty_row'");
      this.hasTailReceivedQtyRowColumn = Array.isArray(rows) && rows.length > 0;
      return this.hasTailReceivedQtyRowColumn;
    } catch {
      this.hasTailReceivedQtyRowColumn = false;
      return false;
    }
  }

  private async hasPackagingQtyRows(): Promise<boolean> {
    if (this.hasPackagingQtyRowColumns != null) return this.hasPackagingQtyRowColumns;
    try {
      const r1 = await this.finishingRepo.query("SHOW COLUMNS FROM `order_finishing` LIKE 'tail_inbound_qty_row'");
      const r2 = await this.finishingRepo.query("SHOW COLUMNS FROM `order_finishing` LIKE 'defect_quantity_row'");
      this.hasPackagingQtyRowColumns = Array.isArray(r1) && r1.length > 0 && Array.isArray(r2) && r2.length > 0;
      return this.hasPackagingQtyRowColumns;
    } catch {
      this.hasPackagingQtyRowColumns = false;
      return false;
    }
  }

  private async fetchTailReceivedQtyRow(orderId: number): Promise<number[] | null> {
    if (!(await this.hasTailReceivedQtyRow())) return null;
    try {
      const rows = await this.finishingRepo.query(
        'SELECT tail_received_qty_row AS tailReceivedQtyRow FROM `order_finishing` WHERE order_id = ? LIMIT 1',
        [orderId],
      );
      const raw = Array.isArray(rows) && rows.length > 0 ? (rows[0] as { tailReceivedQtyRow?: unknown }).tailReceivedQtyRow : null;
      if (raw == null) return null;
      if (Array.isArray(raw)) return raw as number[];
      if (typeof raw === 'string') {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as number[]) : null;
      }
      if (typeof raw === 'object') return Array.isArray(raw) ? (raw as number[]) : null;
      return null;
    } catch {
      return null;
    }
  }

  private async assertCanAmendPackagingPending(orderId: number, finishing: OrderFinishing): Promise<void> {
    const all = await this.inboundPendingRepo.find({ where: { orderId } });
    const hasCompleted = all.some((p) => (p.status ?? '') === 'completed');
    if (hasCompleted) {
      throw new BadRequestException(
        '该订单已有待仓记录完成入库或发货，无法在尾部修改入库/次品数量，请通过仓库库存或业务单据调整。',
      );
    }
    const pendingList = all.filter((p) => (p.status ?? 'pending') === 'pending');
    const expectedTotal = (Number(finishing.tailInboundQty) || 0) + (Number(finishing.defectQuantity) || 0);
    const pendingSum = pendingList.reduce((s, p) => s + (Number(p.quantity) || 0), 0);
    if (pendingList.length > 0 && pendingSum !== expectedTotal) {
      throw new BadRequestException('待仓处理数量与当前登记不一致（可能已在仓库部分处理），无法在尾部修改。');
    }
    if (pendingList.length === 0 && expectedTotal > 0) {
      throw new BadRequestException('未找到可调整的待仓记录，可能已全部完成入库；无法在尾部修改。');
    }
  }

  async registerReceive(orderId: number, tailReceivedQty: number, tailReceivedQuantities?: number[] | null): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'pending_finishing') throw new NotFoundException('仅待尾部订单可登记收货');
    const existing = await this.finishingRepo.findOne({ where: { orderId } });
    if (existing) throw new NotFoundException('该订单已登记收货，请到「尾部」tab 登记包装完成');

    const now = new Date();
    const arrivedAt = order.statusTime ?? now;
    const normalizedTotal = Number(tailReceivedQty) || 0;
    if (normalizedTotal <= 0) throw new NotFoundException('请填写尾部收货数');

    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const headers =
      Array.isArray(ext?.colorSizeHeaders) && ext.colorSizeHeaders.length > 0 ? [...ext.colorSizeHeaders, '合计'] : ['合计'];
    const sizeCount = headers.length > 1 ? headers.length - 1 : 1;
    let tailReceivedQtyRow: number[] | null = null;
    const canSaveRow = await this.hasTailReceivedQtyRow();
    if (canSaveRow) {
      if (Array.isArray(tailReceivedQuantities) && tailReceivedQuantities.length) {
        const perSize = tailReceivedQuantities.slice(0, sizeCount).map((v) => Math.max(0, Number(v) || 0));
        while (perSize.length < sizeCount) perSize.push(0);
        const total = perSize.reduce((a, b) => a + b, 0);
        tailReceivedQtyRow = headers.length === 1 ? [normalizedTotal] : [...perSize, total];
        if (total !== normalizedTotal) {
          throw new NotFoundException(`尾部收货数合计(${total})须等于尾部收货数(${normalizedTotal})`);
        }
      } else {
        tailReceivedQtyRow = headers.length === 1 ? [normalizedTotal] : [...Array(sizeCount).fill(0), normalizedTotal];
      }
    }

    const payload: Partial<OrderFinishing> = {
      orderId,
      status: 'pending_assign',
      arrivedAt,
      completedAt: null,
      tailReceivedQty: normalizedTotal,
      tailShippedQty: 0,
      tailInboundQty: 0,
      defectQuantity: 0,
      remark: null,
    };
    if (canSaveRow) {
      (payload as { tailReceivedQtyRow?: number[] | null }).tailReceivedQtyRow = tailReceivedQtyRow;
    }
    const finishing = this.finishingRepo.create(payload);
    await this.finishingRepo.save(finishing);
  }

  async registerPackagingComplete(
    orderId: number,
    tailShippedQty: number,
    tailInboundQty: number,
    defectQuantity: number,
    remark?: string | null,
    actorUserId?: number,
    tailInboundQuantities?: number[] | null,
    defectQuantities?: number[] | null,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) throw new NotFoundException('请先登记收货');

    const received = Number(finishing.tailReceivedQty) || 0;
    if (received <= 0) throw new NotFoundException('尾部收货数无效，请先登记收货');
    const isFirstRegister = finishing.status === 'pending_assign';
    const isAmend = finishing.status === 'inbound';
    if (!isFirstRegister && !isAmend) {
      throw new NotFoundException('仅「尾部中」待登记包装或「尾部完成」且待仓未处理的订单可操作');
    }
    const ship = 0;
    void tailShippedQty;
    const inbound = Number(tailInboundQty) || 0;
    const defect = Number(defectQuantity) || 0;
    if (inbound < 0 || defect < 0) throw new NotFoundException('入库数/次品数不可为负数');
    if (inbound + defect !== received) {
      throw new NotFoundException(`入库数(${inbound})+次品数(${defect}) 须等于尾部收货数(${received})`);
    }

    if (isAmend) await this.assertCanAmendPackagingPending(orderId, finishing);

    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const headers =
      Array.isArray(ext?.colorSizeHeaders) && ext.colorSizeHeaders.length > 0 ? [...ext.colorSizeHeaders, '合计'] : ['合计'];
    const sizeCount = headers.length > 1 ? headers.length - 1 : 1;

    if (await this.hasPackagingQtyRows()) {
      const tin = tailInboundQuantities;
      const tdq = defectQuantities;
      const hasArrays = Array.isArray(tin) && Array.isArray(tdq) && tin.length >= sizeCount && tdq.length >= sizeCount;
      if (hasArrays) {
        const perIn = tin.slice(0, sizeCount).map((v) => Math.max(0, Number(v) || 0));
        const perDef = tdq.slice(0, sizeCount).map((v) => Math.max(0, Number(v) || 0));
        while (perIn.length < sizeCount) perIn.push(0);
        while (perDef.length < sizeCount) perDef.push(0);
        const sumIn = perIn.reduce((a, b) => a + b, 0);
        const sumDef = perDef.reduce((a, b) => a + b, 0);
        if (sumIn !== inbound || sumDef !== defect) {
          throw new BadRequestException('按尺码填写的入库数、次品数合计与汇总不一致');
        }
        const receivedRow = await this.fetchTailReceivedQtyRow(orderId);
        if (Array.isArray(receivedRow) && receivedRow.length === headers.length && headers.length > 1) {
          let allNumeric = true;
          for (let i = 0; i < sizeCount; i++) {
            const r = receivedRow[i];
            if (r == null || !Number.isFinite(Number(r))) {
              allNumeric = false;
              break;
            }
          }
          if (allNumeric) {
            for (let i = 0; i < sizeCount; i++) {
              const r = Number(receivedRow[i]) || 0;
              if (perIn[i] + perDef[i] !== r) {
                throw new BadRequestException(`${String(headers[i] ?? '尺码')}：入库数+次品数须等于该码尾部收货数(${r})`);
              }
            }
          }
        }
        const tailInboundQtyRow = headers.length === 1 ? [inbound] : [...perIn, inbound];
        const defectQuantityRow = headers.length === 1 ? [defect] : [...perDef, defect];
        (finishing as { tailInboundQtyRow?: number[] }).tailInboundQtyRow = tailInboundQtyRow;
        (finishing as { defectQuantityRow?: number[] }).defectQuantityRow = defectQuantityRow;
      }
    }

    let nextStatus: string | null = null;
    if (isFirstRegister) {
      nextStatus = await this.orderWorkflowService.resolveNextStatus({
        order,
        triggerCode: 'tailing_inbound_completed',
        actorUserId: actorUserId ?? 0,
      });
      if (!nextStatus) {
        throw new BadRequestException('未匹配到“入库完成”流转规则，请先在订单设置中检查流程链路配置');
      }
    }

    finishing.tailShippedQty = ship;
    finishing.tailInboundQty = inbound;
    finishing.defectQuantity = defect;
    finishing.remark = remark?.trim() || null;
    if (isFirstRegister) {
      finishing.completedAt = new Date();
      finishing.status = 'inbound';
      await this.finishingRepo.save(finishing);
      if (nextStatus && nextStatus !== order.status) {
        order.status = nextStatus;
        order.statusTime = new Date();
        await this.orderRepo.save(order);
      }
    } else {
      await this.finishingRepo.save(finishing);
      await this.inboundPendingRepo.delete({ orderId: order.id, status: 'pending' });
    }

    const pendingRows: InboundPending[] = [];
    if (inbound > 0) {
      pendingRows.push(
        this.inboundPendingRepo.create({
          orderId: order.id,
          skuCode: order.skuCode ?? '',
          quantity: inbound,
          sourceType: 'normal',
          status: 'pending',
        }),
      );
    }
    if (defect > 0) {
      pendingRows.push(
        this.inboundPendingRepo.create({
          orderId: order.id,
          skuCode: order.skuCode ?? '',
          quantity: defect,
          sourceType: 'defect',
          status: 'pending',
        }),
      );
    }
    if (pendingRows.length) await this.inboundPendingRepo.save(pendingRows);
  }

  async financeApproveFinishing(orderId: number, actorUserId?: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) throw new NotFoundException('无尾部记录');
    if (finishing.status !== 'pending_ship') throw new NotFoundException('仅等待发货状态可进行财务审批');
    const received = finishing.tailReceivedQty ?? 0;
    const shipped = finishing.tailShippedQty ?? 0;
    const inbound = finishing.tailInboundQty ?? 0;
    const defect = finishing.defectQuantity ?? 0;
    if (shipped + inbound + defect !== received) {
      throw new NotFoundException(`出货数(${shipped})+入库数(${inbound})+次品数(${defect}) 须等于尾部收货数(${received})后才能审批完成`);
    }
    const next = await this.orderWorkflowService.resolveNextStatus({
      order,
      triggerCode: 'tailing_inbound_completed',
      actorUserId: actorUserId ?? 0,
    });
    if (!next) {
      throw new BadRequestException('未匹配到“入库完成”流转规则，请先在订单设置中检查流程链路配置');
    }
    finishing.status = 'inbound';
    await this.finishingRepo.save(finishing);
    if (next && next !== order.status) {
      order.status = next;
      order.statusTime = new Date();
      await this.orderRepo.save(order);
    }
    const pendingRows: InboundPending[] = [];
    if (inbound > 0) {
      pendingRows.push(
        this.inboundPendingRepo.create({
          orderId: order.id,
          skuCode: order.skuCode ?? '',
          quantity: inbound,
          sourceType: 'normal',
          status: 'pending',
        }),
      );
    }
    if (defect > 0) {
      pendingRows.push(
        this.inboundPendingRepo.create({
          orderId: order.id,
          skuCode: order.skuCode ?? '',
          quantity: defect,
          sourceType: 'defect',
          status: 'pending',
        }),
      );
    }
    if (pendingRows.length) await this.inboundPendingRepo.save(pendingRows);
  }

  async registerPackaging(orderId: number, tailReceivedQty: number, defectQuantity: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    if (order.status !== 'pending_finishing') throw new NotFoundException('仅待尾部订单可登记包装');

    const now = new Date();
    const arrivedAt = order.statusTime ?? now;
    let finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) {
      finishing = this.finishingRepo.create({
        orderId,
        status: 'pending_ship',
        arrivedAt,
        completedAt: now,
        tailReceivedQty,
        tailShippedQty: 0,
        tailInboundQty: 0,
        defectQuantity: defectQuantity ?? 0,
      });
    } else {
      finishing.arrivedAt = finishing.arrivedAt ?? arrivedAt;
      finishing.completedAt = now;
      finishing.tailReceivedQty = tailReceivedQty;
      finishing.defectQuantity = defectQuantity ?? 0;
      finishing.status = 'pending_ship';
    }
    await this.finishingRepo.save(finishing);
  }

  async ship(orderId: number, quantity: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) throw new NotFoundException('请先登记包装完成');
    if (finishing.status !== 'pending_ship' && finishing.status !== 'shipped') {
      throw new NotFoundException('仅等待发货或已发货状态可操作发货');
    }

    const qty = Number(quantity) || 0;
    if (qty <= 0) throw new NotFoundException('请填写本次出货数');
    const received = finishing.tailReceivedQty ?? 0;
    const defect = finishing.defectQuantity ?? 0;
    const inbound = finishing.tailInboundQty ?? 0;
    const newShipped = (finishing.tailShippedQty ?? 0) + qty;
    if (newShipped + inbound + defect > received) {
      throw new NotFoundException(`出货数+入库数+次品数不能超过尾部收货数(${received})，当前出货将累加为${newShipped}`);
    }

    finishing.tailShippedQty = newShipped;
    if (finishing.status === 'pending_ship') finishing.status = 'shipped';
    await this.finishingRepo.save(finishing);
  }

  async inbound(orderId: number, quantity: number, actorUserId?: number): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const finishing = await this.finishingRepo.findOne({ where: { orderId } });
    if (!finishing) throw new NotFoundException('请先登记包装完成');
    if (finishing.status !== 'shipped') throw new NotFoundException('请先执行发货后再入库');

    const qty = Number(quantity) || 0;
    if (qty <= 0) throw new NotFoundException('请填写本次入库数');
    const received = finishing.tailReceivedQty ?? 0;
    const shipped = finishing.tailShippedQty ?? 0;
    const defect = finishing.defectQuantity ?? 0;
    const newInbound = (finishing.tailInboundQty ?? 0) + qty;
    if (shipped + newInbound + defect > received) {
      throw new NotFoundException(`出货数(${shipped})+入库数+次品数(${defect})不能超过尾部收货数(${received})`);
    }

    finishing.tailInboundQty = newInbound;
    const total = shipped + newInbound + defect;
    if (total === received) {
      const next = await this.orderWorkflowService.resolveNextStatus({
        order,
        triggerCode: 'tailing_inbound_completed',
        actorUserId: actorUserId ?? 0,
      });
      if (!next) {
        throw new BadRequestException('未匹配到“入库完成”流转规则，请先在订单设置中检查流程链路配置');
      }
      finishing.status = 'inbound';
      await this.finishingRepo.save(finishing);
      if (next && next !== order.status) {
        order.status = next;
        order.statusTime = new Date();
        await this.orderRepo.save(order);
      }
      const pending = this.inboundPendingRepo.create({
        orderId: order.id,
        skuCode: order.skuCode ?? '',
        quantity: finishing.tailInboundQty ?? 0,
        sourceType: 'normal',
        status: 'pending',
      });
      await this.inboundPendingRepo.save(pending);
    } else {
      await this.finishingRepo.save(finishing);
    }
  }
}
