<template>
  <div class="page-card page-card--fill inventory-accessories-page">
    <el-tabs v-model="pageTab" class="inventory-tabs list-page-tabs">
      <el-tab-pane label="库存" name="stock">
        <div class="tab-pane-scroll">
        <el-form class="filter-bar has-filter-collapse" @submit.prevent>
          <el-input
            v-model="filter.name"
            placeholder="名称"
            clearable
            class="filter-bar-item"
            :style="getTextFilterStyle('名称：', filter.name, nameLabelVisible)"
            :input-style="getFilterInputStyle(filter.name)"
            @input="debouncedSearch"
            @keyup.enter="onSearch(true)"
          >
            <template #prefix>
              <span v-if="filter.name && nameLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">名称：</span>
            </template>
          </el-input>
          <el-select
            v-model="filter.category"
            placeholder="类别"
            filterable
            clearable
            class="filter-bar-item"
            :style="getAdaptiveSelectStyle(filter.category ? `类别：${filter.category}` : '', '类别')"
            @change="onSearch(true)"
          >
            <template #label="{ label }">
              <span v-if="filter.category">类别：{{ label }}</span>
              <span v-else>{{ label }}</span>
            </template>
            <el-option v-for="opt in categoryOptions" :key="opt" :label="opt" :value="opt" />
          </el-select>
          <FilterCollapseToggle v-model:collapsed="collapsed" :active-count="activeFilterCount" />
          <div class="filter-rest" v-show="!isMobile || !collapsed">
          <el-select
            v-model="filter.customerName"
            placeholder="客户"
            filterable
            clearable
            class="filter-bar-item"
            :style="getAdaptiveSelectStyle(filter.customerName ? `客户：${filter.customerName}` : '', '客户', 42)"
            @change="onSearch(true)"
          >
            <template #label="{ label }">
              <span v-if="filter.customerName">客户：{{ label }}</span>
              <span v-else>{{ label }}</span>
            </template>
            <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-select
            v-model="filter.salesperson"
            placeholder="业务员"
            filterable
            clearable
            class="filter-bar-item"
            :style="getAdaptiveSelectStyle(filter.salesperson ? `业务员：${filter.salesperson}` : '', '业务员', 42)"
            @change="onSearch(true)"
          >
            <template #label="{ label }">
              <span v-if="filter.salesperson">业务员：{{ label }}</span>
              <span v-else>{{ label }}</span>
            </template>
            <el-option v-for="s in salespersonOptions" :key="s" :label="s" :value="s" />
          </el-select>
          <div
            class="filter-bar-item filter-date-box"
            :class="{ 'is-active': inboundDateRange }"
            :style="getFilterRangeStyle(inboundDateRange, '入库时间')"
          >
            <span v-if="inboundDateRange" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">入库时间：</span>
            <el-date-picker
              v-model="inboundDateRange"
              type="daterange"
              :name="['accessoriesInboundDateStart', 'accessoriesInboundDateEnd']"
              :range-separator="inboundDateRange ? '~' : ''"
              start-placeholder="入库时间"
              end-placeholder=""
              value-format="YYYY-MM-DD"
              :shortcuts="rangeShortcuts"
              unlink-panels
              clearable
              :class="['filter-range', { 'range-single': !inboundDateRange }]"
              @change="onSearch(true)"
            />
          </div>
          </div>
          <div class="filter-bar-actions">
            <el-button type="primary" @click="onSearch(true)">搜索</el-button>
            <el-button @click="onReset">清空</el-button>
            <el-button type="primary" @click="openForm(null)">新增辅料</el-button>
            <el-button
              v-if="selectedRows.length"
              type="warning"
              :disabled="selectedRows.length !== 1"
              @click="openOutboundDialog"
            >
              出库
            </el-button>
          </div>
        </el-form>

        <div v-if="selectedRows.length" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

        <div ref="accessoriesStockShellRef" class="list-page-table-shell">
        <el-table
          ref="accessoriesStockTableRef"
          v-loading="loading"
          :data="list"
          border
          stripe
          class="accessories-table"
          :height="accessoriesStockTableHeight"
          :row-style="compactRowStyle"
          :cell-style="compactCellStyle"
          :header-cell-style="compactHeaderCellStyle"
          @header-dragend="onAccessoriesStockHeaderDragEnd"
          @selection-change="onSelectionChange"
          @row-click="onRowClick"
        >
          <el-table-column type="selection" width="46" fixed />
          <el-table-column label="图片" :width="compactImageColumnMinWidth" align="center">
            <template #default="{ row }">
              <AppImageThumb v-if="getMainImageUrl(row)" :raw-url="getMainImageUrl(row)" :width="compactImageSize" :height="compactImageSize" />
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="salesperson" label="业务员" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="category" label="类别" width="100" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="数量" width="90" align="center" header-align="center">
            <template #default="{ row }">
              <AccessoryQtyCell :value="Number(row.quantity) || 0" :detail="stockSizeDetail(row)" />
            </template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="70" align="center" header-align="center" />
          <el-table-column label="仓库" min-width="120" show-overflow-tooltip align="center" header-align="center">
            <template #default="{ row }">{{ formatWarehouseLabel(row.warehouseId) }}</template>
          </el-table-column>
          <el-table-column prop="location" label="存放地址" min-width="140" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="createdAt" label="创建时间" width="160" align="center" header-align="center">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="90" align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click.stop="openForm(row, 'view')">详情</el-button>
            </template>
          </el-table-column>
        </el-table>
        </div>

        <AppPaginationBar
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :total-quantity="stockTotalQuantity"
          summary-label="总数量"
          @current-change="load"
          @size-change="onPageSizeChange"
        />
        </div>
      </el-tab-pane>

      <el-tab-pane label="出库记录" name="outbounds" lazy>
        <AccessoriesOutboundTab />
      </el-tab-pane>
    </el-tabs>

    <AccessoriesFormDrawer
      ref="accessoriesFormDialogRef"
      v-model:visible="formDialog.visible"
      :submitting="formDialog.submitting"
      :mode="formDialog.mode"
      :quick-add-source="quickAddSource"
      :form="form"
      :form-rules="formRules"
      :category-options="categoryOptions"
      :customer-options="customerOptions"
      :salesperson-options="salespersonOptions"
      :warehouse-options="warehouseOptions"
      :logs="logs"
      :logs-loading="formDialog.logsLoading"
      :format-log-action="formatLogAction"
      @close="resetForm"
      @confirm="submitForm"
      @edit="enterEdit"
      @exit-edit="exitEdit"
    />

    <AccessoriesOutboundDialog
      ref="accessoriesOutboundDialogRef"
      v-model:visible="outboundDialog.visible"
      :submitting="outboundDialog.submitting"
      :form="outboundForm"
      :outbound-rules="outboundRules"
      :outbound-user-options="outboundUserOptions"
      @close="resetOutboundDialog"
      @confirm="submitOutbound"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { getAccessoriesList, type AccessoryItem } from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getFilterRangeStyle,
  getTextFilterStyle,
  getAdaptiveSelectStyle,
} from '@/composables/useFilterBarHelpers'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { useAccessoryInventoryOptions } from '@/composables/useAccessoryInventoryOptions'
import { useAccessoriesFormDialog, type AccessoriesFormDialogExpose } from '@/composables/useAccessoriesFormDialog'
import { useAccessoriesOutboundDialog, type AccessoriesOutboundDialogExpose } from '@/composables/useAccessoriesOutboundDialog'
import AccessoriesFormDrawer from '@/components/inventory/AccessoriesFormDrawer.vue'
import AccessoriesOutboundDialog from '@/components/inventory/AccessoriesOutboundDialog.vue'
import AccessoriesOutboundTab from '@/components/inventory/AccessoriesOutboundTab.vue'
import AccessoryQtyCell from '@/components/inventory/AccessoryQtyCell.vue'
import { formatDateTime as formatDate } from '@/utils/date-format'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import FilterCollapseToggle from '@/components/common/FilterCollapseToggle.vue'
import { useFilterCollapse } from '@/composables/useFilterCollapse'

