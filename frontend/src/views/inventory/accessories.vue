<template>
  <div class="page-card inventory-accessories-page">
    <el-tabs v-model="pageTab" class="inventory-tabs" @tab-change="onPageTabChange">
      <el-tab-pane label="库存" name="stock">
        <div class="filter-bar">
          <el-input
            v-model="filter.name"
            placeholder="名称"
            clearable
            size="large"
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
            size="large"
            class="filter-bar-item"
            @change="onSearch(true)"
          >
            <el-option v-for="opt in categoryOptions" :key="opt" :label="opt" :value="opt" />
          </el-select>
          <el-select
            v-model="filter.customerName"
            placeholder="客户"
            filterable
            clearable
            size="large"
            class="filter-bar-item"
            @change="onSearch(true)"
          >
            <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-select
            v-model="filter.salesperson"
            placeholder="业务员"
            filterable
            clearable
            size="large"
            class="filter-bar-item"
            @change="onSearch(true)"
          >
            <el-option v-for="s in salespersonOptions" :key="s" :label="s" :value="s" />
          </el-select>
          <el-date-picker
            v-model="inboundDateRange"
            type="daterange"
            range-separator=""
            start-placeholder="入库时间"
            end-placeholder=""
            value-format="YYYY-MM-DD"
            :shortcuts="rangeShortcuts"
            unlink-panels
            clearable
            size="large"
            :class="['filter-bar-item', 'filter-range', { 'range-single': !inboundDateRange }]"
            :style="getFilterRangeStyle(inboundDateRange)"
            @change="onSearch(true)"
          />
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
            <el-button size="large" @click="onReset">清空</el-button>
            <el-button type="primary" size="large" @click="openForm(null)">新增辅料</el-button>
            <el-button
              v-if="selectedRows.length"
              type="warning"
              size="large"
              :disabled="selectedRows.length !== 1"
              @click="openOutboundDialog"
            >
              出库
            </el-button>
          </div>
        </div>

        <div v-if="selectedRows.length" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

        <el-table
          ref="accessoriesStockTableRef"
          v-loading="loading"
          :data="list"
          border
          stripe
          class="accessories-table"
          :row-style="compactRowStyle"
          :cell-style="compactCellStyle"
          :header-cell-style="compactHeaderCellStyle"
          @header-dragend="onAccessoriesStockHeaderDragEnd"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="46" fixed />
          <el-table-column label="图片" :width="compactImageColumnMinWidth" align="center">
            <template #default="{ row }">
              <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" :width="compactImageSize" :height="compactImageSize" />
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="名称" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="customerName" label="客户" min-width="140" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="category" label="类别" width="100" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="数量" width="90" align="center" header-align="center">
            <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }}</template>
          </el-table-column>
          <el-table-column prop="unit" label="单位" width="70" align="center" header-align="center" />
          <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="createdAt" label="创建时间" width="160" align="center" header-align="center">
            <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="操作" width="120" align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="info" size="small" @click="openDetail(row)">详情</el-button>
              <el-button link type="primary" size="small" @click="openForm(row)">编辑</el-button>
            </template>
          </el-table-column>
        </el-table>

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
      </el-tab-pane>

      <el-tab-pane label="出库记录" name="outbounds">
        <div class="filter-bar">
          <el-input
            v-model="outboundFilter.orderNo"
            placeholder="订单号（自动出库）"
            clearable
            size="large"
            class="filter-bar-item"
            @keyup.enter="onOutboundSearch(true)"
          />
          <el-select
            v-model="outboundFilter.outboundType"
            placeholder="出库类型"
            clearable
            size="large"
            class="filter-bar-item"
            @change="onOutboundSearch(true)"
          >
            <el-option label="订单自动出库" value="order_auto" />
            <el-option label="手动出库" value="manual" />
          </el-select>
          <el-date-picker
            v-model="outboundFilter.dateRange"
            type="daterange"
            start-placeholder="出库时间"
            end-placeholder=""
            range-separator=""
            unlink-panels
            value-format="YYYY-MM-DD"
            :shortcuts="rangeShortcuts"
            size="large"
            :class="['filter-bar-item', { 'range-single': !(outboundFilter.dateRange && outboundFilter.dateRange.length === 2) }]"
            :style="getInventoryOutboundRangeStyle(outboundFilter.dateRange)"
            @change="onOutboundSearch(true)"
          />
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onOutboundSearch(true)">搜索</el-button>
            <el-button size="large" @click="onOutboundReset">清空</el-button>
          </div>
        </div>

        <el-table
          ref="accessoriesOutboundTableRef"
          v-loading="outboundLoading2"
          :data="outboundList"
          border
          stripe
          class="accessories-table"
          :row-style="compactRowStyle"
          :cell-style="compactCellStyle"
          :header-cell-style="compactHeaderCellStyle"
          @header-dragend="onAccessoriesOutboundHeaderDragEnd"
        >
          <el-table-column prop="createdAt" label="时间" width="160" align="center">
            <template #default="{ row }">{{ row.createdAt }}</template>
          </el-table-column>
          <el-table-column prop="orderNo" label="订单号" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="图片" :width="compactImageColumnMinWidth" align="center">
            <template #default="{ row }">
              <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" :width="compactImageSize" :height="compactImageSize" />
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="customerName" label="客户" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="category" label="类别" width="100" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="出库类型" width="110" align="center" header-align="center">
            <template #default="{ row }">{{ row.outboundType === 'order_auto' ? '订单自动出库' : '手动出库' }}</template>
          </el-table-column>
          <el-table-column label="出库数量" width="100" align="center" header-align="center">
            <template #default="{ row }">{{ formatDisplayNumber(row.quantity) }}</template>
          </el-table-column>
          <el-table-column prop="beforeQuantity" label="出库前库存" width="110" align="center" header-align="center" />
          <el-table-column prop="afterQuantity" label="出库后库存" width="110" align="center" header-align="center" />
          <el-table-column prop="operatorUsername" label="操作人" width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip align="center" header-align="center" />
        </el-table>

        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="outboundPagination.page"
            v-model:page-size="outboundPagination.pageSize"
            :total="outboundPagination.total"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @current-change="loadOutbounds"
            @size-change="onOutboundPageSizeChange"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <AccessoriesFormDialog
      ref="accessoriesFormDialogRef"
      v-model:visible="formDialog.visible"
      :submitting="formDialog.submitting"
      :is-edit="formDialog.isEdit"
      :quick-add-source="quickAddSource"
      :form="form"
      :form-rules="formRules"
      :category-options="categoryOptions"
      :customer-options="customerOptions"
      :salesperson-options="salespersonOptions"
      @close="resetForm"
      @confirm="submitForm"
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

    <AccessoriesDetailDrawer
      v-model:visible="detailDrawer.visible"
      :row="detailDrawer.row"
      :loading="detailDrawer.loading"
      :logs="detailDrawer.logs"
      :format-log-action="formatLogAction"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { getCustomers, getSalespeople, type CustomerItem } from '@/api/customers'
