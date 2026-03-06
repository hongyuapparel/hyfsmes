<template>
  <div class="page-card orders-list-page">
    <!-- 状态切换 + 新建订单 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentStatus" size="large" @change="onStatusChange">
          <el-radio-button
            v-for="tab in STATUS_TABS"
            :key="tab.value"
            :label="tab.value"
          >
            {{ getStatusTabLabel(tab) }}
          </el-radio-button>
        </el-radio-group>
      </div>
      <div class="status-tabs-right">
        <el-button type="primary" size="small" @click="onCreateOrder">新建订单</el-button>
      </div>
    </div>

    <!-- 筛选区：与客户管理 / 产品列表保持同一设计 -->
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
        placeholder="SKU编号"
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
            SKU编号：
          </span>
        </template>
      </el-input>
      <el-select
        v-model="filter.customer"
        placeholder="客户"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.customer)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.customer">客户：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="opt in customerOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-tree-select
        v-model="filter.orderType"
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
        :style="getFilterSelectAutoWidthStyle(
          filter.orderType && `订单类型：${getOrderTypeDisplayLabel(filter.orderType)}`,
        )"
        @change="onSearch"
      >
        <template #prefix>
          <span
            v-if="filter.orderType"
            :style="{ color: 'var(--el-color-primary)' }"
          >
            订单类型：
          </span>
        </template>
      </el-tree-select>
      <el-select
        v-model="filter.processItem"
        placeholder="工艺项目"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.processItem)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.processItem">工艺项目：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="opt in secondaryProcessOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-select
        v-model="filter.salesperson"
        placeholder="业务员"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.salesperson)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.salesperson">业务员：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="name in salespersonOptions"
          :key="name"
          :label="name"
          :value="name"
        />
      </el-select>
      <el-select
        v-model="filter.merchandiser"
        placeholder="跟单员"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.merchandiser)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.merchandiser">跟单员：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="name in merchandiserOptions"
          :key="name"
          :label="name"
          :value="name"
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
      <el-date-picker
        v-model="customerDueRange"
        type="daterange"
        range-separator=""
        start-placeholder="客户交期"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        unlink-panels
        size="large"
        class="filter-bar-item"
        :style="getFilterRangeStyle(customerDueRange)"
        @change="onSearch"
      />
      <el-select
        v-model="filter.factory"
        placeholder="加工厂"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.factory)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.factory">加工厂：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option
          v-for="opt in factoryOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>

      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button
          v-if="canDeleteOrders && hasSelection"
          type="danger"
          size="large"
          @click="onBatchDelete"
        >
          删除
        </el-button>
        <el-button
          v-if="hasSelection"
          type="warning"
          size="large"
          @click="onBatchCopyToDraft"
        >
          复制为草稿
        </el-button>
        <el-button
          v-if="canReviewOrders && isPendingReviewTab && hasSelection"
          type="success"
          size="large"
          @click="onBatchReview"
        >
          审单
        </el-button>
      </div>
    </div>

    <!-- 订单卡片宫格 -->
    <div class="orders-card-list">
      <el-empty v-if="!loading && !list.length" description="暂无订单" />
      <div v-else class="order-card-grid">
        <div
          v-for="item in list"
          :key="item.id"
          class="order-card"
        >
          <div class="order-card-header">
            <div class="order-card-header-top">
              <span class="order-no" :title="item.orderNo">{{ item.orderNo }}</span>
              <el-checkbox
                v-model="cardSelected[item.id]"
                size="large"
                class="card-checkbox"
                @change="onCardSelectChange"
              />
            </div>
            <div class="order-card-header-main">
              <div class="order-card-image">
                <el-image
                  v-if="item.imageUrl"
                  :src="item.imageUrl"
                  fit="cover"
                  :preview-src-list="[item.imageUrl]"
                />
                <div v-else class="image-placeholder">图片</div>
              </div>
              <div class="order-card-main">
                <span class="sku-line">
                  SKU：{{ item.skuCode || '-' }}
                  <template v-if="item.collaborationType">
                    · {{ item.collaborationType }}
                  </template>
                </span>
                <div class="order-card-meta">
                  <span>客户交期：{{ formatDate(item.customerDueDate) }}</span>
                  <span>当前状态：{{ getStatusLabel(item.status) }}</span>
                  <span v-if="item.status !== 'draft' && item.orderDate">
                    下单时间：{{ formatDateTime(item.orderDate) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div class="order-card-body">
            <div class="field-row">
              <span class="field-label">客户：</span>
              <span class="field-value ellipsis" :title="item.customerName || '-'">{{ item.customerName || '-' }}</span>
            </div>
            <div class="field-row">
              <span class="field-label">业务员：</span>
              <span class="field-value ellipsis">{{ item.salesperson || '-' }}</span>
            </div>
            <div class="field-row">
              <span class="field-label">跟单员：</span>
              <span class="field-value ellipsis">{{ item.merchandiser || '-' }}</span>
            </div>
            <div class="field-row">
              <span class="field-label">数量：</span>
              <span class="field-value">{{ item.quantity }} 件</span>
            </div>
            <div class="field-row">
              <span class="field-label">出厂价：</span>
              <span class="field-value price-value">￥{{ item.exFactoryPrice }}</span>
            </div>
            <div class="field-row">
              <span class="field-label">销售价：</span>
              <span class="field-value price-value">￥{{ item.salePrice }}</span>
            </div>
            <div v-if="orderTypeDisplay(item) || item.processItem" class="field-row order-tags-row">
              <el-tag
                v-if="orderTypeDisplay(item)"
                size="small"
                effect="light"
                class="order-type-tag"
              >
                {{ orderTypeDisplay(item) }}
              </el-tag>
              <el-tag
                v-if="item.processItem"
                size="small"
                effect="plain"
                class="process-item-tag"
              >
                {{ item.processItem }}
              </el-tag>
            </div>
          </div>
          <div class="order-card-footer">
            <div v-if="item.factoryName" class="footer-factory ellipsis" :title="item.factoryName">加工厂：{{ item.factoryName }}</div>
            <div class="footer-actions">
              <el-tooltip content="编辑" placement="top">
                <el-button link type="primary" size="small" circle class="action-btn" @click="openEdit(item)">
                  <el-icon><Edit /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="下载" placement="top">
                <el-button link size="small" circle class="action-btn" @click="downloadExcel">
                  <el-icon><Download /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="打印" placement="top">
                <el-button link size="small" circle class="action-btn" @click="printOrder(item)">
                  <el-icon><Printer /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="操作记录" placement="top">
                <el-button link size="small" circle class="action-btn" @click="openOperationLog(item)">
                  <el-icon><Clock /></el-icon>
                </el-button>
              </el-tooltip>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[12, 24, 48]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="onPageSizeChange"
      />
    </div>

    <!-- 查看 / 操作记录 占位弹窗 -->
    <el-dialog v-model="viewDialog.visible" title="订单详情（只读）" width="720">
      <div v-if="viewDialog.order">
        <pre class="json-preview">{{ JSON.stringify(viewDialog.order, null, 2) }}</pre>
      </div>
      <template #footer>
        <el-button @click="viewDialog.visible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="logDialog.visible" title="操作记录" width="520">
      <el-empty description="操作记录功能将于后续步骤实现" />
      <template #footer>
        <el-button @click="logDialog.visible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, watchEffect, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Download, Printer, Clock } from '@element-plus/icons-vue'
import { getOrders, getOrderStatusCounts, deleteOrders, reviewOrders, copyOrdersToDraft, type OrderListItem, type OrderListQuery } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getCustomers, type CustomerItem, getSalespeople, getMerchandisers } from '@/api/customers'
import { getDictOptions, getDictTree } from '@/api/dicts'
import { type SystemOptionTreeNode } from '@/api/system-options'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const STATUS_TABS = [
  { label: '全部', value: 'all' },
  { label: '草稿', value: 'draft' },
  { label: '待审单', value: 'pending_review' },
  { label: '待纸样', value: 'pending_pattern' },
  { label: '待采购', value: 'pending_purchase' },
  { label: '待裁床', value: 'pending_cutting' },
  { label: '待车缝', value: 'pending_sewing' },
  { label: '待尾部', value: 'pending_finishing' },
  { label: '订单完成', value: 'completed' },
] as const

const STATUS_LABEL_MAP: Record<string, string> = STATUS_TABS.reduce((acc, cur) => {
  if (cur.value !== 'all') acc[cur.value] = cur.label
  return acc
}, {} as Record<string, string>)

const orderTypeTree = ref<SystemOptionTreeNode[]>([])

const secondaryProcessOptions = ref<{ label: string; value: string }[]>([])
const factoryOptions = ref<{ label: string; value: string }[]>([])
const customerOptions = ref<{ label: string; value: string }[]>([])
const salespersonOptions = ref<string[]>([])
const merchandiserOptions = ref<string[]>([])

function toOrderTypeTreeSelect(
  nodes: SystemOptionTreeNode[],
  parentPath = '',
): { label: string; value: string; children?: any[]; disabled?: boolean }[] {
  return nodes.map((n) => {
    const path = parentPath ? `${parentPath} > ${n.value}` : n.value
    const children = n.children?.length ? toOrderTypeTreeSelect(n.children, path) : []
    const hasChildren = children.length > 0
    return {
      label: n.value,
      value: path,
      children: hasChildren ? children : undefined,
      // 有子分组的父节点禁用，只允许选择叶子节点
      disabled: hasChildren,
    }
  })
}

const orderTypeTreeSelectData = computed(() => toOrderTypeTreeSelect(orderTypeTree.value))

function getOrderTypeDisplayLabel(v: string | undefined): string {
  if (!v) return ''
  const parts = v
    .split('>')
    .map((s) => s.trim())
    .filter(Boolean)
  return parts.length ? parts[parts.length - 1] : v
}

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const DATE_RANGE_WIDTH_EMPTY = '140px'
const DATE_RANGE_WIDTH_FILLED = '220px'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeInputStyle = { color: ACTIVE_FILTER_COLOR }
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }

