<template>
  <el-table :max-height="420" :data="tasks" row-key="id" empty-text="暂无事项">
    <el-table-column v-if="!other" label="关联订单 / 款式" min-width="240">
      <template #default="{ row }">
        <el-tag v-if="row.urgent" type="danger" size="small">紧急</el-tag>
        <span v-if="row.section === 'other' && !taskOrders(row).length">其他事项</span>
        <div v-for="no in taskOrders(row)" :key="no" class="order-line"><AppImageThumb :src="getOrder(no)?.imageUrl" variant="compact" empty-text="暂无图片" /><div><strong>{{ no }} · {{ getOrder(no)?.sku }}</strong><div class="order-meta">{{ getOrder(no)?.status }} · {{ getOrder(no)?.salesperson }} · {{ getOrder(no)?.customer }}</div></div></div>
      </template>
    </el-table-column>
    <el-table-column label="工作事项" min-width="190">
      <template #default="{ row }">
        <el-tag v-if="other && row.urgent" type="danger" size="small">紧急</el-tag>
        <el-tag v-if="row.needsHelp" type="warning" size="small">需要协助</el-tag>
        <span :class="{ finished: row.status === 'done' }">{{ row.title }}</span>
        <el-tag v-if="row.status === 'done'" size="small" type="success">已完成</el-tag>
        <div v-if="row.revision" class="order-meta">{{ row.revision }}</div><el-tag v-if="row.status === 'deferred'" size="small" type="info">安排调整</el-tag>
      </template>
    </el-table-column>
    <el-table-column label="预计执行日期" width="135">
      <template #default="{ row }">
        <div :class="{ overdue: row.status === 'todo' && row.date && row.date < referenceDate }">{{ row.date || '未安排' }}</div>
        <small v-if="row.date === referenceDate && row.status === 'todo'" class="today">{{ referenceDate === DEMO_DATE ? '今天' : '当日' }}</small>
        <small v-else-if="row.date && row.date < referenceDate && row.status === 'todo'" class="overdue">逾期未完成</small>
        <small v-if="row.status === 'done'" class="order-meta">完成于 {{ row.completedDate }}</small>
      </template>
    </el-table-column>
    <el-table-column v-if="editable" label="操作" width="135">
      <template #default="{ row }">
        <template v-if="row.status === 'todo'">
          <el-button link type="success" @click="emit('complete', row)">完成</el-button>
        </template>
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup lang="ts">
import AppImageThumb from '@/components/AppImageThumb.vue'
import { DEMO_DATE, ORDERS, taskOrders, type WorkTask, type DemoOrder } from '@/composables/workReportDemo'
const props = withDefaults(defineProps<{ catalog?: DemoOrder[]; tasks: WorkTask[]; editable: boolean; other?: boolean; referenceDate?: string }>(), { referenceDate: DEMO_DATE, catalog: () => ORDERS })
const emit = defineEmits<{ (event: 'complete', task: WorkTask): void }>()
const getOrder = (no: string) => props.catalog.find(o => o.no === no)
</script>
<style scoped>
.order-line { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-xs); }
.order-meta { display: block; color: var(--color-text-muted); font-size: var(--font-size-caption); margin-top: 5px; line-height: 1.6; }
.finished { color: var(--color-text-muted); }
.today { color: var(--color-primary); font-size: var(--font-size-caption); }
.overdue { color: var(--el-color-danger); }
small { font-size: var(--font-size-caption); }
</style>
