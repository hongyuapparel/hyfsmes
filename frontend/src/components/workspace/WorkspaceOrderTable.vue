<template>
  <div class="workspace-order-table">
    <div class="table-toolbar">
      <span class="section-title">待跟进订单</span>
      <el-button size="small" :icon="Plus" @click="showAddTask = true">手动任务</el-button>
    </div>

    <el-table
      v-loading="loading"
      :data="tableRows"
      size="small"
      border
      style="width: 100%"
    >
      <el-table-column label="订单号" min-width="120">
        <template #header>
          <div class="col-header">
            <span>订单号</span>
            <el-input
              v-model="filters.orderNo"
              size="small"
              placeholder="搜索"
              clearable
              @input="emit('filterChange')"
              @clear="emit('filterChange')"
            />
          </div>
        </template>
        <template #default="{ row }">
          <template v-if="row.isManual">
            <el-tag size="small" type="info">手动</el-tag>
          </template>
          <template v-else>
            <el-link type="primary" @click="emit('orderClick', row.orderId)">{{ row.orderNo }}</el-link>
          </template>
        </template>
      </el-table-column>

      <el-table-column label="SKU" min-width="120">
        <template #header>
          <div class="col-header">
            <span>SKU</span>
            <el-input
              v-model="filters.skuCode"
              size="small"
              placeholder="搜索"
              clearable
              @input="emit('filterChange')"
              @clear="emit('filterChange')"
            />
          </div>
        </template>
        <template #default="{ row }">{{ row.isManual ? row.title : row.skuCode }}</template>
      </el-table-column>

      <el-table-column label="类型" width="90">
        <template #header>
          <div class="col-header"><span>类型</span></div>
        </template>
        <template #default="{ row }">{{ row.isManual ? '—' : (row.orderTypeName || '—') }}</template>
      </el-table-column>

      <el-table-column label="业务员" width="100">
        <template #header>
          <div class="col-header">
            <span>业务员</span>
            <el-input
              v-model="filters.salesperson"
              size="small"
              placeholder="搜索"
              clearable
              @input="emit('filterChange')"
              @clear="emit('filterChange')"
            />
          </div>
        </template>
        <template #default="{ row }">{{ row.isManual ? '—' : row.salesperson }}</template>
      </el-table-column>

      <el-table-column label="交货期" width="110" sortable>
        <template #default="{ row }">
          <span :class="dueDateClass(row.customerDueDate)">
            {{ row.isManual ? '—' : (row.customerDueDate ? row.customerDueDate.slice(0, 10) : '—') }}
          </span>
        </template>
      </el-table-column>

      <el-table-column label="下次跟进时间" width="148">
        <template #default="{ row }">
          <el-date-picker
            :model-value="row.nextFollowDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="点击设置"
            size="small"
            clearable
            style="width: 130px"
            :class="followDateClass(row.nextFollowDate)"
            @change="(v: string | null) => onFollowDateChange(row, v)"
          />
        </template>
      </el-table-column>

      <el-table-column label="跟进内容" min-width="160">
        <template #default="{ row }">
          <el-input
            :model-value="row.nextAction"
            size="small"
            placeholder="点击填写"
            clearable
            @change="(v: string) => onFollowActionChange(row, v || null)"
            @clear="onFollowActionChange(row, null)"
          />
        </template>
      </el-table-column>

      <el-table-column v-if="!readonly" label="" width="50">
        <template #default="{ row }">
          <el-button
            v-if="row.isManual"
            text
            type="danger"
            size="small"
            :icon="Delete"
            @click="emit('removeManual', row)"
          />
        </template>
      </el-table-column>
    </el-table>

    <div class="table-footer">
      <el-pagination
        v-if="total > pageSize"
        small
        layout="total, prev, pager, next"
        :total="total"
        :page-size="pageSize"
        :current-page="page"
        @current-change="emit('pageChange', $event)"
      />
    </div>

    <el-dialog v-model="showAddTask" title="新增手动任务" width="360px" :append-to-body="true">
      <el-form label-width="80px">
        <el-form-item label="任务描述">
          <el-input v-model="newTaskTitle" placeholder="如：样品看样、见客户等" maxlength="100" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddTask = false">取消</el-button>
        <el-button type="primary" @click="submitAddTask">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import type { WorkspaceFollowOrder, WorkspaceManualTask } from '@/api/workspace'

