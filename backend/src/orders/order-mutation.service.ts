import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt, type OrderMaterialRow, type PackagingCell } from '../entities/order-ext.entity';
import { OrderRemark } from '../entities/order-remark.entity';
import { OrderCostSnapshot } from '../entities/order-cost-snapshot.entity';
import { User } from '../entities/user.entity';
import { InventoryAccessoriesService } from '../inventory-accessories/inventory-accessories.service';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { OrderQueryService } from './order-query.service';
import { OrderStatusService } from './order-status.service';
import { type OrderActor, type OrderEditPayload } from './order.types';

@Injectable()
export class OrderMutationService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(OrderRemark)
    private readonly orderRemarkRepo: Repository<OrderRemark>,
    @InjectRepository(OrderCostSnapshot)
    private readonly orderCostSnapshotRepo: Repository<OrderCostSnapshot>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly inventoryAccessoriesService: InventoryAccessoriesService,
    private readonly orderWorkflowService: OrderWorkflowService,
    private readonly suppliersService: SuppliersService,
    private readonly orderQueryService: OrderQueryService,
    private readonly orderStatusService: OrderStatusService,
  ) {}

  private normalizeMaterialRows(rows: OrderMaterialRow[]): OrderMaterialRow[] {
    return rows.map((row) => {
      const { materialType: _dropType, materialSource: _dropSource, ...rest } = row;
      return rest as OrderMaterialRow;
    });
  }

  private normalizeDecimalInput(v: unknown): string {
    if (v === null || v === undefined) return '0';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '0';
    if (typeof v === 'string') {
      const t = v.trim();
      return t ? t : '0';
    }
    return '0';
  }

  private collectSupplierNamesFromOrderExt(ext: OrderExt | null | undefined): string[] {
    if (!ext) return [];
    const names: string[] = [];
    const materials = Array.isArray(ext.materials) ? ext.materials : [];
    for (const m of materials) {
      const name = (m?.supplierName ?? '').trim();
      if (name) names.push(name);
    }
    const processItems = Array.isArray(ext.processItems) ? ext.processItems : [];
    for (const p of processItems) {
      const name = (p?.supplierName ?? '').trim();
      if (name) names.push(name);
    }
    return names;
  }

  private async touchSuppliersActiveByOrderId(orderId: number): Promise<void> {
    const ext = await this.orderExtRepo.findOne({ where: { orderId } });
    const names = this.collectSupplierNamesFromOrderExt(ext);
    await this.suppliersService.touchLastActiveByNames(names);
  }

  private async autoOutboundAccessoriesByPackagingCells(
    order: Order & { packagingCells?: PackagingCell[] },
    actor: OrderActor,
  ): Promise<void> {
    const cells = Array.isArray((order as any).packagingCells) ? ((order as any).packagingCells as PackagingCell[]) : [];
    if (!cells.length) return;
    const orderQty = Number(order.quantity) || 0;
    if (orderQty <= 0) return;
    const countById = new Map<number, number>();
    cells.forEach((c) => {
      const id = Number((c as any).accessoryId);
      if (!id || Number.isNaN(id)) return;
      countById.set(id, (countById.get(id) ?? 0) + 1);
    });
    if (!countById.size) return;
    for (const [accessoryId, times] of countById.entries()) {
      const qty = orderQty * (times || 1);
      await this.inventoryAccessoriesService.outbound({
        accessoryId,
        quantity: qty,
        outboundType: 'order_auto',
        operatorUsername: actor.username,
        remark: `订单自动出库：${order.orderNo}（${orderQty} * ${times}）`,
        orderId: order.id,
        orderNo: order.orderNo,
      });
    }
  }

  private buildUpdateChangesDescription(before: Order, payload: OrderEditPayload): string {
    const changes: string[] = [];
    const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v);
    const toDateOnly = (v: string | null | undefined): string => {
      if (!v) return '';
      const s = v.trim();
      if (!s) return '';
      return s.length > 10 ? s.slice(0, 10) : s;
    };
    if (payload.skuCode !== undefined && trim(payload.skuCode) !== before.skuCode) {
      changes.push(`SKU: ${before.skuCode || '-'} -> ${trim(payload.skuCode) || '-'}`);
    }
    if (payload.customerName !== undefined && trim(payload.customerName) !== before.customerName) {
      changes.push(`客户名称: ${before.customerName || '-'} -> ${trim(payload.customerName) || '-'}`);
    }
    if (payload.salesperson !== undefined && trim(payload.salesperson) !== before.salesperson) {
      changes.push(`业务员: ${before.salesperson || '-'} -> ${trim(payload.salesperson) || '-'}`);
    }
    if (payload.merchandiser !== undefined && trim(payload.merchandiser) !== before.merchandiser) {
      changes.push(`跟单员: ${before.merchandiser || '-'} -> ${trim(payload.merchandiser) || '-'}`);
    }
    if (payload.quantity !== undefined && payload.quantity !== before.quantity) {
      changes.push(`数量: ${before.quantity} -> ${payload.quantity ?? 0}`);
    }
    if (payload.exFactoryPrice !== undefined && this.normalizeDecimalInput(payload.exFactoryPrice) !== before.exFactoryPrice) {
      changes.push(`出厂价: ${before.exFactoryPrice} -> ${this.normalizeDecimalInput(payload.exFactoryPrice)}`);
    }
    if (payload.salePrice !== undefined && this.normalizeDecimalInput(payload.salePrice) !== before.salePrice) {
      changes.push(`销售价: ${before.salePrice} -> ${this.normalizeDecimalInput(payload.salePrice)}`);
    }
    if (payload.processItem !== undefined && trim(payload.processItem) !== before.processItem) {
      changes.push(`工艺项目: ${before.processItem || '-'} -> ${trim(payload.processItem) || '-'}`);
    }
    if (payload.orderDate !== undefined) {
      const beforeVal = before.orderDate ? before.orderDate.toISOString().slice(0, 10) : '';
      const nextVal = toDateOnly(payload.orderDate ?? null);
      if (nextVal !== beforeVal) changes.push(`下单日期: ${beforeVal || '-'} -> ${nextVal || '-'}`);
    }
    if (payload.customerDueDate !== undefined) {
      const beforeVal = before.customerDueDate ? before.customerDueDate.toISOString().slice(0, 10) : '';
      const nextVal = toDateOnly(payload.customerDueDate ?? null);
      if (nextVal !== beforeVal) changes.push(`客户交期: ${beforeVal || '-'} -> ${nextVal || '-'}`);
    }
    if (payload.factoryName !== undefined && trim(payload.factoryName) !== before.factoryName) {
      changes.push(`加工厂: ${before.factoryName || '-'} -> ${trim(payload.factoryName) || '-'}`);
    }
    return changes.length ? changes.join('; ') : '无关键字段变更';
  }

  private async generateNextOrderNo(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = String(year);
    const last = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.order_no LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('o.order_no', 'DESC')
      .getOne();
    let nextSeq = 1;
    if (last?.orderNo?.startsWith(prefix)) {
      const suffix = last.orderNo.slice(prefix.length);
      const n = parseInt(suffix, 10);
      if (!Number.isNaN(n)) nextSeq = n + 1;
    }
    return `${prefix}${String(nextSeq).padStart(3, '0')}`;
  }

  async createDraft(payload: OrderEditPayload, actor: OrderActor): Promise<Order> {
    const now = new Date();
    const entity = this.orderRepo.create({
      orderNo: await this.generateNextOrderNo(),
      skuCode: payload.skuCode?.trim() || '',
      customerId: payload.customerId ?? null,
      customerName: payload.customerName?.trim() || '',
      collaborationTypeId: typeof payload.collaborationTypeId === 'number' ? payload.collaborationTypeId : null,
      salesperson: payload.salesperson?.trim() || '',
      merchandiser: payload.merchandiser?.trim() || '',
      quantity: payload.quantity ?? 0,
      exFactoryPrice: this.normalizeDecimalInput(payload.exFactoryPrice),
      salePrice: this.normalizeDecimalInput(payload.salePrice),
      orderTypeId: typeof payload.orderTypeId === 'number' ? payload.orderTypeId : null,
      processItem: payload.processItem?.trim() || '',
      orderDate: payload.orderDate ? new Date(payload.orderDate) : now,
      customerDueDate: payload.customerDueDate ? new Date(payload.customerDueDate) : null,
      factoryName: payload.factoryName?.trim() || '',
      imageUrl: payload.imageUrl?.trim() || '',
      status: 'draft',
      statusTime: now,
    });
    const saved = await this.orderRepo.save(entity);
    const extPayload: Partial<OrderExt> = { orderId: saved.id };
    if (payload.materials && Array.isArray(payload.materials)) extPayload.materials = this.normalizeMaterialRows(payload.materials);
    if (payload.colorSizeHeaders && Array.isArray(payload.colorSizeHeaders)) extPayload.colorSizeHeaders = payload.colorSizeHeaders;
    if (payload.colorSizeRows && Array.isArray(payload.colorSizeRows)) extPayload.colorSizeRows = payload.colorSizeRows;
    if (payload.sizeInfoMetaHeaders && Array.isArray(payload.sizeInfoMetaHeaders)) extPayload.sizeInfoMetaHeaders = payload.sizeInfoMetaHeaders;
    if (payload.sizeInfoRows && Array.isArray(payload.sizeInfoRows)) extPayload.sizeInfoRows = payload.sizeInfoRows;
    if (payload.processItems && Array.isArray(payload.processItems)) extPayload.processItems = payload.processItems;
    if (typeof payload.productionRequirement === 'string') extPayload.productionRequirement = payload.productionRequirement;
    if (payload.packagingHeaders && Array.isArray(payload.packagingHeaders)) extPayload.packagingHeaders = payload.packagingHeaders;
    if (payload.packagingCells && Array.isArray(payload.packagingCells)) extPayload.packagingCells = payload.packagingCells;
    if (typeof payload.packagingMethod === 'string') extPayload.packagingMethod = payload.packagingMethod;
    if (payload.attachments && Array.isArray(payload.attachments)) extPayload.attachments = payload.attachments;
    if (Object.keys(extPayload).length > 1) await this.orderExtRepo.save(this.orderExtRepo.create(extPayload));
    await this.orderStatusService.addLog(saved, actor, 'create', '创建订单草稿');
    await this.orderStatusService.appendStatusHistory(saved.id, 'draft');
    return saved;
  }

  async updateDraft(id: number, payload: OrderEditPayload, actor: OrderActor): Promise<Order> {
    const order = await this.orderQueryService.findOne(id);
    const before = { ...order };
    const shouldRebaseWorkflow =
      this.orderStatusService.hasWorkflowRelevantPayload(payload) &&
      (this.orderStatusService.hasWorkflowRelevantChanges(before, payload) ||
        this.orderStatusService.canRebaseWorkflowStatus(order.status));

    if (payload.skuCode !== undefined) order.skuCode = payload.skuCode.trim();
    if (payload.customerId !== undefined) order.customerId = payload.customerId;
    if (payload.customerName !== undefined) order.customerName = payload.customerName.trim();
    if (payload.collaborationTypeId !== undefined) {
      order.collaborationTypeId = typeof payload.collaborationTypeId === 'number' ? payload.collaborationTypeId : null;
    }
    if (payload.salesperson !== undefined) order.salesperson = payload.salesperson.trim();
    if (payload.merchandiser !== undefined) order.merchandiser = payload.merchandiser.trim();
    if (payload.quantity !== undefined) order.quantity = payload.quantity ?? 0;
    if (payload.exFactoryPrice !== undefined) order.exFactoryPrice = this.normalizeDecimalInput(payload.exFactoryPrice);
    if (payload.salePrice !== undefined) order.salePrice = this.normalizeDecimalInput(payload.salePrice);
    if (payload.orderTypeId !== undefined) order.orderTypeId = typeof payload.orderTypeId === 'number' ? payload.orderTypeId : null;
    if (payload.processItem !== undefined) order.processItem = payload.processItem.trim();
    if (payload.orderDate !== undefined) order.orderDate = payload.orderDate ? new Date(payload.orderDate) : null;
    if (payload.customerDueDate !== undefined) order.customerDueDate = payload.customerDueDate ? new Date(payload.customerDueDate) : null;
    if (payload.factoryName !== undefined) order.factoryName = payload.factoryName.trim();
    if (payload.imageUrl !== undefined) order.imageUrl = payload.imageUrl.trim();
    let saved = await this.orderRepo.save(order);

    if (
      payload.materials !== undefined ||
      payload.colorSizeHeaders !== undefined ||
      payload.colorSizeRows !== undefined ||
      payload.sizeInfoMetaHeaders !== undefined ||
      payload.sizeInfoRows !== undefined ||
      payload.processItems !== undefined ||
      payload.productionRequirement !== undefined ||
      payload.packagingHeaders !== undefined ||
      payload.packagingCells !== undefined ||
      payload.packagingMethod !== undefined ||
      payload.attachments !== undefined
    ) {
      let ext = await this.orderExtRepo.findOne({ where: { orderId: id } });
      if (!ext) {
        ext = this.orderExtRepo.create({
          orderId: id,
          materials: payload.materials && Array.isArray(payload.materials) ? this.normalizeMaterialRows(payload.materials) : null,
          colorSizeHeaders: payload.colorSizeHeaders ?? null,
          colorSizeRows: payload.colorSizeRows ?? null,
          sizeInfoMetaHeaders: payload.sizeInfoMetaHeaders ?? null,
          sizeInfoRows: payload.sizeInfoRows ?? null,
          processItems: payload.processItems ?? null,
          productionRequirement: payload.productionRequirement ?? null,
          packagingHeaders: payload.packagingHeaders ?? null,
          packagingCells: payload.packagingCells ?? null,
          packagingMethod: payload.packagingMethod ?? null,
          attachments: payload.attachments ?? null,
        });
      } else {
        if (payload.materials !== undefined) ext.materials = Array.isArray(payload.materials) ? this.normalizeMaterialRows(payload.materials) : payload.materials;
        if (payload.colorSizeHeaders !== undefined) ext.colorSizeHeaders = payload.colorSizeHeaders;
        if (payload.colorSizeRows !== undefined) ext.colorSizeRows = payload.colorSizeRows;
        if (payload.sizeInfoMetaHeaders !== undefined) ext.sizeInfoMetaHeaders = payload.sizeInfoMetaHeaders;
        if (payload.sizeInfoRows !== undefined) ext.sizeInfoRows = payload.sizeInfoRows;
        if (payload.processItems !== undefined) ext.processItems = payload.processItems;
        if (payload.productionRequirement !== undefined) ext.productionRequirement = payload.productionRequirement ?? null;
        if (payload.packagingHeaders !== undefined) ext.packagingHeaders = payload.packagingHeaders;
        if (payload.packagingCells !== undefined) ext.packagingCells = payload.packagingCells;
        if (payload.packagingMethod !== undefined) ext.packagingMethod = payload.packagingMethod ?? null;
        if (payload.attachments !== undefined) ext.attachments = payload.attachments;
      }
      await this.orderExtRepo.save(ext);
    }
    const detail = this.buildUpdateChangesDescription(before, payload);
    if (detail && detail !== '无关键字段变更') await this.orderStatusService.addLog(saved, actor, 'update', detail);
    if (shouldRebaseWorkflow) {
      saved = (await this.orderStatusService.rebaseWorkflowStatusAfterOrderEdit(id, actor)) ?? saved;
    }
    await this.syncCostSnapshotFromOrder(id, { keepExistingPricing: true });
    return saved;
  }

  async submit(id: number, actor: OrderActor): Promise<Order> {
    const order = await this.orderQueryService.findOne(id);
    const beforeStatus = order.status;
    if (!order.orderNo) order.orderNo = await this.generateNextOrderNo();
    if (beforeStatus === 'draft') {
      order.orderDate = new Date();
      const next = await this.orderWorkflowService.resolveNextStatus({
        order,
        triggerCode: 'submit',
        actorUserId: actor.userId,
      });
      order.status = next ?? 'pending_review';
      order.statusTime = new Date();
    }
    const saved = await this.orderRepo.save(order);
    if ((beforeStatus || '') !== (saved.status || '')) {
      await this.orderStatusService.addLog(saved, actor, 'submit', `状态: ${beforeStatus || '-'} -> ${saved.status}`);
      await this.orderStatusService.appendStatusHistory(saved.id, saved.status);
    }
    await this.touchSuppliersActiveByOrderId(saved.id);
    if (beforeStatus === 'draft') await this.autoOutboundAccessoriesByPackagingCells(order as any, actor);
    await this.syncCostSnapshotFromOrder(id, { keepExistingPricing: true });
    return saved;
  }

  async deleteMany(ids: number[], actor: OrderActor): Promise<void> {
    if (!ids?.length) return;
    const orders = await this.orderRepo.findByIds(ids);
    if (!orders.length) return;
    for (const o of orders) await this.orderStatusService.addLog(o, actor, 'delete', '删除订单');
    await this.orderRepo.delete(ids);
  }

  async reviewMany(ids: number[], actor: OrderActor): Promise<void> {
    if (!ids?.length) return;
    const orders = await this.orderRepo.findByIds(ids);
    for (const o of orders) {
      if (o.status !== 'pending_review') continue;
      const before = o.status;
      const next = await this.orderWorkflowService.resolveNextStatus({
        order: o as Order,
        triggerCode: 'review_approve',
        actorUserId: actor.userId,
      });
      const to = next ?? 'pending_purchase';
      o.status = to;
      o.statusTime = new Date();
      await this.orderRepo.save(o as any);
      if (before !== to) {
        await this.orderStatusService.addLog(o as any, actor, 'review', `审核订单：${before} -> ${to}`);
        await this.orderStatusService.appendStatusHistory(o.id, to);
      }
    }
  }

  async reviewRejectMany(ids: number[], reason: string, actor: OrderActor): Promise<void> {
    if (!ids?.length) return;
    const trimmedReason = (reason ?? '').trim();
    if (!trimmedReason) throw new Error('退回原因不能为空');
    const orders = await this.orderRepo.findByIds(ids);
    for (const o of orders) {
      if (o.status !== 'pending_review') continue;
      const before = o.status;
      const next = await this.orderWorkflowService.resolveNextStatus({
        order: o as Order,
        triggerCode: 'review_reject',
        actorUserId: actor.userId,
      });
      const to = next ?? 'draft';
      o.status = to;
      o.statusTime = new Date();
      await this.orderRepo.save(o as any);
      await this.addRemark(o.id, actor, `审核退回原因：${trimmedReason}`);
      if (before !== to) {
        await this.orderStatusService.addLog(o as any, actor, 'review', `审核退回：${before} -> ${to}；原因：${trimmedReason}`);
        await this.orderStatusService.appendStatusHistory(o.id, to);
      }
    }
  }

  private normalizeProfitMargin(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n < 0) return 0.1;
    if (Math.abs(n - 0.15) < 1e-9) return 0.1;
    return n;
  }

  async copyManyToDraft(ids: number[], actor: OrderActor): Promise<Order[]> {
    if (!ids?.length) return [];
    const now = new Date();
    const sourceOrders = await this.orderRepo.findByIds(ids);
    const created: Order[] = [];
    for (const src of sourceOrders) {
      const draft = this.orderRepo.create({
        orderNo: await this.generateNextOrderNo(),
        skuCode: src.skuCode?.trim() || '',
        customerId: src.customerId ?? null,
        customerName: src.customerName?.trim() || '',
        collaborationTypeId: src.collaborationTypeId ?? null,
        salesperson: src.salesperson?.trim() || '',
        merchandiser: src.merchandiser?.trim() || '',
        quantity: src.quantity ?? 0,
        exFactoryPrice: this.normalizeDecimalInput(src.exFactoryPrice),
        salePrice: this.normalizeDecimalInput(src.salePrice),
        orderTypeId: src.orderTypeId ?? null,
        processItem: src.processItem?.trim() || '',
        orderDate: src.orderDate ?? now,
        customerDueDate: src.customerDueDate ?? null,
        factoryName: src.factoryName?.trim() || '',
        imageUrl: src.imageUrl?.trim() || '',
        status: 'draft',
        statusTime: now,
      });
      const saved = await this.orderRepo.save(draft);
      await this.orderStatusService.appendStatusHistory(saved.id, 'draft');
      const srcExt = await this.orderExtRepo.findOne({ where: { orderId: src.id } });
      if (srcExt) {
        const newExt = this.orderExtRepo.create({
          orderId: saved.id,
          materials: srcExt.materials ?? null,
          colorSizeHeaders: srcExt.colorSizeHeaders ?? null,
          colorSizeRows: srcExt.colorSizeRows ?? null,
          sizeInfoMetaHeaders: srcExt.sizeInfoMetaHeaders ?? null,
          sizeInfoRows: srcExt.sizeInfoRows ?? null,
          processItems: srcExt.processItems ?? null,
          productionRequirement: srcExt.productionRequirement ?? null,
          packagingHeaders: srcExt.packagingHeaders ?? null,
          packagingCells: srcExt.packagingCells ?? null,
          packagingMethod: srcExt.packagingMethod ?? null,
          attachments: srcExt.attachments ?? null,
        });
        await this.orderExtRepo.save(newExt);
      }
      const srcCost = await this.orderCostSnapshotRepo.findOne({ where: { orderId: src.id } });
      if (srcCost?.snapshot != null) {
        const srcSnapshot = srcCost.snapshot && typeof srcCost.snapshot === 'object' ? ({ ...(srcCost.snapshot as any) } as any) : null;
        if (srcSnapshot && Object.prototype.hasOwnProperty.call(srcSnapshot, 'profitMargin')) {
          srcSnapshot.profitMargin = this.normalizeProfitMargin(srcSnapshot.profitMargin);
        }
        await this.orderCostSnapshotRepo.save(
          this.orderCostSnapshotRepo.create({ orderId: saved.id, snapshot: srcSnapshot ?? srcCost.snapshot }),
        );
      } else {
        await this.syncCostSnapshotFromOrder(saved.id, { keepExistingPricing: true });
      }
      created.push(saved);
      await this.orderStatusService.addLog(saved, actor, 'copy_to_draft', `从订单 ${src.orderNo} 复制为草稿`);
    }
    return created;
  }

  async addRemark(orderId: number, actor: OrderActor, content: string) {
    const order = await this.orderQueryService.findOne(orderId);
    let operatorUsername = actor.username;
    try {
      const user = await this.userRepo.findOne({ where: { id: actor.userId } });
      if (user) operatorUsername = (user.displayName && user.displayName.trim()) || user.username || actor.username;
    } catch {
      operatorUsername = actor.username;
    }
    const trimmed = (content ?? '').trim();
    if (!trimmed) throw new Error('备注内容不能为空');
    const remark = this.orderRemarkRepo.create({ orderId: order.id, order, operatorUsername, content: trimmed });
    return this.orderRemarkRepo.save(remark);
  }

  private isSameMaterialCostRow(a: any, b: any): boolean {
    const key = (r: any) =>
      [String(r?.materialTypeId ?? ''), String(r?.supplierName ?? ''), String(r?.materialName ?? ''), String(r?.color ?? ''), String(r?.fabricWidth ?? '')].join('|');
    return key(a) === key(b);
  }
  private isSameProcessItemCostRow(a: any, b: any): boolean {
    const key = (r: any) => [String(r?.processName ?? ''), String(r?.supplierName ?? ''), String(r?.part ?? '')].join('|');
    return key(a) === key(b);
  }
  private findBestMaterialCostRow(existingRows: any[], row: any, index: number): any | null {
    if (!existingRows.length) return null;
    return (
      existingRows.find((r) => this.isSameMaterialCostRow(r, row)) ??
      existingRows.find(
        (r) =>
          String(r?.materialTypeId ?? '') === String(row?.materialTypeId ?? '') &&
          String(r?.materialName ?? '') === String(row?.materialName ?? ''),
      ) ??
      existingRows[index] ??
      null
    );
  }
  private findBestProcessItemCostRow(existingRows: any[], row: any, index: number): any | null {
    if (!existingRows.length) return null;
    return (
      existingRows.find((r) => this.isSameProcessItemCostRow(r, row)) ??
      existingRows.find((r) => String(r?.processName ?? '') === String(row?.processName ?? '')) ??
      existingRows[index] ??
      null
    );
  }
  private normalizeProductionCostMultiplier(v: unknown): number {
    const n = typeof v === 'number' ? v : Number(v);
    if (!Number.isFinite(n) || n < 0) return 2;
    return n;
  }
  private calculateExFactoryPriceFromSnapshot(snapshot: Record<string, unknown> | null | undefined): number {
    if (!snapshot || typeof snapshot !== 'object') return 0;
    const materialRows = Array.isArray(snapshot.materialRows) ? (snapshot.materialRows as any[]) : [];
    const processItemRows = Array.isArray(snapshot.processItemRows) ? (snapshot.processItemRows as any[]) : [];
    const productionRows = Array.isArray(snapshot.productionRows) ? (snapshot.productionRows as any[]) : [];
    const materialTotal = materialRows.reduce((sum, row) => {
      const includeInCost = row?.includeInCost !== false;
      if (!includeInCost) return sum;
      const usage = Number(row?.usagePerPiece) || 0;
      const lossPercent = Number(row?.lossPercent) || 0;
      const unitPrice = Number(row?.unitPrice) || 0;
      return sum + usage * (1 + lossPercent / 100) * unitPrice;
    }, 0);
    const processItemTotal = processItemRows.reduce((sum, row) => sum + (Number(row?.quantity) || 0) * (Number(row?.unitPrice) || 0), 0);
    const productionBaseTotal = productionRows.reduce((sum, row) => sum + (Number(row?.unitPrice) || 0), 0);
    const productionTotal = productionBaseTotal * this.normalizeProductionCostMultiplier(snapshot.productionCostMultiplier);
    const totalCost = materialTotal + processItemTotal + productionTotal;
    const margin = this.normalizeProfitMargin(snapshot.profitMargin);
    const exFactory = margin >= 1 ? totalCost : totalCost / (1 - margin);
    return Number.isFinite(exFactory) ? Number(exFactory.toFixed(2)) : 0;
  }

  private withDraftMetadata(snapshot: Record<string, unknown>, actor: OrderActor): Record<string, unknown> {
    return { ...snapshot, quoteNeedsReconfirm: true, quoteDraftUpdatedAt: new Date().toISOString(), quoteDraftUpdatedBy: actor.username };
  }
  private withConfirmedMetadata(snapshot: Record<string, unknown>, actor: OrderActor, exFactoryPrice: string): Record<string, unknown> {
    return {
      ...snapshot,
      quoteNeedsReconfirm: false,
      quoteConfirmedAt: new Date().toISOString(),
      quoteConfirmedBy: actor.username,
      quoteConfirmedExFactoryPrice: exFactoryPrice,
      quoteDraftUpdatedAt: new Date().toISOString(),
      quoteDraftUpdatedBy: actor.username,
    };
  }

  async syncCostSnapshotFromOrder(orderId: number, options?: { keepExistingPricing?: boolean }): Promise<void> {
    const keepPricing = options?.keepExistingPricing !== false;
    const [order, ext] = await Promise.all([
      this.orderRepo.findOne({ where: { id: orderId } }),
      this.orderExtRepo.findOne({ where: { orderId } }),
    ]);
    if (!order) return;
    const sourceMaterials = Array.isArray((ext as any)?.materials) ? ((ext as any).materials as any[]) : [];
    const sourceProcessItems = Array.isArray((ext as any)?.processItems) ? ((ext as any).processItems as any[]) : [];
    const nextMaterialRows = sourceMaterials.map((m) => ({
      materialTypeId: m?.materialTypeId ?? null,
      supplierName: m?.supplierName ?? '',
      materialName: m?.materialName ?? '',
      color: m?.color ?? '',
      fabricWidth: m?.fabricWidth ?? '',
      usagePerPiece: m?.usagePerPiece ?? null,
      lossPercent: m?.lossPercent ?? null,
      orderPieces: m?.orderPieces ?? null,
      purchaseQuantity: m?.purchaseQuantity ?? null,
      cuttingQuantity: m?.cuttingQuantity ?? null,
      remark: m?.remark ?? '',
      unitPrice: 0,
    }));
    const defaultProcessItemQty = 1;
    const nextProcessItemRows = sourceProcessItems.map((p) => ({
      processName: p?.processName ?? '',
      supplierName: p?.supplierName ?? '',
      part: p?.part ?? '',
      remark: p?.remark ?? '',
      unitPrice: 0,
      quantity: defaultProcessItemQty,
    }));
    const existing = await this.orderCostSnapshotRepo.findOne({ where: { orderId } });
    const existingSnapshot = existing?.snapshot && typeof existing.snapshot === 'object' ? (existing.snapshot as any) : null;
    const existingMaterialRows = Array.isArray(existingSnapshot?.materialRows) ? (existingSnapshot.materialRows as any[]) : [];
    const mergedMaterialRows = keepPricing
      ? nextMaterialRows.map((row, index) => {
          const found = this.findBestMaterialCostRow(existingMaterialRows, row, index);
          return found ? { ...row, unitPrice: Number(found.unitPrice) || 0 } : row;
        })
      : nextMaterialRows;
    const existingProcessItemRows = Array.isArray(existingSnapshot?.processItemRows) ? (existingSnapshot.processItemRows as any[]) : [];
    const mergedProcessItemRows = keepPricing
      ? nextProcessItemRows.map((row, index) => {
          const found = this.findBestProcessItemCostRow(existingProcessItemRows, row, index);
          return found
            ? {
                ...row,
                unitPrice: Number(found.unitPrice) || 0,
                quantity: typeof found.quantity === 'number' && Number.isFinite(found.quantity) ? found.quantity : row.quantity,
              }
            : row;
        })
      : nextProcessItemRows;
    const nextSnapshot: Record<string, unknown> = {
      materialRows: mergedMaterialRows.length ? mergedMaterialRows : [{ unitPrice: 0 } as any],
      processItemRows: mergedProcessItemRows.length ? mergedProcessItemRows : [{ unitPrice: 0, quantity: defaultProcessItemQty } as any],
      productionRows: Array.isArray(existingSnapshot?.productionRows) ? existingSnapshot.productionRows : [],
      productionCostMultiplier: this.normalizeProductionCostMultiplier(existingSnapshot?.productionCostMultiplier),
      profitMargin: this.normalizeProfitMargin(existingSnapshot?.profitMargin),
    };
    if (existing) {
      existing.snapshot = nextSnapshot;
      await this.orderCostSnapshotRepo.save(existing);
    } else {
      await this.orderCostSnapshotRepo.save(this.orderCostSnapshotRepo.create({ orderId, snapshot: nextSnapshot }));
    }
  }

  async saveCostSnapshot(orderId: number, payload: { snapshot: Record<string, unknown> }, actor?: OrderActor): Promise<OrderCostSnapshot> {
    const order = await this.orderQueryService.findOne(orderId);
    const snapshot = this.withDraftMetadata(payload.snapshot ?? {}, actor ?? { userId: 0, username: '系统' });
    let row = await this.orderCostSnapshotRepo.findOne({ where: { orderId } });
    if (row) row.snapshot = snapshot;
    else row = this.orderCostSnapshotRepo.create({ orderId, snapshot });
    const saved = await this.orderCostSnapshotRepo.save(row);
    if (actor) await this.orderStatusService.addLog(order, actor, 'cost_draft', '保存成本草稿（未同步订单卡片出厂价）');
    return saved;
  }

  async confirmCostQuote(orderId: number, payload: { snapshot: Record<string, unknown> }, actor: OrderActor): Promise<OrderCostSnapshot> {
    const order = await this.orderQueryService.findOne(orderId);
    const oldExFactory = this.normalizeDecimalInput(order.exFactoryPrice);
    const computed = this.calculateExFactoryPriceFromSnapshot(payload.snapshot ?? {});
    const nextExFactory = this.normalizeDecimalInput(computed.toFixed(2));
    const snapshot = this.withConfirmedMetadata(payload.snapshot ?? {}, actor, nextExFactory);
    let row = await this.orderCostSnapshotRepo.findOne({ where: { orderId } });
    if (row) row.snapshot = snapshot;
    else row = this.orderCostSnapshotRepo.create({ orderId, snapshot });
    const saved = await this.orderCostSnapshotRepo.save(row);
    order.exFactoryPrice = nextExFactory;
    await this.orderRepo.save(order);
    await this.orderStatusService.addLog(order, actor, 'cost_confirm', `确认报价并同步出厂价: ${oldExFactory} -> ${nextExFactory}`);
    return saved;
  }
}
