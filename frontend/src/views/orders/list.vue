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
            {{ tab.label }}
          </el-radio-button>
        </el-radio-group>
      </div>
      <div class="status-tabs-right">
        <el-button type="primary" size="small" @click="onCreateOrder">新建订单</el-button>
      </div>
    </div>

    <!-- 筛选区：与客户管理 / 产品列表保持同一设计 -->
    <div class="filter-bar">
      <div
        class="filter-bar-item filter-input-with-label"
        :class="{ 'has-value': !!filter.orderNo }"
        data-label="订单号"
      >
        <el-input
          v-model="filter.orderNo"
          placeholder="订单号"
          clearable
          size="large"
          :input-style="getFilterInputStyle(filter.orderNo)"
          @input="debouncedSearch"
          @keyup.enter="onSearch"
        />
      </div>
      <div
        class="filter-bar-item filter-input-with-label"
        :class="{ 'has-value': !!filter.skuCode }"
        data-label="SKU编号"
      >
        <el-input
          v-model="filter.skuCode"
          placeholder="SKU编号"
          clearable
          size="large"
          :input-style="getFilterInputStyle(filter.skuCode)"
          @input="debouncedSearch"
          @keyup.enter="onSearch"
        />
      </div>
      <el-select
        v-model="filter.customer"
        placeholder="客户"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getSmartFilterSelectStyle(filter.customer)"
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
        :fit-input-width="false"
        popper-class="order-type-tree-dropdown"
        node-key="value"
        :props="orderTypeTreeSelectProps"
        size="large"
        class="filter-bar-item order-type-filter"
        :style="getSmartFilterSelectStyle(filter.orderType)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.orderType">订单类型：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
      </el-tree-select>
      <el-select
        v-model="filter.secondaryProcess"
        placeholder="二次工艺"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        :style="getSmartFilterSelectStyle(filter.secondaryProcess)"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.secondaryProcess">二次工艺：{{ label }}</span>
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
        :style="getSmartFilterSelectStyle(filter.salesperson)"
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
        :style="getSmartFilterSelectStyle(filter.merchandiser)"
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
        :style="getSmartFilterSelectStyle(filter.factory)"
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
        <el-button type="primary" size="large" @click="onSearch">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button
          v-if="canDeleteOrders"
          type="danger"
          size="large"
          :disabled="!selectedOrderIds.length"
          @click="onBatchDelete"
        >
          删除
        </el-button>
        <el-button
          v-if="currentStatus === 'pending_review' && canReviewOrders"
          type="primary"
          plain
          size="large"
          :disabled="!selectedOrderIds.length"
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
              <div class="order-card-title-row">
                <span class="order-no" :title="item.orderNo">{{ item.orderNo }}</span>
                <el-checkbox v-model="cardSelected[item.id]" size="large" class="card-checkbox" @change="onCardSelectChange" />
              </div>
              <span class="sku-line">SKU：{{ item.skuCode || '-' }}</span>
              <div class="order-card-meta">
                <span>客户交期：{{ formatDate(item.customerDueDate) }}</span>
                <span>当前状态：{{ getStatusLabel(item.status) }}</span>
                <span v-if="item.statusTime">状态时间：{{ formatDateTime(item.statusTime) }}</span>
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
              <span class="field-value">{{ item.quantity }}</span>
            </div>
            <div class="field-row">
              <span class="field-label">出厂价：</span>
              <span class="field-value">{{ item.exFactoryPrice }}</span>
            </div>
            <div class="field-row">
              <span class="field-label">销售价：</span>
              <span class="field-value">{{ item.salePrice }}</span>
            </div>
            <div class="field-row">
              <span class="field-label">标签：</span>
              <span class="field-value ellipsis">{{ item.label || '-' }}</span>
            </div>
            <div class="field-row">
              <span class="field-label">二次工艺：</span>
              <span class="field-value ellipsis">{{ item.secondaryProcess || '-' }}</span>
            </div>
          </div>
          <div class="order-card-footer">
            <div class="footer-factory ellipsis" :title="item.factoryName || '-'">加工厂：{{ item.factoryName || '-' }}</div>
            <div class="footer-actions">
              <el-tooltip content="编辑" placement="top">
                <el-button link type="primary" size="small" circle class="action-btn" @click="openEdit(item)">
                  <el-icon><Edit /></el-icon>
                </el-button>
              </el-tooltip>
              <el-tooltip content="复制" placement="top">
                <el-button link size="small" circle class="action-btn" @click="copyOrder(item)">
                  <el-icon><DocumentCopy /></el-icon>
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
import { ref, reactive, watchEffect, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, DocumentCopy, Download, Printer, Clock } from '@element-plus/icons-vue'
import { getOrders, type OrderListItem, type OrderListQuery, batchDeleteOrders, reviewOrders } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getCustomers, type CustomerItem, getSalespeople, getMerchandisers } from '@/api/customers'
import { getSystemOptions, getSystemOptionsTree, type SystemOptionTreeNode } from '@/api/system-options'
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
): { label: string; value: string; children?: any[] }[] {
  return nodes.map((n) => {
    const path = parentPath ? `${parentPath} > ${n.value}` : n.value
    const children = n.children?.length ? toOrderTypeTreeSelect(n.children, path) : []
    return {
      label: n.value,
      value: path,
      children: children.length ? children : undefined,
    }
  })
}

