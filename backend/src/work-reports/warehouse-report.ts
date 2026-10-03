import { DataSource } from 'typeorm';
import { PackingListsQuery } from '../packing-lists/packing-lists-query';
import { PackingList } from '../entities/packing-list.entity';
import { PackingListBox } from '../entities/packing-list-box.entity';
import { PackingListItem } from '../entities/packing-list-item.entity';
import { formatDateTimeForResponse } from '../common/date-time.util';
import type { AutoRow } from './work-reports.service';

/** 复用装箱单工作页查询；每张单据一个安排，草稿和滞留分开，不把已发货当待办。 */
export async function warehousePackingTodos(db: DataSource, current: boolean) {
  const query = new PackingListsQuery(db.getRepository(PackingList), db.getRepository(PackingListBox), db.getRepository(PackingListItem));
  const groups: {title: string; note: string; rows: AutoRow[]}[] = [];
  for (const status of ['draft', 'held']) {
    const rows: AutoRow[] = [];
    if (current) {
      let page = 1, total = 0;
      do {
        const result = await query.getList({status, page, pageSize: 100});
        total = result.total;
        rows.push(...result.list.map(p => ({entryId:p.id,orderId:0,orderNo:'',sku:p.code,imageUrl:'',customer:p.customerName,
          title:status==='held'?'滞留待处理':'装箱待发货',time:formatDateTimeForResponse(p.createdAt),quantity:p.totalQty,
          factory:'',remark:[p.styleNos.join('、'),p.holdReason].filter(Boolean).join(' · ')})));
        if (!result.list.length) break;
        page++;
      } while ((page - 1) * 100 < total);
    }
    rows.reverse();
    groups.push({title:status==='held'?'当前滞留装箱单（部门）':'当前待发货装箱单（部门）',
      note:current?'与装箱单工作页一致，每张单据填写一次下一步动作；发货操作仍在装箱单页面完成。':'历史日期不展示当前装箱单待办，尚无该日队列快照。',rows});
  }
  return groups;
}
