<template>
 <div class="page-card live-reports">
  <div class="toolbar page-toolbar"><h1>工作报告</h1><span class="muted">ERP 业务记录 · {{ auth.user?.displayName || auth.user?.username }}</span><el-button v-if="isAdmin" :disabled="saving" @click="navigate({route:'/settings/work-reports'})">报告设置</el-button><el-button v-if="people.some(p=>p.id===auth.user?.id)" type="primary" :disabled="busy || saving" @click="navigate({owner:auth.user!.id,date:today,list:true,write:true})">写工作报告</el-button></div>
  <el-alert v-if="message && !editing" :title="message" type="success" :closable="false" />
  <el-alert v-if="error" :title="error" type="error" :closable="false" /><el-button v-if="error && !editing" @click="init">重新加载</el-button>
  <p v-if="!configured && !busy" class="muted">尚未设置报告范围，暂显示全部人员。管理员可在报告设置中选择。</p>
  <div class="submission-summary"><span>{{ listDate }} · 应交 {{ people.length }} 人 · 已交 {{ submittedCount }} 人</span><el-button size="small" :disabled="busy || saving" @click="missingVisible=true">未交人员（{{ missingPeople.length }}）</el-button></div>
  <div class="columns">
   <aside>
    <el-input v-model="search" placeholder="搜索姓名或岗位" clearable aria-label="搜索人员" />
    <el-date-picker class="report-date-filter" style="width:100%" :model-value="listDate" value-format="YYYY-MM-DD" :clearable="false" aria-label="报告列表日期" @update:model-value="navigate({owner,date:$event,list:true})" />
    <el-button v-if="date!==today" :disabled="busy || saving" @click="navigate({owner,date:today,list:true})">回到今天</el-button>
    <div class="person-list"><section v-for="day in days" :key="day"><h2 class="muted">{{ day }}</h2><button v-for="p in peopleOn(day)" :key="p.id" class="person" :title="`${p.name} · ${p.role}`" :class="{selected:p.id===owner&&day===date}" @click="navigate({owner:p.id,date:day})"><strong>{{ p.name }}</strong><span class="muted">{{ p.role }} · 已提交</span></button><p v-if="!peopleOn(day).length" class="muted">当天暂无已提交报告</p></section><el-empty v-if="!filteredPeople.length && !busy" description="暂无可查看人员" :image-size="60" /></div>
   </aside>
   <article ref="reportArticle" v-loading="busy">
    <div v-if="report && !busy && (report.submitted || editing)" class="report-sheet" :class="{'report-sheet-editing':editing}">
     <div class="toolbar report-toolbar"><div class="report-identity"><h2>{{ report.person.name }} · {{ report.person.role }}</h2><span class="muted">{{ date }}</span><el-tag v-if="editing" type="primary" size="small">{{ report.submitted?'修改中':'尚未提交' }}</el-tag></div><div><el-button v-if="mine&&!editing&&(sections.length||report.automatic.some(g=>g.rows.some(r=>r.planKey)))" type="primary" size="small" class="report-action" @click="startEdit">编辑</el-button><template v-if="editing"><el-button size="small" class="report-action" :disabled="saving" @click="navigate({cancel:true})">取消</el-button><el-button type="primary" size="small" class="report-action" :loading="saving" @click="save">{{ report.submitted?'保存修改':'提交报告' }}</el-button></template></div></div>
     <p class="muted plan-hint">{{ editing&&!report.submitted?'已带入上次安排和当前订单，核对后提交才算今天已交；无需重复改字。':'订单自动带入；动作和日期沿用上次保存内容，可修改或留空。' }}</p>
     <div v-if="attention.overdue || attention.finished" class="attention-bar"><el-button size="small" :type="attentionFilter==='overdue'?'danger':'default'" :disabled="editing" @click="attentionFilter=attentionFilter==='overdue'?'all':'overdue'">逾期待处理 {{ attention.overdue }} 项</el-button><el-button v-if="attention.finished" size="small" :type="attentionFilter==='finished'?'warning':'default'" :disabled="editing" @click="attentionFilter=attentionFilter==='finished'?'all':'finished'">订单已结束待确认 {{ attention.finished }} 项</el-button><el-button v-if="attentionFilter!=='all'" link @click="attentionFilter='all'">显示全部</el-button><span class="muted">保留原日期；请确认完成、改期或标记需要协助。</span></div>
     <el-alert v-if="report.historicalMissing && !editing" title="该日期之前尚无保存的工作安排，不用当前计划冒充历史日报。" type="info" :closable="false" />
     <section v-for="group in queues" :key="group.title" class="section"><h2>{{ group.title }} · {{ date!==today ? '未保存历史快照' : (attentionFilter==='all'?group.rows.length:visiblePlans(queueDrafts(group.rows)).length+' / '+group.rows.length)+' 条' }}</h2><p v-if="date!==today" class="muted">历史日期未保存待办快照。</p><WorkReportTaskEditor :editable="editing && mine" queue section="bulk" :drafts="visiblePlans(queueDrafts(group.rows))" :reference-date="date" :queue-rows="group.rows" :catalog="catalog" :originals="report.tasks" error="" @update="updateQueue" /></section>
     <template v-if="editing"><p class="muted">跟单：换下一步勾选上一步完成；结束时勾选结束跟进，已做完可同时勾选完成。部分订单完成请先拆开。岗位清单：动作完成只结束手写安排，不改变生产进度。改期会保留原安排记录。</p><section v-for="group in sections" :key="group.type" class="section"><h2>{{ group.label }} {{ group.drafts.length }} 项</h2><WorkReportTaskEditor :section="group.type" :drafts="group.drafts" :reference-date="date" :check-finished="date===today" :originals="tasks" :catalog="catalog" error="" @add="add(group.type)" @update="updateRow" @merge="merge" @split="split" @remove="remove" /></section></template>
     <template v-else>
      <section v-for="group in sections" :key="group.type" class="section"><h2>{{ group.label }} · 工作安排 {{ attentionFilter==='all'?group.rows.length:visiblePlans(viewDrafts(group.rows)).length+' / '+group.rows.length }} 项</h2><WorkReportTaskEditor :editable="false" :section="group.type" :drafts="visiblePlans(viewDrafts(group.rows))" :reference-date="date" :check-finished="date===today" :catalog="catalog" :originals="[]" error="" /></section>
      <section v-if="legacyTasks.length" class="section"><h2>已有补充安排</h2><WorkReportTaskTable :tasks="legacyTasks" :catalog="catalog" :editable="false" :reference-date="date" /></section>
     </template>
     <WorkReportStatistics :groups="statistics" :historical="date!==today" />
     <template v-if="!editing"><el-collapse v-if="completed.length || adjustments.length" style="--el-collapse-header-font-size:var(--font-size-body);--el-collapse-content-font-size:var(--font-size-body)"><el-collapse-item v-if="completed.length" :title="'当天完成的工作事项 · '+completed.length+' 项'" name="completed"><WorkReportTaskTable :tasks="completed" :catalog="catalog" :editable="false" :reference-date="date" /></el-collapse-item><el-collapse-item v-if="adjustments.length" :title="'当天安排调整 · '+adjustments.length+' 项'" name="adjustments"><WorkReportTaskTable :tasks="adjustments" :catalog="catalog" :editable="false" :reference-date="date" /></el-collapse-item></el-collapse></template>
    </div>
    <el-empty v-if="!busy && !error && (!report || !report.submitted&&!editing)" :description="report?report.person.name+'在该日期尚未提交报告':'当天暂无报告'"><el-button v-if="report && mine" type="primary" @click="startEdit">{{ owner===auth.user?.id?'写工作报告':'代写工作报告' }}</el-button></el-empty>
   </article>
  </div>
  <AppDialog v-model="missingVisible" :title="listDate+' · 未交人员'" width="480"><div class="missing-people"><template v-for="p in missingPeople" :key="p.id"><el-button v-if="isAdmin || p.id===auth.user?.id" @click="missingVisible=false;navigate({owner:p.id,date:listDate})">{{ p.name }} · {{ p.role }}</el-button><el-tag v-else type="info" effect="plain">{{ p.name }} · {{ p.role }}</el-tag></template><p v-if="!missingPeople.length">该日期应交人员均已提交。</p></div></AppDialog>
  <AppDialog v-model="leaveVisible" title="有未保存的安排" width="440"><p>{{ report?.submitted?'保存后再切换，或放弃本次修改。':'提交后才算已交，也可以放弃本次填写。' }}</p><template #footer><el-button @click="leaveVisible=false">继续编辑</el-button><el-button @click="leave(false)">放弃修改</el-button><el-button type="primary" :loading="saving" @click="leave(true)">{{ report?.submitted?'保存并继续':'提交并继续' }}</el-button></template></AppDialog>
 </div>
