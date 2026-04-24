import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../entities/order.entity';
import { OrderExt, type OrderMaterialRow } from '../entities/order-ext.entity';
import { OrderWorkflowService } from '../order-workflow/order-workflow.service';
import { OrderStatus } from '../entities/order-status.entity';
import { OrderStatusHistory } from '../entities/order-status-history.entity';
import { SuppliersService } from '../suppliers/suppliers.service';
import { SystemOptionsService } from '../system-options/system-options.service';
import { FabricStockService } from '../fabric-stock/fabric-stock.service';
import { InventoryAccessoriesService } from '../inventory-accessories/inventory-accessories.service';
import { FinishedGoodsStockService } from '../finished-goods-stock/finished-goods-stock.service';
import { User } from '../entities/user.entity';
@Injectable()
export class ProductionPurchaseService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(OrderExt)
    private readonly orderExtRepo: Repository<OrderExt>,
    @InjectRepository(OrderStatus)
    private readonly orderStatusRepo: Repository<OrderStatus>,
    @InjectRepository(OrderStatusHistory)
    private readonly orderStatusHistoryRepo: Repository<OrderStatusHistory>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly orderWorkflowService: OrderWorkflowService,
    private readonly suppliersService: SuppliersService,
    private readonly systemOptionsService: SystemOptionsService,
    private readonly fabricStockService: FabricStockService,
    private readonly inventoryAccessoriesService: InventoryAccessoriesService,
    private readonly finishedGoodsStockService: FinishedGoodsStockService,
  ) {}

  private async appendStatusHistory(orderId: number, statusCode: string): Promise<void> {
    const code = (statusCode ?? '').trim();
    if (!code) return;
    const status = await this.orderStatusRepo.findOne({ where: { code } });
    if (!status) return;
    await this.orderStatusHistoryRepo.save(
      this.orderStatusHistoryRepo.create({ orderId, statusId: status.id }),
    );
  }
  private materialSourceOptionsLoadedAt = 0;
  private materialSourceLabelById = new Map<number, string>();
  private toDateTimeLocalString(v: Date | string | null | undefined): string | null {
    if (v == null) return null;
    if (typeof v === 'string') return v.slice(0, 19).replace('T', ' ') || null;
    if (!(v instanceof Date) || Number.isNaN(v.getTime())) return null;
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, '0');
    const d = String(v.getDate()).padStart(2, '0');
    const hh = String(v.getHours()).padStart(2, '0');
    const mm = String(v.getMinutes()).padStart(2, '0');
    const ss = String(v.getSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
  }
  private normalizeDecimalInput(v: unknown): string {
    if (v === null || v === undefined) return '0';
    if (typeof v === 'number') {
      return Number.isFinite(v) ? String(v) : '0';
    }
    if (typeof v === 'string') {
      const t = v.trim();
      return t || '0';
    }
    return '0';
  }

  private async ensureMaterialSourceOptionCache(): Promise<void> {
    const now = Date.now();
    if (now - this.materialSourceOptionsLoadedAt < 60_000 && this.materialSourceLabelById.size > 0) return;
    const list = await this.systemOptionsService.findAllByType('material_sources');
    this.materialSourceLabelById = new Map(list.map((item) => [item.id, item.value]));
    this.materialSourceOptionsLoadedAt = now;
  }

  private getMaterialSourceLabelById(id: number | null | undefined): string {
    if (id == null) return '';
    return this.materialSourceLabelById.get(Number(id)) ?? '';
  }

  private resolveMaterialRouteBySourceLabel(sourceLabel: string): 'purchase' | 'picking' {
    const label = sourceLabel.trim();
    if (label === '公司库存' || label === '客供面料') return 'picking';
    // 兼容历史数据：未配置来源时仍走原等待采购流程，避免破坏既有逻辑。
    return 'purchase';
  }

  private isMaterialFlowCompleted(material: OrderMaterialRow): boolean {
    const sourceLabel = this.getMaterialSourceLabelById(material.materialSourceId ?? null);
    const route = this.resolveMaterialRouteBySourceLabel(sourceLabel);
    if (route === 'purchase') {
      return (material.purchaseStatus ?? 'pending').toLowerCase() === 'completed';
    }
    return (material.pickStatus ?? 'pending').toLowerCase() === 'completed';
  }

  private async resolveOperatorName(userId: number | undefined, fallback = ''): Promise<string> {
    const fb = (fallback ?? '').trim();
    if (!userId) return fb;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return (user?.displayName ?? '').trim() || (user?.username ?? '').trim() || fb;
  }

  async registerPurchase(
    orderId: number,
    materialIndex: number,
    actualPurchaseQuantity: number,
    unitPrice: string,
    otherCost: string,
    remark: string | null | undefined,
    imageUrl: string | null | undefined,
    actorUserId?: number,
  ): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('订单不存在');
    }
    let ext = await this.orderExtRepo.findOne({ where: { orderId } });
    if (!ext || !Array.isArray(ext.materials)) {
      throw new NotFoundException('该订单无物料数据');
    }
    if (materialIndex < 0 || materialIndex >= ext.materials.length) {
      throw new NotFoundException('物料索引无效');
    }

    const materials = [...ext.materials];
    const row = materials[materialIndex] as OrderMaterialRow;
    await this.ensureMaterialSourceOptionCache();
    const sourceLabel = this.getMaterialSourceLabelById(row.materialSourceId ?? null);
    if (this.resolveMaterialRouteBySourceLabel(sourceLabel) !== 'purchase') {
      throw new NotFoundException('该物料来源不在等待采购流程，请使用领料处理');
    }

    const normalizedQty = Number.isFinite(actualPurchaseQuantity) ? actualPurchaseQuantity : 0;
    const normalizedUnit = Number(this.normalizeDecimalInput(unitPrice)) || 0;
    const normalizedOther = Number(this.normalizeDecimalInput(otherCost)) || 0;
    const total = normalizedQty * normalizedUnit + normalizedOther;
    const totalStr = Number.isFinite(total) ? total.toFixed(2) : '0';

    materials[materialIndex] = {
      ...row,
      purchaseStatus: 'completed',
      actualPurchaseQuantity: normalizedQty,
      purchaseUnitPrice: this.normalizeDecimalInput(unitPrice),
      purchaseOtherCost: this.normalizeDecimalInput(otherCost),
      purchaseAmount: totalStr,
      purchaseCompletedAt: this.toDateTimeLocalString(new Date()),
      purchaseRemark: (remark ?? '').trim() || null,
      purchaseImageUrl: (imageUrl ?? '').trim() || null,
    };
    ext.materials = materials;
    await this.orderExtRepo.save(ext);
    await this.suppliersService.touchLastActiveByNames([row?.supplierName ?? '']);

    // 若该订单全部物料采购完成，则按配置规则流转
    if (order.status === 'pending_purchase') {
      const allCompleted = materials.length > 0 && materials.every((m) => this.isMaterialFlowCompleted(m));
      if (allCompleted) {
        let next: string | null = await this.orderWorkflowService.resolveNextStatus({
          order,
          triggerCode: 'purchase_all_completed',
          actorUserId: actorUserId ?? 0,
        });
        if (next && next !== order.status) {
          order.status = next;
          order.statusTime = new Date();
          await this.orderRepo.save(order);
          await this.appendStatusHistory(order.id, next);
        }
      }
    }
  }

  async registerPicking(params: {
    orderId: number;
    materialIndex: number;
    inventorySourceType?: 'fabric' | 'accessory' | 'finished' | null;
    inventoryId?: number | null;
    quantity?: number | null;
    stockBatch?: string | null;
    stockColorCode?: string | null;
    stockSpec?: string | null;
    remark?: string | null;
    actorUserId?: number;
    actorUsername?: string;
  }): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id: params.orderId } });
    if (!order) throw new NotFoundException('订单不存在');
    const ext = await this.orderExtRepo.findOne({ where: { orderId: params.orderId } });
    if (!ext || !Array.isArray(ext.materials)) throw new NotFoundException('该订单无物料数据');
    if (params.materialIndex < 0 || params.materialIndex >= ext.materials.length) throw new NotFoundException('物料索引无效');
    await this.ensureMaterialSourceOptionCache();

    const materials = [...ext.materials];
    const row = { ...(materials[params.materialIndex] as OrderMaterialRow) };
    const sourceLabel = this.getMaterialSourceLabelById(row.materialSourceId ?? null);
    if (this.resolveMaterialRouteBySourceLabel(sourceLabel) !== 'picking') {
      throw new NotFoundException('该物料来源不在待领料流程，请使用采购登记');
    }

    const operatorName = await this.resolveOperatorName(params.actorUserId, params.actorUsername ?? '');
    const remark = (params.remark ?? '').trim();
    const inventorySourceType = params.inventorySourceType ?? null;
    const inventoryId = params.inventoryId != null ? Number(params.inventoryId) : null;
    const quantity = params.quantity != null ? Number(params.quantity) : null;
    const shouldUseStock = !!(inventorySourceType && inventoryId && quantity && quantity > 0);
    let inventoryName: string | null = null;

    if (!shouldUseStock && !remark) {
      throw new NotFoundException('请选择库存并填写调取数量，或至少填写备注说明');
    }

    if (shouldUseStock) {
      if (inventorySourceType === 'fabric') {
        const stock = await this.fabricStockService.getOne(inventoryId!);
        inventoryName = stock.name ?? '';
        await this.fabricStockService.outbound(
          inventoryId!,
          quantity!,
          '',
          `领料出库 订单:${order.orderNo} SKU:${order.skuCode ?? ''} 物料:${row.materialName ?? ''} 来源:${sourceLabel} 批次:${params.stockBatch ?? ''} 色号:${params.stockColorCode ?? ''} 规格:${params.stockSpec ?? ''} 备注:${remark}`,
          operatorName,
          params.actorUserId != null && Number.isFinite(Number(params.actorUserId))
            ? Number(params.actorUserId)
            : null,
        );
      } else if (inventorySourceType === 'accessory') {
        const stock = await this.inventoryAccessoriesService.getOne(inventoryId!);
        inventoryName = stock.name ?? '';
        await this.inventoryAccessoriesService.outbound({
          accessoryId: inventoryId!,
          quantity: quantity!,
          outboundType: 'manual',
          operatorUsername: operatorName,
          remark: `领料出库 订单:${order.orderNo} SKU:${order.skuCode ?? ''} 物料:${row.materialName ?? ''} 来源:${sourceLabel} 批次:${params.stockBatch ?? ''} 色号:${params.stockColorCode ?? ''} 规格:${params.stockSpec ?? ''} ${remark}`,
          orderId: order.id,
          orderNo: order.orderNo,
        });
      } else if (inventorySourceType === 'finished') {
        const detail = await this.finishedGoodsStockService.getDetail(inventoryId!);
        inventoryName = detail.stock.skuCode ?? '';
        await this.finishedGoodsStockService.outbound(
          [{ id: inventoryId!, quantity: quantity!, sizeBreakdown: null }],
          operatorName,
          `领料出库 订单:${order.orderNo} SKU:${order.skuCode ?? ''} 物料:${row.materialName ?? ''} 来源:${sourceLabel} 批次:${params.stockBatch ?? ''} 色号:${params.stockColorCode ?? ''} 规格:${params.stockSpec ?? ''} ${remark}`,
          null,
        );
      } else {
        throw new NotFoundException('不支持的库存来源类型');
      }
    }

    const now = this.toDateTimeLocalString(new Date()) ?? '';
    const nextLogs = Array.isArray(row.pickLogs) ? [...row.pickLogs] : [];
    nextLogs.push({
      handledAt: now,
      handledBy: operatorName,
      mode: shouldUseStock ? 'with_stock' : 'remark_only',
      inventorySourceType,
      inventoryId,
      inventoryName,
      stockBatch: (params.stockBatch ?? '').trim() || null,
      stockColorCode: (params.stockColorCode ?? '').trim() || null,
      stockSpec: (params.stockSpec ?? '').trim() || null,
      quantity: shouldUseStock ? quantity : null,
      remark: remark || null,
    });

    materials[params.materialIndex] = {
      ...row,
      pickStatus: 'completed',
      pickCompletedAt: now,
      pickRemark: remark || null,
      pickLogs: nextLogs,
    };
    ext.materials = materials;
    await this.orderExtRepo.save(ext);

    if (order.status === 'pending_purchase') {
      const allCompleted = materials.length > 0 && materials.every((m) => this.isMaterialFlowCompleted(m));
      if (allCompleted) {
        const next = await this.orderWorkflowService.resolveNextStatus({
          order,
          triggerCode: 'purchase_all_completed',
          actorUserId: params.actorUserId ?? 0,
        });
        if (next && next !== order.status) {
          order.status = next;
          order.statusTime = new Date();
          await this.orderRepo.save(order);
          await this.appendStatusHistory(order.id, next);
        }
      }
    }
  }
}
