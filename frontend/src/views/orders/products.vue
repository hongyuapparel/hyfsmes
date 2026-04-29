<template>
  <div class="page-card page-card--fill">
    <div class="products-layout">
      <aside class="products-sidebar" :class="{ 'sidebar-collapsed': sidebarCollapsed }">
        <div class="sidebar-header">
          <span class="sidebar-title">产品分组</span>
          <el-button
            link
            type="primary"
            :icon="sidebarCollapsed ? ArrowRight : ArrowLeft"
            class="sidebar-toggle"
            @click="sidebarCollapsed = !sidebarCollapsed"
          />
        </div>
        <div v-show="!sidebarCollapsed" class="sidebar-body">
          <el-menu :default-active="String(currentGroupId)" class="group-menu" @select="onMenuSelect">
            <el-menu-item
              v-for="node in flatGroupNodes"
              :key="node.id === null ? '__all__' : node.id"
              :index="node.id === null ? '0' : String(node.id)"
              class="group-menu-item"
              :style="{ paddingLeft: 12 + node.depth * 16 + 'px' }"
            >
              <span class="group-menu-label">
                <span v-if="node.hasChildren" class="group-menu-toggle" @click.stop="toggleGroupCollapse(node.path)">
                  <el-icon><ArrowDown v-if="!node.collapsed" /><ArrowRight v-else /></el-icon>
                </span>
                <span class="group-menu-text">{{ node.label }}</span>
              </span>
              <span v-if="node.count !== undefined" class="group-menu-count">({{ node.count }})</span>
            </el-menu-item>
          </el-menu>
        </div>
      </aside>

      <main ref="tableShellRef" class="products-main">
        <div class="filter-bar">
          <el-input
            v-model="filter.productName"
            placeholder="产品名称"
            clearable
            size="large"
            class="filter-bar-item"
            :style="getTextFilterStyle('产品名称：', filter.productName, productNameLabelVisible)"
            :input-style="getFilterInputStyle(filter.productName)"
            @input="debouncedSearch"
            @keyup.enter="onFilterChange(true)"
          >
            <template #prefix>
              <span v-if="filter.productName && productNameLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">产品名称：</span>
            </template>
          </el-input>
          <el-input
            v-model="filter.companyName"
            placeholder="客户"
            clearable
            size="large"
            class="filter-bar-item"
            :style="getTextFilterStyle('客户：', filter.companyName, companyNameLabelVisible)"
            :input-style="getFilterInputStyle(filter.companyName)"
            @input="debouncedSearch"
            @keyup.enter="onFilterChange(true)"
          >
            <template #prefix>
              <span v-if="filter.companyName && companyNameLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">客户：</span>
            </template>
          </el-input>
          <el-input
            v-model="filter.skuCode"
            placeholder="SKU编号"
            clearable
            size="large"
            class="filter-bar-item"
            :style="getTextFilterStyle('SKU编号：', filter.skuCode, skuCodeLabelVisible)"
            :input-style="getFilterInputStyle(filter.skuCode)"
            @input="debouncedSearch"
            @keyup.enter="onFilterChange(true)"
          >
            <template #prefix>
              <span v-if="filter.skuCode && skuCodeLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">SKU编号：</span>
            </template>
          </el-input>
          <el-select
            v-model="filter.applicablePeopleId"
            placeholder="适用人群"
            clearable
            filterable
            size="large"
            class="filter-bar-item"
            :style="getFilterSelectAutoWidthStyle(filter.applicablePeopleId)"
            @change="onFilterChange"
          >
            <template #label="{ label }">
              <span v-if="filter.applicablePeopleId">适用人群：{{ label }}</span>
              <span v-else>{{ label }}</span>
            </template>
            <el-option v-for="opt in applicablePeopleOptions" :key="opt.id" :label="opt.value" :value="opt.id" />
          </el-select>
          <el-select
            v-model="filter.salesperson"
            placeholder="业务员"
            clearable
            filterable
            size="large"
            class="filter-bar-item"
            :style="getFilterSelectAutoWidthStyle(filter.salesperson)"
            @change="onFilterChange"
          >
            <template #label="{ label }">
              <span v-if="filter.salesperson">业务员：{{ label }}</span>
              <span v-else>{{ label }}</span>
            </template>
            <el-option v-for="s in salespeople" :key="s" :label="s" :value="s" />
          </el-select>
          <el-button type="primary" size="large" @click="onFilterChange(true)">搜索</el-button>
          <el-button size="large" @click="resetFilter">清空</el-button>
          <div class="filter-actions">
            <el-button size="large" @click="openColumnConfig">列设置</el-button>
            <el-button type="primary" size="large" @click="openCreate">新建SKU</el-button>
            <el-tooltip v-if="selectedIds.length" content="删除" placement="top">
              <el-button type="danger" size="large" circle @click="batchDelete">
                <el-icon><Delete /></el-icon>
              </el-button>
            </el-tooltip>
          </div>
        </div>

        <div v-if="selectedIds.length" class="table-selection-count">已选 {{ selectedIds.length }} 项</div>

        <el-table
          ref="tableRef"
          class="products-table"
          :data="list"
          border
          stripe
          :fit="true"
          :height="tableHeight"
          scrollbar-always-on
          :row-style="compactRowStyle"
          :cell-style="getCellStyle"
          :header-cell-style="getHeaderCellStyle"
          @selection-change="onSelectionChange"
          @sort-change="onSortChange"
        >
          <el-table-column
            type="selection"
            width="50"
            align="center"
            header-align="center"
            class-name="selection-column"
            header-class-name="selection-column"
          />
          <el-table-column
            v-for="f in tableFields"
            :key="f.code"
            :column-key="f.code"
            :prop="productListColumnProp(f)"
            :label="f.label"
            :width="f.type === 'image' ? compactImageColumnMinWidth : undefined"
            :min-width="getColumnMinWidth(f, compactImageColumnMinWidth)"
            :sortable="f.sortable ? 'custom' : false"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              <template v-if="f.type === 'image'">
                <AppImageThumb
                  v-if="row[f.code]"
                  :raw-url="String(row[f.code])"
                  :width="compactImageSize"
                  :height="compactImageSize"
                />
                <span v-else>-</span>
              </template>
              <span v-else-if="f.type === 'date'">{{ formatDate(row[f.code]) }}</span>
              <span v-else-if="f.code === 'companyName'">{{ row.customer?.companyName ?? '-' }}</span>
              <span v-else-if="f.code === 'applicablePeople'">{{ row.applicablePeople ?? '-' }}</span>
              <span v-else>{{ row[f.code] ?? '-' }}</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
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
            @size-change="load"
          />
        </div>
      </main>
    </div>

    <OrderProductColumnConfigDialog
      v-model="columnConfigVisible"
      :list="columnConfigList"
      @visible-change="onColumnVisibleChange"
      @move="moveColumn"
    />
    <OrderProductFormDialog
      ref="formDialogRef"
      :form-fields="formFields"
      :product-group-options="productGroupOptions"
      :product-group-tree-select-data="productGroupTreeSelectData"
      :salespeople="salespeople"
      :customers="customers"
      :customer-loading="customersLoading"
      :applicable-people-options="applicablePeopleOptions"
      @customer-search="searchCustomerOptions"
      @customer-dropdown-visible="onCustomerDropdownVisible"
      @success="load"
    />
  </div>
