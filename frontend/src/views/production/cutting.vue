<template>
  <div class="page-card cutting-page">
    <!-- Tab：全部 / 等待裁床 / 裁床完成 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button
            v-for="tab in CUTTING_TABS"
            :key="tab.value"
            :label="tab.value"
          >
            {{ getTabLabel(tab) }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 筛选区：与订单列表同一设计（订单号、SKU） -->
    <div class="filter-bar">
      <el-input
        v-model="filter.orderNo"
        placeholder="订单号"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getOrderNoFilterStyle(filter.orderNo, orderNoLabelVisible)"
        :input-style="getFilterInputStyle(filter.orderNo)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.orderNo && orderNoLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            订单号：
          </span>
        </template>
      </el-input>
      <el-input
        v-model="filter.skuCode"
        placeholder="SKU"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getSkuCodeFilterStyle(filter.skuCode, skuCodeLabelVisible)"
        :input-style="getFilterInputStyle(filter.skuCode)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.skuCode && skuCodeLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            SKU：
          </span>
        </template>
      </el-input>
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button size="large" :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button
          v-if="hasSelection && canRegisterSelection"
          type="primary"
          size="large"
          @click="openRegisterDialog"
        >
          裁床登记
        </el-button>
      </div>
    </div>

    <!-- 待裁床订单列表 -->
    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      class="cutting-table"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column prop="arrivedAt" label="到裁床时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.arrivedAt) }}</template>
      </el-table-column>
      <el-table-column prop="completedAt" label="完成时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.completedAt) }}</template>
      </el-table-column>
      <el-table-column prop="orderNo" label="订单号" min-width="100" show-overflow-tooltip />
      <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
      <el-table-column label="图片" width="72" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.imageUrl"
            :src="row.imageUrl"
            fit="cover"
            class="table-thumb"
            :preview-src-list="[row.imageUrl]"
          />
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="订单数量" width="96" align="right">
        <template #default="{ row }">
          <el-popover
            placement="top-start"
            trigger="hover"
            :width="Math.max(320, (sizeBreakdownCache[row.orderId]?.headers?.length ?? 1) * 72)"
            :show-arrow="true"
            @show="onShowQtyPopover(row)"
          >
            <template #reference>
              <span class="qty-trigger">{{ row.quantity }}</span>
            </template>
            <div class="qty-popover">
              <div class="qty-popover-title">数量追踪</div>
              <div v-if="sizePopoverLoadingId === row.orderId" class="qty-popover-loading">加载中...</div>
              <div v-else>
                <table v-if="sizeBreakdownCache[row.orderId]?.rows?.length" class="qty-popover-table">
                  <thead>
                    <tr>
                      <th class="qty-header">尺码</th>
                      <th
                        v-for="(h, hIdx) in sizeBreakdownCache[row.orderId].headers"
                        :key="hIdx"
                        class="qty-header"
                      >
                        {{ h }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="r in sizeBreakdownCache[row.orderId].rows"
                      :key="r.label"
                    >
                      <td class="qty-label">{{ r.label }}</td>
                      <td
                        v-for="(v, vIdx) in r.values"
                        :key="vIdx"
                        class="qty-value"
                      >
                        {{ v != null ? v : '-' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="qty-popover-empty">暂无尺码明细</div>
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column label="实裁数量" width="96" align="right">
        <template #default="{ row }">
          <el-popover
            placement="top-start"
            trigger="hover"
            :width="Math.max(320, (sizeBreakdownCache[row.orderId]?.headers?.length ?? 1) * 72)"
            :show-arrow="true"
            @show="onShowQtyPopover(row)"
          >
            <template #reference>
              <span class="qty-trigger">{{ row.actualCutTotal != null ? row.actualCutTotal : '-' }}</span>
            </template>
            <div class="qty-popover">
              <div class="qty-popover-title">数量追踪</div>
              <div v-if="sizePopoverLoadingId === row.orderId" class="qty-popover-loading">加载中...</div>
              <div v-else>
                <table v-if="sizeBreakdownCache[row.orderId]?.rows?.length" class="qty-popover-table">
                  <thead>
                    <tr>
                      <th class="qty-header">尺码</th>
                      <th
                        v-for="(h, hIdx) in sizeBreakdownCache[row.orderId].headers"
                        :key="hIdx"
                        class="qty-header"
                      >
                        {{ h }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="r in sizeBreakdownCache[row.orderId].rows"
                      :key="r.label"
                    >
                      <td class="qty-label">{{ r.label }}</td>
                      <td
                        v-for="(v, vIdx) in r.values"
                        :key="vIdx"
                        class="qty-value"
                      >
                        {{ v != null ? v : '-' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="qty-popover-empty">暂无尺码明细</div>
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column prop="timeRating" label="时效判定" width="90" align="center" />
    </el-table>

    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[20, 40, 60]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="onPageSizeChange"
      />
    </div>

    <!-- 裁床登记弹窗：填写实际裁剪数量 + 裁剪成本 -->
    <el-dialog
      v-model="registerDialog.visible"
      title="裁床登记"
      width="720"
      destroy-on-close
      @close="resetRegisterForm"
    >
      <template v-if="registerDialog.row">
        <div class="register-brief">
          <div>订单号：{{ registerDialog.row.orderNo }}</div>
          <div>SKU：{{ registerDialog.row.skuCode }}</div>
          <div>订单数量：{{ registerDialog.row.quantity }}</div>
        </div>
        <p class="register-hint">请填写实际裁剪数量明细（与订单 B 区颜色尺码对应），并填写裁剪成本。</p>
        <el-table :data="registerForm.actualCutRows" border class="cut-grid" size="small">
          <el-table-column prop="colorName" label="颜色" width="100" />
          <el-table-column
            v-for="(header, idx) in registerForm.colorSizeHeaders"
            :key="idx"
            :label="header"
            width="80"
            align="center"
          >
            <template #default="{ row }">
              <el-input-number
                v-model="row.quantities[idx]"
                :min="0"
                :precision="0"
                controls-position="right"
                size="small"
                style="width: 100%"
              />
            </template>
          </el-table-column>
          <el-table-column prop="remark" label="备注" min-width="80">
            <template #default="{ row }">
              <el-input v-model="row.remark" size="small" placeholder="备注" clearable />
            </template>
          </el-table-column>
        </el-table>
        <el-form :model="registerForm" label-width="90px" class="cut-cost-form">
          <el-form-item label="裁剪成本（元）">
            <el-input v-model="registerForm.cuttingCost" placeholder="元" clearable style="width: 160px" />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="registerDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="registerDialog.submitting" @click="submitRegister">
          完成
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getCuttingItems,
  getOrderColorSize,
  getCuttingQuantityBreakdown,
  completeCutting,
  exportCuttingItems,
  type CuttingListItem,
  type CuttingListQuery,
  type ColorSizeRow,
  type CuttingQuantityBreakdownRes,
} from '@/api/production-cutting'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const CUTTING_TABS = [
  { label: '全部', value: 'all' },
  { label: '等待裁床', value: 'pending' },
  { label: '裁床完成', value: 'completed' },
] as const

type CuttingTabConfig = (typeof CUTTING_TABS)[number]

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeInputStyle = { color: ACTIVE_FILTER_COLOR }

function getFilterInputStyle(v: unknown) {
  return v ? activeInputStyle : undefined
}
function getOrderNoFilterStyle(orderNo: unknown, showLabel: boolean) {
  if (!orderNo || !showLabel) return undefined
  const text = `订单号：${String(orderNo)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}
function getSkuCodeFilterStyle(skuCode: unknown, showLabel: boolean) {
  if (!skuCode || !showLabel) return undefined
  const text = `SKU：${String(skuCode)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}

const filter = reactive({ orderNo: '', skuCode: '' })
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)

const currentTab = ref<string>('all')
const tabCounts = ref<Record<string, number>>({})
const tabTotal = ref(0)
const list = ref<CuttingListItem[]>([])
const loading = ref(false)
const sizeBreakdownCache = ref<Record<number, CuttingQuantityBreakdownRes>>({})
const sizePopoverLoadingId = ref<number | null>(null)
const exporting = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<CuttingListItem[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)
const canRegisterSelection = computed(() =>
  selectedRows.value.length > 0 && selectedRows.value.some((r) => r.cuttingStatus !== 'completed'),
)

function getTabLabel(tab: CuttingTabConfig): string {
  const counts = tabCounts.value
  const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
  return `${tab.label}(${count})`
}

const registerDialog = reactive<{
  visible: boolean
  submitting: boolean
  row: CuttingListItem | null
}>({ visible: false, submitting: false, row: null })
const registerForm = reactive<{
  colorSizeHeaders: string[]
  actualCutRows: { colorName: string; quantities: number[]; remark?: string }[]
  cuttingCost: string
}>({
  colorSizeHeaders: [],
  actualCutRows: [],
  cuttingCost: '',
})

function formatDateTime(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN')
}

function buildQuery(): CuttingListQuery {
  return {
    tab: currentTab.value,
    orderNo: filter.orderNo || undefined,
    skuCode: filter.skuCode || undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
}

async function loadTabCounts() {
  const base = buildQuery()
  base.page = 1
  base.pageSize = 1
  const counts: Record<string, number> = {}
  await Promise.all(
    CUTTING_TABS.map(async (tab) => {
      try {
        const res = await getCuttingItems({ ...base, tab: tab.value })
        const data = res.data
        counts[tab.value] = data?.total ?? 0
      } catch {
        counts[tab.value] = 0
      }
    }),
  )
  tabCounts.value = counts
  tabTotal.value = counts.all ?? 0
}

async function load() {
  loading.value = true
  try {
    const res = await getCuttingItems(buildQuery())
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

async function onExport() {
  const query = buildQuery()
  const { page, pageSize, ...rest } = query
  exporting.value = true
  try {
    const res = await exportCuttingItems(rest)
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `裁床管理_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '导出失败'))
  } finally {
    exporting.value = false
  }
}

async function onShowQtyPopover(row: CuttingListItem) {
  const id = row.orderId
  if (sizeBreakdownCache.value[id] || sizePopoverLoadingId.value === id) return
  sizePopoverLoadingId.value = id
  try {
    const res = await getCuttingQuantityBreakdown(id)
    sizeBreakdownCache.value[id] = res.data ?? { headers: [], rows: [] }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '尺码明细加载失败'))
  } finally {
    if (sizePopoverLoadingId.value === id) sizePopoverLoadingId.value = null
  }
}

function onSearch(byUser = false) {
  if (byUser) {
    if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
    if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
  }
  pagination.page = 1
  load()
  void loadTabCounts()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    onSearch(false)
  }, 400)
}

function onReset() {
  orderNoLabelVisible.value = false
  skuCodeLabelVisible.value = false
  filter.orderNo = ''
  filter.skuCode = ''
  currentTab.value = 'all'
  pagination.page = 1
  selectedRows.value = []
  load()
  void loadTabCounts()
}

function onTabChange() {
  pagination.page = 1
  selectedRows.value = []
  load()
  void loadTabCounts()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function onSelectionChange(rows: CuttingListItem[]) {
  selectedRows.value = rows
}

async function openRegisterDialog() {
  const pending = selectedRows.value.filter((r) => r.cuttingStatus !== 'completed')
  if (pending.length === 0) return
  const row = pending[0]
  registerDialog.row = row
  registerDialog.visible = true
  try {
    const res = await getOrderColorSize(row.orderId)
    const data = res.data
    registerForm.colorSizeHeaders = data?.colorSizeHeaders ?? []
    const rows = data?.colorSizeRows ?? []
    registerForm.actualCutRows = rows.map((r: ColorSizeRow) => ({
      colorName: r.colorName ?? '',
      quantities: Array.isArray(r.quantities) ? [...r.quantities] : [],
      remark: r.remark ?? '',
    }))
    if (registerForm.actualCutRows.length === 0) {
      registerForm.actualCutRows = [{ colorName: '', quantities: [], remark: '' }]
    }
    const len = registerForm.colorSizeHeaders.length
    registerForm.actualCutRows.forEach((r) => {
      while (r.quantities.length < len) r.quantities.push(0)
    })
    registerForm.cuttingCost = ''
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    registerDialog.visible = false
  }
}

function resetRegisterForm() {
  registerDialog.row = null
  registerForm.colorSizeHeaders = []
  registerForm.actualCutRows = []
  registerForm.cuttingCost = ''
}

async function submitRegister() {
  if (!registerDialog.row) return
  registerDialog.submitting = true
  try {
    const actualCutRows = registerForm.actualCutRows.map((r) => ({
      colorName: r.colorName,
      quantities: r.quantities,
      remark: r.remark,
    }))
    await completeCutting({
      orderId: registerDialog.row.orderId,
      cuttingCost: registerForm.cuttingCost.trim() || '0',
      actualCutRows,
    })
    ElMessage.success('裁床登记完成，订单已进入待车缝')
    registerDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '操作失败'))
  } finally {
    registerDialog.submitting = false
  }
}

onMounted(() => {
  load()
  void loadTabCounts()
})
</script>

<style scoped>
.cutting-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.status-tabs {
  display: flex;
  align-items: center;
  margin-bottom: var(--space-md);
}

.status-tabs-left {
  flex-shrink: 0;
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-sm);
  padding: var(--space-sm);
  margin-bottom: var(--space-md);
  border-radius: var(--radius-lg);
  background-color: var(--color-bg-subtle, #f5f6f8);
}

.filter-bar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
}

.cutting-table {
  margin-bottom: var(--space-md);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
}

.register-brief {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  font-size: var(--font-size-caption, 12px);
}

.register-brief > div + div {
  margin-top: 4px;
}

.register-hint {
  margin-bottom: var(--space-sm);
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption, 12px);
}

.cut-grid {
  margin-bottom: var(--space-md);
}

.cut-cost-form {
  margin-top: var(--space-sm);
}

.qty-trigger {
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.qty-popover {
  font-size: 12px;
}

.qty-popover-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.qty-popover-table {
  width: 100%;
  border-collapse: collapse;
}

.qty-popover-table .qty-label {
  padding: 2px 4px;
  color: var(--color-text-muted, #909399);
  white-space: nowrap;
}

.qty-popover-table .qty-value {
  padding: 2px 4px;
  text-align: right;
  white-space: nowrap;
}

.qty-header {
  padding: 2px 4px;
  font-weight: 500;
  white-space: nowrap;
}

.qty-popover-loading,
.qty-popover-empty {
  font-size: 12px;
  color: var(--color-text-muted, #909399);
}
</style>
