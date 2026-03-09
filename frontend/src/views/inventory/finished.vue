<template>
  <div class="page-card inventory-finished-page">
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button
            v-for="tab in FINISHED_TABS"
            :key="tab.value"
            :label="tab.value"
          >
            {{ tab.label }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

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
          v-if="hasPendingSelection"
          type="primary"
          size="large"
          :loading="inboundLoading"
          @click="openInboundDialog"
        >
          入库
        </el-button>
        <el-button
          v-if="hasStoredSelection"
          type="warning"
          size="large"
          :loading="outboundLoading"
          @click="openOutboundDialog"
        >
          出库
        </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      class="finished-table"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column prop="orderNo" label="订单号" min-width="110" show-overflow-tooltip />
      <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
      <el-table-column prop="quantity" label="数量" width="90" align="right" />
      <el-table-column label="状态" width="88" align="center">
        <template #default="{ row }">
          <el-tag :type="row.type === 'stored' ? 'success' : 'info'" size="small">
            {{ row.type === 'stored' ? '已入库' : '待入库' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="warehouse" label="仓库" min-width="90" show-overflow-tooltip />
      <el-table-column prop="department" label="部门" min-width="90" show-overflow-tooltip />
      <el-table-column prop="location" label="存放地址" min-width="120" show-overflow-tooltip />
      <el-table-column prop="createdAt" label="时间" width="160" align="center" />
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

    <el-dialog
      v-model="inboundDialog.visible"
      title="入库（填写货物存放地址）"
      width="440"
      destroy-on-close
      @close="resetInboundForm"
    >
      <el-form
        ref="inboundFormRef"
        :model="inboundForm"
        :rules="inboundRules"
        label-width="100px"
      >
        <el-form-item label="仓库" prop="warehouse">
          <el-input v-model="inboundForm.warehouse" placeholder="请输入仓库" clearable />
        </el-form-item>
        <el-form-item label="部门" prop="department">
          <el-input v-model="inboundForm.department" placeholder="请输入部门" clearable />
        </el-form-item>
        <el-form-item label="位置登记" prop="location">
          <el-input v-model="inboundForm.location" placeholder="请输入货物存放地址" clearable />
        </el-form-item>
        <el-form-item label="图片" prop="imageUrl">
          <ImageUploadArea v-model="inboundForm.imageUrl" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="inboundDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="inboundDialog.submitting" @click="submitInbound">
          确定入库
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="outboundDialog.visible"
      title="出库"
      width="400"
      destroy-on-close
      @close="resetOutboundForm"
    >
      <el-form
        ref="outboundFormRef"
        :model="outboundForm"
        :rules="outboundRules"
        label-width="80px"
      >
        <el-form-item label="出库数量" prop="quantity">
          <el-input-number
            v-model="outboundForm.quantity"
            :min="1"
            :max="outboundMaxQty"
            :precision="0"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <p v-if="outboundDialog.row" class="outbound-tip">
          当前库存：{{ outboundDialog.row.quantity }}
        </p>
      </el-form>
      <template #footer>
        <el-button @click="outboundDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="outboundDialog.submitting" @click="submitOutbound">
          确定出库
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import {
  getFinishedStockList,
  doPendingInbound,
  finishedOutbound,
  type FinishedStockRow,
} from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const FINISHED_TABS = [
  { label: '全部', value: 'all' },
  { label: '待入库', value: 'pending' },
  { label: '已入库', value: 'stored' },
] as const

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14

function getFilterInputStyle(v: unknown) {
  return v ? { color: ACTIVE_FILTER_COLOR } : undefined
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

const currentTab = ref<string>('all')
const filter = reactive({ orderNo: '', skuCode: '' })
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)
const list = ref<FinishedStockRow[]>([])
const loading = ref(false)
const inboundLoading = ref(false)
const outboundLoading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<FinishedStockRow[]>([])

const pendingRows = computed(() => selectedRows.value.filter((r) => r.type === 'pending'))
const storedRows = computed(() => selectedRows.value.filter((r) => r.type === 'stored'))
const hasPendingSelection = computed(() => pendingRows.value.length > 0)
const hasStoredSelection = computed(() => storedRows.value.length > 0)

const inboundDialog = reactive<{ visible: boolean; submitting: boolean }>({
  visible: false,
  submitting: false,
})
const inboundFormRef = ref<FormInstance>()
const inboundForm = reactive({ warehouse: '', department: '', location: '', imageUrl: '' })
const inboundRules: FormRules = {
  warehouse: [{ required: true, message: '请输入仓库', trigger: 'blur' }],
  department: [{ required: true, message: '请输入部门', trigger: 'blur' }],
  location: [{ required: true, message: '请输入位置登记', trigger: 'blur' }],
}

const outboundDialog = reactive<{
  visible: boolean
  submitting: boolean
  row: FinishedStockRow | null
}>({ visible: false, submitting: false, row: null })
const outboundFormRef = ref<FormInstance>()
const outboundForm = reactive({ quantity: 1 })
const outboundRules: FormRules = {
  quantity: [{ required: true, message: '请输入出库数量', trigger: 'blur' }],
}
const outboundMaxQty = computed(() => outboundDialog.row?.quantity ?? 0)

async function load() {
  loading.value = true
  try {
    const res = await getFinishedStockList({
      tab: currentTab.value,
      orderNo: filter.orderNo || undefined,
      skuCode: filter.skuCode || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
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

function onSelectionChange(rows: FinishedStockRow[]) {
  selectedRows.value = rows
}

function openInboundDialog() {
  if (!pendingRows.value.length) return
  inboundDialog.visible = true
}

function resetInboundForm() {
  inboundForm.warehouse = ''
  inboundForm.department = ''
  inboundForm.location = ''
  inboundForm.imageUrl = ''
  inboundFormRef.value?.clearValidate()
}

async function submitInbound() {
  await inboundFormRef.value?.validate().catch(() => {})
  const ids = pendingRows.value.map((r) => r.id)
  if (!ids.length) return
  inboundDialog.submitting = true
  try {
    await doPendingInbound({
      ids,
      warehouse: inboundForm.warehouse,
      department: inboundForm.department,
      location: inboundForm.location,
      imageUrl: inboundForm.imageUrl || undefined,
    })
    ElMessage.success('入库成功')
    inboundDialog.visible = false
    selectedRows.value = []
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    inboundDialog.submitting = false
  }
}

function openOutboundDialog() {
  if (storedRows.value.length === 0) return
  const row = storedRows.value[0]
  outboundDialog.row = row
  outboundForm.quantity = row.quantity > 0 ? 1 : 0
  outboundDialog.visible = true
}

function resetOutboundForm() {
  outboundDialog.row = null
  outboundForm.quantity = 1
  outboundFormRef.value?.clearValidate()
}

async function submitOutbound() {
  if (!outboundDialog.row) return
  await outboundFormRef.value?.validate().catch(() => {})
  const qty = outboundForm.quantity
  if (qty <= 0 || qty > outboundDialog.row.quantity) {
    ElMessage.warning('出库数量无效')
    return
  }
  outboundDialog.submitting = true
  try {
    await finishedOutbound(outboundDialog.row.id, qty)
    ElMessage.success('出库成功')
    outboundDialog.visible = false
    selectedRows.value = []
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    outboundDialog.submitting = false
  }
}

onMounted(() => load())
</script>

<style scoped>
.inventory-finished-page {
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

.finished-table {
  margin-bottom: var(--space-md);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
}

.outbound-tip {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  margin-top: -8px;
  margin-bottom: 0;
}
</style>
