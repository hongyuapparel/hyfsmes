<template>
 <div class="plan-table" :class="{'plan-table-editing':editable,'plan-table-other':section==='other'&&!queue}">
  <div v-if="editable && !queue && section !== 'other'" class="merge-toolbar"><el-button :disabled="selected.length < 2" @click="emit('merge',selected.map(r=>r.id));selected=[]">合并安排（{{ selected.length }}）</el-button><span class="order-meta">共同事项可合并填写；部分完成前先拆开订单。</span></div>
  <el-alert v-if="error" :title="error" type="error" :closable="false" />
  <el-table :data="drafts" row-key="id" :class="{'editable-grid':editable}" :max-height="editable?undefined:420" empty-text="暂无待办" @selection-change="selected=$event">
   <el-table-column v-if="editable && !queue && section!=='other'" type="selection" width="42" />
   <el-table-column v-if="queue || section!=='other'" label="订单 / 款式" min-width="200">
    <template #default="{row,$index}">
     <template v-if="editable && !queue && !row.sourceIds?.length">
      <el-select-v2 v-if="editingOrderId===row.id" :model-value="taskOrders(row)" :options="orderOptions" multiple filterable :aria-label="section+'第'+($index+1)+'行订单'" @update:model-value="patch(row.id,{orders:$event,order:$event[0]||''})" />
      <el-button v-else link type="primary" @click="editingOrderId=row.id">{{ row.order?'更改关联订单':'选择订单' }}</el-button>
     </template>
     <div v-for="no in taskOrders(row)" :key="no" class="order-line"><AppImageThumb class="order-thumb" :src="info(row,no)?.imageUrl" variant="compact" /><div class="order-copy"><strong>{{ no }} · {{ info(row,no)?.sku }}</strong><div class="order-meta order-customer" :title="[info(row,no)?.salesperson,info(row,no)?.customer].filter(Boolean).join(' · ')">{{ [info(row,no)?.salesperson,info(row,no)?.customer].filter(Boolean).join(' · ') }}</div></div></div>
     <el-button v-if="editable && !queue && taskOrders(row).length>1" link type="primary" @click="emit('split',row.id)">拆开订单</el-button>
    </template>
   </el-table-column>
   <el-table-column v-if="queue || section!=='other'" label="当前状态 / 事项" min-width="140"><template #default="{row}"><template v-if="queue"><div>{{ queueInfo(row)?.status || queueInfo(row)?.title }}</div><div v-if="queueInfo(row)?.status" class="order-meta">{{ queueInfo(row)?.title }}</div><div class="order-meta">{{ queueInfo(row)?.factory }}</div><div v-if="queueInfo(row)?.quantity!=null" class="order-meta">数量 {{ queueInfo(row)?.quantity }}</div><div class="order-meta">{{ queueInfo(row)?.remark }}</div></template><template v-else>{{ [...new Set(taskOrders(row).map(no=>info(row,no)?.status).filter(Boolean))].join('、') }}</template></template></el-table-column>
   <el-table-column :label="section==='other'&&!queue?'任务 / 协助反馈':'下一步动作（选填）'" min-width="180"><template #default="{row,$index}"><el-input v-if="editable" :model-value="row.title" :disabled="!!row.end" type="textarea" :autosize="{minRows:1,maxRows:4}" maxlength="200" placeholder="填写下一步动作或需要协助的事项" :aria-label="section+'第'+($index+1)+'行工作安排'" @update:model-value="patch(row.id,{title:$event})" /><span v-else>{{ row.title || '—' }}</span></template></el-table-column>
   <el-table-column label="执行日期（选填）" width="145"><template #default="{row,$index}"><el-date-picker v-if="editable" :model-value="row.date" :disabled="!!row.end" type="date" value-format="YYYY-MM-DD" clearable :aria-label="section+'第'+($index+1)+'行预计日期'" @update:model-value="patch(row.id,{date:$event||''})" /><span v-else>{{ row.date || '未安排' }}</span></template></el-table-column>
   <el-table-column v-if="!queue" label="紧急" width="65"><template #default="{row}"><el-checkbox v-if="editable" :model-value="!!row.urgent" aria-label="紧急" @update:model-value="patch(row.id,{urgent:!!$event})" /><el-tag v-else-if="row.urgent" type="danger" size="small">紧急</el-tag></template></el-table-column>
   <el-table-column v-if="!queue && section==='other'" label="需要协助" width="95"><template #default="{row}"><el-checkbox v-if="editable" :model-value="!!row.needsHelp" aria-label="需要协助" @update:model-value="patch(row.id,{needsHelp:!!$event})" /><span v-else>{{ row.needsHelp?'需要协助':'—' }}</span></template></el-table-column>
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
import type {AutomaticRow} from '@/api/work-reports'
const props=withDefaults(defineProps<{catalog?:DemoOrder[];section:'sample'|'bulk'|'other';drafts:DraftRow[];originals:WorkTask[];error:string;editable?:boolean;queue?:boolean;queueRows?:AutomaticRow[]}>(),{catalog:()=>ORDERS,editable:true,queue:false,queueRows:()=>[]})
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
.plan-table {width:100%;max-width:980px;min-width:0}
.plan-table-editing {max-width:1180px}
.plan-table-other {max-width:760px}
.order-thumb {flex-shrink:0}
.order-copy {min-width:0;flex:1;text-align:left}
.order-customer {overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.order-meta {color:var(--color-text-muted);font-size:var(--font-size-caption)}
.order-line,.merge-toolbar {display:flex;gap:var(--space-sm);align-items:center;margin-bottom:var(--space-xs)}
.add-row {margin-top:var(--space-sm)}
</style>
