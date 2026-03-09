<template>
  <div class="page-card finishing-page">
    <!-- Tab：全部 / 等待发货 / 已发货 / 已入库 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button
            v-for="tab in FINISHING_TABS"
            :key="tab.value"
            :label="tab.value"
          >
            {{ tab.label }}
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
        <el-button
          v-if="hasSelection && canRegisterSelection"
          type="primary"
          size="large"
          @click="openRegisterDialog"
        >
          登记包装完成
        </el-button>
        <el-button
          v-if="hasSelection && canShipSelection"
          type="success"
          size="large"
          :loading="shipping"
          @click="onShip"
        >
          发货
        </el-button>
        <el-button
          v-if="hasSelection && canInboundSelection"
          type="warning"
          size="large"
          :loading="inbounding"
          @click="onInbound"
        >
          入库
        </el-button>
      </div>
    </div>

    <!-- 待尾部订单列表 -->
    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      class="finishing-table"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column prop="arrivedAt" label="到尾部时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.arrivedAt) }}</template>
      </el-table-column>
      <el-table-column prop="completedAt" label="完成时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.completedAt) }}</template>
      </el-table-column>
      <el-table-column prop="orderNo" label="订单号" min-width="100" show-overflow-tooltip />
      <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
      <el-table-column label="裁床数量" width="96" align="right">
        <template #default="{ row }">{{ row.cutTotal != null ? row.cutTotal : '-' }}</template>
      </el-table-column>
      <el-table-column label="车缝数量" width="96" align="right">
        <template #default="{ row }">{{ row.sewingQuantity != null ? row.sewingQuantity : '-' }}</template>
      </el-table-column>
      <el-table-column label="尾部收货数" width="100" align="right">
        <template #default="{ row }">{{ row.tailReceivedQty != null ? row.tailReceivedQty : '-' }}</template>
      </el-table-column>
      <el-table-column label="尾部出货数" width="100" align="right">
        <template #default="{ row }">{{ row.tailShippedQty != null ? row.tailShippedQty : '-' }}</template>
      </el-table-column>
      <el-table-column label="次品数" width="80" align="right">
        <template #default="{ row }">{{ row.defectQuantity != null ? row.defectQuantity : '-' }}</template>
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

    <!-- 登记包装完成弹窗 -->
    <el-dialog
      v-model="registerDialog.visible"
      title="登记包装完成"
      width="420"
      destroy-on-close
      @close="resetRegisterForm"
    >
      <template v-if="registerDialog.row">
        <div class="register-brief">
          <div>订单号：{{ registerDialog.row.orderNo }}</div>
          <div>SKU：{{ registerDialog.row.skuCode }}</div>
        </div>
        <el-form
          ref="registerFormRef"
          :model="registerForm"
          :rules="registerRules"
          label-width="120px"
          class="register-form"
        >
          <el-form-item label="实际包装完成数量" prop="tailReceivedQty">
            <el-input-number
              v-model="registerForm.tailReceivedQty"
              :min="0"
              :precision="0"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="次品数" prop="defectQuantity">
            <el-input-number
              v-model="registerForm.defectQuantity"
              :min="0"
              :precision="0"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="registerDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="registerDialog.submitting" @click="submitRegister">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  getFinishingItems,
  registerFinishingPackaging,
  shipFinishingOrder,
  inboundFinishingOrder,
  type FinishingListItem,
  type FinishingListQuery,
} from '@/api/production-finishing'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const FINISHING_TABS = [
  { label: '全部', value: 'all' },
  { label: '等待发货', value: 'pending_ship' },
  { label: '已发货', value: 'shipped' },
  { label: '已入库', value: 'inbound' },
] as const

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
const list = ref<FinishingListItem[]>([])
const loading = ref(false)
const shipping = ref(false)
const inbounding = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<FinishingListItem[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)
const canRegisterSelection = computed(() =>
  selectedRows.value.some((r) => r.finishingStatus === 'pending_ship' && r.tailReceivedQty == null),
)
const canShipSelection = computed(() =>
  selectedRows.value.every(
    (r) => r.finishingStatus === 'pending_ship' && r.tailReceivedQty != null && r.tailReceivedQty >= 0,
  ) && selectedRows.value.length > 0,
)
const canInboundSelection = computed(() =>
  selectedRows.value.every((r) => r.finishingStatus === 'shipped') && selectedRows.value.length > 0,
)

const registerDialog = reactive<{
  visible: boolean
  submitting: boolean
  row: FinishingListItem | null
}>({ visible: false, submitting: false, row: null })
const registerFormRef = ref<FormInstance>()
const registerForm = reactive({
  tailReceivedQty: 0,
  defectQuantity: 0,
})
const registerRules: FormRules = {
  tailReceivedQty: [{ required: true, message: '请输入实际包装完成数量', trigger: 'blur' }],
}

function formatDateTime(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN')
}

function buildQuery(): FinishingListQuery {
  return {
    tab: currentTab.value,
    orderNo: filter.orderNo || undefined,
    skuCode: filter.skuCode || undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
}

async function load() {
  loading.value = true
  try {
    const res = await getFinishingItems(buildQuery())
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
  currentTab.value = 'all'
  pagination.page = 1
  selectedRows.value = []
  load()
}

function onTabChange() {
  pagination.page = 1
  selectedRows.value = []
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function onSelectionChange(rows: FinishingListItem[]) {
  selectedRows.value = rows
}

function openRegisterDialog() {
  const canReg = selectedRows.value.filter(
    (r) => r.finishingStatus === 'pending_ship' && r.tailReceivedQty == null,
  )
  if (canReg.length === 0) return
  const row = canReg[0]
  registerDialog.row = row
  registerForm.tailReceivedQty = 0
  registerForm.defectQuantity = 0
  registerDialog.visible = true
}

function resetRegisterForm() {
  registerDialog.row = null
  registerForm.tailReceivedQty = 0
  registerForm.defectQuantity = 0
  registerFormRef.value?.clearValidate()
}

async function submitRegister() {
  if (!registerDialog.row) return
  await registerFormRef.value?.validate().catch(() => {})
  registerDialog.submitting = true
  try {
    await registerFinishingPackaging({
      orderId: registerDialog.row.orderId,
      tailReceivedQty: registerForm.tailReceivedQty,
      defectQuantity: registerForm.defectQuantity,
    })
    ElMessage.success('登记成功')
    registerDialog.visible = false
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '操作失败'))
  } finally {
    registerDialog.submitting = false
  }
}

async function onShip() {
  const toShip = selectedRows.value.filter(
    (r) => r.finishingStatus === 'pending_ship' && r.tailReceivedQty != null,
  )
  if (toShip.length === 0) return
  shipping.value = true
  try {
    for (const row of toShip) {
      await shipFinishingOrder(row.orderId)
    }
    ElMessage.success(`已发货 ${toShip.length} 条`)
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '发货失败'))
  } finally {
    shipping.value = false
  }
}

async function onInbound() {
  const toInbound = selectedRows.value.filter((r) => r.finishingStatus === 'shipped')
  if (toInbound.length === 0) return
  inbounding.value = true
  try {
    for (const row of toInbound) {
      await inboundFinishingOrder(row.orderId)
    }
    ElMessage.success(`已入库 ${toInbound.length} 条，订单已完成`)
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '入库失败'))
  } finally {
    inbounding.value = false
  }
}

onMounted(() => load())
</script>

<style scoped>
.finishing-page {
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

.finishing-table {
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

.register-form {
  margin-top: var(--space-sm);
}
</style>