</template>

<script setup lang="ts">
import { nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, ref, watch } from 'vue'
import { ArrowDown, ArrowLeft, ArrowRight, Delete } from '@element-plus/icons-vue'
import type { ProductItem } from '@/api/products'
import OrderProductColumnConfigDialog from '@/components/orders/OrderProductColumnConfigDialog.vue'
import OrderProductFormDialog from '@/components/orders/OrderProductFormDialog.vue'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useOrderProductsList } from '@/composables/useOrderProductsList'
import { formatDate, getColumnMinWidth, productListColumnProp } from '@/utils/order-products'

const tableRef = ref<InstanceType<typeof import('element-plus')['ElTable']>>()
const tableShellRef = ref<HTMLElement | null>(null)
const formDialogRef = ref<{
  openCreate: () => Promise<void>
  openEdit: (row: ProductItem) => void
} | null>(null)

function scheduleProductTableLayout() {
  nextTick(() => {
    tableRef.value?.doLayout?.()
  })
}

const {
  list,
  filter,
  pagination,
  tableFields,
  formFields,
  productGroupTreeSelectData,
  productGroupOptions,
  salespeople,
  customers,
  customersLoading,
  applicablePeopleOptions,
  selectedIds,
  sidebarCollapsed,
  flatGroupNodes,
  currentGroupId,
  companyNameLabelVisible,
  skuCodeLabelVisible,
  productNameLabelVisible,
  columnConfigVisible,
  columnConfigList,
  load,
  loadFieldDefinitions,
  loadOptions,
  searchCustomerOptions,
  onCustomerDropdownVisible,
  onMenuSelect,
  toggleGroupCollapse,
  onFilterChange,
  debouncedSearch,
  resetFilter,
  onSelectionChange,
  onSortChange,
  openColumnConfig,
  onColumnVisibleChange,
  moveColumn,
  batchDelete,
  cleanup,
} = useOrderProductsList({
  onListUpdated: scheduleProductTableLayout,
})