function getFilterInputStyle(v: unknown) {
  return v ? activeInputStyle : undefined
}

function getFilterSelectStyle(v: unknown) {
  return v ? activeSelectStyle : undefined
}

function getFilterSelectAutoWidthStyle(v: unknown) {
  if (!v) return undefined
  const text = String(v)
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return {
    ...activeSelectStyle,
    width: `${width}px`,
    flex: `0 0 ${width}px`,
  }
}

function getOrderNoFilterStyle(orderNo: unknown, showLabel: boolean) {
  if (!orderNo || !showLabel) return undefined
  const text = `订单号：${String(orderNo)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return {
    width: `${width}px`,
    flex: `0 0 ${width}px`,
  }
}

function getSkuCodeFilterStyle(skuCode: unknown, showLabel: boolean) {
  if (!skuCode || !showLabel) return undefined
  const text = `SKU编号：${String(skuCode)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return {
    width: `${width}px`,
    flex: `0 0 ${width}px`,
  }
}

function getFilterRangeStyle(v: [string, string] | null) {
  const hasValue = v && v.length === 2
  const width = hasValue ? DATE_RANGE_WIDTH_FILLED : DATE_RANGE_WIDTH_EMPTY
  const base = { width, flex: `0 0 ${width}` }
  return hasValue ? { ...base, ...activeSelectStyle } : base
}

const filter = reactive({
  orderNo: '',
  skuCode: '',
  customer: '',
  orderType: '',
  processItem: '',
  salesperson: '',
  merchandiser: '',
  factory: '',
})

const orderDateRange = ref<[string, string] | null>(null)
const customerDueRange = ref<[string, string] | null>(null)

/** 订单号前缀「订单号：」仅在回车或点击搜索后显示 */
const orderNoLabelVisible = ref(false)
/** SKU编号前缀「SKU编号：」仅在回车或点击搜索后显示 */
const skuCodeLabelVisible = ref(false)

const pagination = reactive({
  page: 1,
  pageSize: 12,
  total: 0,
})

const currentStatus = ref<'all' | string>('all')
const list = ref<OrderListItem[]>([])
const loading = ref(false)
const statusCounts = ref<Record<string, number>>({})
const statusTotal = ref<number>(0)

const viewDialog = reactive<{ visible: boolean; order: OrderListItem | null }>({
  visible: false,
  order: null,
})

const logDialog = reactive<{ visible: boolean }>({
  visible: false,
})

/** 卡片勾选状态 + 批量操作 */
const cardSelected = ref<Record<number, boolean>>({})
const selectedIds = computed(() => {
  const map = cardSelected.value
  return list.value.filter((item) => map[item.id]).map((item) => item.id)
})
const hasSelection = computed(() => selectedIds.value.length > 0)
const isPendingReviewTab = computed(() => currentStatus.value === 'pending_review')
const canDeleteOrders = computed(() => authStore.hasPermission('orders_delete'))
const canReviewOrders = computed(() => authStore.hasPermission('orders_review'))

function resetSelection() {
  cardSelected.value = {}
}

function onCardSelectChange() {
  // 选中状态变化时，selectedIds 由计算属性自动更新
}

function getStatusLabel(status: string): string {
  return STATUS_LABEL_MAP[status] || status || '-'
}

/** 订单类型展示值：后端列表返回 label 字段存订单类型，兼容 orderType */
function orderTypeDisplay(item: OrderListItem): string {
  const v = item.orderType ?? item.label
  return (v && String(v).trim()) ? String(v).trim() : ''
}

async function loadOptions() {
  // 1）基础选项：客户 / 业务员 / 订单类型 / 二次工艺 / 加工厂
  try {
    const [custRes, salesRes, orderTypeRes, secondaryRes, factoryRes] = await Promise.all([
      getCustomers({ page: 1, pageSize: 200 }),
      getSalespeople(),
      getDictTree('order_types'),
      getDictOptions('secondary_processes'),
      getDictOptions('factories'),
    ])

    const custList = (custRes.data?.list ?? []) as CustomerItem[]
    customerOptions.value = custList.map((c) => ({
      label: c.companyName,
      value: c.companyName,
    }))

    salespersonOptions.value = salesRes.data ?? []

    const orderTypeVals = orderTypeRes.data ?? []
    orderTypeTree.value = Array.isArray(orderTypeVals) ? orderTypeVals : []

    const secondaryVals = secondaryRes.data ?? []
    secondaryProcessOptions.value = secondaryVals.map((v: string) => ({ label: v, value: v }))

    const factoryVals = factoryRes.data ?? []
    factoryOptions.value = factoryVals.map((v: string) => ({ label: v, value: v }))
  } catch (e: unknown) {
    if (!isErrorHandled(e)) {
      console.warn('订单筛选选项加载失败：', getErrorMessage(e, '选项加载失败'))
    }
  }

  // 2）跟单员单独请求，避免影响其他选项
  try {
    const merchRes = await getMerchandisers()
    merchandiserOptions.value = merchRes.data ?? []
  } catch (e: unknown) {
    // 跟单员加载失败时，仅保留为空列表，不影响其他筛选
    if (!isErrorHandled(e)) {
      console.warn('跟单员选项加载失败：', getErrorMessage(e, '选项加载失败'))
    }
  }
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

function buildQuery(): OrderListQuery {
  const q: OrderListQuery = {
    orderNo: filter.orderNo || undefined,
    skuCode: filter.skuCode || undefined,
    customer: filter.customer || undefined,
    orderType: filter.orderType || undefined,
    processItem: filter.processItem || undefined,
    salesperson: filter.salesperson || undefined,
    merchandiser: filter.merchandiser || undefined,
    factory: filter.factory || undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
  if (currentStatus.value !== 'all') {
    q.status = currentStatus.value
  }
  if (orderDateRange.value && orderDateRange.value.length === 2) {
    q.orderDateStart = orderDateRange.value[0]
    q.orderDateEnd = orderDateRange.value[1]
  }
  if (customerDueRange.value && customerDueRange.value.length === 2) {
    q.customerDueStart = customerDueRange.value[0]
    q.customerDueEnd = customerDueRange.value[1]
  }
  return q
}

function buildCountQuery(): Omit<OrderListQuery, 'status' | 'page' | 'pageSize'> {
  const q: Omit<OrderListQuery, 'status' | 'page' | 'pageSize'> = {
    orderNo: filter.orderNo || undefined,
    skuCode: filter.skuCode || undefined,
    customer: filter.customer || undefined,
    orderType: filter.orderType || undefined,
    processItem: filter.processItem || undefined,
    salesperson: filter.salesperson || undefined,
    merchandiser: filter.merchandiser || undefined,
    factory: filter.factory || undefined,
  }
  if (orderDateRange.value && orderDateRange.value.length === 2) {
    q.orderDateStart = orderDateRange.value[0]
    q.orderDateEnd = orderDateRange.value[1]
  }
  if (customerDueRange.value && customerDueRange.value.length === 2) {
    q.customerDueStart = customerDueRange.value[0]
    q.customerDueEnd = customerDueRange.value[1]
  }
  return q
}

function getStatusTabLabel(tab: (typeof STATUS_TABS)[number]) {
  const count = tab.value === 'all' ? statusTotal.value : (statusCounts.value[tab.value] ?? 0)
  return `${tab.label}(${count})`
}

async function load() {
  loading.value = true
  try {
    const [listRes, countsRes] = await Promise.all([getOrders(buildQuery()), getOrderStatusCounts(buildCountQuery())])
    const data = listRes.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
    }
    const countsData = countsRes.data
    statusTotal.value = countsData?.total ?? 0
    statusCounts.value = countsData?.byStatus ?? {}
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

/** @param byUser 仅当用户按回车或点击搜索按钮时为 true，输入防抖触发时为 false */
function onSearch(byUser = false) {
  if (byUser) {
    if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
    if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
  }
  pagination.page = 1
  load()
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
  filter.customer = ''
  filter.orderType = ''
  filter.processItem = ''
  filter.salesperson = ''
  filter.merchandiser = ''
  filter.factory = ''
  orderDateRange.value = null
  customerDueRange.value = null
  currentStatus.value = 'all'
  pagination.page = 1
  resetSelection()
  load()
}

function onStatusChange() {
  pagination.page = 1
  resetSelection()
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

async function onBatchDelete() {
  if (!hasSelection.value) return
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 条订单吗？`, '提示', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await deleteOrders(selectedIds.value)
    ElMessage.success('已删除选中订单')
    pagination.page = 1
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '删除失败'))
  }
}

async function onBatchReview() {
  if (!hasSelection.value || !isPendingReviewTab.value) return
  try {
    await ElMessageBox.confirm(`确定审核选中的 ${selectedIds.value.length} 条订单吗？`, '审核确认', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await reviewOrders(selectedIds.value)
    ElMessage.success('审核成功')
    pagination.page = 1
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '审核失败'))
  }
}

async function onBatchCopyToDraft() {
  if (!hasSelection.value) return
  try {
    await ElMessageBox.confirm(`确定将选中的 ${selectedIds.value.length} 条订单复制为草稿吗？`, '复制为草稿', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await copyOrdersToDraft(selectedIds.value)
    ElMessage.success('已复制为草稿')
    pagination.page = 1
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '复制失败'))
  }
}

function openEdit(order: OrderListItem) {
  router.push({ name: 'OrdersEdit', params: { id: order.id } })
}

function downloadExcel() {
  ElMessage.info('下载 Excel 功能将在后续统一实现')
}

function printOrder(_order: OrderListItem) {
  window.print()
}

function openOperationLog(order: OrderListItem) {
  ElMessage.info(`后续将在此查看订单 ${order.orderNo} 的操作记录`)
}

function onCreateOrder() {
  router.push({ name: 'OrdersEdit' })
}

onMounted(() => {
  load()
  loadOptions()
})

watch(
  () => filter.orderNo,
  (v) => {
    if (!v || !String(v).trim()) orderNoLabelVisible.value = false
  },
)
watch(
  () => filter.skuCode,
  (v) => {
    if (!v || !String(v).trim()) skuCodeLabelVisible.value = false
  },
)

watchEffect(() => {
  // 预留：当筛选条件发生明显变化时，可在此埋点或做其它处理
  void filter.orderNo
})
</script>

<style scoped>
.orders-list-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.status-tabs {
  margin-bottom: var(--space-md);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
}

.status-tabs-left {
  flex: 1;
  min-width: 0;
}

.status-tabs-right {
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

.filter-bar :deep(.el-form-item) {
  margin-bottom: 0;
}

.filter-bar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
}

.orders-card-list {
  min-height: 200px;
}

.order-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.order-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  background-color: var(--color-bg, #fff);
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
  min-width: 0;
  overflow: hidden;
}

.order-card-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.order-card-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.order-card-header-main {
  display: flex;
  gap: 10px;
  min-width: 0;
}

.order-card-image {
  width: 72px;
  height: 72px;
  border-radius: var(--radius);
  overflow: hidden;
  background-color: #f2f3f5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.order-card-image :deep(.el-image) {
  width: 100%;
  height: 100%;
}

.image-placeholder {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #909399);
}

.order-card-main {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.order-card-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 6px;
  margin-bottom: 2px;
}

.card-checkbox {
  flex-shrink: 0;
  margin: 0;
  padding: 4px;
  cursor: pointer;
}

.card-checkbox :deep(.el-checkbox__inner) {
  transform: scale(1.2);
}

.order-no {
  font-weight: 600;
  font-size: var(--font-size-body, 14px);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.sku-line {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #909399);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.order-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #909399);
  line-height: 1.3;
}

.order-card-body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 12px;
  font-size: var(--font-size-caption, 12px);
}

.field-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.field-label {
  color: var(--color-text-muted, #909399);
  flex-shrink: 0;
}

.field-value {
  flex: 1;
  min-width: 0;
}

.field-value.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 订单类型 + 工艺 同一行：左侧标签（仅值），右侧工艺 */
.order-tags-row {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.order-tags-row :deep(.el-tag) {
  max-width: 100%;
}

.order-tags-row .order-type-tag,
.order-tags-row .process-item-tag {
  overflow: hidden;
  text-overflow: ellipsis;
}

.order-card-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
  border-top: 1px dashed var(--color-border);
  padding-top: 8px;
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-muted, #909399);
  min-width: 0;
}

.footer-factory {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: auto;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.footer-actions .action-btn {
  padding: 4px;
}

.footer-actions .action-btn :deep(.el-icon) {
  font-size: 16px;
}

.pagination-wrap {
  margin-top: var(--space-md);
  display: flex;
  justify-content: flex-end;
}

.json-preview {
  margin: 0;
  padding: 12px;
  border-radius: var(--radius);
  background-color: #0f172a;
  color: #e5e7eb;
  font-family: Menlo, Monaco, Consolas, 'Courier New', monospace;
  font-size: 12px;
  max-height: 400px;
  overflow: auto;
}
</style>
