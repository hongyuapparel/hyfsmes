<template>
 <div class="plan-table" :class="{'plan-table-editing':editable,'plan-table-other':section==='other'&&!queue}">
  <div v-if="editable && !queue && section !== 'other'" class="merge-toolbar"><el-button :disabled="selected.length < 2" @click="emit('merge',selected.map(r=>r.id));selected=[]">合并安排（{{ selected.length }}）</el-button><span class="order-meta">共同事项可合并填写；部分完成前先拆开订单。</span></div>
  <el-alert v-if="error" :title="error" type="error" :closable="false" />
  <el-table size="small" :data="drafts" row-key="id" :class="{'editable-grid':editable}" :border="editable" :cell-style="reportCellStyle" empty-text="暂无待办" @selection-change="selected=$event">
   <el-table-column v-if="editable && !queue && section!=='other'" type="selection" width="42" />
   <el-table-column v-if="queue || section!=='other'" label="订单 / 款式" column-key="order" align="left" min-width="220">
    <template #default="{row,$index}">
     <template v-if="editable && !queue && !row.sourceIds?.length">
      <el-select-v2 v-if="editingOrderId===row.id" :model-value="taskOrders(row)" :options="orderOptions" multiple filterable :aria-label="section+'第'+($index+1)+'行订单'" @update:model-value="patch(row.id,{orders:$event,order:$event[0]||''})" />
      <el-button v-else link type="primary" @click="editingOrderId=row.id">{{ row.order?'更改关联订单':'选择订单' }}</el-button>
     </template>
     <div v-for="no in taskOrders(row)" :key="no" class="order-line"><AppImageThumb class="order-thumb" :src="info(row,no)?.imageUrl" variant="compact" :width="32" :height="32" /><div class="order-copy"><strong>{{ no }} · {{ info(row,no)?.sku }}</strong><div class="order-meta order-customer" :title="[info(row,no)?.salesperson,info(row,no)?.customer].filter(Boolean).join(' · ')">{{ [info(row,no)?.salesperson,info(row,no)?.customer].filter(Boolean).join(' · ') }}</div></div></div>
     <el-button v-if="editable && !queue && taskOrders(row).length>1" link type="primary" @click="emit('split',row.id)">拆开订单</el-button>
    </template>
   </el-table-column>
   <el-table-column v-if="queue || section!=='other'" label="当前状态 / 事项" column-key="status" align="left" min-width="160"><template #default="{row}"><div class="status-copy"><template v-if="queue"><div>{{ queueInfo(row)?.status || queueInfo(row)?.title }}</div><div v-if="queueInfo(row)?.status" class="order-meta">{{ queueInfo(row)?.title }}</div><div class="order-meta queue-meta"><span v-if="queueInfo(row)?.factory">{{ queueInfo(row)?.factory }}</span><span v-if="queueInfo(row)?.quantity!=null">数量 {{ queueInfo(row)?.quantity }}</span></div><div v-if="queueInfo(row)?.remark" class="order-meta">{{ queueInfo(row)?.remark }}</div></template><template v-else><div class="manual-status"><span>{{ [...new Set(taskOrders(row).map(no=>info(row,no)?.status).filter(Boolean))].join('、') }}</span><el-tooltip v-if="finishedOrders(row).length" :content="finishedOrders(row).length===taskOrders(row).length?'订单已结束，请确认安排是否结束':'部分订单已结束，请拆分确认'" placement="top"><el-tag class="plan-warning" type="warning" size="small" tabindex="0">待确认</el-tag></el-tooltip></div></template></div></template></el-table-column>
   <el-table-column :label="section==='other'&&!queue?'任务 / 协助反馈':'下一步动作（选填）'" align="left" class-name="report-action-cell" min-width="190"><template #default="{row,$index}"><el-input class="report-action-input" v-if="editable" :model-value="row.title" :disabled="!!row.end" type="textarea" :input-style="{padding:'4px 8px',textAlign:'left',flex:'1 0 auto'}" resize="none" :autosize="{minRows:1,maxRows:4}" maxlength="200" :placeholder="section==='other'?'填写事项':'填写动作'" :aria-label="section+'第'+($index+1)+'行工作安排'" @update:model-value="patch(row.id,{title:$event})" /><span v-else class="plan-text">{{ row.title || '—' }}</span></template></el-table-column>
   <el-table-column label="执行日期（选填）" width="165"><template #default="{row,$index}"><el-date-picker placeholder="选择日期" style="width:100%" v-if="editable" :model-value="row.date" :disabled="!!row.end" type="date" value-format="YYYY-MM-DD" clearable :aria-label="section+'第'+($index+1)+'行预计日期'" @update:model-value="patch(row.id,{date:$event||''})" /><span v-else :class="{'plan-overdue':overdue(row)>0}">{{ row.date || '未安排' }}</span><div v-if="overdue(row)>0" class="plan-overdue plan-date-hint">逾期 {{ overdue(row) }} 天</div></template></el-table-column>
   <el-table-column v-if="!queue" label="紧急" width="65"><template #default="{row}"><el-checkbox v-if="editable" :model-value="!!row.urgent" aria-label="紧急" @update:model-value="patch(row.id,{urgent:!!$event})" /><el-tag v-else-if="row.urgent" type="danger" size="small">紧急</el-tag></template></el-table-column>
   <el-table-column label="需要协助" width="95"><template #default="{row}"><el-checkbox v-if="editable" :model-value="!!row.needsHelp" aria-label="需要协助" @update:model-value="patch(row.id,{needsHelp:!!$event})" /><span v-else>{{ row.needsHelp?'需要协助':'—' }}</span></template></el-table-column>
   <el-table-column v-if="editable && queue" label="动作完成" width="90"><template #default="{row}"><el-checkbox :model-value="row.done" :disabled="!originals.some(t=>t.automaticKey===row.id)" aria-label="动作完成" @update:model-value="patch(row.id,{done:!!$event})" /></template></el-table-column>
   <el-table-column v-if="editable && !queue" :label="section==='other'?'完成':'上一步完成'" width="105"><template #default="{row}"><el-checkbox :model-value="row.done" :disabled="!row.sourceIds?.length" :aria-label="row.order+'上一步完成'" @update:model-value="patch(row.id,{done:!!$event})" /></template></el-table-column>
   <el-table-column v-if="editable && !queue" label="结束跟进" width="90"><template #default="{row}"><el-checkbox v-if="row.sourceIds?.length" :model-value="row.end" aria-label="结束跟进" @update:model-value="patch(row.id,{end:!!$event})" /><el-button v-else link type="danger" @click="emit('remove',row.id)">移除</el-button></template></el-table-column>
  </el-table>
  <el-button v-if="editable && !queue" class="add-row" @click="emit('add')">＋ 添加一项安排</el-button>
 </div>