const orderTypeTreeSelectData = computed(() => toOrderTypeTreeSelect(orderTypeTree.value))

const orderTypeTreeSelectProps = {
  label: 'label',
  value: 'value',
  children: 'children',
  disabled: (node: { children?: unknown[] }) =>
    Array.isArray(node.children) && node.children.length > 0,
}

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const FILTER_ITEM_WIDTH = '120px'
const FILTER_MAX_WIDTH = 260
const activeInputStyle = { color: ACTIVE_FILTER_COLOR }
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }
const rangeBaseStyle = { width: FILTER_ITEM_WIDTH, flex: `0 0 ${FILTER_ITEM_WIDTH}` }

function getFilterInputStyle(v: unknown) {
  return v ? activeInputStyle : undefined
}

function getFilterSelectStyle(v: unknown) {
  return v ? activeSelectStyle : undefined
}

function getSmartFilterSelectStyle(v: unknown) {
  const text = typeof v === 'string' ? v : v == null ? '' : String(v)
  const len = text.length
  const base = parseInt(FILTER_ITEM_WIDTH, 10) || 120
  const width = len ? Math.min(base + len * 8, FILTER_MAX_WIDTH) : base
  const colorStyle = v ? activeSelectStyle : {}
  return {
    ...colorStyle,
    width: `${width}px`,
    flex: `0 0 ${width}px`,
  }
}

function getFilterRangeStyle(v: [string, string] | null) {
  return v && v.length === 2
    ? { ...rangeBaseStyle, ...activeSelectStyle }
    : rangeBaseStyle
}

const filter = reactive({
  orderNo: '',
  skuCode: '',
  customer: '',
  orderType: '',
  secondaryProcess: '',
  salesperson: '',
  merchandiser: '',
  factory: '',
})

const orderDateRange = ref<[string, string] | null>(null)
const customerDueRange = ref<[string, string] | null>(null)

const pagination = reactive({
  page: 1,
  pageSize: 12,
  total: 0,
})

const currentStatus = ref<'all' | string>('all')
const list = ref<OrderListItem[]>([])
const loading = ref(false)

const viewDialog = reactive<{ visible: boolean; order: OrderListItem | null }>({
  visible: false,
  order: null,
})

const logDialog = reactive<{ visible: boolean }>({
  visible: false,
})

/** 卡片勾选状态与批量操作 */
const cardSelected = ref<Record<number, boolean>>({})
const selectedOrderIds = computed<number[]>(() =>
  Object.entries(cardSelected.value)
    .filter(([, checked]) => checked)
    .map(([id]) => Number(id)),
)

const canDeleteOrders = computed(() => authStore.hasPermissionCode('orders_delete'))
const canReviewOrders = computed(() => authStore.hasPermissionCode('orders_review'))

function onCardSelectChange() {
  // 预留：如需实时联动其它 UI，可在此处理
}

function resetSelection() {
  cardSelected.value = {}
}

function getStatusLabel(status: string): string {
  return STATUS_LABEL_MAP[status] || status || '-'
}

async function loadOptions() {
  // 1）基础选项：客户 / 业务员 / 订单类型 / 二次工艺 / 加工厂
  try {
    const [custRes, salesRes, orderTypeRes, secondaryRes, factoryRes] = await Promise.all([
      getCustomers({ page: 1, pageSize: 200 }),
      getSalespeople(),
      getSystemOptionsTree('order_types'),
      getSystemOptions('secondary_processes'),
      getSystemOptions('factories'),
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
    secondaryProcess: filter.secondaryProcess || undefined,
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

async function load() {
  loading.value = true
  try {
    const res = await getOrders(buildQuery())
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      resetSelection()
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
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    onSearch()
  }, 400)
}

function onReset() {
  filter.orderNo = ''
  filter.skuCode = ''
  filter.customer = ''
  filter.orderType = ''
  filter.secondaryProcess = ''
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
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function openEdit(order: OrderListItem) {
  router.push({ name: 'OrdersEdit', params: { id: order.id } })
}

function copyOrder(_order: OrderListItem) {
  ElMessage.info('复制订单功能将在编辑/创建订单表单完成后一并实现')
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

async function onBatchDelete() {
  if (!selectedOrderIds.value.length) return
  try {
    await ElMessageBox.confirm(`确定删除选中的 ${selectedOrderIds.value.length} 个订单？`, '提示', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await batchDeleteOrders(selectedOrderIds.value)
    ElMessage.success('已删除所选订单')
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '删除失败'))
  }
}

async function onBatchReview() {
  if (!selectedOrderIds.value.length) return
  try {
    await ElMessageBox.confirm(`确定审核通过选中的 ${selectedOrderIds.value.length} 个订单？`, '提示', {
      type: 'warning',
    })
  } catch {
    return
  }
  try {
    await reviewOrders(selectedOrderIds.value)
    ElMessage.success('已审核所选订单')
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '审单失败'))
  }
}

onMounted(() => {
  load()
  loadOptions()
})

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

.filter-bar-actions :deep(.el-button + .el-button) {
  margin-left: 0;
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
}

.card-checkbox :deep(.el-checkbox__inner) {
  width: 18px;
  height: 18px;
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

.order-card-footer {
  display: flex;
  justify-content: space-between;
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
