import {it,expect} from 'vitest'
import {reportCount,reportQueues} from './workReportPresentation'
import type {AutomaticRow,LiveReport} from '@/api/work-reports'
const row=(orderId:number,title:string,quantity:number|null):AutomaticRow=>({orderId,orderNo:orderId?'O'+orderId:'',title,quantity,sku:'款',time:'',factory:'',imageUrl:'',planKey:'key'+orderId})
it('尾部按状态分区且保留原计划键，完成记录只放统计',()=>{
 const report={automatic:[{title:'当前尾部待办（部门）',note:'',rows:[row(1,'待收货',10),row(2,'待包装 / 分配',20)]},{title:'当天尾部完成（部门）',note:'',rows:[row(3,'完成',30)]}]} as LiveReport
 const groups=reportQueues(report);expect(groups).toHaveLength(2);expect(groups[0].rows[0].planKey).toBe('key1');expect(groups[1].title).toContain('待包装')
})
it('订单去重、出货件数累加；采购物料不混合单位合计',()=>{
 const rows=[row(1,'物料1',10),row(1,'物料2',20),row(0,'手填',5)]
 expect(reportCount(rows,'当天采购完成')).toEqual({orders:1,quantity:null,items:3,unlinked:1})
 expect(reportCount(rows,'今日出货').quantity).toBe(35)
 expect(reportCount([row(1,'纸样',null)],'纸样').quantity).toBe(null)
})

import {compareReportPlans} from './workReportPresentation'
it('执行日期升序，空日期最后，同日紧急优先且不改变输入数组',()=>{
 const rows=[{date:'',urgent:true},{date:'2026-09-26',urgent:true},{date:'2026-09-22'},{date:'2026-09-20'},{date:'2026-09-22',urgent:true}]
 expect([...rows].sort(compareReportPlans)).toEqual([rows[3],rows[4],rows[2],rows[1],rows[0]])
})
