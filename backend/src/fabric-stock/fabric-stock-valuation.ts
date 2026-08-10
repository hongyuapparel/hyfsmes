import { BadRequestException } from '@nestjs/common';

const UNIT_PRICE_SCALE = 4;
const AMOUNT_SCALE = 2;

function parseNonNegativeNumber(value: unknown, label: string): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new BadRequestException(`${label}必须大于或等于 0`);
  }
  return number;
}

export function normalizeFabricUnitPrice(value: unknown): string | null {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  return parseNonNegativeNumber(value, '单价').toFixed(UNIT_PRICE_SCALE);
}

export function normalizeFabricOtherCost(value: unknown): string {
  if (value === undefined || value === null || String(value).trim() === '') return '0.00';
  return parseNonNegativeNumber(value, '其他费用').toFixed(AMOUNT_SCALE);
}

export function calculateFabricInboundUnitPrice(
  quantity: number,
  purchaseUnitPrice: unknown,
  otherCost: unknown,
): string | null {
  const unitPrice = normalizeFabricUnitPrice(purchaseUnitPrice);
  const normalizedOtherCost = normalizeFabricOtherCost(otherCost);
  if (unitPrice == null) {
    if (Number(normalizedOtherCost) > 0) {
      throw new BadRequestException('未填写采购单价时不能填写其他费用');
    }
    return null;
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new BadRequestException('入库数量必须大于 0');
  }
  const totalCost = quantity * Number(unitPrice) + Number(normalizedOtherCost);
  return (totalCost / quantity).toFixed(UNIT_PRICE_SCALE);
}

/** 任一批次未计价时，合并后的整行保持未计价，避免展示不完整金额。 */
export function calculateFabricWeightedUnitPrice(
  currentQuantity: number,
  currentUnitPrice: unknown,
  inboundQuantity: number,
  inboundUnitPrice: unknown,
): string | null {
  const currentPrice = normalizeFabricUnitPrice(currentUnitPrice);
  const inboundPrice = normalizeFabricUnitPrice(inboundUnitPrice);
  if (currentQuantity <= 0) return inboundPrice;
  if (inboundQuantity <= 0) return currentPrice;
  if (currentPrice == null || inboundPrice == null) return null;
  const totalQuantity = currentQuantity + inboundQuantity;
  if (!Number.isFinite(totalQuantity) || totalQuantity <= 0) return null;
  return ((currentQuantity * Number(currentPrice) + inboundQuantity * Number(inboundPrice)) / totalQuantity)
    .toFixed(UNIT_PRICE_SCALE);
}

export function calculateFabricAmount(quantity: unknown, unitPrice: unknown): string | null {
  const price = normalizeFabricUnitPrice(unitPrice);
  const normalizedQuantity = Number(quantity);
  if (price == null || !Number.isFinite(normalizedQuantity)) return null;
  return (normalizedQuantity * Number(price)).toFixed(AMOUNT_SCALE);
}
