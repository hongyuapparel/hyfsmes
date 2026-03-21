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
      ref="pendingTableRef"
      v-loading="loading"
      :data="list"
      border
      stripe
      class="pending-table"
      @header-dragend="onPendingHeaderDragEnd"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column prop="orderNo" label="订单号" min-width="120" show-overflow-tooltip />
      <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip />
      <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
      <el-table-column label="图片" width="90" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.imageUrl"
            :src="row.imageUrl"
            fit="cover"
            style="width: 56px; height: 56px; border-radius: 6px"
            :preview-src-list="[row.imageUrl]"
            preview-teleported
          />
          <span v-else class="text-placeholder">-</span>
        </template>
      </el-table-column>
      <el-table-column label="数量" width="140" align="right">
        <template #default="{ row }">
          <el-tooltip
            placement="top"
            effect="light"
            :show-after="250"
            :hide-after="0"
            :disabled="!row.orderId"
            popper-class="pending-qty-popper"
            @show="ensureColorSizeBreakdown(row.orderId)"
          >
            <template #content>
              <div class="qty-tooltip">
                <template v-if="colorSizeCache[row.orderId]?.loading">
                  <div class="qty-tooltip-loading">加载中...</div>
                </template>
                <template v-else-if="colorSizeCache[row.orderId]?.error">
                  <div class="qty-tooltip-error">明细加载失败</div>
                </template>
                <template v-else>
                  <div v-if="(colorSizeCache[row.orderId]?.headers?.length ?? 0) === 0" class="qty-tooltip-empty">
                    暂无明细
                  </div>
                  <div v-else class="qty-tooltip-grid">
                    <div class="qty-tooltip-row qty-tooltip-head">
                      <div class="qty-tooltip-cell qty-tooltip-color">颜色</div>
                      <div
                        v-for="(h, idx) in colorSizeCache[row.orderId].headers"
                        :key="idx"
                        class="qty-tooltip-cell"
                      >
                        {{ h }}
                      </div>
                    </div>
                    <div
                      v-for="(r, rIdx) in colorSizeCache[row.orderId].rows"
                      :key="rIdx"
                      class="qty-tooltip-row"
                    >
                      <div class="qty-tooltip-cell qty-tooltip-color">{{ r.colorName || '-' }}</div>
                      <div
                        v-for="(v, vIdx) in r.values"
                        :key="vIdx"
                        class="qty-tooltip-cell qty-tooltip-num"
                      >
                        {{ v }}
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </template>
            <span class="qty-inline">
              <span class="qty-hover">{{ row.quantity }}</span>
              <el-tag v-if="row.sourceType === 'defect'" type="danger" size="small" effect="light" class="defect-tag">
                次品
              </el-tag>
            </span>
          </el-tooltip>
        </template>
      </el-table-column>
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
        <el-form-item label="部门" prop="department">
          <el-select
            v-model="inboundForm.department"
            placeholder="请选择部门"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="opt in departmentOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
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
        <el-form-item label="存放地址" prop="location">
          <el-input v-model="inboundForm.location" placeholder="请输入具体存放地址" clearable />
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
import { getSystemOptionsList, type SystemOptionItem } from '@/api/system-options'
import { getOrderColorSizeBreakdown, type OrderColorSizeBreakdownRes } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
} from '@/composables/useFilterBarHelpers'

const filter = reactive({ orderNo: '', skuCode: '' })
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)
const list = ref<PendingListItem[]>([])
const pendingTableRef = ref()
const loading = ref(false)
const inboundLoading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<PendingListItem[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)
const { onHeaderDragEnd: onPendingHeaderDragEnd, restoreColumnWidths: restorePendingColumnWidths } =
  useTableColumnWidthPersist('inventory-pending-main')

const inboundDialog = reactive<{ visible: boolean; submitting: boolean }>({
  visible: false,
  submitting: false,
})
const inboundFormRef = ref<FormInstance>()
const inboundForm = reactive({
  warehouseId: null as number | null,
  inventoryTypeId: null as number | null,
  department: '',
  location: '',
})
const inboundRules: FormRules = {
  warehouseId: [{ required: true, message: '请选择仓库', trigger: 'change' }],
  department: [{ required: true, message: '请选择部门', trigger: 'change' }],
  location: [{ required: true, message: '请输入存放地址', trigger: 'blur' }],
}

