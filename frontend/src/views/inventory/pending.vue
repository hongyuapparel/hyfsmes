<template>
  <div class="page-card page-card--fill inventory-pending-page">
    <el-tabs v-model="pageTab" class="inventory-tabs" @tab-change="onPageTabChange">
      <el-tab-pane label="待处理" name="pending" />
      <el-tab-pane label="已发货" name="shipped" />
    </el-tabs>

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
          v-if="pageTab === 'pending' && hasSelection"
          type="primary"
          size="large"
          :loading="inboundLoading"
          @click="openInboundDialog"
        >
          入库
        </el-button>
        <el-button
          v-if="pageTab === 'pending' && canOutboundSelection"
          type="warning"
          size="large"
          :loading="outboundDialog.submitting"
          @click="openOutboundDialog"
        >
          发货
        </el-button>
      </div>
    </div>

    <div v-if="pageTab === 'pending' && hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <div ref="tableShellRef" class="list-page-table-shell">
    <el-table
      ref="pendingTableRef"
      v-loading="loading"
      :data="list"
      border
      stripe
      class="pending-table"
      :height="tableHeight"
      @header-dragend="onPendingHeaderDragEnd"
      @selection-change="onSelectionChange"
    >
      <el-table-column v-if="pageTab === 'pending'" type="selection" width="48" align="center" />
      <el-table-column prop="orderNo" label="订单号" min-width="120" show-overflow-tooltip />
      <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip />
      <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
      <el-table-column label="图片" width="90" align="center">
        <template #default="{ row }">
          <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" variant="table" />
          <span v-else class="text-placeholder">-</span>
        </template>
      </el-table-column>
      <el-table-column :label="pageTab === 'pending' ? '待处理数量' : '已发货数量'" width="140" align="right">
        <template #default="{ row }">
          <el-tooltip
            v-if="pageTab === 'pending'"
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
                        {{ formatDisplayNumber(v) }}
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </template>
            <span class="qty-inline">
              <span class="qty-hover">{{ formatDisplayNumber(row.quantity) }}</span>
              <el-tag v-if="row.sourceType === 'defect'" type="danger" size="small" effect="light" class="defect-tag">
                次品
              </el-tag>
            </span>
          </el-tooltip>
          <span v-else>{{ formatDisplayNumber(row.quantity) }}</span>
        </template>
      </el-table-column>
      <el-table-column :label="pageTab === 'pending' ? '完成时间' : '发货时间'" prop="createdAt" width="160" align="center" />
      <el-table-column v-if="pageTab === 'shipped'" prop="pickupUserName" label="领取人/收货人" width="140" show-overflow-tooltip />
      <el-table-column v-if="pageTab === 'shipped'" prop="operatorUsername" label="操作人" width="120" show-overflow-tooltip />
      <el-table-column v-if="pageTab === 'shipped'" prop="remark" label="备注" min-width="140" show-overflow-tooltip />
    </el-table>
    </div>

    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
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

    <el-dialog
      v-model="outboundDialog.visible"
      title="发货"
      width="860"
      destroy-on-close
      @close="resetOutboundForm"
    >
      <el-form
        ref="outboundFormRef"
        :model="outboundForm"
        :rules="outboundRules"
        label-width="80px"
      >
        <el-form-item label="领取人" prop="pickupUserId">
          <el-select
            v-model="outboundForm.pickupUserId"
            placeholder="请选择业务员"
            filterable
            clearable
            style="width: 260px"
          >
            <el-option
              v-for="opt in pickupUserOptions"
              :key="opt.id"
              :label="opt.displayName || opt.username"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <div class="outbound-batch-head">
          <span>客户：{{ outboundSelectedCustomer }}</span>
          <span>选中记录：{{ outboundDialog.items.length }}</span>
          <span>发货总数：{{ outboundGrandTotal }}</span>
        </div>
        <div class="outbound-batch-list">
          <div
            v-for="item in outboundDialog.items"
            :key="item.row.id"
            class="outbound-batch-card"
          >
            <div class="outbound-card-meta">
              <div>订单号：{{ item.row.orderNo }}</div>
              <div>SKU：{{ item.row.skuCode }}</div>
              <div>客户：{{ item.row.customerName || '-' }}</div>
              <div>当前待处理：{{ item.row.quantity }}</div>
            </div>
            <div v-if="item.headers.length" class="outbound-size-wrap">
              <el-table :data="item.rows" border size="small">
                <el-table-column label="颜色" min-width="100">
                  <template #default="{ row }">
                    {{ row.colorName || '-' }}
                  </template>
                </el-table-column>
                <el-table-column
                  v-for="(h, hIdx) in item.headers"
                  :key="hIdx"
                  :label="h"
                  min-width="80"
                  align="right"
                >
                  <template #default="{ row }">
                    <el-input-number
                      v-model="row.quantities[hIdx]"
                      :min="0"
                      :precision="0"
                      controls-position="right"
                      size="small"
                      style="width: 100%"
                    />
                  </template>
                </el-table-column>
              </el-table>
              <div class="outbound-size-footer">该记录合计：{{ formatDisplayNumber(getOutboundItemTotal(item)) }}</div>
            </div>
            <div v-else class="detail-muted">该记录暂无颜色尺码明细，无法发货。</div>
          </div>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="outboundDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="outboundDialog.submitting" @click="submitOutbound">
          确定发货
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  getPendingList,
  doPendingInbound,
  doPendingOutbound,
  getPendingPickupUserOptions,
  type PendingListItem,
  type FinishedPickupUserOption,
} from '@/api/inventory'
import { getSystemOptionsList, type SystemOptionItem } from '@/api/system-options'
import { getOrderColorSizeBreakdown, type OrderColorSizeBreakdownRes } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDisplayNumber } from '@/utils/display-number'

