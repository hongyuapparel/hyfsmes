import { BadRequestException } from '@nestjs/common';

export const CASH_KINDS = ['operating', 'investing', 'financing', 'unclassified'] as const;
export type CashKind = typeof CASH_KINDS[number];

export function financeDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('请填写有效日期');
  }
  return value;
}

export function financeToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

// 金额只接受两位小数，以整数分计算，拒绝截断或自动四舍五入。
export function financeCents(value: unknown, positive = false): number {
  const text = String(value ?? '');
  if (!/^-?\d{1,10}(\.\d{1,2})?$/.test(text)) throw new BadRequestException('金额必须为有效数字，最多两位小数');
  const cents = Math.round(Number(text) * 100);
  if (positive && cents <= 0) throw new BadRequestException('收付款金额必须大于零');
  return cents;
}

export function financeMoney(cents: number): string { return (cents / 100).toFixed(2); }

export function financeId(value: unknown, optional = false): number | null {
  if (optional && (value === null || value === undefined || value === '')) return null;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new BadRequestException('请选择有效的账户或分类');
  return id;
}

export function financeText(value: unknown, max: number): string {
  if (value == null) return '';
  if (typeof value !== 'string' || value.length > max) throw new BadRequestException(`文字长度不能超过 ${max} 字`);
  return value.trim();
}
