import { isReportScheduled } from './workReportSchedule'
import { computed, ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { getReportDirectory,getReportOrders,getLiveReport,saveReportPlans,type ReportDirectoryPerson,type ReportOrder,type LiveReport,type AutomaticRow,type AutomaticPlan } from '@/api/work-reports'
import { compareReportPlans } from './workReportPresentation'
import { taskOrders, type DraftRow, type WorkTask } from './workReportDemo'
import { getErrorMessage } from '@/api/request'
export function useLiveWorkReport() {
 const auth=useAuthStore(),people=ref<ReportDirectoryPerson[]>([]),catalog=ref<ReportOrder[]>([]),report=ref<LiveReport|null>(null)
 const date=ref(new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date())),owner=ref(auth.user?.id||0)
 const configured=ref(false),message=ref('')
 const busy=ref(false),error=ref(''),editing=ref(false),drafts=ref<DraftRow[]>([]),baseline=ref(''),saving=ref(false)
 const automaticDrafts=ref<AutomaticPlan[]>([])
 const draftState=()=>JSON.stringify([drafts.value,automaticDrafts.value])
 const dirty=computed(()=>editing.value&&baseline.value!==draftState())
 const today=computed(()=>report.value?.today||new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date()))
 const mine=computed(()=>(owner.value===auth.user?.id||auth.user?.roleCode==='admin'||auth.user?.roleCodes?.includes('admin'))&&date.value===today.value)
 const tasks=computed(()=>(report.value?.tasks||[]).filter(t=>!t.automaticKey))
 const unplanned=computed(()=>(report.value?.pendingOrders||[]).filter(o=>report.value?.template.manualSections.includes(o.orderType)&&!tasks.value.some(t=>t.status==='todo'&&taskOrders(t).includes(o.no))))
 const autoTasks=computed<WorkTask[]>(()=>unplanned.value.map(o=>({id:'auto-'+o.id,owner:String(owner.value),order:o.no,orders:[o.no],section:o.orderType,title:'可补充下一步安排',date:'',status:'todo',completedDate:'',history:[]})))
 const sections=computed(()=>(report.value?.template.manualSections||[]).map(type=>({type,label:type==='sample'?'样品订单':type==='bulk'?'大货订单':'其他事项 / 特殊说明（选填）',
   rows:[...tasks.value.filter(t=>t.status==='todo'&&t.section===type),...autoTasks.value.filter(t=>t.section===type)].sort(compareReportPlans),drafts:drafts.value.filter(t=>t.section===type)})))
 const legacyTasks=computed(()=>tasks.value.filter(t=>t.status==='todo'&&!sections.value.some(s=>s.type===t.section)))
 let requestId=0
 async function load() {
  const id=++requestId;
  if(!owner.value){report.value=null;busy.value=false;error.value='';return}
  busy.value=true;error.value='';message.value=''
  try { const r=await getLiveReport(owner.value,date.value);if(id===requestId)report.value=r.data }
  catch(e){if(id===requestId){report.value=null;error.value=getErrorMessage(e,'读取失败')}}
  finally{if(id===requestId)busy.value=false}
 }
 async function init() {
  busy.value=true
  try {const [p,o]=await Promise.all([getReportDirectory(),getReportOrders()]);people.value=p.data.people;configured.value=p.data.configured;catalog.value=o.data;const scheduled=people.value.filter(p=>isReportScheduled(p.rule));owner.value=scheduled.find(p=>p.id===auth.user?.id)?.id||scheduled[0]?.id||0;await load()}
  catch(e){error.value=getErrorMessage(e,'读取失败')}finally{busy.value=false}
 }
 async function refreshDirectory() {
  try {const {data}=await getReportDirectory();people.value=data.people;configured.value=data.configured;
   if(!people.value.some(p=>p.id===owner.value&&isReportScheduled(p.rule))){owner.value=people.value.find(p=>isReportScheduled(p.rule))?.id||0}
   await load()
  }catch(e){error.value=getErrorMessage(e,'更新报告范围失败')}
 }
 function edit() {message.value='';drafts.value=tasks.value.filter(t=>t.status==='todo').map(t=>({id:t.id,order:t.order,orders:[...taskOrders(t)],sourceIds:[t.id],section:t.section,title:t.title,date:t.date,urgent:t.urgent,needsHelp:t.needsHelp,done:false,end:false}));for(const o of unplanned.value){add(o.orderType,o.no);drafts.value[drafts.value.length-1].id="auto-"+o.id;drafts.value[drafts.value.length-1].date="";}drafts.value.sort(compareReportPlans);automaticDrafts.value=(report.value?.automatic||[]).flatMap(g=>g.rows.filter(r=>r.planKey).map(r=>{const saved=report.value?.tasks.find(t=>t.automaticKey===r.planKey);return {key:r.planKey!,title:saved?.title||'',date:saved?.date||'',needsHelp:!!saved?.needsHelp,done:false}}));baseline.value=draftState();editing.value=true}
 function add(section:'sample'|'bulk'|'other',no='') {drafts.value.push({id:'new-'+crypto.randomUUID(),section,order:no,orders:no?[no]:[],sourceIds:[],title:'',date:today.value,done:false,end:false})}
 function annotate(row:AutomaticRow){if(!sections.value.some(s=>s.type==='other'))return;if(!editing.value)edit();add('other');drafts.value[drafts.value.length-1].title=row.orderNo+' · '+row.title+'：'}
 function merge(ids:string[]) {
  const selected=drafts.value.filter(t=>ids.includes(t.id));if(selected.length<2)return
  if(selected.some(r=>r.done||r.end||!taskOrders(r).length)){error.value='请先取消完成/结束勾选，并选择订单';return}
  const first=selected[0];if(selected.some(r=>r.section!==first.section)){error.value='样品和大货请分别合并';return}
  const orders=[...new Set(selected.flatMap(taskOrders))]
  const merged={...first,order:orders[0],orders,sourceIds:[...new Set(selected.flatMap(r=>r.sourceIds||[]))],title:selected.every(r=>r.title===first.title)?first.title:'',date:selected.every(r=>r.date===first.date)?first.date:'',urgent:selected.some(r=>r.urgent)}
  drafts.value=drafts.value.flatMap(r=>r.id===first.id?[merged]:ids.includes(r.id)?[]:[r])
 }
 function split(id:string) {
  const row=drafts.value.find(t=>t.id===id);if(!row||row.done||row.end){error.value='请取消完成/结束后拆分';return}
  drafts.value=drafts.value.flatMap(r=>r.id!==id?[r]:taskOrders(r).map((order,i)=>({...r,id:i?'split-'+crypto.randomUUID():r.id,order,orders:[order],sourceIds:(r.sourceIds||[]).filter(source=>taskOrders(tasks.value.find(t=>t.id===source)!).includes(order))})))
 }
 async function save() {
  if(!report.value||saving.value)return false;saving.value=true;error.value=''
  try {const r=await saveReportPlans(report.value.version,drafts.value.filter(r=>!r.id.startsWith("auto-")||r.sourceIds?.length||r.title.trim()||r.date||r.done||r.end||r.urgent||r.needsHelp),automaticDrafts.value,owner.value);report.value={...report.value,...r.data};editing.value=false;message.value='全部安排已保存';return true}
  catch(e){error.value=getErrorMessage(e,'保存失败，草稿已保留');return false}finally{saving.value=false}
 }
 function automaticPlan(key:string){return editing.value?automaticDrafts.value.find(p=>p.key===key):report.value?.tasks.find(t=>t.automaticKey===key)}
 return {message,automaticPlan,automaticDrafts,auth,configured,people,catalog,report,date,owner,busy,error,editing,drafts,dirty,saving,today,mine,tasks,sections,legacyTasks,unplanned,annotate,init,refreshDirectory,load,edit,add,merge,split,save}
}