const pageTab = ref<'stock' | 'outbounds'>('stock')
const filter = reactive({ name: '', category: '', customerName: '', salesperson: '' })
const inboundDateRange = ref<[string, string] | null>(null)
const nameLabelVisible = ref(false)
const { collapsed, isMobile } = useFilterCollapse('inventory-accessories')
const activeFilterCount = computed(() => {
  let n = 0
  if (filter.name) n++
  if (filter.category) n++
  if (filter.customerName) n++
  if (filter.salesperson) n++
  if (inboundDateRange.value) n++
  return n
})
const list = ref<AccessoryItem[]>([])
/** 当前筛选下全量匹配的总数量（接口返回，跨分页） */
const stockGrandTotalQuantity = ref(0)
const accessoriesStockTableRef = ref()
const accessoriesStockShellRef = ref<HTMLElement | null>(null)
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<AccessoryItem[]>([])
const accessoriesFormDialogRef = ref<AccessoriesFormDialogExpose>()
const accessoriesOutboundDialogRef = ref<AccessoriesOutboundDialogExpose>()

const { compactHeaderCellStyle, compactCellStyle, compactRowStyle, compactImageSize, compactImageColumnMinWidth } = useCompactTableStyle()
const { tableHeight: accessoriesStockTableHeight } = useFlexShellTableHeight(accessoriesStockShellRef)
const { onHeaderDragEnd: onAccessoriesStockHeaderDragEnd, restoreColumnWidths: restoreAccessoriesStockColumnWidths } =
  useTableColumnWidthPersist('inventory-accessories-stock')
