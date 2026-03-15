<template>
  <div class="page-card process-page">
    <!-- Tab：全部 / 等待送出 / 工艺完成 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button
            v-for="tab in CRAFT_TABS"
            :key="tab.value"
            :label="tab.value"
          >
            {{ getTabLabel(tab) }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 筛选区：与订单列表同一设计 -->
    <div class="filter-bar">
      <el-input
        v-model="filter.supplier"
        placeholder="供应商"
        clearable
        size="large"
        class="filter-bar-item"
        :input-style="getFilterInputStyle(filter.supplier)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      />
      <el-input
        v-model="filter.processItem"
        placeholder="工艺项目"
        clearable
        size="large"
        class="filter-bar-item"
        :input-style="getFilterInputStyle(filter.processItem)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      />
      <el-tree-select
        v-model="filter.orderTypeId"
        :data="orderTypeTreeSelectData"
        placeholder="订单类型"
        filterable
        clearable
        default-expand-all
        :render-after-expand="false"
        node-key="value"
        :props="{ label: 'label', value: 'value', children: 'children', disabled: 'disabled' }"
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.orderTypeId && `订单类型：${findOrderTypeLabelById(filter.orderTypeId)}`,
          )
        "
        @change="onSearch"
      >
        <template #prefix>
          <span v-if="filter.orderTypeId" :style="{ color: ACTIVE_FILTER_COLOR }">订单类型：</span>
        </template>
      </el-tree-select>
      <el-select
        v-model="filter.collaborationTypeId"
        placeholder="合作方式"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.collaborationTypeId && `合作方式：${findCollaborationLabelById(filter.collaborationTypeId)}`,
          )
        "
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.collaborationTypeId">合作方式：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="opt in collaborationOptions"
          :key="opt.id"
          :label="opt.label"
          :value="opt.id"
        />
      </el-select>
      <el-date-picker
        v-model="orderDateRange"
        type="daterange"
        range-separator=""
        start-placeholder="下单时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        unlink-panels
        size="large"
        class="filter-bar-item"
        :style="getFilterRangeStyle(orderDateRange)"
        @change="onSearch"
      />
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button
          v-if="hasSelection && canCompleteSelection"
          type="primary"
          size="large"
          :loading="completing"
          @click="onConfirmComplete"
        >
          确认完成
        </el-button>
      </div>
    </div>

    <!-- 有工艺项目的订单列表 -->
    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      class="craft-table"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column prop="orderDate" label="下单时间" width="110" align="center">
        <template #default="{ row }">{{ formatDate(row.orderDate) }}</template>
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
      <el-table-column prop="supplierName" label="供应商" min-width="100" show-overflow-tooltip />
      <el-table-column prop="processItem" label="工艺项目" min-width="120" show-overflow-tooltip />
      <el-table-column label="订单类型" width="100" show-overflow-tooltip>
        <template #default="{ row }">
          {{ orderTypeDisplay(row) }}
        </template>
      </el-table-column>
      <el-table-column label="合作方式" width="100" show-overflow-tooltip>
        <template #default="{ row }">
          {{ collaborationDisplay(row) }}
        </template>
      </el-table-column>
      <el-table-column prop="purchaseStatus" label="采购状态" width="96" align="center">
        <template #default="{ row }">
          <el-tag :type="row.purchaseStatus === 'completed' ? 'success' : 'info'" size="small">
            {{ row.purchaseStatus === 'completed' ? '已完成' : '未完成' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="completedAt" label="完成时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.completedAt) }}</template>
      </el-table-column>
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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getCraftItems, completeCraft, type CraftListItem, type CraftListQuery } from '@/api/production-craft'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getDictTree, getDictItems } from '@/api/dicts'
import type { SystemOptionTreeNode } from '@/api/system-options'

const CRAFT_TABS = [
  { label: '全部', value: 'all' },
  { label: '等待送出', value: 'pending' },
  { label: '工艺完成', value: 'completed' },
] as const

type CraftTabConfig = (typeof CRAFT_TABS)[number]

const orderTypeTree = ref<SystemOptionTreeNode[]>([])
const collaborationOptions = ref<{ id: number; label: string }[]>([])

function toOrderTypeTreeSelect(
  nodes: SystemOptionTreeNode[],
): { label: string; value: number; children?: unknown[]; disabled?: boolean }[] {
  return nodes.map((n) => {
    const children = n.children?.length ? toOrderTypeTreeSelect(n.children) : []
    const hasChildren = children.length > 0
    return { label: n.value, value: n.id, children: hasChildren ? children : undefined, disabled: hasChildren }
  })
}
const orderTypeTreeSelectData = computed(() => toOrderTypeTreeSelect(orderTypeTree.value))

function findOrderTypeLabelById(id: number | null | undefined): string {
  if (!id) return ''
  const stack: SystemOptionTreeNode[] = [...orderTypeTree.value]
  while (stack.length) {
    const node = stack.pop()!
    if (node.id === id) return node.value
    if (node.children?.length) stack.push(...node.children)
  }
  return ''
}

