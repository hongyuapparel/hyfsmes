import type {AutomaticRow,LiveReport} from '@/api/work-reports'
export function reportQueues(report:LiveReport) {
 return report.automatic.filter(g=>g.title.startsWith('当前')).flatMap(group=>{
  const split=group.title.includes('尾部')||group.title.includes('纸样')||group.title.includes('车缝')||group.title.includes('采购')
  if(!split||!group.rows.length)return [group]
  return [...new Set(group.rows.map(r=>r.status||r.title))].map(status=>({...group,title:group.title+' · '+status,rows:group.rows.filter(r=>(r.status||r.title)===status)}))
 })
}
export function reportCount(rows:AutomaticRow[],title:string) {
 const orders=new Set(rows.map(r=>r.orderId>0?'id:'+r.orderId:r.orderNo).filter(Boolean)).size
 const unlinked=rows.filter(r=>!r.orderId&&!r.orderNo).length
 const quantity=rows.length>0&&!title.includes('采购')&&rows.every(r=>r.quantity!=null&&Number.isFinite(Number(r.quantity)))?rows.reduce((n,r)=>n+Number(r.quantity),0):null
 return {orders,quantity,items:rows.length,unlinked}
}