import { getAccessoriesList, getAccessoryOutboundRecords, type AccessoryItem, type AccessoryOutboundRecord } from '@/api/inventory'
import { getDictTree } from '@/api/dicts'
import type { SystemOptionTreeNode } from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getFilterRangeStyle,
  getTextFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { useAccessoriesDetailDrawer } from '@/composables/useAccessoriesDetailDrawer'
import { useAccessoriesFormDialog, type AccessoriesFormDialogExpose } from '@/composables/useAccessoriesFormDialog'
import { useAccessoriesOutboundDialog, type AccessoriesOutboundDialogExpose } from '@/composables/useAccessoriesOutboundDialog'
import AccessoriesDetailDrawer from '@/components/inventory/AccessoriesDetailDrawer.vue'
import AccessoriesFormDialog from '@/components/inventory/AccessoriesFormDialog.vue'
import AccessoriesOutboundDialog from '@/components/inventory/AccessoriesOutboundDialog.vue'
import { formatDateTime as formatDate } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'

const pageTab = ref<'stock' | 'outbounds'>('stock')
const filter = reactive({ name: '', category: '', customerName: '', salesperson: '' })
const inboundDateRange = ref<[string, string] | null>(null)
const nameLabelVisible = ref(false)
const list = ref<AccessoryItem[]>([])
const accessoriesStockTableRef = ref()
const accessoriesOutboundTableRef = ref()
const customerOptions = ref<{ label: string; value: string }[]>([])
const salespersonOptions = ref<string[]>([])
const categoryOptions = ref<string[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<AccessoryItem[]>([])
const outboundFilter = reactive<{ orderNo: string; outboundType: string; dateRange: [string, string] | [] }>({
  orderNo: '',
  outboundType: '',
  dateRange: [],
})
const outboundList = ref<AccessoryOutboundRecord[]>([])
const outboundLoading2 = ref(false)
const outboundPagination = reactive({ page: 1, pageSize: 20, total: 0 })
const accessoriesFormDialogRef = ref<AccessoriesFormDialogExpose>()
const accessoriesOutboundDialogRef = ref<AccessoriesOutboundDialogExpose>()

const { compactHeaderCellStyle, compactCellStyle, compactRowStyle, compactImageSize, compactImageColumnMinWidth } = useCompactTableStyle()
const { onHeaderDragEnd: onAccessoriesStockHeaderDragEnd, restoreColumnWidths: restoreAccessoriesStockColumnWidths } =
  useTableColumnWidthPersist('inventory-accessories-stock')
const {
  onHeaderDragEnd: onAccessoriesOutboundHeaderDragEnd,
  restoreColumnWidths: restoreAccessoriesOutboundColumnWidths,
} = useTableColumnWidthPersist('inventory-accessories-outbounds')
const { detailDrawer, formatLogAction, openDetail } = useAccessoriesDetailDrawer()

const { formDialog, quickAddSource, form, formRules, openForm, resetForm, submitForm } = useAccessoriesFormDialog(
  selectedRows,
  load,
  accessoriesFormDialogRef,
)
const { outboundDialog, outboundUserOptions, outboundForm, outboundRules, openOutboundDialog, resetOutboundDialog, submitOutbound } =
  useAccessoriesOutboundDialog(selectedRows, load, accessoriesOutboundDialogRef)

function getInventoryOutboundRangeStyle(v: [string, string] | []) {
  const hasValue = Array.isArray(v) && v.length === 2
  if (!hasValue) return getFilterRangeStyle(v)
  const width = '240px'
  return { ...getFilterRangeStyle(v), width, minWidth: width, flex: `0 0 ${width}` }
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
      restoreAccessoriesStockColumnWidths(accessoriesStockTableRef.value)
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

async function loadCustomerOptions() {
  try {
    const res = await getCustomers({ page: 1, pageSize: 200, sortBy: 'companyName', sortOrder: 'asc' })
    const customers = (res.data?.list ?? []) as CustomerItem[]
    customerOptions.value = customers.map((item) => ({ label: item.companyName, value: item.companyName }))
  } catch {
    console.warn('客户选项加载失败')
  }
}

async function loadSalespersonOptions() {
  try {
    const res = await getSalespeople()
    salespersonOptions.value = (res.data ?? []).filter((v) => !!String(v ?? '').trim())
  } catch {
    salespersonOptions.value = []
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

function findNodeByValue(nodes: SystemOptionTreeNode[], value: string): SystemOptionTreeNode | null {
  for (const node of nodes) {
    if (node.value === value) return node
    if (node.children?.length) {
      const found = findNodeByValue(node.children, value)
      if (found) return found
    }
  }
  return null
}

async function loadCategoryOptions() {
  try {
    const res = await getDictTree('supplier_types')
    const tree = res.data ?? []
    const accessoryRoot = findNodeByValue(tree, '辅料供应商')
    categoryOptions.value = (accessoryRoot?.children ?? []).map((child) => child.value).filter(Boolean)
  } catch {
    categoryOptions.value = []
  }
}

async function loadOutbounds() {
  outboundLoading2.value = true
  try {
    const res = await getAccessoryOutboundRecords({
      orderNo: outboundFilter.orderNo || undefined,
      outboundType: outboundFilter.outboundType || undefined,
      page: outboundPagination.page,
      pageSize: outboundPagination.pageSize,
    })
    const data = res.data
    outboundList.value = data?.list ?? []
    outboundPagination.total = data?.total ?? 0
    restoreAccessoriesOutboundColumnWidths(accessoriesOutboundTableRef.value)
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
  outboundFilter.outboundType = ''
  outboundFilter.dateRange = []
  outboundPagination.page = 1
  loadOutbounds()
}

function onOutboundPageSizeChange() {
  outboundPagination.page = 1
  loadOutbounds()
}

onMounted(() => {
  loadCustomerOptions()
  loadSalespersonOptions()
  loadCategoryOptions()
  load()
})
</script>

<style scoped>
.inventory-accessories-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
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
