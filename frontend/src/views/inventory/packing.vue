<template>
  <div class="page-card page-card--fill inventory-packing-page">
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="filter.status" @change="onStatusTabChange">
          <el-radio-button
            v-for="tab in STATUS_TABS"
            :key="tab.value"
            :value="tab.value"
          >
            {{ tab.label }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <el-form class="filter-bar has-filter-collapse" @submit.prevent>
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
      <FilterCollapseToggle v-model:collapsed="collapsed" :active-count="activeFilterCount" />
      <div class="filter-rest" v-show="!isMobile || !collapsed">
      <el-input
        v-model="filter.xiaomanOrderNo"
        placeholder="小满单号"
        clearable
        class="filter-bar-item"
        :style="getTextFilterStyle('小满单号：', filter.xiaomanOrderNo, true)"
        :input-style="getFilterInputStyle(filter.xiaomanOrderNo)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span v-if="filter.xiaomanOrderNo" :style="{ color: ACTIVE_FILTER_COLOR }">小满单号：</span>
        </template>
      </el-input>
      <el-select
        v-model="filter.serviceManager"
        placeholder="业务员"
        filterable
        clearable
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(filter.serviceManager ? `业务员：${filter.serviceManager}` : '', '业务员', 42)"
        @change="onSearch(true)"
      >
        <template #label="{ label }">
          <span v-if="filter.serviceManager">业务员：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option v-for="s in salespersonOptions" :key="s" :label="s" :value="s" />
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
      </div>
      <div class="filter-bar-actions">
        <el-button type="primary" @click="onSearch(true)">搜索</el-button>
        <el-button @click="onReset">清空</el-button>
        <el-button type="primary" @click="goEdit(null)">新建装箱单</el-button>
      </div>
    </el-form>

    <div v-if="selectedRows.length" class="packing-batch-bar">
      <span class="packing-batch-info">已选 {{ selectedRows.length }} 项</span>
      <el-button size="small" @click="batchExport">批量导出</el-button>
      <el-button size="small" type="danger" @click="batchDelete">批量删除</el-button>
      <el-button size="small" text @click="clearSelection">取消</el-button>
    </div>

    <div ref="tableShellRef" class="list-page-table-shell">
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="list"
        border
        stripe
        class="packing-table"
        :height="tableHeight"
        :row-style="compactRowStyle"
        :cell-style="compactCellStyle"
        :header-cell-style="compactHeaderCellStyle"
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="44" align="center" header-align="center" />
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
        <el-table-column label="客户" min-width="150" show-overflow-tooltip align="center" header-align="center">
          <template #default="{ row }">{{ displayCustomer(row.customerName) }}</template>
        </el-table-column>
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
        <el-table-column prop="packDate" label="装箱日期" width="116" show-overflow-tooltip align="center" header-align="center">
          <template #default="{ row }">{{ row.packDate || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作" :width="isMobile ? 56 : 180" align="center" header-align="center" fixed="right">
          <template #default="{ row }">
            <TableRowActions
              :inline-limit="3"
              :actions="[
                { key: 'edit', label: row.status === 'draft' ? '编辑' : '查看', onClick: () => goEdit(row), type: 'primary' },
                { key: 'doc', label: '客户单', onClick: () => openDoc(row), type: 'primary' },
                { key: 'labels', label: '箱贴', onClick: () => openLabels(row), type: 'info' },
                { key: 'copy', label: '拆分', onClick: () => openCopyDialog(row), type: 'warning', show: row.status === 'draft' },
                { key: 'log', label: '记录', onClick: () => openLog(row), type: 'info' },
              ]"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <AppPaginationBar
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :total-quantity="pageBoxCount"
      summary-label="本页箱数"
      unit="箱"
      :secondary-quantity="pageTotalQty"
      secondary-label="本页件数"
      secondary-unit="件"
      @current-change="load"
      @size-change="onPageSizeChange"
    />

    <PackingListLogDrawer
      v-model:visible="logDrawer.visible"
      :title="logDrawer.title"
      :loading="logDrawer.loading"
      :logs="logDrawer.logs"
    />

    <AppDialog v-model="copyDialog.visible" title="拆分/复制装箱单" width="480px">
      <el-form label-width="84px" @submit.prevent>
        <el-form-item label="源单">
          <span>{{ copyDialog.source?.code || '-' }}</span>
        </el-form-item>
        <el-form-item label="箱号">
          <div class="copy-range">
            <el-input
              v-model="copyDialog.boxSeqText"
              placeholder="例：1-5 或 1,3,5"
              clearable
            />
            <span class="copy-range-count">共 {{ copyRangeCount }} 箱</span>
          </div>
        </el-form-item>
        <el-form-item label="新单备注">
          <el-input
            v-model="copyDialog.remark"
            type="textarea"
            :rows="3"
            maxlength="1000"
            show-word-limit
            placeholder="空运/海运/货代地址等，留空沿用源单备注"
          />
        </el-form-item>
      </el-form>
      <div class="copy-dialog-note">支持连续范围和跳箱，例如 1-5、1,3,5、1-3,6；新草稿会按原箱号顺序从 1 重新编号，源单不会自动删除。</div>
      <template #footer>
        <el-button :disabled="copyDialog.submitting" @click="copyDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="copyDialog.submitting" @click="submitCopyToDraft">生成新草稿</el-button>
      </template>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onActivated, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
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
import { usePackingListActions } from '@/composables/usePackingListActions'
import { formatDisplayNumber } from '@/utils/display-number'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getSalespeople } from '@/api/customers'
import { getPackingLists, type PackingListRow } from '@/api/packing-lists'
import AppDialog from '@/components/AppDialog.vue'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import PackingListLogDrawer from '@/components/inventory/PackingListLogDrawer.vue'
import FilterCollapseToggle from '@/components/common/FilterCollapseToggle.vue'
import TableRowActions from '@/components/common/TableRowActions.vue'
import { useFilterCollapse } from '@/composables/useFilterCollapse'
import { usePackingListCopyToDraft } from '@/composables/usePackingListCopyToDraft'