function findCollaborationLabelById(id: number | null | undefined): string {
  if (!id) return ''
  const found = collaborationOptions.value.find((opt) => opt.id === id)
  return found?.label ?? ''
}

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const DATE_RANGE_WIDTH_EMPTY = '140px'
const DATE_RANGE_WIDTH_FILLED = '220px'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeInputStyle = { color: ACTIVE_FILTER_COLOR }
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR as string }

function getFilterInputStyle(v: unknown) {
  return v ? activeInputStyle : undefined
}
function getFilterSelectAutoWidthStyle(v: unknown) {
  if (!v) return undefined
  const text = String(v)
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { ...activeSelectStyle, width: `${width}px`, flex: `0 0 ${width}px` }
}
function getFilterRangeStyle(v: [string, string] | null) {
  const hasValue = v && v.length === 2
  const width = hasValue ? DATE_RANGE_WIDTH_FILLED : DATE_RANGE_WIDTH_EMPTY
  const base = { width, flex: `0 0 ${width}` }
  return hasValue ? { ...base, ...activeSelectStyle } : base
}

const filter = reactive({
  supplier: '',
  processItem: '',
  orderTypeId: null as number | null,
  collaborationTypeId: null as number | null,
})
const orderDateRange = ref<[string, string] | null>(null)

const currentTab = ref<string>('all')
const tabCounts = ref<Record<string, number>>({})
const tabTotal = ref(0)
const list = ref<CraftListItem[]>([])
const loading = ref(false)
const completing = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<CraftListItem[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)
const canCompleteSelection = computed(() =>
  selectedRows.value.length > 0 && selectedRows.value.some((r) => r.craftStatus !== 'completed'),
)

function getTabLabel(tab: CraftTabConfig): string {
  const counts = tabCounts.value
  const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
  return `${tab.label}(${count})`
}

function formatDate(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('zh-CN')
}
function formatDateTime(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN')
}

function buildQuery(): CraftListQuery {
  const q: CraftListQuery = {
    tab: currentTab.value,
    supplier: filter.supplier || undefined,
    processItem: filter.processItem || undefined,
    orderTypeId: filter.orderTypeId ?? undefined,
    collaborationTypeId: filter.collaborationTypeId ?? undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
  if (orderDateRange.value && orderDateRange.value.length === 2) {
    q.orderDateStart = orderDateRange.value[0]
    q.orderDateEnd = orderDateRange.value[1]
  }
  return q
}

async function loadTabCounts() {
  const base = buildQuery()
  base.page = 1
  base.pageSize = 1
  const counts: Record<string, number> = {}
  await Promise.all(
    CRAFT_TABS.map(async (tab) => {
      try {
        const res = await getCraftItems({ ...base, tab: tab.value })
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
    const res = await getCraftItems(buildQuery())
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

function onSearch() {
  pagination.page = 1
  load()
  void loadTabCounts()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { searchTimer = null; onSearch() }, 400)
}

function onReset() {
  filter.supplier = ''
  filter.processItem = ''
  filter.orderTypeId = null
  filter.collaborationTypeId = null
  orderDateRange.value = null
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

function onSelectionChange(rows: CraftListItem[]) {
  selectedRows.value = rows
}

async function onConfirmComplete() {
  const toComplete = selectedRows.value.filter((r) => r.craftStatus !== 'completed')
  if (toComplete.length === 0) return
  completing.value = true
  try {
    for (const row of toComplete) {
      await completeCraft(row.orderId)
    }
    ElMessage.success(`已确认完成 ${toComplete.length} 条`)
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '操作失败'))
  } finally {
    completing.value = false
  }
}

async function loadOptions() {
  try {
    const [orderTypeRes, collabRes] = await Promise.all([
      getDictTree('order_types'),
      getDictItems('collaboration'),
    ])
    orderTypeTree.value = Array.isArray(orderTypeRes.data) ? orderTypeRes.data : []
    const items = collabRes.data ?? []
    collaborationOptions.value = (Array.isArray(items) ? items : []).map((item: any) => ({
      id: item.id,
      label: item.value,
    }))
  } catch {
    orderTypeTree.value = []
    collaborationOptions.value = []
  }
}

function orderTypeDisplay(row: CraftListItem): string {
  if (typeof row.orderTypeId === 'number') {
    const label = findOrderTypeLabelById(row.orderTypeId)
    if (label && label.trim()) return label.trim()
  }
  return ''
}

function collaborationDisplay(row: CraftListItem): string {
  if (typeof row.collaborationTypeId === 'number') {
    const label = findCollaborationLabelById(row.collaborationTypeId)
    if (label && label.trim()) return label.trim()
  }
  return ''
}

onMounted(() => {
  loadOptions()
  load()
  void loadTabCounts()
})
</script>

<style scoped>
.process-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.status-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
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

.craft-table {
  margin-bottom: var(--space-md);
}

.table-thumb {
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  display: block;
}

.text-muted {
  color: var(--el-text-color-secondary);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
}
</style>
