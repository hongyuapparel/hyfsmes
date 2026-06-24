<template>
  <div class="page-card page-card--fill pattern-page">
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" @change="onTabChange">
          <el-radio-button v-for="tab in PATTERN_TABS" :key="tab.value" :value="tab.value">
            {{ getTabLabel(tab) }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="filter-bar has-filter-collapse">
      <el-input
        v-model="filter.orderNo"
        placeholder="订单号"
        clearable
        class="filter-bar-item"
        :style="getOrderNoFilterStyle(filter.orderNo, orderNoLabelVisible)"
        :input-style="getFilterInputStyle(filter.orderNo)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span v-if="filter.orderNo && orderNoLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">
            订单号：
          </span>
        </template>
      </el-input>
      <el-input
        v-model="filter.skuCode"
        placeholder="SKU编号"
        clearable
        class="filter-bar-item"
        :style="getSkuCodeFilterStyle(filter.skuCode, skuCodeLabelVisible)"
        :input-style="getFilterInputStyle(filter.skuCode)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span v-if="filter.skuCode && skuCodeLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">
            SKU编号：
          </span>
        </template>
      </el-input>
      <FilterCollapseToggle v-model:collapsed="collapsed" :active-count="activeFilterCount" />
      <div class="filter-rest" v-show="!isMobile || !collapsed">
      <el-select
        v-model="filter.patternMaster"
        placeholder="纸样师"
        clearable
        filterable
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(filter.patternMaster ? `纸样师：${filter.patternMaster}` : '', '纸样师')"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.patternMaster">纸样师：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option v-for="e in patternMasterOptions" :key="e.id" :label="e.name" :value="e.name" />
      </el-select>
      <el-select
        v-model="filter.sampleMaker"
        placeholder="车版师"
        clearable
        filterable
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(filter.sampleMaker ? `车版师：${filter.sampleMaker}` : '', '车版师')"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.sampleMaker">车版师：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option v-for="e in sampleMakerOptions" :key="e.id" :label="e.name" :value="e.name" />
      </el-select>
      <el-tree-select
        v-model="filter.orderTypeId"
        :data="orderTypeTreeSelectData"
        placeholder="订单类型"
        popper-class="pattern-order-type-tree-popper"
        filterable
        clearable
        check-strictly
        default-expand-all
        :render-after-expand="false"
        node-key="value"
        :props="{ label: 'label', value: 'value', children: 'children', disabled: 'disabled' }"
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(filter.orderTypeId && `订单类型：${findOrderTypeLabelById(filter.orderTypeId)}`, '订单类型')"
        @change="onSearch"
        @visible-change="(v: boolean) => v && adjustTreePopperWidth('pattern-order-type-tree-popper')"
      >
        <template #prefix>
          <span v-if="filter.orderTypeId" :style="{ color: ACTIVE_FILTER_COLOR }">订单类型：</span>
        </template>
      </el-tree-select>
      <el-select
        v-model="filter.collaborationTypeId"
        placeholder="合作方式"
        filterable
        clearable
        class="filter-bar-item"
        :style="getAdaptiveSelectStyle(filter.collaborationTypeId && `合作方式：${findCollaborationLabelById(filter.collaborationTypeId)}`, '合作方式')"
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.collaborationTypeId">合作方式：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option v-for="opt in collaborationOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
      </el-select>
      <div
        class="filter-bar-item filter-date-box"
        :class="{ 'is-active': orderDateRange }"
        :style="getFilterRangeStyle(orderDateRange, '下单时间')"
      >
        <span v-if="orderDateRange" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">下单时间：</span>
        <el-date-picker
          v-model="orderDateRange"
          type="daterange"
          :name="['patternOrderDateStart', 'patternOrderDateEnd']"
          :range-separator="orderDateRange ? '~' : ''"
          start-placeholder="下单时间"
          end-placeholder=""
          value-format="YYYY-MM-DD"
          :shortcuts="rangeShortcuts"
          unlink-panels
          clearable
          :class="['filter-range', { 'range-single': !orderDateRange }]"
          @change="onSearch"
        />
      </div>
      <div
        class="filter-bar-item filter-date-box"
        :class="{ 'is-active': completedRange }"
        :style="getFilterRangeStyle(completedRange, '完成时间')"
      >
        <span v-if="completedRange" class="filter-date-label-text" :style="{ color: ACTIVE_FILTER_COLOR }">完成时间：</span>
        <el-date-picker
          v-model="completedRange"
          type="daterange"
          :name="['patternCompletedDateStart', 'patternCompletedDateEnd']"
          :range-separator="completedRange ? '~' : ''"
          start-placeholder="完成时间"
          end-placeholder=""
          value-format="YYYY-MM-DD"
          :shortcuts="rangeShortcuts"
          unlink-panels
          clearable
          :class="['filter-range', { 'range-single': !completedRange }]"
          @change="onSearch"
        />
      </div>
      </div>
      <div class="filter-bar-actions">
        <el-button type="primary" @click="onSearch(true)">搜索</el-button>
        <el-button @click="onReset">清空</el-button>
        <el-button :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button v-if="hasSelection && canAssignPattern" type="primary" @click="openAssignDialog">
          分配纸样师和车版师
        </el-button>
        <el-button
          v-if="hasSelection && canCompleteSelection && canCompletePattern"
          type="primary"
          @click="openCompleteDialog"
        >
          确认完成
        </el-button>
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <div ref="tableShellRef" class="list-page-table-shell">
      <PatternTable
        ref="patternTableRef"
        :loading="loading"
        :list="list"
        :table-height="tableHeight"
        :compact-row-style="compactRowStyle"
        :compact-cell-style="compactCellStyle"
        :compact-header-cell-style="compactHeaderCellStyle"
        :compact-image-size="compactImageSize"
        :compact-image-column-min-width="compactImageColumnMinWidth"
        :find-order-type-label-by-id="findOrderTypeLabelById"
        :find-collaboration-label-by-id="findCollaborationLabelById"
        @header-dragend="onHeaderDragEnd"
        @selection-change="onSelectionChange"
        @open-detail="openPatternDetailDrawer"
        @sort-change="onSortChange"
      />
    </div>

    <AppPaginationBar
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :total-quantity="totalQuantity"
      summary-label="订单数量合计"
      unit="件"
      :page-sizes="[20, 50, 100]"
      @current-change="load"
      @size-change="onPageSizeChange"
    />

    <PatternDetailDrawer
      ref="detailDrawerRef"
      v-model="detailDrawer.visible"
      :row="detailDrawer.row"
      :brief="detailDrawer.row ? patternBriefFromRow(detailDrawer.row) : emptyBrief"
      :loading="detailDrawer.loading"
      :saving="detailDrawer.saving"
      :can-edit="canEditPatternMaterials"
      :materials-form="materialsForm"
      :material-type-options="materialTypeOptions"
      :logs="patternDrawerLogs"
      @closed="onDetailDrawerClosed"
      @enter-edit="onEnterEdit"
      @cancel-edit="onCancelEdit"
      @save="onSaveMaterials"
      @add-material-row="addMaterialRow"
      @remove-material-row="removeMaterialRow"
    />

    <PatternAssignDialog
      v-model="assignDialog.visible"
      :form="assignForm"
      :rules="assignRules"
      :pattern-master-options="patternMasterOptions"
      :sample-maker-options="sampleMakerOptions"
      :submitting="assignDialog.submitting"
      @close="resetAssignForm"
      @submit="submitAssign"
    />

    <PatternCompleteDialog
      ref="completeDialogRef"
      v-model="completeDialog.visible"
      :row="completeDialog.row"
      :form="completeForm"
      :rules="completeRules"
      :submitting="completeDialog.submitting"
      @close="resetCompleteForm"
      @submit="submitComplete"
      @trigger-upload="overrideTriggerUpload"
      @clear-image="clearSampleImage"
      @file-change="onSampleImageFileChange"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
  getFilterRangeStyle,
  getAdaptiveSelectStyle,
} from '@/composables/useFilterBarHelpers'
import { useTreeSelectAdjust } from '@/composables/useTreeSelectAdjust'
import { useFilterCollapse } from '@/composables/useFilterCollapse'
import FilterCollapseToggle from '@/components/common/FilterCollapseToggle.vue'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { PATTERN_TABS, usePatternList } from '@/composables/usePatternList'
import { usePatternDialogs } from '@/composables/usePatternDialogs'
import type { PatternListItem, PatternMaterialRow } from '@/api/production-pattern'
import PatternTable from '@/components/production/PatternTable.vue'
import PatternDetailDrawer from '@/components/production/PatternDetailDrawer.vue'
import PatternAssignDialog from '@/components/production/PatternAssignDialog.vue'
import PatternCompleteDialog from '@/components/production/PatternCompleteDialog.vue'
import { fetchOrderOperationLogs, toLogSectionItems } from '@/api/operation-logs'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import { useAuthStore } from '@/stores/auth'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'