const { tableHeight } = useFlexShellTableHeight(tableShellRef)
const {
  compactHeaderCellStyle,
  compactCellStyle,
  compactRowStyle,
  compactImageSize,
  compactImageColumnMinWidth,
} = useCompactTableStyle()

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeInputStyle = { color: ACTIVE_FILTER_COLOR }
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }

function getFilterInputStyle(v: unknown) {
  return v ? activeInputStyle : undefined
}

function getFilterSelectAutoWidthStyle(v: unknown) {
  if (!v) return undefined
  const text = String(v)
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return {
    ...activeSelectStyle,
    width: `${width}px`,
    flex: `0 0 ${width}px`,
  }
}

function getTextFilterStyle(labelPrefix: string, value: unknown, showLabel: boolean) {
  if (!value || !showLabel) return undefined
  const text = `${labelPrefix}${String(value)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}

function getHeaderCellStyle() {
  return compactHeaderCellStyle()
}

function getCellStyle() {
  return {
    ...compactCellStyle(),
    whiteSpace: 'nowrap',
  }
}

function openCreate() {
  return formDialogRef.value?.openCreate()
}

function openEdit(row: ProductItem) {
  formDialogRef.value?.openEdit(row)
}

watch(
  () => tableHeight.value,
  () => scheduleProductTableLayout(),
)

onMounted(() => {
  void loadFieldDefinitions()
  void load()
  void loadOptions()
})

onActivated(() => {
  void nextTick(() => scheduleProductTableLayout())
})

onDeactivated(() => cleanup())
onBeforeUnmount(() => cleanup())
</script>

<style scoped>
.page-card {
  background: var(--color-card);
  padding: var(--space-sm);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.products-layout {
  display: flex;
  gap: var(--space-sm);
  min-height: 400px;
  flex: 1;
  min-height: 0;
}

.products-sidebar {
  flex-shrink: 0;
  width: 220px;
  border-radius: var(--radius-lg, 10px);
  background: var(--el-fill-color-blank, #fff);
  border: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.products-sidebar .sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-md);
  font-weight: 600;
  font-size: 15px;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-blank, #fff);
}

.products-sidebar .sidebar-toggle {
  padding: 4px;
}

.products-sidebar .sidebar-body {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xs) 0;
}

.products-sidebar .group-menu {
  border-right: none;
  background: transparent;
  --el-menu-bg-color: transparent;
  --el-menu-hover-bg-color: var(--el-fill-color-light, #f5f7fa);
  --el-menu-active-color: var(--el-color-primary);
}

.products-sidebar .group-menu-item {
  height: 40px;
  line-height: 40px;
  margin: 2px 8px;
  border-radius: 6px;
}

.products-sidebar .group-menu-item.is-active {
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary);
}

.products-sidebar .group-menu-label {
  display: inline-flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.products-sidebar .group-menu-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  margin-right: 4px;
  color: var(--el-text-color-secondary, #909399);
}

.products-sidebar .group-menu-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.products-sidebar .group-menu-count {
  margin-left: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary, #909399);
}

.products-sidebar .group-menu-item.is-active .group-menu-count {
  color: var(--el-color-primary);
  opacity: 0.9;
}

.products-sidebar.sidebar-collapsed {
  width: 48px;
}

.products-sidebar.sidebar-collapsed .sidebar-header {
  flex-direction: column;
  padding: var(--space-sm);
}

.products-sidebar.sidebar-collapsed .sidebar-title {
  display: none;
}

.products-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  min-height: 0;
}
.filter-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}
.pagination-wrap {
  margin-top: var(--space-sm);
  display: flex;
  justify-content: flex-end;
}
.products-table {
  flex: 1;
  min-height: 0;
}

.products-table :deep(.el-table__header .cell) {
  white-space: nowrap;
}

.products-table :deep(.cell) {
  padding-left: 6px;
  padding-right: 6px;
  line-height: 20px;
}

.products-table :deep(.selection-column .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: 0;
  padding-right: 0;
}
</style>
