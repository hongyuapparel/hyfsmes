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
          <span v-if="filter.skuCode && skuCodeLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">
            SKU：
          </span>
        </template>
      </el-input>
      <el-tree-select
        v-model="filter.orderTypeId"
        :data="orderTypeTreeSelectData"
        placeholder="订单类型"
        filterable
        clearable
        default-expand-all
        :render-after-expand="false"
        node-key="value"
        :props="{ label: 'label', value: 'value', children: 'children', disabled: 'disabled' }"
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.orderTypeId && `订单类型：${findOrderTypeLabelById(filter.orderTypeId)}`,
          )
        "
        @change="onSearch"
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
        :style="
          getFilterSelectAutoWidthStyle(
            filter.collaborationTypeId && `合作方式：${findCollaborationLabelById(filter.collaborationTypeId)}`,
          )
        "
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.collaborationTypeId">合作方式：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option v-for="opt in collaborationOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
      </el-select>
      <el-select
        v-model="filter.purchaseStatus"
        placeholder="采购状态"
        clearable
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.purchaseStatus ? `采购状态：${purchaseStatusLabel(filter.purchaseStatus)}` : undefined,
          )
        "
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.purchaseStatus">采购状态：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option label="全部" value="" />
        <el-option label="已完成" value="completed" />
        <el-option label="未完成" value="pending" />
      </el-select>
      <el-date-picker
        v-model="orderDateRange"
        type="daterange"
        range-separator=""
        start-placeholder="下单时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        size="large"
        class="filter-bar-item"
        :style="getFilterRangeStyle(orderDateRange)"
        @change="onSearch"
      />
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
        :purchase-status-label="purchaseStatusLabel"
        @header-dragend="onHeaderDragEnd"
        @selection-change="onSelectionChange"
        @open-detail="openPatternDetailDrawer"
      />
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

    <ProductionDetailDrawerShell
      v-model="detailDrawer.visible"
      title="纸样详情"
      size="760px"
      @closed="onDetailDrawerClosed"
    >
      <template v-if="detailDrawer.row">
        <ProductionDetailSection>
          <ProductionOrderBriefPanel :brief="patternBriefFromRow(detailDrawer.row)" />
        </ProductionDetailSection>
        <ProductionDetailSection title="业务扩展信息">
          <el-descriptions :column="1" border size="small" class="pattern-brief-extra">
            <el-descriptions-item label="纸样师">
              {{ (detailDrawer.row.patternMaster ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="车版师">
              {{ (detailDrawer.row.sampleMaker ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="纸样状态">
              {{ detailDrawer.row.patternStatus }}
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="时效与节点">
          <el-descriptions :column="1" border size="small" class="pattern-brief-extra">
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
          <div class="materials-brief">
            <div>订单号：{{ detailDrawer.row.orderNo }}</div>
            <div>SKU：{{ detailDrawer.row.skuCode }}</div>
          </div>

          <div class="materials-actions">
            <el-button
              link
              type="primary"
              size="small"
              :disabled="detailDrawer.loading || !canEditPatternMaterials"
              @click="addMaterialRow"
            >
              新增
            </el-button>
          </div>

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
                  :disabled="!canEditPatternMaterials"
                >
                  <el-option v-for="opt in materialTypeOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
                </el-select>
              </template>
            </el-table-column>
            <el-table-column label="物料名称" min-width="180" align="center">
              <template #default="{ row }">
                <el-input v-model="row.materialName" size="small" :disabled="!canEditPatternMaterials" />
              </template>
            </el-table-column>
            <el-table-column label="幅宽(cm)" width="120" align="center">
              <template #default="{ row }">
                <el-input
                  v-model="row.fabricWidth"
                  size="small"
                  placeholder="如 183cm"
                  :disabled="!canEditPatternMaterials"
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
                  :disabled="!canEditPatternMaterials"
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
                  :disabled="!canEditPatternMaterials"
                />
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="200" align="center">
              <template #default="{ row }">
                <el-input v-model="row.remark" size="small" :disabled="!canEditPatternMaterials" />
              </template>
            </el-table-column>
            <el-table-column v-if="canEditPatternMaterials" label="操作" width="70" fixed="right" align="center">
              <template #default="{ $index }">
                <el-button link type="danger" size="small" @click="removeMaterialRow($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>

          <div class="materials-remark">
            <div class="materials-remark-label">总体备注</div>
            <el-input
              v-model="materialsForm.remark"
              type="textarea"
              :rows="3"
              placeholder="可选"
              :disabled="!canEditPatternMaterials"
            />
          </div>

          <div class="detail-drawer-footer">
            <el-button
              v-if="canEditPatternMaterials"
              type="primary"
              :loading="detailDrawer.saving"
              :disabled="detailDrawer.loading"
              @click="submitMaterials"
            >
              保存
            </el-button>
          </div>
        </ProductionDetailSection>
      </template>
    </ProductionDetailDrawerShell>

    <el-dialog
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
    </el-dialog>

    <el-dialog
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
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { formatDateTime } from '@/utils/date-format'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
  getFilterRangeStyle,
} from '@/composables/useFilterBarHelpers'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { PATTERN_TABS, usePatternList } from '@/composables/usePatternList'
import { usePatternDialogs } from '@/composables/usePatternDialogs'
import PatternTable from '@/components/production/PatternTable.vue'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import ProductionOrderBriefPanel from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const canAssignPattern = computed(() => authStore.hasPermission('production_pattern_assign'))
const canCompletePattern = computed(() => authStore.hasPermission('production_pattern_complete'))

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
  orderNoLabelVisible,
  skuCodeLabelVisible,
  currentTab,
  list,
  loading,
  exporting,
  pagination,
  selectedRows,
  hasSelection,
  canCompleteSelection,
  orderTypeTreeSelectData,
  collaborationOptions,
  findOrderTypeLabelById,
  findCollaborationLabelById,
  purchaseStatusLabel,
  getFilterSelectAutoWidthStyle,
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

onMounted(() => {
  void loadOptions()
  void loadMaterialTypes()
  void load()
  void loadTabCounts()
  void loadPatternStaffOptions()
})
</script>

<style scoped src="./pattern.css"></style>
