import type { FinishedGoodsOutboundRecord, ColorSizeSnapshot } from '../finished-goods-stock/finished-goods-stock.types';
import type { PendingListItem } from '../inventory-pending/inventory-pending-query.helpers';
import type { getAccessoryOutboundRecords } from '../inventory-accessories/inventory-accessories-outbound-query';
import type { FabricOutboundListRow } from '../fabric-stock/fabric-stock-outbound-query.service';
import type { OutboundExportColumn, OutboundExportLine } from './outbound-export-workbook';

export type OutboundExportKind = 'finished' | 'pending' | 'accessories' | 'fabric';
const column = (key: string, header: string, width = 18, money = false): OutboundExportColumn => ({ key, header, width, money });
const time = column('createdAt', '时间', 22);
const image = column('image', '图片/照片', 16);
const quantity = column('quantity', '出库数量', 12);
const detail = column('detail', '实际颜色/尺码明细', 42);
const tail = [column('pickupUserName', '领取人/收货人'), column('operatorUsername', '操作人'), column('remark', '备注', 36)];
export const outboundColumns: Record<OutboundExportKind, OutboundExportColumn[]> = {
  finished: [time, column('orderNo', '订单号'), column('skuCode', 'SKU'), image, detail, quantity,
    column('inventoryType', '库存类型'), column('warehouse', '仓库'), column('department', '部门'), column('customerName', '客户'), ...tail],
  pending: [time, column('orderNo', '订单号'), column('skuCode', 'SKU'), image, column('customerName', '客户'), detail, quantity, ...tail],
  accessories: [time, column('orderNo', '订单号'), column('name', '辅料名称', 26), image, column('customerName', '客户'),
    column('category', '类别'), column('outboundType', '出库类型'), detail, quantity, column('beforeQuantity', '出库前库存'),
    column('afterQuantity', '出库后库存'), column('operatorUsername', '操作人'), column('remark', '备注（含领取人）', 36)],
  fabric: [time, column('name', '面料名称', 26), image, column('inventoryType', '库存类型'), column('customerName', '客户'),
    column('pickupUserName', '领取人'), quantity, column('unit', '单位', 10), column('unitPrice', '实际成本单价', 18, true),
    column('amount', '出库金额', 18, true), column('remark', '备注', 36), column('sourceNote', '资料来源说明', 36)],
};

function sizeText(snapshot: ColorSizeSnapshot | null | undefined): string {
  if (!snapshot?.headers.length || !snapshot.rows.length) return '未留存明细';
  return snapshot.rows.map(row => `${row.colorName || '颜色未记录'}：${snapshot.headers.map((header, i) => `${header}=${row.quantities[i] ?? '未记录'}`).join('，')}`).join('\n');
}

export function finishedOutboundLine(row: FinishedGoodsOutboundRecord, labels: Map<number, string>): OutboundExportLine {
  return { key: row.exportKey ?? String(row.id), imageUrl: row.imageUrl ?? '', values: {
    createdAt: row.createdAt, orderNo: row.orderNo, skuCode: row.skuCode, customerName: row.customerName,
    quantity: row.quantity, detail: sizeText(row.sizeBreakdown), department: row.department,
    inventoryType: (row.inventoryTypeId == null ? undefined : labels.get(row.inventoryTypeId)) ?? '未记录/已失效',
    warehouse: (row.warehouseId == null ? undefined : labels.get(row.warehouseId)) ?? '未记录/已失效',
    pickupUserName: row.pickupUserName, operatorUsername: row.operatorUsername, remark: row.remark,
  } };
}

export function pendingOutboundLine(row: PendingListItem): OutboundExportLine {
  return { key: String(row.id), imageUrl: row.imageUrl, values: {
    createdAt: row.createdAt, orderNo: row.orderNo, skuCode: row.skuCode, customerName: row.customerName,
    quantity: row.quantity, detail: row.detailStatus === 'recorded' ? sizeText(row.colorSizeSnapshot) : '未留存完整明细',
    pickupUserName: row.pickupUserName, operatorUsername: row.operatorUsername, remark: row.remark,
  } };
}

type AccessoryRow = Awaited<ReturnType<typeof getAccessoryOutboundRecords>>['list'][number];
export function accessoryOutboundLine(row: AccessoryRow): OutboundExportLine {
  const sizes = row.sizeOutbound;
  return { key: String(row.id), imageUrl: row.imageUrl ?? '', values: {
    createdAt: row.createdAt, orderNo: row.orderNo, name: row.accessoryName ?? '名称不可用', customerName: row.customerName ?? '',
    category: row.category ?? '', outboundType: row.outboundType === 'order_auto' ? '订单自动出库' : '手动出库',
    quantity: row.quantity, beforeQuantity: row.beforeQuantity, afterQuantity: row.afterQuantity,
    detail: sizes?.headers.length ? sizes.headers.map((h, i) => `${h}=${sizes.quantities[i] ?? '未记录'}`).join('，') : '未留存分码明细',
    operatorUsername: row.operatorUsername, remark: row.remark,
  } };
}

export function fabricOutboundLine(row: FabricOutboundListRow): OutboundExportLine {
  const sources = [row.nameFromCurrentStock && '名称', row.customerNameFromCurrentStock && '客户', row.unitFromCurrentStock && '单位', row.inventoryTypeFromCurrentStock && '库存类型'].filter(Boolean);
  return { key: String(row.id), imageUrl: row.photoUrl, values: {
    createdAt: row.createdAt, name: row.name, inventoryType: row.inventoryTypeLabel, customerName: row.customerName,
    pickupUserName: row.pickupUserName, quantity: Number(row.quantity), unit: row.unit || '单位未记录',
    unitPrice: row.unitPrice == null ? '未计价' : Number(row.unitPrice), amount: row.amount == null ? '未计价' : Number(row.amount),
    remark: row.remark, sourceNote: sources.length ? `${sources.join('、')}：出库时未留存，使用关联库存现有信息` : '',
  } };
}
