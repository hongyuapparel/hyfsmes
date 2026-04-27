<template>
  <div class="page-card page-card--fill sewing-page">
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button v-for="tab in SEWING_TABS" :key="tab.value" :value="tab.value">
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
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button size="large" :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button v-if="hasSelection && canAssignSelection && canAssignSewingAction" type="primary" size="large" @click="openAssignDialog">
          分单
        </el-button>
        <el-button
          v-if="hasSelection && canAssignCompletedSelection && canAssignSewingAction"
          type="primary"
          size="large"
          @click="openAssignDialog"
        >
          补录分单
        </el-button>
        <el-button v-if="hasSelection && canRegisterSelection && canCompleteSewingAction" type="primary" size="large" @click="openRegisterDialog">
          登记车缝完成
        </el-button>
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <div ref="tableShellRef" class="list-page-table-shell">
      <SewingTable
        ref="sewingTableRef"
        :list="list"
        :loading="loading"
        :table-height="tableHeight"
        :compact-row-style="compactRowStyle"
        :compact-cell-style="compactCellStyle"
        :compact-header-cell-style="compactHeaderCellStyle"
        :compact-image-size="compactImageSize"
        :compact-image-column-min-width="compactImageColumnMinWidth"
        :size-breakdown-cache="sizeBreakdownCache"
        :size-popover-loading-id="sizePopoverLoadingId"
        :qty-popover-blocks="qtyPopoverBlocks"
        :qty-popover-width="qtyPopoverWidth"
        @header-dragend="onHeaderDragEnd"
        @selection-change="onSelectionChange"
        @show-qty-popover="onShowQtyPopover"
        @open-brief="openSewingBriefDrawer"
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

    <el-dialog v-model="assignDialog.visible" title="分单" width="460" destroy-on-close @close="resetAssignForm">
      <el-form ref="assignFormRef" :model="assignForm" :rules="assignRules" label-width="100px" class="assign-form">
        <el-form-item label="分单时间" prop="distributedAt">
          <el-date-picker
            v-model="assignForm.distributedAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择分单时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="交期" prop="factoryDueDate">
          <el-date-picker
            v-model="assignForm.factoryDueDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="加工供应商需交货给我们的日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="加工供应商" prop="factoryName">
          <el-select v-model="assignForm.factoryName" placeholder="请选择加工供应商" filterable clearable style="width: 100%">
            <el-option v-for="s in factorySuppliers" :key="s.id" :label="s.name" :value="s.name" />
          </el-select>
        </el-form-item>
        <el-form-item label="车缝加工费" prop="sewingFee">
          <el-input v-model="assignForm.sewingFee" placeholder="0" clearable style="width: 100%">
            <template #prefix>
              <span class="currency-prefix">¥</span>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="assignDialog.submitting" @click="submitAssign">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="registerDialog.visible"
      title="登记车缝完成"
      width="720"
      destroy-on-close
      @close="resetRegisterForm"
    >
      <template v-if="registerDialog.row">
        <div class="register-brief">
          <div>订单号：{{ registerDialog.row.orderNo }}</div>
          <div>SKU：{{ registerDialog.row.skuCode }}</div>
        </div>
        <div v-if="registerFormCompleteLoading" class="register-loading">加载尺寸细数...</div>
        <template v-else-if="registerForm.headers?.length">
          <div class="register-qty-title">尺寸细数</div>
          <el-table :data="registerSizeTableRows" border size="small" class="register-qty-table" style="width: 100%">
            <el-table-column prop="label" label="" width="90" align="right" />
            <el-table-column
              v-for="(h, idx) in registerForm.headers"
              :key="idx"
              :label="h"
              min-width="100"
              align="center"
            >
              <template #default="{ row }">
                <template v-if="row.key === 'order' || row.key === 'cut'">
                  {{ row.values[idx] != null ? formatDisplayNumber(row.values[idx]) : '-' }}
                </template>
                <template
                  v-else-if="row.key === 'sewing' && idx === registerForm.headers.length - 1 && registerForm.headers.length > 1"
                >
                  {{ formatDisplayNumber(registerSewingTotal) }}
                </template>
                <template v-else>
                  <el-input-number
                    v-model="registerForm.sewingQuantities[idx]"
                    :min="0"
                    :max="registerForm.cutRow[idx] != null ? Number(registerForm.cutRow[idx]) : undefined"
                    :precision="0"
                    controls-position="right"
                    size="small"
                    style="width: 100%"
                  />
                </template>
              </template>
            </el-table-column>
          </el-table>
          <p class="register-qty-sum">车缝数量合计：{{ formatDisplayNumber(registerSewingTotal) }}</p>
        </template>
        <el-form
          ref="registerFormRef"
          :model="registerForm"
          :rules="registerRules"
          label-width="100px"
          class="register-form"
        >
          <el-form-item label="次品数量" prop="defectQuantity">
            <el-input-number
              v-model="registerForm.defectQuantity"
              :min="0"
              :precision="0"
              controls-position="right"
              style="width: 160px"
            />
          </el-form-item>
          <el-form-item label="次品说明" prop="defectReason">
            <el-input
              v-model="registerForm.defectReason"
              type="textarea"
              :rows="3"
              placeholder="填写次品原因或说明"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="registerDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="registerDialog.submitting" @click="submitRegister">完成</el-button>
      </template>
    </el-dialog>

    <ProductionDetailDrawerShell
      v-model="sewingBriefDrawer.visible"
      title="车缝外发概要"
      size="460px"
      @closed="sewingBriefDrawer.row = null"
    >
      <template v-if="sewingBriefDrawer.row">
        <ProductionDetailSection>
          <ProductionOrderBriefPanel :brief="sewingBriefFromRow(sewingBriefDrawer.row)" />
        </ProductionDetailSection>
        <ProductionDetailSection title="业务扩展信息">
          <el-descriptions :column="1" border size="small" class="sewing-brief-extra">
            <el-descriptions-item label="加工供应商">
              {{ (sewingBriefDrawer.row.factoryName ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="分单时间">
              {{ formatDateTime(sewingBriefDrawer.row.distributedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="加工供应商交期">
              {{ formatDate(sewingBriefDrawer.row.factoryDueDate) }}
            </el-descriptions-item>
            <el-descriptions-item label="车缝加工费(元)">
              {{
                sewingBriefDrawer.row.sewingFee != null && String(sewingBriefDrawer.row.sewingFee).trim() !== ''
                  ? formatDisplayNumber(sewingBriefDrawer.row.sewingFee)
                  : '—'
              }}
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="时效与节点">
          <el-descriptions :column="1" border size="small" class="sewing-brief-extra">
            <el-descriptions-item label="到车缝时间">
              {{ formatDateTime(sewingBriefDrawer.row.arrivedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="完成时间">
              {{ formatDateTime(sewingBriefDrawer.row.completedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="时效判定">
              <SlaJudgeTag :text="sewingBriefDrawer.row.timeRating" />
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
      </template>
    </ProductionDetailDrawerShell>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, onMounted } from 'vue'
import { type SewingListItem } from '@/api/production-sewing'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDate, formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import { useSewingList } from '@/composables/useSewingList'
import { useSewingDialogs } from '@/composables/useSewingDialogs'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import SewingTable from '@/components/production/SewingTable.vue'
import ProductionOrderBriefPanel, {
  type ProductionOrderBriefModel,
} from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const canAssignSewingAction = computed(() => authStore.hasPermission('production_sewing_assign'))
const canCompleteSewingAction = computed(() => authStore.hasPermission('production_sewing_complete'))

const {
  SEWING_TABS,
  filter,
  orderNoLabelVisible,
  skuCodeLabelVisible,
  currentTab,
  list,
  loading,
  exporting,
  pagination,
  selectedRows,
  hasSelection,
  canAssignSelection,
  canAssignCompletedSelection,
  canRegisterSelection,
  tableShellRef,
  tableHeight,
  compactHeaderCellStyle,
  compactCellStyle,
  compactRowStyle,
  compactImageSize,
  compactImageColumnMinWidth,
  sewingTableRef,
  sizeBreakdownCache,
  sizePopoverLoadingId,
  onHeaderDragEnd,
  qtyPopoverBlocks,
  qtyPopoverWidth,
  getTabLabel,
  load,
  loadTabCounts,
  refreshAfterMutation,
  onExport,
  onShowQtyPopover,
  onSearch,
  debouncedSearch,
  onReset,
  onTabChange,
  onPageSizeChange,
  onSelectionChange,
} = useSewingList()

const {
  factorySuppliers,
  assignDialog,
  assignFormRef,
  assignForm,
  assignRules,
  registerDialog,
  registerFormCompleteLoading,
  registerFormRef,
  registerForm,
  registerSizeTableRows,
  registerSewingTotal,
  registerRules,
  loadFactorySuppliers,
  openAssignDialog,
  resetAssignForm,
  submitAssign,
  openRegisterDialog,
  resetRegisterForm,
  submitRegister,
} = useSewingDialogs(selectedRows, refreshAfterMutation)

const sewingBriefDrawer = reactive<{ visible: boolean; row: SewingListItem | null }>({
  visible: false,
  row: null,
})

function openSewingBriefDrawer(row: SewingListItem) {
  sewingBriefDrawer.row = row
  sewingBriefDrawer.visible = true
}

function sewingBriefFromRow(row: SewingListItem): ProductionOrderBriefModel {
  return {
    orderNo: row.orderNo,
    skuCode: row.skuCode,
    imageUrl: row.imageUrl,
    customerName: row.customerName,
    merchandiser: row.merchandiser,
    customerDueDate: row.customerDueDate,
    orderQuantity: row.quantity,
  }
}

onMounted(() => {
  void loadFactorySuppliers()
  void load()
  void loadTabCounts()
})
</script>

<style scoped>
.sewing-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.status-tabs {
  display: flex;
  align-items: center;
  margin-bottom: var(--space-md);
}

.status-tabs-left {
  flex-shrink: 0;
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.register-brief {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  font-size: var(--font-size-caption, 12px);
}

.register-brief > div + div {
  margin-top: 4px;
}

.register-loading {
  padding: var(--space-md);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.register-qty-title {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 13px;
}

.register-qty-table {
  margin-bottom: 8px;
}

.register-qty-sum {
  margin: 0 0 var(--space-sm);
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.register-form {
  margin-top: var(--space-sm);
}

.currency-prefix {
  color: var(--el-text-color-regular);
}

.sewing-brief-extra {
  margin-top: 12px;
}
</style>
