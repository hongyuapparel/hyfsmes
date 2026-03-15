<template>
  <div class="page-card order-sla-report-page">
    <p class="report-desc">
      按订单状态停留时段统计实际耗时与配置的标准时长，超出标准时长的记为超期，可用于绩效考核。数据自启用「订单时效配置」并产生状态流转后开始积累。
    </p>

    <div class="filter-bar">
      <el-date-picker
        v-model="filter.startDate"
        type="date"
        placeholder="进入时间起"
        value-format="YYYY-MM-DD"
        clearable
        size="default"
        class="filter-item"
      />
      <el-date-picker
        v-model="filter.endDate"
        type="date"
        placeholder="进入时间止"
        value-format="YYYY-MM-DD"
        clearable
        size="default"
        class="filter-item"
      />
      <el-select
        v-model="filter.statusId"
        placeholder="状态"
        clearable
        size="default"
        class="filter-item"
        style="width: 140px"
      >
        <el-option
          v-for="s in statusOptions"
          :key="s.id"
          :label="s.label"
          :value="s.id"
        />
      </el-select>
      <el-button type="primary" size="default" @click="loadReport">查询</el-button>
    </div>

    <div v-if="summary" class="summary-bar">
      <span>共 <strong>{{ summary.total }}</strong> 个停留段</span>
      <span class="summary-overdue">超期 <strong>{{ summary.overdue }}</strong> 个</span>
    </div>

    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      size="small"
      class="report-table"
    >
      <el-table-column prop="orderNo" label="订单号" width="140" show-overflow-tooltip />
      <el-table-column prop="statusLabel" label="状态" width="100" />
      <el-table-column label="进入时间" width="172" align="center">
        <template #default="{ row }">
          {{ formatDateTime(row.enteredAt) }}
        </template>
      </el-table-column>
      <el-table-column label="离开时间" width="172" align="center">
        <template #default="{ row }">
          {{ row.leftAt ? formatDateTime(row.leftAt) : '当前停留中' }}
        </template>
      </el-table-column>
      <el-table-column label="停留时长(小时)" width="120" align="right">
        <template #default="{ row }">
          {{ row.durationHours }}
        </template>
      </el-table-column>
      <el-table-column label="标准时长(小时)" width="120" align="right">
        <template #default="{ row }">
          {{ row.limitHours != null ? row.limitHours : '-' }}
        </template>
      </el-table-column>
      <el-table-column label="是否超期" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.isOverdue" type="danger" size="small">超期</el-tag>
          <el-tag v-else type="success" size="small">未超期</el-tag>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getOrderSlaReport, getOrderStatuses, type OrderSlaReportRow } from '@/api/order-status-config'
import type { OrderStatusItem } from '@/api/order-status-config'

const loading = ref(false)
const list = ref<OrderSlaReportRow[]>([])
const summary = ref<{ total: number; overdue: number } | null>(null)
const statusOptions = ref<OrderStatusItem[]>([])

const filter = ref<{ startDate?: string; endDate?: string; statusId?: number }>({})

function formatDateTime(iso: string) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }).replace(' ', ' ')
}

async function loadStatusOptions() {
  try {
    const res = await getOrderStatuses()
    statusOptions.value = res.data ?? []
  } catch {
    statusOptions.value = []
  }
}

async function loadReport() {
  loading.value = true
  try {
    const res = await getOrderSlaReport({
      start_date: filter.value.startDate,
      end_date: filter.value.endDate,
      status_id: filter.value.statusId,
    })
    list.value = res.data?.list ?? []
    summary.value = res.data?.summary ?? null
  } catch {
    list.value = []
    summary.value = null
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await loadStatusOptions()
  await loadReport()
})
</script>

<style scoped>
.report-desc {
  font-size: var(--el-font-size-small);
  color: var(--el-text-color-secondary);
  margin: 0 0 var(--el-component-spacing);
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--el-component-spacing);
  margin-bottom: var(--el-component-spacing);
}

.filter-item {
  width: 160px;
}

.summary-bar {
  margin-bottom: var(--el-component-spacing);
  font-size: var(--el-font-size-small);
}

.summary-overdue {
  margin-left: 16px;
  color: var(--el-color-danger);
}

.report-table {
  margin-top: 8px;
}
</style>