const {
  customerOptions, salespersonOptions, categoryOptions, warehouseOptions, loadCustomerOptions, loadSalespersonOptions,
  loadCategoryOptions, loadWarehouseOptions, formatWarehouseLabel, getMainImageUrl,
} = useAccessoryInventoryOptions()
const { formDialog, quickAddSource, form, formRules, logs, openForm, enterEdit, exitEdit, resetForm, submitForm, formatLogAction } =
  useAccessoriesFormDialog(selectedRows, load, accessoriesFormDialogRef)
const { outboundDialog, outboundUserOptions, outboundForm, outboundRules, openOutboundDialog, resetOutboundDialog, submitOutbound } =
  useAccessoriesOutboundDialog(selectedRows, load, accessoriesOutboundDialogRef)

function onRowClick(row: AccessoryItem, column?: { type?: string; label?: string }) {
  if (column?.type === 'selection' || column?.label === '操作') return
  openForm(row, 'view')
}

const stockTotalQuantity = computed(() => {
  if (selectedRows.value.length > 0) {
    return selectedRows.value.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
  }
  return stockGrandTotalQuantity.value
})

function stockSizeDetail(row: AccessoryItem): { headers: string[]; quantities: number[] } | null {
  if (row.isSized && Array.isArray(row.sizeHeaders) && row.sizeHeaders.length) {
    return { headers: row.sizeHeaders, quantities: Array.isArray(row.sizeQuantities) ? row.sizeQuantities : [] }
  }
  return null
}

async function load() {
  loading.value = true
  try {
    const [startDate, endDate] =
      inboundDateRange.value && inboundDateRange.value.length === 2 ? inboundDateRange.value : ['', '']
    const res = await getAccessoriesList({
      name: filter.name || undefined,
      category: filter.category || undefined,
      customerName: filter.customerName || undefined,
      salesperson: filter.salesperson || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      stockGrandTotalQuantity.value = Number(data.totalQuantity ?? 0) || 0
      restoreAccessoriesStockColumnWidths(accessoriesStockTableRef.value)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function onSearch(byUser = false) {
  if (byUser && filter.name && String(filter.name).trim()) nameLabelVisible.value = true
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
  nameLabelVisible.value = false
  filter.name = ''
  filter.category = ''
  filter.customerName = ''
  filter.salesperson = ''
  inboundDateRange.value = null
  pagination.page = 1
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function onSelectionChange(rows: AccessoryItem[]) {
  selectedRows.value = rows ?? []
}

onMounted(() => {
  loadCustomerOptions()
  loadSalespersonOptions()
  loadCategoryOptions()
  loadWarehouseOptions()
  load()
})
</script>

<style scoped>
.inventory-accessories-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.accessories-table :deep(.cell) {
  padding-left: 6px;
  padding-right: 6px;
  line-height: 20px;
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
</style>
