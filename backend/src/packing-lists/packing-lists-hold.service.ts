import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PackingList } from '../entities/packing-list.entity';
import { PackingListLog } from '../entities/packing-list-log.entity';
import { SetPackingListHoldDto } from './dto';

/** 仅切换未发货单的分类；状态与审计记录同事务，不接触箱、明细或库存。 */
@Injectable()
export class PackingListsHoldService {
  constructor(@InjectRepository(PackingList) private readonly listRepo: Repository<PackingList>) {}

  async setHold(payload: SetPackingListHoldDto, operatorUsername: string): Promise<{ changed: number }> {
    const ids = [...new Set(payload.ids)].sort((a, b) => a - b);
    return this.listRepo.manager.transaction(async (manager) => {
      const repo = manager.getRepository(PackingList);
      // 与确认发货使用同一主表行锁；按 ID 排序减少批量操作死锁。
      const lists = await repo.createQueryBuilder('list')
        .where('list.id IN (:...ids)', { ids })
        .orderBy('list.id', 'ASC')
        .setLock('pessimistic_write')
        .getMany();
      if (lists.length !== ids.length) throw new NotFoundException('部分装箱单已不存在，本次未作任何修改');
      const invalid = lists.filter((list) => list.status !== 'draft' && list.status !== 'held');
      if (invalid.length) {
        throw new BadRequestException(`仅未发货装箱单可切换滞留分类，本次未作任何修改：${invalid.map((list) => list.code).join('、')}`);
      }
      const changed = lists.filter((list) => list.status !== payload.status);
      const logRepo = manager.getRepository(PackingListLog);
      for (const list of changed) {
        const previousReason = list.holdReason;
        const holdReason = payload.status === 'held' ? (payload.reason ?? '').trim() : '';
        await repo.update({ id: list.id }, { status: payload.status, holdReason });
        await logRepo.save(logRepo.create({
          packingListId: list.id,
          action: payload.status === 'held' ? 'hold' : 'resume',
          operatorUsername: operatorUsername.trim(),
          summary: payload.status === 'held'
            ? `标记滞留待发；原因：${holdReason || '未填写'}（不改变数量和库存）`
            : `移回草稿；原滞留原因：${previousReason || '未填写'}（不改变数量和库存）`,
        }));
      }
      return { changed: changed.length };
    });
  }
}