</template>
<script setup lang="ts">
import {computed,ref} from 'vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import {ORDERS,taskOrders,type DraftRow,type WorkTask,type DemoOrder} from '@/composables/workReportDemo'
import {planOverdueDays} from '@/composables/workReportPresentation'
import type {AutomaticRow} from '@/api/work-reports'
const props=withDefaults(defineProps<{catalog?:(DemoOrder & {finished?:number})[];referenceDate?:string;checkFinished?:boolean;section:'sample'|'bulk'|'other';drafts:DraftRow[];originals:WorkTask[];error:string;editable?:boolean;queue?:boolean;queueRows?:AutomaticRow[]}>(),{catalog:()=>ORDERS,referenceDate:'',checkFinished:false,editable:true,queue:false,queueRows:()=>[]})
const reportCellStyle=({column}:{column:{columnKey?:string}})=>({background:props.editable&&(column.columnKey==='order'||column.columnKey==='status')?'var(--color-bg)':'var(--color-card)',padding:props.editable?(column.columnKey?'0 8px':undefined):'4px 8px'})
const overdue=(row:DraftRow)=>row.done||row.end?0:planOverdueDays(row.date,props.referenceDate)
const finishedOrders=(row:DraftRow)=>props.checkFinished&&!props.queue?taskOrders(row).filter(no=>ordersByNo.value.get(no)?.finished===1):[]
const selected=ref<DraftRow[]>([]),editingOrderId=ref('')
const emit=defineEmits<{(event:'update',id:string,patch:Partial<DraftRow>):void;(event:'add'):void;(event:'remove',id:string):void;(event:'merge',ids:string[]):void;(event:'split',id:string):void}>()
const patch=(id:string,value:Partial<DraftRow>)=>emit('update',id,value)
const orderOptions=computed(()=>props.catalog.filter(o=>o.orderType===props.section).map(o=>({value:o.no,label:o.no+' · '+o.sku+' · '+o.customer})))
const ordersByNo=computed(()=>new Map(props.catalog.map(o=>[o.no,o])))
const queuesByKey=computed(()=>new Map(props.queueRows.map(r=>[r.planKey,r])))
const queueInfo=(row:DraftRow)=>queuesByKey.value.get(row.id)
const info=(row:DraftRow,no:string)=>props.queue?{...ordersByNo.value.get(no),...queueInfo(row)}:ordersByNo.value.get(no)
</script>
<style scoped>
.plan-overdue {color:var(--el-color-danger)}
.manual-status {display:flex;align-items:center;flex-wrap:wrap;gap:var(--space-xs)}
.plan-warning {flex-shrink:0;font-size:var(--font-size-caption)}
.plan-date-hint {font-size:var(--font-size-caption)}
.plan-table {width:100%;min-width:0}
.order-thumb {flex-shrink:0}
.report-action-input {height:100%;display:flex;flex-direction:column}
.plan-text {display:block;padding:4px 8px;text-align:left}
.status-copy {text-align:left}
.order-copy {min-width:0;flex:1;text-align:left}
.order-customer {overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.order-meta {color:var(--color-text-muted);font-size:var(--font-size-caption)}
.order-line {display:flex;gap:var(--space-xs);align-items:center;line-height:1.4}
.order-line + .order-line {margin-top:4px}
.queue-meta {display:flex;justify-content:flex-start;flex-wrap:wrap;column-gap:var(--space-xs)}
.merge-toolbar {display:flex;gap:var(--space-sm);align-items:center;margin-bottom:var(--space-xs)}
.add-row {margin-top:var(--space-sm)}
</style>

<style>
/* The table cell owns the editing area; stretch the public cell content wrapper. */
.plan-table-editing td.report-action-cell .cell {height:100%;display:flex;align-items:stretch}
</style>
