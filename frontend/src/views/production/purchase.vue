<template>
  <div class="page-card purchase-page">
    <!-- Tab：全部 / 等待采购 / 采购完成 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button
            v-for="tab in PURCHASE_TABS"
            :key="tab.value"
            :label="tab.value"
          >
            {{ tab.label }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 筛选区：与订单列表同一设计（下单时间、订单号、SKU、供应商、订单类型） -->
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
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            订单类型：
          </span>
        </template>
      </el-tree-select>
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
          v-if="hasSelection"
          type="primary"
          size="large"
          @click="openRegisterDialog"
        >
          登记实际采购
        </el-button>
      </div>
    </div>

    <!-- 物料列表表格 -->
    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      class="purchase-table"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column prop="orderDate" label="下单时间" width="110" align="center">
        <template #default="{ row }">
          {{ formatDate(row.orderDate) }}
        </template>
      </el-table-column>
      <el-table-column prop="orderNo" label="订单号" min-width="100" show-overflow-tooltip />
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
      <el-table-column prop="materialName" label="物料名称" min-width="120" show-overflow-tooltip />
      <el-table-column prop="planQuantity" label="计划用量" width="96" align="right">
        <template #default="{ row }">
          {{ row.planQuantity != null ? row.planQuantity : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="actualPurchaseQuantity" label="实际采购" width="96" align="right">
        <template #default="{ row }">
          {{ row.actualPurchaseQuantity != null ? row.actualPurchaseQuantity : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="purchaseAmount" label="采购金额" width="100" align="right">
        <template #default="{ row }">
          {{ row.purchaseAmount != null && row.purchaseAmount !== '' ? `￥${row.purchaseAmount}` : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="purchaseStatus" label="采购状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.purchaseStatus === 'completed' ? 'success' : 'warning'" size="small">
            {{ row.purchaseStatus === 'completed' ? '采购完成' : '等待采购' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="orderType" label="订单类型" width="100" show-overflow-tooltip />
      <el-table-column prop="purchaseCompletedAt" label="完成时间" width="110" align="center">
        <template #default="{ row }">
          {{ formatDate(row.purchaseCompletedAt) }}
        </template>
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

    <!-- 登记实际采购弹窗 -->
    <el-dialog
      v-model="registerDialog.visible"
      title="登记实际采购"
      width="420"
      destroy-on-close
      @close="resetRegisterForm"
    >
      <template v-if="registerDialog.row">
        <div class="register-brief">
          <div>订单号：{{ registerDialog.row.orderNo }}</div>
          <div>物料：{{ registerDialog.row.materialName }}</div>
          <div>供应商：{{ registerDialog.row.supplierName }}</div>
        </div>
        <el-form
          ref="registerFormRef"
          :model="registerForm"
          :rules="registerRules"
          label-width="100px"
          class="register-form"
        >
          <el-form-item label="实际采购数量" prop="actualPurchaseQuantity">
            <el-input-number
              v-model="registerForm.actualPurchaseQuantity"
              :min="0"
              :precision="0"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="采购金额" prop="purchaseAmount">
            <el-input
              v-model="registerForm.purchaseAmount"
              placeholder="元"
              clearable
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
import { getPurchaseItems, registerPurchase, type PurchaseItemRow, type PurchaseListQuery } from '@/api/production-purchase'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getDictTree } from '@/api/dicts'
import type { SystemOptionTreeNode } from '@/api/system-options'

const PURCHASE_TABS = [
  { label: '全部', value: 'all' },
  { label: '等待采购', value: 'pending' },
  { label: '采购完成', value: 'completed' },
] as const

const orderTypeTree = ref<SystemOptionTreeNode[]>([])
function toOrderTypeTreeSelect(
  nodes: SystemOptionTreeNode[],
  parentPath = '',
): { label: string; value: string; children?: unknown[]; disabled?: boolean }[] {
  return nodes.map((n) => {
    const path = parentPath ? `${parentPath} > ${n.value}` : n.value
    const children = n.children?.length ? toOrderTypeTreeSelect(n.children, path) : []
    const hasChildren = children.length > 0
    return {
      label: n.value,
      value: path,
      children: hasChildren ? children : undefined,
      disabled: hasChildren,
    }
  })
}
const orderTypeTreeSelectData = computed(() => toOrderTypeTreeSelect(orderTypeTree.value))
function getOrderTypeDisplayLabel(v: string | undefined): string {
  if (!v) return ''
  const parts = v.split('>').map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : v
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
function getFilterRangeStyle(v: [string, string] | null) {
  const hasValue = v && v.length === 2
  const width = hasValue ? DATE_RANGE_WIDTH_FILLED : DATE_RANGE_WIDTH_EMPTY
  const base = { width, flex: `0 0 ${width}` }
  return hasValue ? { ...base, ...activeSelectStyle } : base
}

const filter = reactive({
  orderNo: '',
  skuCode: '',
  supplier: '',
  orderType: '',
})
const orderDateRange = ref<[string, string] | null>(null)
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)

const currentTab = ref<string>('all')
const list = ref<PurchaseItemRow[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<PurchaseItemRow[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)

const registerDialog = reactive<{
  visible: boolean
  submitting: boolean
  row: PurchaseItemRow | null
}>({ visible: false, submitting: false, row: null })
const registerFormRef = ref<FormInstance>()
const registerForm = reactive({
  actualPurchaseQuantity: 0,
  purchaseAmount: '',
})
const registerRules: FormRules = {
  actualPurchaseQuantity: [{ required: true, message: '请输入实际采购数量', trigger: 'blur' }],
}

function formatDate(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('zh-CN')
}

function buildQuery(): PurchaseListQuery {
  const q: PurchaseListQuery = {
    tab: currentTab.value,
    orderNo: filter.orderNo || undefined,
    skuCode: filter.skuCode || undefined,
    supplier: filter.supplier || undefined,
    orderType: filter.orderType || undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
  if (orderDateRange.value && orderDateRange.value.length === 2) {
    q.orderDateStart = orderDateRange.value[0]
    q.orderDateEnd = orderDateRange.value[1]
  }
  return q
}

async function load() {
  loading.value = true
  try {
    const res = await getPurchaseItems(buildQuery())
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
  filter.supplier = ''
  filter.orderType = ''
  orderDateRange.value = null
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

function onSelectionChange(rows: PurchaseItemRow[]) {
  selectedRows.value = rows
}

function openRegisterDialog() {
  if (selectedRows.value.length === 0) return
  const row = selectedRows.value[0]
  registerDialog.row = row
  registerForm.actualPurchaseQuantity = row.actualPurchaseQuantity ?? row.planQuantity ?? 0
  registerForm.purchaseAmount = row.purchaseAmount ?? ''
  registerDialog.visible = true
}

function resetRegisterForm() {
  registerDialog.row = null
  registerForm.actualPurchaseQuantity = 0
  registerForm.purchaseAmount = ''
  registerFormRef.value?.clearValidate()
}

async function submitRegister() {
  if (!registerDialog.row) return
  await registerFormRef.value?.validate().catch(() => {})
  registerDialog.submitting = true
  try {
    await registerPurchase({
      orderId: registerDialog.row.orderId,
      materialIndex: registerDialog.row.materialIndex,
      actualPurchaseQuantity: registerForm.actualPurchaseQuantity,
      purchaseAmount: registerForm.purchaseAmount.trim() || '0',
    })
    ElMessage.success('登记成功')
    registerDialog.visible = false
    await load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '登记失败'))
  } finally {
    registerDialog.submitting = false
  }
}

async function loadOptions() {
  try {
    const res = await getDictTree('order_types')
    orderTypeTree.value = Array.isArray(res.data) ? res.data : []
  } catch {
    orderTypeTree.value = []
  }
}

onMounted(() => {
  loadOptions()
  load()
})
</script>

<style scoped>
.purchase-page {
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

.purchase-table {
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

.register-brief {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  font-size: var(--font-size-caption, 12px);
  color: var(--el-text-color-regular);
}

.register-brief > div + div {
  margin-top: 4px;
}

.register-form {
  margin-top: var(--space-sm);
}
</style>