const filter = reactive({ orderNo: '', skuCode: '' })
const pageTab = ref<'pending' | 'shipped'>('pending')
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)
const list = ref<PendingListItem[]>([])
const pendingTableRef = ref()
const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)
const loading = ref(false)
const inboundLoading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<PendingListItem[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)
const canOutboundSelection = computed(
  () => pageTab.value === 'pending' && selectedRows.value.length > 0 && selectedRows.value.every((r) => r.sourceType !== 'defect'),
)
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

type PendingOutboundDialogItem = {
  row: PendingListItem
  headers: string[]
  rows: Array<{ colorName: string; quantities: number[] }>
}

const outboundDialog = reactive<{
  visible: boolean
  submitting: boolean
  items: PendingOutboundDialogItem[]
}>({ visible: false, submitting: false, items: [] })
const outboundFormRef = ref<FormInstance>()
const outboundForm = reactive({
  pickupUserId: null as number | null,
})
const outboundRules: FormRules = {
  pickupUserId: [{ required: true, message: '请选择领取人', trigger: 'change' }],
}
const pickupUserOptions = ref<FinishedPickupUserOption[]>([])
const outboundSelectedCustomer = computed(() => {
  const first = outboundDialog.items[0]?.row?.customerName?.trim()
  return first || '-'
})
const outboundGrandTotal = computed(() =>
  outboundDialog.items.reduce((sum, item) => sum + getOutboundItemTotal(item), 0),
)

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
      tab: pageTab.value,
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
  if (pageTab.value !== 'pending') return
  selectedRows.value = rows
}