const warehouseOptions = ref<{ id: number; label: string }[]>([])
const inventoryTypeOptions = ref<{ id: number; label: string }[]>([])
const departmentOptions = ref<{ value: string; label: string }[]>([])

const colorSizeCache = reactive<Record<
  number,
  {
    loading: boolean
    error: boolean
    headers: string[]
    rows: Array<{ colorName: string; values: number[] }>
  }
>>({})

async function ensureColorSizeBreakdown(orderId: number) {
  if (!orderId) return
  const existing = colorSizeCache[orderId]
  if (existing && (existing.loading || existing.headers.length > 0 || existing.error)) return
  colorSizeCache[orderId] = { loading: true, error: false, headers: [], rows: [] }
  try {
    const res = await getOrderColorSizeBreakdown(orderId)
    const data = (res.data ?? { headers: [], rows: [] }) as OrderColorSizeBreakdownRes
    colorSizeCache[orderId] = {
      loading: false,
      error: false,
      headers: Array.isArray(data.headers) ? data.headers : [],
      rows: Array.isArray(data.rows) ? data.rows : [],
    }
  } catch {
    colorSizeCache[orderId] = { loading: false, error: true, headers: [], rows: [] }
  }
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
      restorePendingColumnWidths(pendingTableRef.value)
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
  inboundForm.warehouseId = null
  inboundForm.inventoryTypeId = null
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
      warehouseId: inboundForm.warehouseId,
      inventoryTypeId: inboundForm.inventoryTypeId ?? undefined,
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

async function loadWarehouseOptions() {
  try {
    const res = await getSystemOptionsList('warehouses')
    const list = (res.data ?? []) as SystemOptionItem[]
    warehouseOptions.value = list.map((o) => ({ id: o.id, label: o.value }))
  } catch {
    warehouseOptions.value = []
  }
}

async function loadDepartmentOptions() {
  try {
    const res = await getSystemOptionsList('org_departments')
    const list = (res.data ?? []) as SystemOptionItem[]
    departmentOptions.value = list.map((o) => ({ value: o.value, label: o.value }))
  } catch {
    departmentOptions.value = []
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
  await Promise.all([loadWarehouseOptions(), loadInventoryTypeOptions(), loadDepartmentOptions()])
  await load()
})
</script>

<style scoped>
.qty-hover {
  cursor: help;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}

.qty-inline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.defect-tag {
  transform: scale(0.92);
  transform-origin: right center;
}

.qty-tooltip {
  max-width: 520px;
}

.qty-tooltip-loading,
.qty-tooltip-error,
.qty-tooltip-empty {
  padding: 6px 8px;
  font-size: 12px;
  line-height: 1.4;
}

.qty-tooltip-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.qty-tooltip-row {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(44px, auto);
  align-items: center;
  gap: 2px;
}

.qty-tooltip-cell {
  padding: 4px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.12);
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
}

.qty-tooltip-head .qty-tooltip-cell {
  background: rgba(255, 255, 255, 0.18);
  font-weight: 600;
}

.qty-tooltip-color {
  min-width: 72px;
  text-align: center;
}

.qty-tooltip-num {
  text-align: center;
}
</style>

<style>
/* tooltip 弹层在 body 下，需用全局样式；通过 popper-class 精确作用范围 */
.pending-qty-popper {
  padding: 0;
}

.pending-qty-popper .el-popper__arrow::before {
  border: 1px solid var(--el-border-color-lighter);
}

.pending-qty-popper .qty-tooltip {
  padding: 10px 12px;
}

.pending-qty-popper .qty-tooltip-cell {
  background: #f5f6f8;
  color: var(--el-text-color-regular);
  border: 1px solid var(--el-border-color-lighter);
  text-align: center;
}

.pending-qty-popper .qty-tooltip-head .qty-tooltip-cell {
  background: #eef1f6;
  font-weight: 600;
}
</style>

<style scoped>
.inventory-pending-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.inventory-pending-page .pending-table {
  margin-bottom: var(--space-md);
}
</style>
