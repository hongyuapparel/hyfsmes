<template>
  <div class="page-card page-card--fill inventory-packing-page">
    <el-form class="filter-bar" @submit.prevent>
      <el-input
        v-model="filter.customerName"
        placeholder="客户"
        clearable
        class="filter-bar-item"
        :style="getTextFilterStyle('客户：', filter.customerName, customerLabelVisible)"
        :input-style="getFilterInputStyle(filter.customerName)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span v-if="filter.customerName && customerLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">客户：</span>
        </template>
      </el-input>
      <el-input
        v-model="filter.keyword"
        placeholder="SKU编号"
        clearable
        class="filter-bar-item"
        :style="getSkuCodeFilterStyle(filter.keyword, true)"
        :input-style="getFilterInputStyle(filter.keyword)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span v-if="filter.keyword" :style="{ color: ACTIVE_FILTER_COLOR }">SKU编号：</span>
        </template>
      </el-input>
      <el-select
        v-model="filter.status"
        placeholder="状态"
        clearable
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(filter.status ? `状态：${statusLabel(filter.status)}` : '', '状态', 42)"
        @change="onSearch(true)"
      >
        <template #label="{ label }">
          <span v-if="filter.status">状态：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option label="草稿" value="draft" />
        <el-option label="已发货" value="shipped" />
      </el-select>
      <div
        class="filter-bar-item filter-date-box"
        :class="{ 'is-active': dateRange && dateRange.length === 2 }"
        :style="getFilterRangeStyle(dateRange, '装箱日期')"
      >
        <span v-if="dateRange && dateRange.length === 2" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">装箱日期：</span>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          :range-separator="dateRange && dateRange.length === 2 ? '~' : ''"
          start-placeholder="装箱日期"
          end-placeholder=""
          value-format="YYYY-MM-DD"
          :shortcuts="rangeShortcuts"
          unlink-panels
          clearable
          :class="['filter-range', { 'range-single': !(dateRange && dateRange.length === 2) }]"
          @change="onSearch(true)"
        />
      </div>
      <div class="filter-bar-actions">
        <el-button type="primary" @click="onSearch(true)">搜索</el-button>
        <el-button @click="onReset">清空</el-button>
        <el-button type="primary" @click="goEdit(null)">新建装箱单</el-button>
      </div>
    </el-form>

    <div ref="tableShellRef" class="list-page-table-shell">
      <el-table
        v-loading="loading"
        :data="list"
        border
        stripe
        class="packing-table"
        :height="tableHeight"
        :row-style="compactRowStyle"
        :cell-style="compactCellStyle"
        :header-cell-style="compactHeaderCellStyle"
      >
        <el-table-column prop="code" label="单号" min-width="140" show-overflow-tooltip align="center" header-align="center" />
        <el-table-column label="小满单号" min-width="120" show-overflow-tooltip align="center" header-align="center">
          <template #default="{ row }">
            <a
              v-if="row.xiaomanOrderId"
              :href="`https://crm.xiaoman.cn/order/detail/${row.xiaomanOrderId}`"
              target="_blank"
              rel="noopener"
              class="xiaoman-cell-link"
            >{{ row.xiaomanOrderNo || row.xiaomanOrderId }}</a>
            <span v-else>{{ row.xiaomanOrderNo || '-' }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="150" show-overflow-tooltip align="center" header-align="center" />
        <el-table-column prop="serviceManager" label="业务员" min-width="100" show-overflow-tooltip align="center" header-align="center" />
        <el-table-column label="款号" min-width="140" show-overflow-tooltip align="center" header-align="center">
          <template #default="{ row }">{{ styleSummary(row) }}</template>
        </el-table-column>
        <el-table-column label="箱数" width="80" align="center" header-align="center">
          <template #default="{ row }">{{ formatDisplayNumber(row.boxCount) }}</template>
        </el-table-column>
        <el-table-column label="件数" width="90" align="center" header-align="center">
          <template #default="{ row }">{{ formatDisplayNumber(row.totalQty) }}</template>
        </el-table-column>
        <el-table-column label="总重(kg)" width="100" align="center" header-align="center">
          <template #default="{ row }">{{ row.totalWeight > 0 ? row.totalWeight : '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90" align="center" header-align="center">
          <template #default="{ row }">
            <el-tag :type="row.status === 'shipped' ? 'success' : 'info'" size="small">{{ statusLabel(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="packDate" label="装箱日期" width="110" align="center" header-align="center">
          <template #default="{ row }">{{ row.packDate || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" width="248" align="center" header-align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="goEdit(row)">{{ row.status === 'draft' ? '编辑' : '查看' }}</el-button>
            <el-button link type="primary" size="small" @click="openDoc(row)">客户单</el-button>
            <el-button link type="info" size="small" @click="openLabels(row)">箱贴</el-button>
            <el-button link type="info" size="small" @click="exportExcel(row)">导出</el-button>
            <el-button v-if="row.status === 'draft'" link type="danger" size="small" @click="onDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <AppPaginationBar
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      @current-change="load"
      @size-change="onPageSizeChange"
    />
  </div>
</template>

<script setup lang="ts">
import { onActivated, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getTextFilterStyle,
  getSkuCodeFilterStyle,
  getFilterRangeStyle,
  getAdaptiveSelectStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDisplayNumber } from '@/utils/display-number'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { deletePackingList, getPackingListDetail, getPackingLists, type PackingListRow } from '@/api/packing-lists'
import { exportPackingListExcel } from '@/utils/packing-export'
import AppPaginationBar from '@/components/AppPaginationBar.vue'

const { compactHeaderCellStyle, compactCellStyle, compactRowStyle } = useCompactTableStyle()
const router = useRouter()

const filter = reactive<{ customerName: string; status: string; keyword: string }>({ customerName: '', status: '', keyword: '' })
const dateRange = ref<[string, string] | null>(null)
const customerLabelVisible = ref(true)
const list = ref<PackingListRow[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const tableShellRef = ref<HTMLElement>()
const tableHeight = ref<number | undefined>(undefined)

let searchTimer: ReturnType<typeof setTimeout> | null = null

function statusLabel(status: string): string {
  return status === 'shipped' ? '已发货' : '草稿'
}

function styleSummary(row: PackingListRow): string {
  if (!row.styleNos.length) return '-'
  const first = row.styleNos[0]
  return row.styleNos.length > 1 ? `${first} 等${row.styleNos.length}款` : first
}

async function load() {
  loading.value = true
  try {
    const res = await getPackingLists({
      customerName: filter.customerName || undefined,
      status: filter.status || undefined,
      keyword: filter.keyword || undefined,
      dateFrom: dateRange.value?.[0] || undefined,
      dateTo: dateRange.value?.[1] || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    list.value = res.data.list
    pagination.total = res.data.total
  } catch (e) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载装箱单失败'))
  } finally {
    loading.value = false
  }
}

function onSearch(resetPage: boolean) {
  if (resetPage) pagination.page = 1
  load()
}

function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => onSearch(true), 400)
}

function onReset() {
  filter.customerName = ''
  filter.status = ''
  filter.keyword = ''
  dateRange.value = null
  onSearch(true)
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function goEdit(row: PackingListRow | null) {
  if (row) router.push(`/inventory/packing/edit/${row.id}`)
  else router.push('/inventory/packing/edit')
}

function openLabels(row: PackingListRow) {
  router.push(`/inventory/packing/edit/${row.id}?action=labels`)
}

function openDoc(row: PackingListRow) {
  router.push(`/inventory/packing/edit/${row.id}?action=doc`)
}

async function exportExcel(row: PackingListRow) {
  try {
    const res = await getPackingListDetail(row.id)
    exportPackingListExcel(res.data)
  } catch (e) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '导出失败'))
  }
}

async function onDelete(row: PackingListRow) {
  try {
    await ElMessageBox.confirm(`确定删除装箱单 ${row.code} 吗？`, '删除确认', { type: 'warning' })
  } catch {
    return
  }
  try {
    await deletePackingList(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '删除失败'))
  }
}

onMounted(load)

// 编辑页保存/发货后返回本页（keep-alive 缓存恢复）需重新拉列表，否则看不到最新结果
let initialActivationDone = false
onActivated(() => {
  if (!initialActivationDone) {
    initialActivationDone = true
    return
  }
  load()
})
</script>

<style scoped>
.inventory-packing-page {
  display: flex;
  flex-direction: column;
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
  overflow: hidden;
}

.inventory-packing-page .packing-table {
  flex: 1;
  min-height: 0;
}

.xiaoman-cell-link {
  color: var(--color-primary);
  text-decoration: none;
}

.xiaoman-cell-link:hover {
  text-decoration: underline;
}
</style>