function onPageTabChange() {
  selectedRows.value = []
  pagination.page = 1
  load()
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

async function loadPickupUserOptions() {
  try {
    const res = await getPendingPickupUserOptions()
    pickupUserOptions.value = res.data ?? []
  } catch {
    pickupUserOptions.value = []
  }
}

async function openOutboundDialog() {
  if (pageTab.value !== 'pending') return
  if (!selectedRows.value.length) return
  const rows = selectedRows.value
  if (rows.some((row) => row.sourceType === 'defect')) {
    ElMessage.warning('次品记录不支持直接发货')
    return
  }
  const customerNames = Array.from(new Set(rows.map((row) => row.customerName?.trim() || '__EMPTY__')))
  if (customerNames.length > 1) {
    ElMessage.warning('批量发货请只选择同一客户的记录')
    return
  }
  outboundForm.pickupUserId = null
  await Promise.all(
    rows
      .map((row) => row.orderId)
      .filter((orderId): orderId is number => Number.isInteger(orderId) && orderId > 0)
      .map((orderId) => ensureColorSizeBreakdown(orderId)),
  )
  outboundDialog.items = rows.map((row) => {
    const breakdown = row.orderId ? colorSizeCache[row.orderId] : undefined
    const headers = (breakdown?.headers ?? []).filter((h) => h !== '合计')
    return {
      row,
      headers,
      rows: (breakdown?.rows ?? []).map((r) => ({
        colorName: r.colorName,
        quantities: headers.map(() => 0),
      })),
    }
  })
  outboundDialog.visible = true
}

function resetOutboundForm() {
  outboundDialog.items = []
  outboundForm.pickupUserId = null
  outboundFormRef.value?.clearValidate()
}

function getOutboundItemTotal(item: PendingOutboundDialogItem) {
  return item.rows.reduce(
    (sum, row) => sum + row.quantities.reduce((rowSum, q) => rowSum + (Number(q) || 0), 0),
    0,
  )
}

async function submitOutbound() {
  if (!outboundDialog.items.length) return
  const valid = await outboundFormRef.value?.validate().catch(() => false)
  if (!valid) return
  const invalidItem = outboundDialog.items.find((item) => {
    const qty = getOutboundItemTotal(item)
    return item.headers.length === 0 || qty <= 0 || qty > item.row.quantity
  })
  if (invalidItem) {
    const qty = getOutboundItemTotal(invalidItem)
    if (invalidItem.headers.length === 0) {
      ElMessage.warning(`订单 ${invalidItem.row.orderNo} / ${invalidItem.row.skuCode} 暂无颜色尺码明细，无法发货`)
    } else if (qty <= 0) {
      ElMessage.warning(`订单 ${invalidItem.row.orderNo} / ${invalidItem.row.skuCode} 请填写发货数量`)
    } else {
      ElMessage.warning(`订单 ${invalidItem.row.orderNo} / ${invalidItem.row.skuCode} 的发货数量不能大于当前待处理数量`)
    }
    return
  }
  outboundDialog.submitting = true
  try {
    await doPendingOutbound({
      items: outboundDialog.items.map((item) => ({
        id: item.row.id,
        quantity: getOutboundItemTotal(item),
        sizeBreakdown: {
          headers: item.headers,
          rows: item.rows.map((row) => ({
            colorName: row.colorName,
            quantities: row.quantities.map((q) => Number(q) || 0),
          })),
        },
      })),
      pickupUserId: outboundForm.pickupUserId,
    })
    ElMessage.success('发货成功')
    outboundDialog.visible = false
    selectedRows.value = []
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    outboundDialog.submitting = false
  }
}

onMounted(async () => {
  await Promise.all([
    loadWarehouseOptions(),
    loadInventoryTypeOptions(),
    loadDepartmentOptions(),
    loadPickupUserOptions(),
  ])
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

.outbound-size-wrap {
  width: 100%;
}

.outbound-size-footer {
  margin-top: 8px;
  text-align: right;
  color: var(--el-text-color-secondary);
}

.outbound-batch-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
}

.outbound-batch-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 55vh;
  overflow: auto;
  padding-right: 4px;
}

.outbound-batch-card {
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-fill-color-blank);
}

.outbound-card-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px 12px;
  margin-bottom: 10px;
  color: var(--el-text-color-regular);
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
  min-height: 0;
}

.inventory-pending-page .pending-table {
  flex: 1;
  min-height: 0;
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.detail-muted {
  color: var(--el-text-color-secondary);
}
</style>
