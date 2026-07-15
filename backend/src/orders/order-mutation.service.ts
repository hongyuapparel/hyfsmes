import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';
import { OrderRemark } from '../entities/order-remark.entity';
import { OrderCostSnapshot } from '../entities/order-cost-snapshot.entity';
import { User } from '../entities/user.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { OrderQueryService } from './order-query.service';
import { OrderStatusService } from './order-status.service';
import { OrderLifecycleService } from './order-lifecycle.service';
import { OrderCostSnapshotService } from './order-cost-snapshot.service';
import { type OrderActor, type OrderEditPayload, type ReviewResult } from './order.types';
import { resolveOperatorDisplayName } from '../common/operator.util';

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
    private readonly orderWorkflowService: OrderWorkflowService,
    private readonly suppliersService: SuppliersService,
    private readonly orderQueryService: OrderQueryService,
    private readonly orderStatusService: OrderStatusService,
    private readonly orderLifecycleService: OrderLifecycleService,
    private readonly orderCostSnapshotService: OrderCostSnapshotService,
  ) {}

  private normalizeMaterialRows(rows: OrderMaterialRow[]): OrderMaterialRow[] {
    return rows.map((row) => {
      const { materialType: _dropType, materialSource: _dropSource, ...rest } = row;
      return rest as OrderMaterialRow;
    });
  }

  private materialTextKeyPart(v: unknown): string {
    return String(v ?? '').trim();
  }

  private materialNumberKeyPart(v: unknown): string {
    if (v === null || v === undefined || v === '') return '';
    const n = Number(v);
    return Number.isFinite(n) ? String(Number(n.toFixed(6))) : String(v).trim();
  }

  /** 匹配采购/领料操作字段时只用物料身份键，用量变更不应丢失已完成状态。 */
  private materialOperationMatchKey(row: OrderMaterialRow): string {
    return [
      this.materialNumberKeyPart(row.materialSourceId),
      this.materialNumberKeyPart(row.materialTypeId),
      this.materialTextKeyPart(row.supplierName),
      this.materialTextKeyPart(row.materialName),
      this.materialTextKeyPart(row.color),
      this.materialTextKeyPart(row.fabricWidth),
    ].join('|');
  }

  private withPreservedMaterialOperationFields(row: OrderMaterialRow, source: OrderMaterialRow): OrderMaterialRow {
    return {
      ...row,
      purchaseStatus: row.purchaseStatus ?? source.purchaseStatus,
      actualPurchaseQuantity: row.actualPurchaseQuantity ?? source.actualPurchaseQuantity,
      purchaseAmount: row.purchaseAmount ?? source.purchaseAmount,
      purchaseCompletedAt: row.purchaseCompletedAt ?? source.purchaseCompletedAt,
      purchaseUnitPrice: row.purchaseUnitPrice ?? source.purchaseUnitPrice,
      purchaseOtherCost: row.purchaseOtherCost ?? source.purchaseOtherCost,
      purchaseRemark: row.purchaseRemark ?? source.purchaseRemark,
      purchaseImageUrl: row.purchaseImageUrl ?? source.purchaseImageUrl,
      pickStatus: row.pickStatus ?? source.pickStatus,
      pickCompletedAt: row.pickCompletedAt ?? source.pickCompletedAt,
      pickRemark: row.pickRemark ?? source.pickRemark,
      pickLogs: row.pickLogs ?? source.pickLogs?.map((log) => ({ ...log })),
    };
  }

  private preserveMaterialOperationFields(
    rows: OrderMaterialRow[],
    existingRows: OrderMaterialRow[] | null | undefined,
  ): OrderMaterialRow[] {
    const existing = Array.isArray(existingRows) ? existingRows : [];
    if (!rows.length || !existing.length) return rows;
    const existingByKey = new Map<string, OrderMaterialRow[]>();
    for (const row of existing) {
      const key = this.materialOperationMatchKey(row);
      const bucket = existingByKey.get(key) ?? [];
      bucket.push(row);
      existingByKey.set(key, bucket);
    }
    return rows.map((row) => {
      const key = this.materialOperationMatchKey(row);
      const bucket = existingByKey.get(key);
      const matched = bucket?.shift();
      return matched ? this.withPreservedMaterialOperationFields(row, matched) : row;
    });
  }

  private resetMaterialOperationFieldsForNewDraft(
    rows: OrderMaterialRow[] | null | undefined,
  ): OrderMaterialRow[] | null {
    if (!Array.isArray(rows)) return null;
    return this.normalizeMaterialRows(rows).map((row) => {
      const {
        purchaseStatus: _dropPurchaseStatus,
        actualPurchaseQuantity: _dropActualPurchaseQuantity,
        purchaseAmount: _dropPurchaseAmount,
        purchaseCompletedAt: _dropPurchaseCompletedAt,
        purchaseUnitPrice: _dropPurchaseUnitPrice,
        purchaseOtherCost: _dropPurchaseOtherCost,
        purchaseRemark: _dropPurchaseRemark,
        purchaseImageUrl: _dropPurchaseImageUrl,
        pickStatus: _dropPickStatus,
        pickCompletedAt: _dropPickCompletedAt,
        pickRemark: _dropPickRemark,
        pickLogs: _dropPickLogs,
        ...rest
      } = row;
      return rest as OrderMaterialRow;
    });
  }

  private shouldPreserveMaterialOperationFields(status: string | null | undefined): boolean {
    const code = (status ?? '').trim();
    return !!code && !['draft', 'pending_review'].includes(code);
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

  private isDuplicateOrderNoError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const anyErr = err as {
      code?: unknown;
      errno?: unknown;
      message?: unknown;
      sqlMessage?: unknown;
      driverError?: { code?: unknown; errno?: unknown; message?: unknown; sqlMessage?: unknown };
    };
    const parts = [
      anyErr.code,
      anyErr.errno,
      anyErr.message,
      anyErr.sqlMessage,
      anyErr.driverError?.code,
      anyErr.driverError?.errno,
      anyErr.driverError?.message,
      anyErr.driverError?.sqlMessage,
    ]
      .filter((v) => typeof v === 'string' || typeof v === 'number')
      .map((v) => String(v));
    const haystack = parts.join(' | ').toLowerCase();
    return haystack.includes('duplicate entry') && haystack.includes('orders');
  }

  private async saveOrderWithRetry(order: Order, regenerateOrderNo: () => Promise<string>): Promise<Order> {
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await this.orderRepo.save(order);
      } catch (err) {
        if (!this.isDuplicateOrderNoError(err) || attempt === maxAttempts - 1) throw err;
        order.orderNo = await regenerateOrderNo();
      }
    }
    return this.orderRepo.save(order);
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
    const rows = await this.orderRepo
      .createQueryBuilder('o')
      .select('o.order_no', 'orderNo')
      .where('o.order_no LIKE :prefix', { prefix: `${prefix}%` })
      .getRawMany<{ orderNo: string | null }>();
    let maxSeq = 0;
    for (const row of rows) {
      const orderNo = String(row.orderNo ?? '').trim();
      if (!orderNo.startsWith(prefix)) continue;
      const suffix = orderNo.slice(prefix.length);
      if (!/^\d+$/.test(suffix)) continue;
      const seq = Number(suffix);
      if (Number.isFinite(seq) && seq > maxSeq) maxSeq = seq;
    }
    const nextSeq = maxSeq + 1;
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
    const saved = await this.saveOrderWithRetry(entity, () => this.generateNextOrderNo());
    const extPayload: Partial<OrderExt> = { orderId: saved.id };
    if (payload.materials && Array.isArray(payload.materials)) {
      extPayload.materials = this.resetMaterialOperationFieldsForNewDraft(payload.materials);
    }
    if (payload.colorSizeHeaders && Array.isArray(payload.colorSizeHeaders)) extPayload.colorSizeHeaders = payload.colorSizeHeaders;
    if (payload.colorSizeRows && Array.isArray(payload.colorSizeRows)) extPayload.colorSizeRows = payload.colorSizeRows;
    if (payload.sizeInfoMetaHeaders && Array.isArray(payload.sizeInfoMetaHeaders)) extPayload.sizeInfoMetaHeaders = payload.sizeInfoMetaHeaders;
    if (payload.sizeInfoRows && Array.isArray(payload.sizeInfoRows)) extPayload.sizeInfoRows = payload.sizeInfoRows;
    if (payload.processItems && Array.isArray(payload.processItems)) extPayload.processItems = payload.processItems;
    if (typeof payload.revisionNotes === 'string') extPayload.revisionNotes = payload.revisionNotes;
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
    const isAdmin = await this.orderStatusService.isAdminUser(actor.userId);
    const shouldRebaseWorkflow =
      !isAdmin &&
      (await this.orderStatusService.canRebaseWorkflowStatus(order.status)) &&
      this.orderStatusService.hasWorkflowRelevantChanges(before, payload);

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
      payload.revisionNotes !== undefined ||
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
          materials: payload.materials && Array.isArray(payload.materials)
            ? this.shouldPreserveMaterialOperationFields(order.status)
              ? this.normalizeMaterialRows(payload.materials)
              : this.resetMaterialOperationFieldsForNewDraft(payload.materials)
            : null,
          colorSizeHeaders: payload.colorSizeHeaders ?? null,
          colorSizeRows: payload.colorSizeRows ?? null,
          sizeInfoMetaHeaders: payload.sizeInfoMetaHeaders ?? null,
          sizeInfoRows: payload.sizeInfoRows ?? null,
          processItems: payload.processItems ?? null,
          revisionNotes: payload.revisionNotes ?? null,
          productionRequirement: payload.productionRequirement ?? null,
          packagingHeaders: payload.packagingHeaders ?? null,
          packagingCells: payload.packagingCells ?? null,
          packagingMethod: payload.packagingMethod ?? null,
          attachments: payload.attachments ?? null,
        });
      } else {
        if (payload.materials !== undefined) {
          ext.materials = Array.isArray(payload.materials)
            ? this.shouldPreserveMaterialOperationFields(order.status)
              ? this.preserveMaterialOperationFields(this.normalizeMaterialRows(payload.materials), ext.materials)
              : this.resetMaterialOperationFieldsForNewDraft(payload.materials)
            : payload.materials;
        }
        if (payload.colorSizeHeaders !== undefined) ext.colorSizeHeaders = payload.colorSizeHeaders;
        if (payload.colorSizeRows !== undefined) ext.colorSizeRows = payload.colorSizeRows;
        if (payload.sizeInfoMetaHeaders !== undefined) ext.sizeInfoMetaHeaders = payload.sizeInfoMetaHeaders;
        if (payload.sizeInfoRows !== undefined) ext.sizeInfoRows = payload.sizeInfoRows;
        if (payload.processItems !== undefined) ext.processItems = payload.processItems;
        if (payload.revisionNotes !== undefined) ext.revisionNotes = payload.revisionNotes ?? null;
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
    return saved;
  }

  async submit(id: number, actor: OrderActor): Promise<Order> {
    const order = await this.orderQueryService.findOne(id);
    const beforeStatus = order.status;
    const needsOrderNo = !order.orderNo;
    if (needsOrderNo) {
      order.orderNo = await this.generateNextOrderNo();
    }
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
    const saved = needsOrderNo ? await this.saveOrderWithRetry(order, () => this.generateNextOrderNo()) : await this.orderRepo.save(order);
    if ((beforeStatus || '') !== (saved.status || '')) {
      await this.orderStatusService.addLog(saved, actor, 'submit', `状态: ${beforeStatus || '-'} -> ${saved.status}`);
      await this.orderStatusService.appendStatusHistory(saved.id, saved.status);
    }
    await this.touchSuppliersActiveByOrderId(saved.id);
    return saved;
  }

  async deleteMany(ids: number[], actor: OrderActor, deleteReason?: string): Promise<void> {
    return this.orderLifecycleService.deleteMany(ids, actor, deleteReason);
  }

  async reviewMany(ids: number[], actor: OrderActor): Promise<ReviewResult> {
    return this.orderLifecycleService.reviewMany(ids, actor);
  }

  async reviewRejectMany(ids: number[], reason: string, actor: OrderActor): Promise<void> {
    return this.orderLifecycleService.reviewRejectMany(ids, reason, actor);
  }

  async restoreMany(ids: number[], actor: OrderActor): Promise<void> {
    return this.orderLifecycleService.restoreMany(ids, actor);
  }

  async copyManyToDraft(ids: number[], actor: OrderActor): Promise<Order[]> {
    if (!ids?.length) return [];
    const now = new Date();
    const sourceOrders = await this.orderRepo.find({ where: { id: In(ids) } });
    const sourceIds = sourceOrders.map((o) => o.id);
    const extList = await this.orderExtRepo.find({ where: { orderId: In(sourceIds) } });
    const extMap = new Map(extList.map((e) => [e.orderId, e]));
    const costList = await this.orderCostSnapshotRepo.find({ where: { orderId: In(sourceIds) } });
    const costMap = new Map(costList.map((c) => [c.orderId, c]));
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
        exFactoryPrice: this.normalizeDecimalInput(0),
        salePrice: this.normalizeDecimalInput(src.salePrice),
        orderTypeId: src.orderTypeId ?? null,
        processItem: src.processItem?.trim() || '',
        orderDate: now,
        customerDueDate: src.customerDueDate ?? null,
        factoryName: '',
        imageUrl: src.imageUrl?.trim() || '',
        status: 'draft',
        statusTime: now,
      });
      const saved = await this.saveOrderWithRetry(draft, () => this.generateNextOrderNo());
      await this.orderStatusService.appendStatusHistory(saved.id, 'draft');
      const srcExt = extMap.get(src.id) ?? null;
      if (srcExt) {
        const newExt = this.orderExtRepo.create({
          orderId: saved.id,
          materials: this.resetMaterialOperationFieldsForNewDraft(srcExt.materials),
          colorSizeHeaders: srcExt.colorSizeHeaders ?? null,
          colorSizeRows: srcExt.colorSizeRows ?? null,
          sizeInfoMetaHeaders: srcExt.sizeInfoMetaHeaders ?? null,
          sizeInfoRows: srcExt.sizeInfoRows ?? null,
          processItems: srcExt.processItems ?? null,
          revisionNotes: srcExt.revisionNotes ?? null,
          productionRequirement: srcExt.productionRequirement ?? null,
          packagingHeaders: srcExt.packagingHeaders ?? null,
          packagingCells: srcExt.packagingCells ?? null,
          packagingMethod: srcExt.packagingMethod ?? null,
          attachments: srcExt.attachments ?? null,
        });
        await this.orderExtRepo.save(newExt);
      }
      const srcCost = costMap.get(src.id) ?? null;
      if (srcCost?.snapshot != null && typeof srcCost.snapshot === 'object') {
        const srcSnapshot = this.orderCostSnapshotService.stripQuoteMetadataFromSnapshot({ ...(srcCost.snapshot as Record<string, unknown>) });
        if (Object.prototype.hasOwnProperty.call(srcSnapshot, 'profitMargin')) {
          srcSnapshot.profitMargin = this.orderCostSnapshotService.normalizeProfitMargin(srcSnapshot.profitMargin);
        }
        await this.orderCostSnapshotRepo.save(
          this.orderCostSnapshotRepo.create({ orderId: saved.id, snapshot: srcSnapshot }),
        );
      } else {
        await this.orderCostSnapshotService.syncCostSnapshotFromOrder(saved.id);
      }
      created.push(saved);
      await this.orderStatusService.addLog(saved, actor, 'copy_to_draft', `从订单 ${src.orderNo} 复制为草稿`);
    }
    return created;
  }

  async addRemark(orderId: number, actor: OrderActor, content: string) {
    const order = await this.orderQueryService.findOne(orderId);
    const operatorUsername = await resolveOperatorDisplayName(this.userRepo, actor);
    const trimmed = (content ?? '').trim();
    if (!trimmed) throw new Error('备注内容不能为空');
    const remark = this.orderRemarkRepo.create({ orderId: order.id, order, operatorUsername, content: trimmed });
    return this.orderRemarkRepo.save(remark);
  }

}