interface TableRow {
  isManual: false
  orderId: number
  orderNo: string
  skuCode: string
  orderTypeName: string
  salesperson: string
  customerDueDate: string | null
  nextFollowDate: string | null
  nextAction: string | null
}
interface ManualRow {
  isManual: true
  taskId: number
  title: string
  customerDueDate: null
  nextFollowDate: string | null
  nextAction: string | null
}

const props = defineProps<{
  orders: WorkspaceFollowOrder[]
  manualTasks: WorkspaceManualTask[]
  total: number
  page: number
  pageSize: number
  loading: boolean
  readonly?: boolean
  filters: { orderNo: string; skuCode: string; salesperson: string }
}>()

const emit = defineEmits<{
  filterChange: []
  pageChange: [page: number]
  orderClick: [orderId: number]
  saveFollowDate: [order: WorkspaceFollowOrder, date: string | null]
  saveFollowAction: [order: WorkspaceFollowOrder, action: string | null]
  saveManualDate: [task: WorkspaceManualTask, date: string | null]
  saveManualNote: [task: WorkspaceManualTask, note: string | null]
  removeManual: [task: WorkspaceManualTask]
  addManual: [title: string]
}>()

const showAddTask = ref(false)
const newTaskTitle = ref('')

const tableRows = computed<(TableRow | ManualRow)[]>(() => {
  const orderRows: TableRow[] = props.orders.map((o) => ({
    isManual: false,
    orderId: o.id,
    orderNo: o.orderNo,
    skuCode: o.skuCode,
    orderTypeName: o.orderTypeName,
    salesperson: o.salesperson,
    customerDueDate: o.customerDueDate,
    nextFollowDate: o.followPlan?.nextFollowDate ?? null,
    nextAction: o.followPlan?.nextAction ?? null,
  }))
  const manualRows: ManualRow[] = props.manualTasks.map((t) => ({
    isManual: true,
    taskId: t.id,
    title: t.title,
    customerDueDate: null,
    nextFollowDate: t.nextFollowDate,
    nextAction: t.note,
  }))
  return [...orderRows, ...manualRows]
})

function dueDateClass(date: string | null): string {
  if (!date) return ''
  const diff = new Date(date).getTime() - Date.now()
  if (diff < 0) return 'date-overdue'
  if (diff < 3 * 86400000) return 'date-warn'
  return ''
}

function followDateClass(date: string | null): string {
  if (!date) return ''
  const diff = new Date(date).getTime() - Date.now()
  if (diff < 86400000) return 'follow-urgent'
  if (diff < 3 * 86400000) return 'follow-warn'
  return ''
}

function onFollowDateChange(row: TableRow | ManualRow, v: string | null) {
  if (row.isManual) {
    const task = props.manualTasks.find((t) => t.id === row.taskId)
    if (task) emit('saveManualDate', task, v)
  } else {
    const order = props.orders.find((o) => o.id === row.orderId)
    if (order) emit('saveFollowDate', order, v)
  }
}

function onFollowActionChange(row: TableRow | ManualRow, v: string | null) {
  if (row.isManual) {
    const task = props.manualTasks.find((t) => t.id === row.taskId)
    if (task) emit('saveManualNote', task, v)
  } else {
    const order = props.orders.find((o) => o.id === row.orderId)
    if (order) emit('saveFollowAction', order, v)
  }
}

function submitAddTask() {
  if (!newTaskTitle.value.trim()) return
  emit('addManual', newTaskTitle.value.trim())
  newTaskTitle.value = ''
  showAddTask.value = false
}
</script>

<style scoped>
.workspace-order-table { display: flex; flex-direction: column; gap: 10px; }
.table-toolbar { display: flex; align-items: center; justify-content: space-between; }
.section-title { font-size: var(--font-size-subtitle); font-weight: 600; color: var(--color-text-primary); }
.col-header { display: flex; flex-direction: column; gap: 4px; }
.date-overdue { color: var(--el-color-danger); font-weight: 500; }
.date-warn { color: var(--el-color-warning); font-weight: 500; }
.table-footer { display: flex; justify-content: flex-end; padding-top: 4px; }
:deep(.follow-urgent .el-input__wrapper) { box-shadow: 0 0 0 1px var(--el-color-danger) inset; }
:deep(.follow-warn .el-input__wrapper) { box-shadow: 0 0 0 1px var(--el-color-warning) inset; }
</style>
