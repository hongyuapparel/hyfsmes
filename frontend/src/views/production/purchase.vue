<template>
  <div class="page-card page-card--fill purchase-page">
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button
            v-for="tab in PURCHASE_TABS"
            :key="tab.value"
            :value="tab.value"
          >
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
      <el-input
        v-model="filter.supplier"
        placeholder="供应商"
        clearable
        size="large"
        class="filter-bar-item"
        :input-style="getFilterInputStyle(filter.supplier)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      />
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
          <span
            v-if="filter.orderTypeId"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            订单类型：
          </span>
        </template>
      </el-tree-select>
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
        <el-button
          v-if="hasSelection"
          type="primary"
          size="large"
          @click="onBatchHandle"
        >
          {{ batchButtonLabel }}
        </el-button>
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <PurchaseTable
      ref="purchaseTableHostRef"
      :loading="loading"
      :list="list"
      :material-progress-column-label="materialProgressColumnLabel"
      @header-dragend="onHeaderDragEnd"
      @selection-change="onSelectionChange"
      @open-brief="openPurchaseBriefDrawer"
    />

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
      v-model="purchaseBriefDrawer.visible"
      title="订单与物料概要"
      @closed="purchaseBriefDrawer.row = null"
    >
      <template v-if="purchaseBriefDrawer.row">
        <ProductionDetailSection>
          <ProductionOrderBriefPanel :brief="purchaseBriefFromRow(purchaseBriefDrawer.row)" />
        </ProductionDetailSection>
        <ProductionDetailSection title="本行物料">
          <el-descriptions :column="2" border size="small" class="purchase-brief-material">
            <el-descriptions-item label="物料序号">
              {{ purchaseBriefDrawer.row.materialIndex + 1 }}
            </el-descriptions-item>
            <el-descriptions-item label="处理路线">
              {{ purchaseBriefDrawer.row.processRoute === 'picking' ? '领料' : '采购' }}
            </el-descriptions-item>
            <el-descriptions-item label="订单类型">
              {{ orderTypeDisplay(purchaseBriefDrawer.row) || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="物料类型">
              {{ (purchaseBriefDrawer.row.materialType ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="物料名称">
              {{ (purchaseBriefDrawer.row.materialName ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="颜色">
              {{ (purchaseBriefDrawer.row.color ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="供应商">
              {{ (purchaseBriefDrawer.row.supplierName ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="物料来源">
              {{ (purchaseBriefDrawer.row.materialSource ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="计划用量">
              {{
                purchaseBriefDrawer.row.planQuantity != null
                  ? formatDisplayNumber(purchaseBriefDrawer.row.planQuantity)
                  : '—'
              }}
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="采购登记信息">
          <el-descriptions :column="2" border size="small" class="purchase-brief-material">
            <el-descriptions-item label="实际采购数量">
              {{
                purchaseBriefDrawer.row.actualPurchaseQuantity != null
                  ? formatDisplayNumber(purchaseBriefDrawer.row.actualPurchaseQuantity)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="单价(元)">
              {{
                purchaseBriefDrawer.row.purchaseUnitPrice != null && purchaseBriefDrawer.row.purchaseUnitPrice !== ''
                  ? formatDisplayNumber(purchaseBriefDrawer.row.purchaseUnitPrice)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="其他费用(元)">
              {{
                purchaseBriefDrawer.row.purchaseOtherCost != null && purchaseBriefDrawer.row.purchaseOtherCost !== ''
                  ? formatDisplayNumber(purchaseBriefDrawer.row.purchaseOtherCost)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="采购总金额(元)">
              {{
                purchaseBriefDrawer.row.purchaseAmount != null && purchaseBriefDrawer.row.purchaseAmount !== ''
                  ? formatDisplayNumber(purchaseBriefDrawer.row.purchaseAmount)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="采购凭证">
              <AppImageThumb
                v-if="purchaseBriefDrawer.row.purchaseImageUrl"
                :raw-url="purchaseBriefDrawer.row.purchaseImageUrl"
                variant="compact"
              />
              <span v-else>—</span>
            </el-descriptions-item>
            <el-descriptions-item label="采购备注">
              {{ (purchaseBriefDrawer.row.purchaseRemark ?? '').trim() || '—' }}
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="时效与节点">
          <el-descriptions :column="2" border size="small" class="purchase-brief-material">
            <el-descriptions-item label="到采购时间">
              {{ formatDateTime(purchaseBriefDrawer.row.pendingPurchaseAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="完成时间">
              {{
                formatDateTime(
                  purchaseBriefDrawer.row.processRoute === 'picking'
                    ? purchaseBriefDrawer.row.pickCompletedAt
                    : purchaseBriefDrawer.row.purchaseCompletedAt,
                )
              }}
            </el-descriptions-item>
            <el-descriptions-item label="时效判定">
              <SlaJudgeTag :text="purchaseBriefDrawer.row.timeRating" />
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
      </template>
    </ProductionDetailDrawerShell>

    <el-dialog
      v-model="registerDialog.visible"
      title="登记实际采购"
      width="560"
      destroy-on-close
      @close="resetRegisterForm"
    >
      <template v-if="registerDialog.row">
        <div class="register-brief">
          <div>订单号：{{ registerDialog.row.orderNo }}</div>
          <div>物料：{{ registerDialog.row.materialName }}</div>
          <div>供应商：{{ registerDialog.row.supplierName }}</div>
        </div>
        <el-form
          ref="registerFormRef"
          :model="registerForm"
          :rules="registerRules"
          label-width="110px"
          class="register-form"
        >
          <el-form-item label="实际采购数量" prop="actualPurchaseQuantity">
            <el-input-number
              v-model="registerForm.actualPurchaseQuantity"
              :min="0"
              :precision="0"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="单价">
            <el-input
              v-model="registerForm.unitPrice"
              placeholder="元 / 单位"
              clearable
            >
              <template #prepend>￥</template>
            </el-input>
          </el-form-item>
          <el-form-item label="其他费用">
            <el-input
              v-model="registerForm.otherCost"
              placeholder="如运费、杂费，元"
              clearable
            >
              <template #prepend>￥</template>
            </el-input>
          </el-form-item>
          <el-form-item label="采购总金额">
            <el-input
              v-model="registerForm.purchaseAmount"
              placeholder="自动计算"
              disabled
            >
              <template #prepend>￥</template>
            </el-input>
          </el-form-item>
          <el-form-item label="采购凭证">
            <ImageUploadArea v-model="registerForm.imageUrl" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input
              v-model="registerForm.remark"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
              placeholder="本次采购的补充说明"
            />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="registerDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="registerDialog.submitting" @click="submitRegister">
          确定
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="pickDialog.visible"
      title="领料"
      width="620"
      destroy-on-close
      @close="resetPickForm"
    >
      <template v-if="pickDialog.row">
        <div class="register-brief pick-brief-grid">
          <div><span class="pick-brief-label">订单号：</span>{{ pickDialog.row.orderNo }}</div>
          <div><span class="pick-brief-label">SKU：</span>{{ pickDialog.row.skuCode }}</div>
          <div><span class="pick-brief-label">物料：</span>{{ pickDialog.row.materialName }}</div>
          <div><span class="pick-brief-label">物料类型：</span>{{ displayMaterialType(pickDialog.row) }}</div>
          <div><span class="pick-brief-label">物料来源：</span>{{ pickDialog.row.materialSource || '-' }}</div>
          <div><span class="pick-brief-label">颜色：</span>{{ pickDialog.row.color || '-' }}</div>
          <div>
            <span class="pick-brief-label">计划用量：</span>{{ pickDialog.row.planQuantity != null ? formatDisplayNumber(pickDialog.row.planQuantity) : '-' }} 米
          </div>
          <div v-if="pickDialog.total > 1"><span class="pick-brief-label">当前处理：</span>{{ pickDialog.index + 1 }} / {{ pickDialog.total }}</div>
        </div>
        <el-alert
          v-if="pickDialog.row.materialSource === '客供面料'"
          type="warning"
          :closable="false"
          title="请联系对应业务员或跟单领取客供面料"
          style="margin-bottom: 12px"
        />
        <el-form ref="pickFormRef" :model="pickForm" :rules="pickRules" label-width="120px">
          <el-form-item label="库存来源类型">
            <el-select v-model="pickForm.inventorySourceType" clearable placeholder="可选（不选则仅备注处理）" @change="onPickSourceTypeChange">
              <el-option label="面料库存" value="fabric" />
              <el-option label="辅料库存" value="accessory" />
              <el-option label="成衣库存" value="finished" />
            </el-select>
          </el-form-item>
          <el-form-item label="具体库存">
            <el-select v-model="pickForm.inventoryId" clearable filterable placeholder="先选择库存来源类型" :disabled="!pickForm.inventorySourceType">
              <el-option v-for="opt in pickInventoryOptions" :key="opt.id" :label="opt.label" :value="opt.id">
                <div class="pick-stock-option">
                  <AppImageThumb
                    v-if="opt.imageUrl"
                    :raw-url="opt.imageUrl"
                    :width="28"
                    :height="28"
                  />
                  <span v-else class="pick-stock-thumb-empty">-</span>
                  <span class="pick-stock-option-label">{{ opt.label }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="调取数量" prop="quantity">
            <div class="pick-qty-row">
              <el-input-number v-model="pickForm.quantity" :min="0" :precision="2" :controls="false" style="width: 100%" />
              <span class="pick-qty-unit">米</span>
            </div>
          </el-form-item>
          <el-form-item label="备注" prop="remark">
            <el-input v-model="pickForm.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="pickDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="pickDialog.submitting" @click="submitPick">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
  getFilterRangeStyle,
} from '@/composables/useFilterBarHelpers'
import { PURCHASE_TABS, usePurchaseList } from '@/composables/usePurchaseList'
import { usePurchaseDialogs } from '@/composables/usePurchaseDialogs'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import PurchaseTable from '@/components/production/PurchaseTable.vue'
import ProductionOrderBriefPanel from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'

const {
  filter,
  orderDateRange,
  orderNoLabelVisible,
  skuCodeLabelVisible,
  currentTab,
  list,
  loading,
  pagination,
  selectedRows,
  hasSelection,
  orderTypeTreeSelectData,
  materialProgressColumnLabel,
  purchaseTableHostRef,
  purchaseBriefDrawer,
  getTabLabel,
  getFilterSelectAutoWidthStyle,
  findOrderTypeLabelById,
  load,
  loadTabCounts,
  onSearch,
  debouncedSearch,
  onReset,
  onTabChange,
  onPageSizeChange,
  onSelectionChange,
  onHeaderDragEnd,
  loadOptions,
  orderTypeDisplay,
  openPurchaseBriefDrawer,
  purchaseBriefFromRow,
  displayMaterialType,
} = usePurchaseList()

const {
  registerDialog,
  registerFormRef,
  registerForm,
  registerRules,
  pickDialog,
  pickFormRef,
  pickForm,
  pickInventoryOptions,
  pickRules,
  batchButtonLabel,
  onBatchHandle,
  onPickSourceTypeChange,
  resetPickForm,
  submitPick,
  resetRegisterForm,
  submitRegister,
} = usePurchaseDialogs({
  currentTab,
  hasSelection,
  selectedRows,
  reload: load,
  reloadTabCounts: loadTabCounts,
  clearSelection: () => {
    selectedRows.value = []
  },
})

onMounted(() => {
  void loadOptions()
  void load()
  void loadTabCounts()
})
</script>

<style scoped>
.purchase-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.status-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
  color: var(--el-text-color-regular);
}

.register-brief > div + div {
  margin-top: 4px;
}

.pick-brief-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
}

.pick-brief-grid > div + div {
  margin-top: 0;
}

.pick-brief-label {
  color: var(--el-text-color-secondary);
}

.pick-stock-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pick-stock-thumb-empty {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px dashed var(--el-border-color-lighter);
  color: var(--el-text-color-placeholder);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.pick-stock-option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pick-qty-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.pick-qty-unit {
  color: var(--el-text-color-secondary);
  flex: 0 0 auto;
}

.register-form {
  margin-top: var(--space-sm);
}

.register-form :deep(.el-form-item__label) {
  white-space: normal;
  line-height: 1.3;
}
</style>
