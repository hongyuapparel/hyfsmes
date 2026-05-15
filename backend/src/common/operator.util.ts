import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';

/**
 * 操作人显示名解析：displayName 优先 → username → fallback。
 * 任何异常（含查不到 user）都回退到 fallback，不应抛出。
 */
export async function resolveOperatorDisplayName(
  userRepo: Repository<User>,
  actor: { userId?: number; username?: string },
): Promise<string> {
  const fallback = (actor.username ?? '').trim();
  if (!actor.userId) return fallback;
  try {
    const user = await userRepo.findOne({ where: { id: actor.userId } });
    if (!user) return fallback;
    return (
      (user.displayName && user.displayName.trim()) ||
      (user.username && user.username.trim()) ||
      fallback
    );
  } catch {
    return fallback;
  }
}