const authStore = useAuthStore()
const canAssignPattern = computed(() => authStore.hasPermission('production_pattern_assign'))
const canCompletePattern = computed(() => authStore.hasPermission('production_pattern_complete'))

const { adjustTreePopperWidth } = useTreeSelectAdjust()
const { collapsed, isMobile } = useFilterCollapse('production-pattern')

const patternTableRef = ref<{ getTableRef?: () => unknown } | null>(null)
const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)
const {
  compactHeaderCellStyle,
  compactCellStyle,
  compactRowStyle,
  compactImageSize,
  compactImageColumnMinWidth,
} = useCompactTableStyle()
const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('production-pattern-main')

const {
  filter,
  orderDateRange,
  completedRange,
  orderNoLabelVisible,
  skuCodeLabelVisible,
  currentTab,
  list,
  loading,
  exporting,
  pagination,
  totalQuantity,
  selectedRows,
  hasSelection,
  canCompleteSelection,
  orderTypeTreeSelectData,
  collaborationOptions,
  findOrderTypeLabelById,
  findCollaborationLabelById,
  getTabLabel,
  load: loadList,
  loadTabCounts,
  loadOptions,
  onExport,
  onSearch: searchList,
  debouncedSearch: debounceSearchList,
  onReset: resetList,
  onTabChange: changeTab,
  onPageSizeChange: changePageSize,
  onSelectionChange: updateSelection,
  onSortChange,
} = usePatternList()

