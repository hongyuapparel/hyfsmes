<template>
  <div class="page-card page-card--fill pattern-page">
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button v-for="tab in PATTERN_TABS" :key="tab.value" :value="tab.value">
            {{ getTabLabel(tab) }}
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
          <span v-if="filter.orderNo && orderNoLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">
            订单号：
          </span>
        </template>
      </el-input>
      <el-input
        v-model="filter.skuCode"
        placeholder="SKU编号"
        clearable
        size="large"
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
      <el-select
        v-model="filter.patternMaster"
        placeholder="纸样师"
        clearable
        filterable
        size="large"
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
        size="large"
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
        size="large"
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
        size="large"
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
          size="large"
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
          size="large"
          :class="['filter-range', { 'range-single': !completedRange }]"
          @change="onSearch"
        />
      </div>
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button size="large" :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button v-if="hasSelection && canAssignPattern" type="primary" size="large" @click="openAssignDialog">
          分配纸样师和车版师
        </el-button>
        <el-button
          v-if="hasSelection && canCompleteSelection && canCompletePattern"
          type="primary"
          size="large"
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

    <ProductionDetailDrawerShell
      v-model="detailDrawer.visible"
      title="纸样详情"
      :size="760"
      :resizable="true"
      @closed="onDetailDrawerClosed"
    >
      <template v-if="detailDrawer.row">
        <ProductionDetailSection>
          <ProductionOrderBriefPanel :brief="patternBriefFromRow(detailDrawer.row)" />
        </ProductionDetailSection>
        <ProductionDetailSection title="业务扩展信息">
          <el-descriptions :column="2" border size="small" class="pattern-brief-extra">
            <el-descriptions-item label="纸样师">
              {{ (detailDrawer.row.patternMaster ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="车版师">
              {{ (detailDrawer.row.sampleMaker ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="纸样状态">
              {{ patternStatusLabel(detailDrawer.row.patternStatus) }}
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="时效与节点">
          <el-descriptions :column="2" border size="small" class="pattern-brief-extra">
            <el-descriptions-item label="到纸样时间">
              {{ formatDateTime(detailDrawer.row.arrivedAtPattern) }}
            </el-descriptions-item>
            <el-descriptions-item label="完成时间">
              {{ formatDateTime(detailDrawer.row.completedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="时效判定">
              <SlaJudgeTag :text="detailDrawer.row.timeRating" />
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="纸样物料/裁片清单">
          <template #actions>
            <el-button
              v-if="!materialsEditMode && canEditPatternMaterials"
              size="small"
              text
              type="primary"
              class="materials-head-btn"
              :disabled="detailDrawer.loading"
              @click="enterMaterialsEdit"
            >
              <el-icon><Edit /></el-icon>
              <span>编辑</span>
            </el-button>
            <template v-if="materialsEditMode">
              <el-button
                size="small"
                :disabled="detailDrawer.saving"
                @click="cancelMaterialsEdit"
              >
                取消
              </el-button>
              <el-button
                type="primary"
                size="small"
                :loading="detailDrawer.saving"
                :disabled="detailDrawer.loading"
                @click="handleSubmitMaterials"
              >
                保存
              </el-button>
            </template>
          </template>

          <el-table v-loading="detailDrawer.loading" :data="materialsForm.materials" border size="small" class="materials-table">
            <el-table-column label="物料类型" min-width="110" align="center">
              <template #default="{ row }">
                <el-select
                  v-model="row.materialTypeId"
                  placeholder="选择"
                  filterable
                  clearable
                  size="small"
                  style="width: 100%"
                  :disabled="!canEditPatternMaterials || !materialsEditMode"
                >
                  <el-option v-for="opt in materialTypeOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="物料名称" min-width="180" align="center">
              <template #default="{ row }">
                <el-input v-model="row.materialName" size="small" :disabled="!canEditPatternMaterials || !materialsEditMode" />
              </template>
            </el-table-column>
            <el-table-column label="幅宽(cm)" width="120" align="center">
              <template #default="{ row }">
                <el-input
                  v-model="row.fabricWidth"
                  size="small"
                  placeholder="如 183cm"
                  :disabled="!canEditPatternMaterials || !materialsEditMode"
                />
              </template>
            </el-table-column>
            <el-table-column label="单件用量(米)" width="110" align="center">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.usagePerPiece"
                  :min="0"
                  :controls="false"
                  size="small"
                  :disabled="!canEditPatternMaterials || !materialsEditMode"
                />
              </template>
            </el-table-column>
            <el-table-column label="裁片数量" width="110" align="center">
              <template #default="{ row }">
                <el-input-number
                  v-model="row.cuttingQuantity"
                  :min="0"
                  :controls="false"
                  size="small"
                  :disabled="!canEditPatternMaterials || !materialsEditMode"
                />
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="200" align="center">
              <template #default="{ row }">
                <el-input v-model="row.remark" size="small" :disabled="!canEditPatternMaterials || !materialsEditMode" />
              </template>
            </el-table-column>
            <el-table-column v-if="canEditPatternMaterials && materialsEditMode" label="操作" width="70" fixed="right" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" size="small" @click="removeMaterialRow($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div v-if="materialsEditMode" class="materials-add-row">
            <el-button
              link
              type="primary"
              size="small"
              :disabled="detailDrawer.loading"
              @click="addMaterialRow"
            >
              <el-icon><Plus /></el-icon>
              <span>新增一行</span>
            </el-button>
          </div>

          <div class="materials-remark">
            <div class="materials-remark-label">备注</div>
            <div class="materials-remark-field">
              <el-input
                v-model="materialsForm.remark"
                type="textarea"
                size="small"
                :autosize="{ minRows: 1, maxRows: 8 }"
                placeholder="可选"
                :disabled="!canEditPatternMaterials || !materialsEditMode"
              />
            </div>
          </div>

        </ProductionDetailSection>
        <ProductionDetailSection>
          <OperationLogsSection :logs="patternDrawerLogs" />
        </ProductionDetailSection>
      </template>
    </ProductionDetailDrawerShell>

    <AppDialog
      v-model="assignDialog.visible"
      title="分配纸样师和车版师"
      width="420"
      destroy-on-close
      @close="resetAssignForm"
    >
      <el-form ref="assignFormRef" :model="assignForm" :rules="assignRules" label-width="100px">
        <el-form-item label="纸样师" prop="patternMaster">
          <el-select
            v-model="assignForm.patternMaster"
            placeholder="请选择纸样师"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option v-for="e in patternMasterOptions" :key="e.id" :label="e.name" :value="e.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="车版师" prop="sampleMaker">
          <el-select
            v-model="assignForm.sampleMaker"
            placeholder="请选择车版师"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option v-for="e in sampleMakerOptions" :key="e.id" :label="e.name" :value="e.name" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="assignDialog.submitting" @click="submitAssign">
          确定
        </el-button>
      </template>
    </AppDialog>

    <AppDialog
      v-model="completeDialog.visible"
      title="确认完成"
      width="480"
      destroy-on-close
      @close="resetCompleteForm"
    >
      <div v-if="completeDialog.row" class="complete-brief">
        <div>订单号：{{ completeDialog.row.orderNo }}</div>
        <div>SKU：{{ completeDialog.row.skuCode }}</div>
      </div>
      <div class="complete-hint">样品图片可选：不上传也可以完成纸样</div>
      <el-form ref="completeFormRef" :model="completeForm" :rules="completeRules" label-width="100px">
        <el-form-item label="样品图片" prop="sampleImageUrl">
          <div class="sample-image-upload" @click="triggerSampleImageUpload">
            <div v-if="completeForm.sampleImageUrl" class="image-preview-wrap">
              <el-image
                :src="completeForm.sampleImageUrl"
                fit="contain"
                :preview-teleported="true"
                :preview-src-list="[completeForm.sampleImageUrl]"
              />
              <el-button text type="danger" size="small" class="image-remove" @click.stop="clearSampleImage">
                移除
              </el-button>
            </div>
            <div v-else class="image-placeholder">
              <span>点击上传样品图片</span>
            </div>
          </div>
          <input
            ref="sampleImageFileInputRef"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            class="hidden-file-input"
            @change="onSampleImageFileChange"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="completeDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="completeDialog.submitting" @click="submitComplete">
          完成纸样
        </el-button>
      </template>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { formatDateTime } from '@/utils/date-format'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
  getFilterRangeStyle,
  getAdaptiveSelectStyle,
} from '@/composables/useFilterBarHelpers'
import { useTreeSelectAdjust } from '@/composables/useTreeSelectAdjust'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { PATTERN_TABS, patternStatusLabel, usePatternList } from '@/composables/usePatternList'
import { usePatternDialogs } from '@/composables/usePatternDialogs'
import { Edit, Plus } from '@element-plus/icons-vue'
import type { PatternListItem, PatternMaterialRow } from '@/api/production-pattern'
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'
import { fetchOrderOperationLogs, toLogSectionItems } from '@/api/operation-logs'
import PatternTable from '@/components/production/PatternTable.vue'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import ProductionOrderBriefPanel from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import { useAuthStore } from '@/stores/auth'
import AppPaginationBar from '@/components/AppPaginationBar.vue'

const authStore = useAuthStore()
const canAssignPattern = computed(() => authStore.hasPermission('production_pattern_assign'))
const canCompletePattern = computed(() => authStore.hasPermission('production_pattern_complete'))

const { adjustTreePopperWidth } = useTreeSelectAdjust()

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
} = usePatternList()

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
  assignFormRef,
  assignForm,
  assignRules,
  patternMasterOptions,
  sampleMakerOptions,
  completeDialog,
  completeFormRef,
  completeForm,
  completeRules,
  sampleImageFileInputRef,
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
  triggerSampleImageUpload,
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

const materialsEditMode = ref(false)
let materialsSnapshot: { materials: PatternMaterialRow[]; remark: string } | null = null

function enterMaterialsEdit() {
  materialsSnapshot = {
    materials: JSON.parse(JSON.stringify(materialsForm.materials)) as PatternMaterialRow[],
    remark: materialsForm.remark,
  }
  if (!materialsForm.materials.length) {
    addMaterialRow()
  }
  materialsEditMode.value = true
}

function cancelMaterialsEdit() {
  if (materialsSnapshot) {
    materialsForm.materials = materialsSnapshot.materials
    materialsForm.remark = materialsSnapshot.remark
  }
  materialsSnapshot = null
  materialsEditMode.value = false
}

async function handleSubmitMaterials() {
  if (detailDrawer.saving) return
  const ok = await submitMaterials()
  if (ok) {
    materialsSnapshot = null
    materialsEditMode.value = false
    await loadPatternDrawerLogs(detailDrawer.row)
  }
}

watch(
  () => detailDrawer.visible,
  (visible) => {
    if (!visible) {
      materialsEditMode.value = false
      materialsSnapshot = null
    }
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
  (row) => {
    void loadPatternDrawerLogs(row)
  },
)

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