const STATUS_TABS = [
  { label: '全部', value: '' },
  { label: '草稿', value: 'draft' },
  { label: '已发货', value: 'shipped' },
] as const

const { compactHeaderCellStyle, compactCellStyle, compactRowStyle } = useCompactTableStyle()
const router = useRouter()

const filter = reactive<{ customerName: string; status: string; keyword: string; xiaomanOrderNo: string; serviceManager: string }>({ customerName: '', status: '', keyword: '', xiaomanOrderNo: '', serviceManager: '' })
const salespersonOptions = ref<string[]>([])
const dateRange = ref<[string, string] | null>(null)
const customerLabelVisible = ref(true)
const { collapsed, isMobile } = useFilterCollapse('packing')
const activeFilterCount = computed(() => {
  let n = 0
  if (filter.customerName) n++
  if (filter.keyword) n++
  if (filter.xiaomanOrderNo) n++
  if (filter.serviceManager) n++
  if (dateRange.value) n++
  return n
})
const list = ref<PackingListRow[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const tableShellRef = ref<HTMLElement>()
const tableHeight = ref<number | undefined>(undefined)

const { tableRef, selectedRows, onSelectionChange, clearSelection, batchExport, batchDelete, logDrawer, openLog } =
  usePackingListActions(load)
const { copyDialog, copyRangeCount, openCopyDialog, submitCopyToDraft } = usePackingListCopyToDraft(load)

let searchTimer: ReturnType<typeof setTimeout> | null = null

const pageBoxCount = computed(() => list.value.reduce((sum, row) => sum + (Number(row.boxCount) || 0), 0))
const pageTotalQty = computed(() => list.value.reduce((sum, row) => sum + (Number(row.totalQty) || 0), 0))

function statusLabel(status: string): string {
  return status === 'shipped' ? '已发货' : '草稿'
}

/** 客户名为空或纯数字（如"1"等无效占位）时列表显示"-"，不改数据 */
function displayCustomer(name: string): string {
  const t = (name || '').trim()
  return !t || /^\d+$/.test(t) ? '-' : t
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
      xiaomanOrderNo: filter.xiaomanOrderNo || undefined,
      serviceManager: filter.serviceManager || undefined,
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

function onStatusTabChange() {
  onSearch(true)
}

function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => onSearch(true), 400)
}

function onReset() {
  filter.customerName = ''
  filter.status = ''
  filter.keyword = ''
  filter.xiaomanOrderNo = ''
  filter.serviceManager = ''
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

async function loadSalespersonOptions() {
  try {
    const res = await getSalespeople()
    salespersonOptions.value = res.data
  } catch {
    salespersonOptions.value = []
  }
}

onMounted(() => {
  loadSalespersonOptions()
  load()
})

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

.status-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
  flex-shrink: 0;
}

.status-tabs-left {
  flex: 1;
  min-width: 0;
}

.packing-batch-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: var(--space-sm);
}

.packing-batch-info {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
}

/* 本表无图片列，单元格会塌得很矮；按紧凑表设计行高 52px 托底（compactRowStyle 的 minHeight 作用在 tr 上不生效），
   与有图的库存表（约 51px）观感统一 */
.inventory-packing-page .packing-table :deep(.el-table__body .el-table__cell) {
  height: 52px;
}

.xiaoman-cell-link {
  color: var(--color-primary);
  text-decoration: none;
}

.xiaoman-cell-link:hover {
  text-decoration: underline;
}

.copy-range {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  flex-wrap: wrap;
}

.copy-range :deep(.el-input) {
  width: 220px;
}

.copy-range-count,
.copy-dialog-note {
  color: var(--color-text-secondary);
  font-size: var(--font-size-caption);
}

.copy-dialog-note {
  margin: 0 0 var(--space-sm) 84px;
}
</style>
