<template>
  <div class="tab-pane-scroll">
    <el-form class="filter-bar" @submit.prevent>
      <el-input
        v-model="filter.name"
        placeholder="面料名称"
        clearable
        class="filter-bar-item"
        :style="getTextFilterStyle('面料名称', filter.name, false)"
        :input-style="getFilterInputStyle(filter.name)"
        @keyup.enter="search"
      />
      <el-select
        v-model="filter.customerName"
        placeholder="客户"
        filterable
        clearable
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(filter.customerName ? `客户：${filter.customerName}` : '', '客户', 42)"
        @change="search"
      >
        <template #label="{ label }">
          <span v-if="filter.customerName">客户：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option v-for="option in customerOptions" :key="option.value" :label="option.label" :value="option.value" />
      </el-select>
      <el-select
        v-model="filter.inventoryTypeId"
        placeholder="库存类型"
        filterable
        clearable
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(selectedInventoryTypeLabel, '库存类型', 42)"
        @change="search"
      >
        <template #label="{ label }">
          <span v-if="filter.inventoryTypeId != null">库存类型：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option v-for="option in inventoryTypeOptions" :key="option.id" :label="option.label" :value="option.id" />
      </el-select>
      <div
        class="filter-bar-item filter-date-box"
        :class="{ 'is-active': filter.dateRange.length === 2 }"
        :style="getFilterRangeStyle(filter.dateRange, '出库时间')"
      >
        <span v-if="filter.dateRange.length === 2" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">
          出库时间：
        </span>
        <el-date-picker
          v-model="dateRangeModel"
          type="daterange"
          :name="['fabricOutboundDateStart', 'fabricOutboundDateEnd']"
          :range-separator="filter.dateRange.length === 2 ? '~' : ''"
          start-placeholder="出库时间"
          end-placeholder=""
          value-format="YYYY-MM-DD"
          :shortcuts="rangeShortcuts"
          unlink-panels
          clearable
          :class="['filter-range', { 'range-single': filter.dateRange.length !== 2 }]"
          @change="search"
        />
      </div>
      <div class="filter-bar-actions">
        <el-button type="primary" @click="search">搜索</el-button>
        <el-button @click="reset">清空</el-button>
      </div>
    </el-form>

    <div ref="shellRef" class="list-page-table-shell">
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="list"
        border
        stripe
        class="fabric-table"
        :height="tableHeight"
        :row-style="compactRowStyle"
        :cell-style="compactCellStyle"
        :header-cell-style="compactHeaderCellStyle"
        @header-dragend="onHeaderDragEnd"
      >
        <el-table-column prop="createdAt" label="时间" width="160" align="center" />
        <el-table-column prop="name" label="面料名称" min-width="150" show-overflow-tooltip align="center">
          <template #default="{ row }">
            <el-tooltip v-if="row.nameFromCurrentStock" :content="currentStockFallbackTip" placement="top">
              <span class="current-stock-fallback">{{ row.name }}</span>
            </el-tooltip>
            <span v-else>{{ row.name }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="inventoryTypeLabel" label="库存类型" min-width="120" show-overflow-tooltip align="center">
          <template #default="{ row }">
            <el-tooltip v-if="row.inventoryTypeFromCurrentStock" :content="currentStockFallbackTip" placement="top">
              <span class="current-stock-fallback">{{ row.inventoryTypeLabel }}</span>
            </el-tooltip>
            <span v-else>{{ row.inventoryTypeLabel }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="customerName" label="客户" min-width="130" show-overflow-tooltip align="center">
          <template #default="{ row }">
            <el-tooltip v-if="row.customerNameFromCurrentStock" :content="currentStockFallbackTip" placement="top">
              <span class="current-stock-fallback">{{ row.customerName }}</span>
            </el-tooltip>
            <span v-else>{{ row.customerName }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="pickupUserName" label="领取人" min-width="100" show-overflow-tooltip align="center" />
        <el-table-column label="出库数量" width="110" align="center">
          <template #default="{ row }">
            {{ formatDisplayNumber(row.quantity) }}
            <el-tooltip v-if="row.unitFromCurrentStock" :content="currentStockFallbackTip" placement="top">
              <span class="current-stock-fallback">{{ row.unit }}</span>
            </el-tooltip>
            <span v-else>{{ row.unit || '（单位未记录）' }}</span>
          </template>
        </el-table-column>
        <el-table-column label="实际成本单价" width="130" align="right">
          <template #default="{ row }">{{ row.unitPrice == null ? '未计价' : formatMoneyAligned(row.unitPrice) }}</template>
        </el-table-column>
        <el-table-column label="出库金额" width="130" align="right">
          <template #default="{ row }">{{ row.amount == null ? '未计价' : formatMoneyAligned(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip align="center" />
        <el-table-column label="照片" :width="compactImageColumnMinWidth" align="center">
          <template #default="{ row }">
            <AppImageThumb
              v-if="row.photoUrl"
              :raw-url="row.photoUrl"
              :width="compactImageSize"
              :height="compactImageSize"
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <AppPaginationBar
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :total-quantity="totalQuantity"
      :total-amount="totalAmount"
      :secondary-quantity="unpricedQuantity"
      :secondary-label="`未计价（${unpricedCount}条）`"
      summary-label="出库数量"
      total-amount-label="已计价金额"
      @current-change="load"
      @size-change="pageSizeChanged"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getFabricOutboundRecords, type FabricOutboundRecord } from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { formatDisplayNumber, formatMoneyAligned } from '@/utils/display-number'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import {
  ACTIVE_FILTER_COLOR,
  getAdaptiveSelectStyle,
  getFilterInputStyle,
  getFilterRangeStyle,
  getTextFilterStyle,
} from '@/composables/useFilterBarHelpers'
import AppImageThumb from '@/components/AppImageThumb.vue'
import AppPaginationBar from '@/components/AppPaginationBar.vue'

const props = defineProps<{
  customerOptions: Array<{ label: string; value: string }>
  inventoryTypeOptions: Array<{ id: number; label: string }>
}>()

const filter = reactive<{ name: string; customerName: string; inventoryTypeId: number | null; dateRange: [string, string] | [] }>({
  name: '', customerName: '', inventoryTypeId: null, dateRange: [],
})
const dateRangeModel = computed({
  get: () => filter.dateRange,
  set: (value: [string, string] | [] | null) => { filter.dateRange = value ?? [] },
})
const selectedInventoryTypeLabel = computed(() => {
  if (filter.inventoryTypeId == null) return ''
  const label = props.inventoryTypeOptions.find((option) => option.id === filter.inventoryTypeId)?.label
  return label ? `库存类型：${label}` : '库存类型'
})
const currentStockFallbackTip = '出库时未保存该字段，当前显示关联库存的现有信息'
const list = ref<FabricOutboundRecord[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const totalQuantity = ref(0)
const totalAmount = ref(0)
const unpricedCount = ref(0)
const unpricedQuantity = ref(0)
const tableRef = ref()
const shellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(shellRef)
const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('inventory-fabric-outbounds')
const { compactHeaderCellStyle, compactCellStyle, compactRowStyle, compactImageSize, compactImageColumnMinWidth } = useCompactTableStyle()

let requestVersion = 0
onScopeDispose(() => { requestVersion++ })
async function load() {
  const version = ++requestVersion
  loading.value = true
  try {
    const [startDate, endDate] = filter.dateRange.length === 2 ? filter.dateRange : ['', '']
    const { data } = await getFabricOutboundRecords({
      name: filter.name || undefined,
      customerName: filter.customerName || undefined,
      inventoryTypeId: filter.inventoryTypeId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    if (version !== requestVersion) return
    list.value = data?.list ?? []
    pagination.total = data?.total ?? 0
    totalQuantity.value = data?.totalQuantity ?? 0
    totalAmount.value = data?.totalAmount ?? 0
    unpricedCount.value = data?.unpricedCount ?? 0
    unpricedQuantity.value = data?.unpricedQuantity ?? 0
    restoreColumnWidths(tableRef.value)
  } catch (error: unknown) {
    if (version === requestVersion && !isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

function search() {
  pagination.page = 1
  void load()
}

function reset() {
  Object.assign(filter, { name: '', customerName: '', inventoryTypeId: null, dateRange: [] })
  search()
}

function pageSizeChanged() {
  pagination.page = 1
  void load()
}

onMounted(load)
defineExpose({ load })
</script>

<style scoped>
.fabric-table { flex: 1; min-height: 0; }
.fabric-table :deep(.cell) { padding-left: 6px; padding-right: 6px; line-height: 20px; }
.fabric-table :deep(td.el-table__cell) { height: 52px; }
.current-stock-fallback { border-bottom: 1px dotted var(--el-text-color-secondary); cursor: help; }
</style>