</template>
<script setup lang="ts">
import {computed,onMounted,onActivated,onBeforeUnmount,ref,watch} from 'vue'
import {useRouter,onBeforeRouteLeave} from 'vue-router'
import AppDialog from '@/components/AppDialog.vue'
import WorkReportStatistics from '@/components/workspace/WorkReportStatistics.vue'
import WorkReportTaskEditor from '@/components/workspace/WorkReportTaskEditor.vue'
import WorkReportTaskTable from '@/components/workspace/WorkReportTaskTable.vue'
import {reportQueues,compareReportPlans,planOverdueDays} from '@/composables/workReportPresentation'
import {useLiveWorkReport} from '@/composables/useLiveWorkReport'
import type {DraftRow,WorkTask} from '@/composables/workReportDemo'
import type {AutomaticRow} from '@/api/work-reports'
const router=useRouter(),reportArticle=ref<HTMLElement|null>(null)
const {submittedPeople,submittedCount,missingPeople,listDate,days,refreshSubmissions,message,automaticPlan,auth,configured,people,catalog,report,date,owner,busy,error,editing,drafts,dirty,saving,today,mine,tasks,sections,legacyTasks,init,refreshDirectory,load,edit,add,merge,split,save}=useLiveWorkReport()
const isAdmin=computed(()=>auth.user?.roleCode==='admin'||auth.user?.roleCodes?.includes('admin'))
const search=ref(''),leaveVisible=ref(false),missingVisible=ref(false)
type Target={owner?:number;date?:string;list?:boolean;cancel?:boolean;route?:string;write?:boolean}
const target=ref<Target>({})
const filteredPeople=computed(()=>people.value.filter(p=>(p.name+p.role).includes(search.value.trim())))
const peopleOn=(day:string)=>submittedPeople(day).filter(p=>(p.name+p.role).includes(search.value.trim()))
const completed=computed(()=>tasks.value.filter(t=>t.status==='done'&&t.completedDate===date.value))
const adjustments=computed(()=>tasks.value.filter(t=>t.status==='deferred'&&t.recordedDate===date.value))
const queues=computed(()=>report.value?reportQueues(report.value):[])
const statistics=computed(()=>[...queues.value,...(report.value?.automatic.filter(g=>!g.title.startsWith('当前'))||[]),...sections.value.filter(g=>g.type!=='other').map(g=>({title:'当前'+g.label,note:'负责跟进的订单，按订单去重；不代表当日产量。',rows:g.rows.flatMap(t=>(t.orders?.length?t.orders:[t.order]).map(no=>({orderId:catalog.value.find(o=>o.no===no)?.id||0,orderNo:no,sku:catalog.value.find(o=>o.no===no)?.sku||'',title:t.title,time:'',quantity:null,factory:'',imageUrl:''})))}))])
const viewDrafts=(rows:WorkTask[]):DraftRow[]=>rows.map(t=>({...t,title:t.id.startsWith('auto-')?'':t.title,sourceIds:[t.id],done:false}))
const queueDrafts=(rows:AutomaticRow[]):DraftRow[]=>rows.map<DraftRow>(r=>({id:r.planKey!,order:r.orderNo,orders:[r.orderNo],section:'bulk',title:automaticPlan(r.planKey!)?.title||'',date:automaticPlan(r.planKey!)?.date||'',needsHelp:!!automaticPlan(r.planKey!)?.needsHelp,sourceIds:[],done:!!(automaticPlan(r.planKey!) as {done?:boolean})?.done})).sort((a,b)=>compareReportPlans(editing.value?{date:report.value?.tasks.find(t=>t.automaticKey===a.id)?.date||''}:a,editing.value?{date:report.value?.tasks.find(t=>t.automaticKey===b.id)?.date||''}:b))
const attentionFilter=ref<'all'|'overdue'|'finished'>('all')
watch([owner,date],()=>{attentionFilter.value='all'})
const finishedNos=computed(()=>new Set(date.value===today.value?catalog.value.filter(o=>o.finished===1).map(o=>o.no):[]))
const hasFinished=(row:DraftRow)=>(row.orders||[row.order]).some(no=>finishedNos.value.has(no))
const attention=computed(()=>{const manual=sections.value.flatMap(g=>viewDrafts(g.rows)),all=[...manual,...queues.value.flatMap(g=>queueDrafts(g.rows))];return {overdue:all.filter(r=>planOverdueDays(r.date,date.value)>0).length,finished:manual.filter(hasFinished).length}})
const visiblePlans=(rows:DraftRow[])=>editing.value||attentionFilter.value==='all'?rows:rows.filter(r=>attentionFilter.value==='overdue'?planOverdueDays(r.date,date.value)>0:hasFinished(r))
function startEdit(){attentionFilter.value='all';edit()}
function updateQueue(id:string,patch:Partial<DraftRow>){const plan=automaticPlan(id);if(plan){if(patch.title!==undefined)plan.title=patch.title;if(patch.date!==undefined)plan.date=patch.date;if(patch.needsHelp!==undefined)plan.needsHelp=patch.needsHelp;if(patch.done!==undefined)(plan as {done?:boolean}).done=patch.done}}
function updateRow(id:string,patch:Partial<DraftRow>){const row=drafts.value.find(r=>r.id===id);if(row)Object.assign(row,patch)}
function remove(id:string){if(!drafts.value.find(r=>r.id===id)?.sourceIds?.length)drafts.value=drafts.value.filter(r=>r.id!==id)}
function navigate(next:Target){if(saving.value)return;target.value=next;if(dirty.value)leaveVisible.value=true;else void leave(false)}
let navigationId=0
async function leave(shouldSave:boolean){
 if(saving.value)return
 const id=++navigationId,next=target.value
 if(shouldSave&&!await save()){leaveVisible.value=false;return}
 editing.value=false;leaveVisible.value=false
 if(next.route){await router.push(next.route);return}
 if(next.cancel)return
 if(next.owner)owner.value=next.owner
 if(next.date)date.value=next.date
 if(next.list){
  listDate.value=date.value;busy.value=true
  try{await refreshSubmissions()}catch{error.value='读取提交名单失败，请重新加载';busy.value=false;return}
  if(id!==navigationId)return
  const available=peopleOn(date.value)
  if(!next.write&&!available.some(p=>p.id===owner.value)&&available.length)owner.value=available[0].id
 }
 await load()
 if(id===navigationId&&next.write&&mine.value&&report.value)startEdit()
}
onBeforeRouteLeave(to=>{if(saving.value)return false;if(dirty.value){navigate({route:to.fullPath});return false}return true})
function unload(e:BeforeUnloadEvent){if(dirty.value){e.preventDefault();e.returnValue=''}}
let initialized=false
const calendarDay=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date())
let lastDay=calendarDay()
function advanceDay(){const current=calendarDay();if(current===lastDay||editing.value||saving.value)return false;if(date.value===lastDay)date.value=current;if(listDate.value===lastDay)listDate.value=current;lastDay=current;return true}
function focus(){if(advanceDay())void refreshDirectory()}
onActivated(()=>{if(!initialized){initialized=true;void init()}else if(!dirty.value){advanceDay();void refreshDirectory()}})
onMounted(()=>{window.addEventListener('beforeunload',unload);window.addEventListener('focus',focus)})
onBeforeUnmount(()=>{window.removeEventListener('beforeunload',unload);window.removeEventListener('focus',focus)})
</script>
<style scoped>
.live-reports {font-size:var(--font-size-body);line-height:1.5;height:calc(100vh - 125px);display:flex;flex-direction:column}
.toolbar {display:flex;justify-content:space-between;align-items:center;gap:var(--space-sm);flex-wrap:wrap;padding-bottom:var(--space-sm)}
h1 {font-size:var(--font-size-subtitle);margin:0} h2 {font-size:var(--font-size-subtitle);margin:0}
.muted {font-size:var(--font-size-caption);color:var(--color-text-muted);line-height:1.6}
.submission-summary {display:flex;align-items:center;gap:var(--space-sm);padding-bottom:var(--space-sm);font-size:var(--font-size-caption);color:var(--color-text-muted)}
.missing-people {display:flex;flex-wrap:wrap;gap:var(--space-sm)}
.columns {display:grid;grid-template-columns:220px minmax(0,1fr);flex:1;min-height:0;border:1px solid var(--color-border);border-radius:var(--radius-md);overflow:hidden;background:var(--color-card)}
aside {min-width:0;display:flex;flex-direction:column;gap:var(--space-sm);padding:var(--space-sm);border-right:1px solid var(--color-border);min-height:0}
.person-list {overflow:auto;min-height:0}.person-list h2 {margin:var(--space-sm) 0;font-size:var(--font-size-caption);font-weight:500;line-height:1.5}
.person {height:32px;min-height:32px;box-sizing:border-box;display:flex;align-items:center;gap:var(--space-sm);width:100%;padding:var(--space-xs) var(--space-sm);margin-bottom:var(--space-xs);border:1px solid transparent;border-radius:var(--el-border-radius-base);background:var(--el-fill-color-light);color:var(--color-text-primary);text-align:left;cursor:pointer;font-family:var(--font-family-ui);font-size:var(--font-size-body);line-height:1.5}
.person strong,.person span {font-size:inherit;line-height:inherit}.person strong {flex-shrink:0;font-weight:600}.person span {overflow:hidden;white-space:nowrap;text-overflow:ellipsis}.person.selected {border-color:var(--color-primary);background:var(--el-color-primary-light-9)}
article {overflow:auto;min-width:0;padding:var(--space-md);background:var(--color-card)}
aside {background:var(--color-card)}
.report-sheet {width:100%;min-width:0}
.report-sheet-editing .report-toolbar {position:sticky;top:0;z-index:3;background:var(--el-color-primary-light-9);border:1px solid var(--el-color-primary-light-8);border-radius:var(--radius-md);padding:var(--space-sm)}
.report-date-filter {width:100%;min-width:0;box-sizing:border-box}
.page-toolbar {justify-content:flex-start}.page-toolbar > .muted {margin-right:auto}
.report-action {font-size:var(--font-size-body)}
.report-toolbar {padding-bottom:var(--space-sm);margin-bottom:var(--space-sm);border-bottom:1px solid var(--color-border)}.report-identity {display:flex;align-items:baseline;gap:var(--space-sm);flex-wrap:wrap}
.attention-bar {display:flex;align-items:center;flex-wrap:wrap;gap:var(--space-xs);margin-bottom:var(--space-sm)}
.plan-hint {margin:0 0 var(--space-sm)}
.section {margin:var(--space-lg) 0}.section h2 {margin-bottom:var(--space-sm)}
@media(max-width:760px){.columns {grid-template-columns:170px minmax(0,1fr)}article {padding:var(--space-sm)}}
</style>
