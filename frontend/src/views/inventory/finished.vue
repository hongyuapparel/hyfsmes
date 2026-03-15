<template>
  <div class="page-card inventory-finished-page">
    <el-tabs v-model="pageTab" class="inventory-tabs" @tab-change="onPageTabChange">
      <el-tab-pane label="库存" name="stock">
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
          <el-select
            v-model="filter.customerName"
            placeholder="客户"
            filterable
            clearable
            size="large"
            class="filter-bar-item"
            @change="onSearch(true)"
          >
            <el-option
              v-for="opt in customerOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <el-select
            v-model="filter.inventoryTypeId"
            placeholder="库存类型"
            filterable
            clearable
            size="large"
            class="filter-bar-item"
            @change="onSearch(true)"
          >
            <el-option
              v-for="opt in inventoryTypeOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
            />
          </el-select>
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
            <el-button size="large" @click="onReset">清空</el-button>
            <el-button type="primary" size="large" @click="openCreateDialog">新增库存</el-button>
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
          <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip />
          <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
          <el-table-column prop="quantity" label="数量" width="90" align="right" />
          <el-table-column label="状态" width="88" align="center">
            <template #default="{ row }">
              <el-tag :type="row.type === 'stored' ? 'success' : 'info'" size="small">
                {{ row.type === 'stored' ? '已入库' : '待入库' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="仓库" min-width="90" show-overflow-tooltip>
            <template #default="{ row }">
              {{ findWarehouseLabelById(row.warehouseId) || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="库存类型" min-width="100" show-overflow-tooltip>
            <template #default="{ row }">
              {{ findInventoryTypeLabelById(row.inventoryTypeId) || '-' }}
            </template>
          </el-table-column>
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
      </el-tab-pane>

      <el-tab-pane label="出库记录" name="outbounds">
        <div class="filter-bar">
          <el-input v-model="outboundFilter.orderNo" placeholder="订单号" clearable size="large" class="filter-bar-item" @keyup.enter="onOutboundSearch(true)" />
          <el-input v-model="outboundFilter.skuCode" placeholder="SKU" clearable size="large" class="filter-bar-item" @keyup.enter="onOutboundSearch(true)" />
          <el-select v-model="outboundFilter.customerName" placeholder="客户" filterable clearable size="large" class="filter-bar-item" @change="onOutboundSearch(true)">
            <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-date-picker
            v-model="outboundFilter.dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            size="large"
            class="filter-bar-item"
            @change="onOutboundSearch(true)"
          />
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onOutboundSearch(true)">搜索</el-button>
            <el-button size="large" @click="onOutboundReset">清空</el-button>
          </div>
        </div>

        <el-table v-loading="outboundLoading2" :data="outboundList" border stripe class="finished-table">
          <el-table-column prop="createdAt" label="时间" width="160" align="center">
            <template #default="{ row }">{{ row.createdAt }}</template>
          </el-table-column>
          <el-table-column prop="orderNo" label="订单号" min-width="110" show-overflow-tooltip />
          <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip />
          <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
          <el-table-column prop="quantity" label="出库数量" width="90" align="right" />
          <el-table-column prop="operatorUsername" label="操作人" width="120" show-overflow-tooltip />
          <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        </el-table>

        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="outboundPagination.page"
            v-model:page-size="outboundPagination.pageSize"
            :total="outboundPagination.total"
            :page-sizes="[20, 40, 60]"
            layout="total, sizes, prev, pager, next"
            @current-change="loadOutbounds"
            @size-change="onOutboundPageSizeChange"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

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
        <el-form-item label="仓库" prop="warehouseId">
          <el-select
            v-model="inboundForm.warehouseId"
            placeholder="请选择仓库"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="opt in warehouseOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="库存类型" prop="inventoryTypeId">
          <el-select
            v-model="inboundForm.inventoryTypeId"
            placeholder="请选择库存类型"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="opt in inventoryTypeOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
            />
          </el-select>
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

    <el-dialog
      v-model="createDialog.visible"
      title="新增库存"
      width="520"
      destroy-on-close
      @close="resetCreateForm"
    >
      <el-form
        ref="createFormRef"
        :model="createForm"
        :rules="createRules"
        label-width="90px"
      >
        <el-form-item label="订单号" prop="orderNo">
          <el-input v-model="createForm.orderNo" placeholder="请输入订单号" clearable />
        </el-form-item>
        <el-form-item label="SKU" prop="skuCode">
          <el-input v-model="createForm.skuCode" placeholder="请输入SKU编号" clearable />
        </el-form-item>
        <el-form-item label="尺寸数量">
          <div class="size-rows">
            <div
              v-for="(row, index) in sizeRows"
              :key="index"
              class="size-row"
            >
              <el-input
                v-model="row.size"
                placeholder="尺寸（如 S / M / L）"
                class="size-input"
                clearable
              />
              <el-input-number
                v-model="row.quantity"
                :min="0"
                :precision="0"
                controls-position="right"
                class="size-qty-input"
              />
              <el-button
                v-if="sizeRows.length > 1"
                type="danger"
                link
                @click="removeSizeRow(index)"
              >
                删除
              </el-button>
            </div>
            <div class="size-total-line">
              <el-button type="primary" link @click="addSizeRow">新增尺寸行</el-button>
              <span class="size-total-text">合计数量：{{ sizeTotalQuantity }}</span>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="仓库" prop="warehouseId">
          <el-select
            v-model="createForm.warehouseId"
            placeholder="请选择仓库"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="opt in warehouseOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="库存类型" prop="inventoryTypeId">
          <el-select
            v-model="createForm.inventoryTypeId"
            placeholder="请选择库存类型"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="opt in inventoryTypeOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="部门" prop="department">
          <el-input v-model="createForm.department" placeholder="请输入部门" clearable />
        </el-form-item>
        <el-form-item label="存放地址" prop="location">
          <el-input v-model="createForm.location" placeholder="请输入具体存放地址" clearable />
        </el-form-item>
        <el-form-item label="图片">
          <ImageUploadArea v-model="createForm.imageUrl" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="createDialog.submitting" @click="submitCreate">
          确定
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
  createFinishedStock,
  getFinishedOutboundRecords,
  type FinishedStockRow,
  type FinishedOutboundRecord,
} from '@/api/inventory'
import { getSystemOptionsList, type SystemOptionItem } from '@/api/system-options'
import { getCustomers, type CustomerItem } from '@/api/customers'
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

const pageTab = ref<'stock' | 'outbounds'>('stock')
const currentTab = ref<string>('stored')
const filter = reactive<{
  orderNo: string
  skuCode: string
  customerName: string
  inventoryTypeId: number | null
}>({ orderNo: '', skuCode: '', customerName: '', inventoryTypeId: null })
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)
const list = ref<FinishedStockRow[]>([])
const customerOptions = ref<{ label: string; value: string }[]>([])
const warehouseOptions = ref<{ id: number; label: string }[]>([])
const inventoryTypeOptions = ref<{ id: number; label: string }[]>([])
const loading = ref(false)
const inboundLoading = ref(false)
const outboundLoading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<FinishedStockRow[]>([])

const outboundFilter = reactive<{
  orderNo: string
  skuCode: string
  customerName: string
  dateRange: [string, string] | []
}>({ orderNo: '', skuCode: '', customerName: '', dateRange: [] })
const outboundList = ref<FinishedOutboundRecord[]>([])
const outboundLoading2 = ref(false)
const outboundPagination = reactive({ page: 1, pageSize: 20, total: 0 })

const pendingRows = computed(() => selectedRows.value.filter((r) => r.type === 'pending'))
const storedRows = computed(() => selectedRows.value.filter((r) => r.type === 'stored'))
const hasPendingSelection = computed(() => pendingRows.value.length > 0)
const hasStoredSelection = computed(() => storedRows.value.length > 0)

const inboundDialog = reactive<{ visible: boolean; submitting: boolean }>({
  visible: false,
  submitting: false,
})
const inboundFormRef = ref<FormInstance>()
const inboundForm = reactive<{
  warehouseId: number | null
  inventoryTypeId: number | null
  department: string
  location: string
  imageUrl: string
}>({
  warehouseId: null,
  inventoryTypeId: null,
  department: '',
  location: '',
  imageUrl: '',
})
const inboundRules: FormRules = {
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
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

const createDialog = reactive<{ visible: boolean; submitting: boolean }>({
  visible: false,
  submitting: false,
})
const createFormRef = ref<FormInstance>()
const createForm = reactive({
  orderNo: '',
  skuCode: '',
  quantity: 1,
  warehouseId: null as number | null,
  inventoryTypeId: null as number | null,
  department: '',
  location: '',
  imageUrl: '',
})
const createRules: FormRules = {
  orderNo: [{ required: true, message: '请输入订单号', trigger: 'blur' }],
  skuCode: [{ required: true, message: '请输入SKU', trigger: 'blur' }],
  quantity: [{ required: true, message: '请输入数量', trigger: 'blur' }],
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  department: [{ required: true, message: '请输入部门', trigger: 'blur' }],
  location: [{ required: true, message: '请输入存放地址', trigger: 'blur' }],
}

const sizeRows = ref<{ size: string; quantity: number }[]>([
  { size: '', quantity: 0 },
])

const sizeTotalQuantity = computed(() =>
  sizeRows.value.reduce((sum, row) => {
    const q = Number(row.quantity)
    return Number.isFinite(q) && q > 0 ? sum + q : sum
  }, 0),
)

function addSizeRow() {
  sizeRows.value.push({ size: '', quantity: 0 })
}

function removeSizeRow(index: number) {
  sizeRows.value.splice(index, 1)
  if (!sizeRows.value.length) sizeRows.value.push({ size: '', quantity: 0 })
}

async function loadCustomerOptions() {
  try {
    const res = await getCustomers({ page: 1, pageSize: 200, sortBy: 'companyName', sortOrder: 'asc' })
    const list = (res.data?.list ?? []) as CustomerItem[]
    customerOptions.value = list.map((c) => ({
      label: c.companyName,
      value: c.companyName,
    }))
  } catch (e: unknown) {
    console.warn('客户选项加载失败')
  }
}

async function load() {
  loading.value = true
  try {
    const res = await getFinishedStockList({
      tab: currentTab.value,
      orderNo: filter.orderNo || undefined,
      skuCode: filter.skuCode || undefined,
      customerName: filter.customerName || undefined,
      inventoryTypeId: filter.inventoryTypeId ?? undefined,
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

function onPageTabChange() {
  if (pageTab.value === 'outbounds') {
    outboundPagination.page = 1
    loadOutbounds()
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
  filter.customerName = ''
  filter.inventoryTypeId = null
  currentTab.value = 'stored'
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
  inboundForm.warehouseId = null
  inboundForm.inventoryTypeId = null
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
      warehouseId: inboundForm.warehouseId,
      inventoryTypeId: inboundForm.inventoryTypeId ?? undefined,
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

function openCreateDialog() {
  createDialog.visible = true
  resetCreateForm()
}

function resetCreateForm() {
  createForm.orderNo = ''
  createForm.skuCode = ''
  createForm.quantity = 1
  createForm.warehouseId = null
  createForm.inventoryTypeId = null
  createForm.department = ''
  createForm.location = ''
  createForm.imageUrl = ''
  sizeRows.value = [{ size: '', quantity: 0 }]
  createFormRef.value?.clearValidate()
}

async function submitCreate() {
  await createFormRef.value?.validate().catch(() => {})
  const totalQty = sizeTotalQuantity.value
  if (!totalQty || totalQty <= 0) {
    ElMessage.warning('请填写尺寸对应的数量')
    return
  }
  createForm.quantity = totalQty
  createDialog.submitting = true
  try {
    await createFinishedStock({
      orderNo: createForm.orderNo,
      skuCode: createForm.skuCode,
      quantity: createForm.quantity,
      warehouseId: createForm.warehouseId,
      inventoryTypeId: createForm.inventoryTypeId ?? undefined,
      department: createForm.department,
      location: createForm.location,
      imageUrl: createForm.imageUrl || undefined,
    })
    ElMessage.success('新增库存成功')
    createDialog.visible = false
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    createDialog.submitting = false
  }
}

function findWarehouseLabelById(id: number | null | undefined): string {
  if (id == null) return ''
  const item = warehouseOptions.value.find((w) => w.id === id)
  return item?.label ?? ''
}

function findInventoryTypeLabelById(id: number | null | undefined): string {
  if (id == null) return ''
  const item = inventoryTypeOptions.value.find((o) => o.id === id)
  return item?.label ?? ''
}

async function loadWarehouseOptions() {
  try {
    const res = await getSystemOptionsList('warehouses')
    const list = (res.data ?? []) as SystemOptionItem[]
    warehouseOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
  } catch {
    warehouseOptions.value = []
  }
}

async function loadInventoryTypeOptions() {
  try {
    const res = await getSystemOptionsList('inventory_types')
    const list = (res.data ?? []) as SystemOptionItem[]
    inventoryTypeOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
  } catch {
    inventoryTypeOptions.value = []
  }
}

onMounted(async () => {
  await Promise.all([loadWarehouseOptions(), loadInventoryTypeOptions(), loadCustomerOptions()])
  await load()
})

async function loadOutbounds() {
  outboundLoading2.value = true
  try {
    const [startDate, endDate] = Array.isArray(outboundFilter.dateRange) && outboundFilter.dateRange.length === 2 ? outboundFilter.dateRange : ['', '']
    const res = await getFinishedOutboundRecords({
      orderNo: outboundFilter.orderNo || undefined,
      skuCode: outboundFilter.skuCode || undefined,
      customerName: outboundFilter.customerName || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: outboundPagination.page,
      pageSize: outboundPagination.pageSize,
    })
    const data = res.data
    outboundList.value = data?.list ?? []
    outboundPagination.total = data?.total ?? 0
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    outboundLoading2.value = false
  }
}

function onOutboundSearch(_byUser = false) {
  outboundPagination.page = 1
  loadOutbounds()
}

function onOutboundReset() {
  outboundFilter.orderNo = ''
  outboundFilter.skuCode = ''
  outboundFilter.customerName = ''
  outboundFilter.dateRange = []
  outboundPagination.page = 1
  loadOutbounds()
}

function onOutboundPageSizeChange() {
  outboundPagination.page = 1
  loadOutbounds()
}
</script>

<style scoped>
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

.size-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  width: 100%;
}

.size-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.size-input {
  flex: 1.2;
}

.size-qty-input {
  flex: 1;
}

.size-total-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-xs);
}

.size-total-text {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}
</style>
