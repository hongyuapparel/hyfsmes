import { Repository } from 'typeorm';
import { OrderSewing } from '../entities/order-sewing.entity';

/**
 * 下游车缝是否已登记数量：用于编辑裁床数据前的风险判定。
 * 判定口径：存在车缝记录且（已完成 或 完成数量>0）。
 */
export async function detectSewingStarted(
  sewingRepo: Repository<OrderSewing>,
  orderId: number,
): Promise<{ sewingStarted: boolean; sewingQuantity: number }> {
  const sewing = await sewingRepo.findOne({ where: { orderId } });
  if (!sewing) return { sewingStarted: false, sewingQuantity: 0 };
  const qty = Number(sewing.sewingQuantity) || 0;
  const started = String(sewing.status ?? '').toLowerCase() === 'completed' || qty > 0;
  return { sewingStarted: started, sewingQuantity: qty };
}
