<template>
  <div class="page-card inventory-pending-page">
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
          v-if="hasSelection"
          type="primary"
          size="large"
          :loading="inboundLoading"
          @click="openInboundDialog"
        >
          入库
        </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      class="pending-table"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column prop="orderNo" label="订单号" min-width="120" show-overflow-tooltip />
      <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip />
      <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
      <el-table-column prop="quantity" label="数量" width="90" align="right" />
      <el-table-column prop="createdAt" label="登记时间" width="160" align="center" />
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
      title="入库"
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
          <el-input v-model="inboundForm.location" placeholder="请输入货物存放位置" clearable />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="inboundDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="inboundDialog.submitting" @click="submitInbound">
          确定入库
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { getPendingList, doPendingInbound, type PendingListItem } from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'

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

const filter = reactive({ orderNo: '', skuCode: '' })
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)
const list = ref<PendingListItem[]>([])
const loading = ref(false)
const inboundLoading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<PendingListItem[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)

const inboundDialog = reactive<{ visible: boolean; submitting: boolean }>({
  visible: false,
  submitting: false,
})
const inboundFormRef = ref<FormInstance>()
const inboundForm = reactive({
  warehouse: '',
  department: '',
  location: '',
})
const inboundRules: FormRules = {
  warehouse: [{ required: true, message: '请输入仓库', trigger: 'blur' }],
  department: [{ required: true, message: '请输入部门', trigger: 'blur' }],
  location: [{ required: true, message: '请输入位置登记', trigger: 'blur' }],
}

async function load() {
  loading.value = true
  try {
    const res = await getPendingList({
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
  pagination.page = 1
  selectedRows.value = []
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function onSelectionChange(rows: PendingListItem[]) {
  selectedRows.value = rows
}

function openInboundDialog() {
  if (!selectedRows.value.length) return
  inboundDialog.visible = true
}

function resetInboundForm() {
  inboundForm.warehouse = ''
  inboundForm.department = ''
  inboundForm.location = ''
  inboundFormRef.value?.clearValidate()
}

async function submitInbound() {
  await inboundFormRef.value?.validate().catch(() => {})
  const ids = selectedRows.value.map((r) => r.id)
  if (!ids.length) return
  inboundDialog.submitting = true
  try {
    await doPendingInbound({
      ids,
      warehouse: inboundForm.warehouse,
      department: inboundForm.department,
      location: inboundForm.location,
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

onMounted(() => load())
</script>

<style scoped>
.inventory-pending-page .pending-table {
  margin-bottom: var(--space-md);
}
.pagination-wrap {
  display: flex;
  justify-content: flex-end;
}
</style>