const activeFilterCount = computed(() => {
  let n = 0
  if (filter.orderNo) n++
  if (filter.skuCode) n++
  if (filter.patternMaster) n++
  if (filter.sampleMaker) n++
  if (filter.orderTypeId != null) n++
  if (filter.collaborationTypeId != null) n++
  if (orderDateRange.value) n++
  if (completedRange.value) n++
  return n
})

async function load() {
  await loadList(() => restoreColumnWidths(patternTableRef.value?.getTableRef?.()))
}

function onSearch(byUser = false) {
  searchList(load, byUser)
}

function debouncedSearch() {
  debounceSearchList(load)
}

function onReset() {
  resetList(load)
}

function onTabChange() {
  changeTab(load)
}

function onPageSizeChange() {
  changePageSize(load)
}

function onSelectionChange(rows: typeof selectedRows.value) {
  updateSelection(rows)
}

const {
  canEditPatternMaterials,
  detailDrawer,
  materialsForm,
  materialTypeOptions,
  assignDialog,
  assignForm,
  assignRules,
  patternMasterOptions,
  sampleMakerOptions,
  completeDialog,
  completeForm,
  completeRules,
  patternBriefFromRow,
  addMaterialRow,
  removeMaterialRow,
  onDetailDrawerClosed,
  openPatternDetailDrawer,
  submitMaterials,
  openAssignDialog,
  resetAssignForm,
  submitAssign,
  openCompleteDialog,
  resetCompleteForm,
  clearSampleImage,
  onSampleImageFileChange,
  submitComplete,
  loadPatternStaffOptions,
  loadMaterialTypes,
} = usePatternDialogs(
  selectedRows,
  { reloadList: load, reloadTabCounts: loadTabCounts },
  { findOrderTypeLabelById, findCollaborationLabelById },
)

const emptyBrief: ProductionOrderBriefModel = {
  orderNo: '',
  skuCode: '',
  imageUrl: '',
  customerName: '',
  merchandiser: '',
  customerDueDate: '',
  orderQuantity: 0,
}

const detailDrawerRef = ref<{ onSaveSuccess: () => void } | null>(null)
let materialsSnapshot: { materials: PatternMaterialRow[]; remark: string } | null = null

function onEnterEdit() {
  materialsSnapshot = {
    materials: JSON.parse(JSON.stringify(materialsForm.materials)) as PatternMaterialRow[],
    remark: materialsForm.remark,
  }
  if (!materialsForm.materials.length) {
    addMaterialRow()
  }
}

function onCancelEdit() {
  if (materialsSnapshot) {
    materialsForm.materials = materialsSnapshot.materials
    materialsForm.remark = materialsSnapshot.remark
  }
  materialsSnapshot = null
}

async function onSaveMaterials() {
  if (detailDrawer.saving) return
  const ok = await submitMaterials()
  if (ok) {
    materialsSnapshot = null
    detailDrawerRef.value?.onSaveSuccess()
    await loadPatternDrawerLogs(detailDrawer.row)
  }
}

watch(
  () => detailDrawer.visible,
  (visible) => {
    if (!visible) materialsSnapshot = null
  },
)

const patternDrawerLogs = ref<ReturnType<typeof toLogSectionItems>>([])

async function loadPatternDrawerLogs(row: PatternListItem | null) {
  if (!row) {
    patternDrawerLogs.value = []
    return
  }
  const logs = await fetchOrderOperationLogs(row.orderId, { module: 'production_pattern' })
  patternDrawerLogs.value = toLogSectionItems(logs)
}

watch(
  () => detailDrawer.row,
  (row) => { void loadPatternDrawerLogs(row) },
)

const completeDialogRef = ref<{ fileInputRef: HTMLInputElement | null } | null>(null)

function overrideTriggerUpload() {
  completeDialogRef.value?.fileInputRef?.click()
}

onMounted(() => {
  void loadOptions()
  void loadMaterialTypes()
  void loadPatternStaffOptions()
  void (async () => {
    await load()
    await loadTabCounts()
  })()
})
</script>

<style scoped src="./pattern.css"></style>

<style>
.pattern-order-type-tree-popper.el-popper {
  max-width: 440px;
}
</style>
