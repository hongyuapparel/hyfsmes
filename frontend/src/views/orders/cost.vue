<template>
  <div class="page-card order-cost-page" @input="onAnyFieldInput" @change="onAnyFieldChange">
    <div class="page-header">
      <div class="left">
        <el-button link type="primary" @click="goBack">返回列表</el-button>
        <span class="title">订单成本</span>
        <span v-if="order" class="sub-title">{{ order.orderNo }} · {{ order.skuCode }}</span>
      </div>
      <div class="header-actions">
        <el-button :loading="savingDraft" :disabled="!canSubmitCost || confirmingQuote" @click="saveDraft">保存草稿</el-button>
        <el-button type="primary" :loading="confirmingQuote" :disabled="!canSubmitCost || savingDraft" @click="confirmQuote">
          确认报价
        </el-button>
      </div>
    </div>

    <el-card class="block-card summary-card" shadow="never">
      <div class="order-summary">
        <span><strong>客户：</strong>{{ order?.customerName ?? '-' }}</span>
        <span><strong>数量：</strong>{{ formatDisplayNumber(order?.quantity ?? 0) }}</span>
        <span><strong>当前销售价：</strong>{{ order?.salePrice ?? '-' }} 元</span>
        <span class="cost-notice">{{ costNotice }}</span>
      </div>
    </el-card>

    <OrderCostMaterialCard
      :rows="materialRowsSorted"
      :total="materialTotal"
      :material-type-options="materialTypeOptions"
      :supplier-options="supplierOptions"
      :supplier-loading="supplierLoading"
      :span-method="materialSpanMethod"
      :format-money="formatMoney"
      :remote-supplier-search="searchSuppliers"
      :on-supplier-visible-change="onSupplierSelectVisibleChange"
      @add="addMaterialRow"
      @remove="removeMaterialRow"
    />

    <OrderCostProcessItemsCard
      :rows="processItemRows"
      :total="processItemTotal"
      :process-options="processOptions"
      :supplier-options="supplierOptions"
      :supplier-loading="supplierLoading"
      :format-money="formatMoney"
      :remote-supplier-search="searchSuppliers"
      :on-supplier-visible-change="onSupplierSelectVisibleChange"
      :on-process-visible-change="onProcessOptionsVisibleChange"
      @add="addProcessItemRow"
      @remove="removeProcessItemRow"
    />

    <OrderCostProductionCard
      :rows="productionRowsSorted"
      :production-processes="productionProcesses"
      :selected-rows="selectedProductionRows"
      :production-cost-multiplier="productionCostMultiplier"
      :base-total="productionProcessBaseTotal"
      :total="productionProcessTotal"
      :production-picker-visible="productionPickerVisible"
      :production-added-ids-signature="productionAddedIdsSignature"
      :import-template-options="importTemplateOptions"
      :import-dialog-visible="importTemplateDialog.visible"
      :import-template-id="importTemplateDialog.templateId"
      :save-dialog-visible="saveTemplateDialog.visible"
      :save-dialog-name="saveTemplateDialog.name"
      :save-dialog-submitting="saveTemplateDialog.submitting"
      :department-options="departmentOptions"
      :span-method="productionSpanMethod"
      :get-job-type-options="getJobTypeOptions"
      :get-process-options="getProductionProcessSelectOptions"
      :get-job-type-amount-by-index="getJobTypeGroupAmountByRowIndex"
      :get-department-amount-by-index="getDepartmentGroupAmountByRowIndex"
      :format-money="formatMoney"
      @open-import-dialog="openImportTemplateDialog"
      @open-save-dialog="openSaveTemplateDialog"
      @open-picker="openProductionPickerDialog"
      @batch-remove="batchRemoveProductionRows"
      @selection-change="onProductionSelectionChange"
      @department-change="onProductionDepartmentChange"
      @job-type-change="onProductionJobTypeChange"
      @process-change="onProductionProcessChange"
      @remove-row="removeProductionRow"
      @update-production-cost-multiplier="(v) => (productionCostMultiplier = v)"
      @update-import-dialog-visible="(v) => (importTemplateDialog.visible = v)"
      @update-import-template-id="(v) => (importTemplateDialog.templateId = v)"
      @update-save-dialog-visible="(v) => (saveTemplateDialog.visible = v)"
      @update-save-dialog-name="(v) => (saveTemplateDialog.name = v)"
      @import-dialog-close="importTemplateDialog.templateId = null"
      @save-dialog-close="saveTemplateDialog.name = ''"
      @apply-import-template="applyImportTemplate"
      @save-current-template="saveCurrentProcessesAsTemplate"
      @update:production-picker-visible="(v) => (productionPickerVisible = v)"
      @picker-append="onProductionPickerAppend"
    />

    <el-card class="block-card result-card" shadow="never">
      <template #header>
        <div class="block-header">
          <span class="block-title">成本汇总与出厂价</span>
        </div>
      </template>
      <div class="result-rows">
        <div class="result-row"><span>物料小计</span><span>{{ formatMoney(materialTotal) }} 元</span></div>
        <div class="result-row"><span>工艺项目小计</span><span>{{ formatMoney(processItemTotal) }} 元</span></div>
        <div class="result-row"><span>生产工序小计</span><span>{{ formatMoney(productionProcessTotal) }} 元</span></div>
        <div class="result-row total-cost"><span>总成本</span><span>{{ formatMoney(totalCost) }} 元</span></div>
        <div class="result-row profit-row">
          <span>利润率（小数，如 0.1 表示 10%）</span>
          <el-input-number v-model="profitMargin" :min="0" :max="0.99" :step="0.01" :precision="2" size="small" class="profit-input" />
        </div>
        <div class="result-row ex-factory">
          <span>计算得出出厂价</span>
          <span class="ex-factory-value">{{ formatMoney(computedExFactoryPrice) }} 元</span>
        </div>
      </div>
      <div class="result-actions">
        <el-button @click="goBack">取消</el-button>
        <el-button :loading="savingDraft" :disabled="!canSubmitCost || confirmingQuote" @click="saveDraft">保存草稿</el-button>
        <el-button type="primary" :loading="confirmingQuote" :disabled="!canSubmitCost || savingDraft" @click="confirmQuote">
          确认报价
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { formatDisplayNumber } from '@/utils/display-number'
import { useOrderCostPage } from '@/composables/useOrderCostPage'
import OrderCostMaterialCard from '@/components/orders/cost/OrderCostMaterialCard.vue'
import OrderCostProcessItemsCard from '@/components/orders/cost/OrderCostProcessItemsCard.vue'
import OrderCostProductionCard from '@/components/orders/cost/OrderCostProductionCard.vue'

const authStore = useAuthStore()
const {
  order,
  materialRowsSorted,
  processItemRows,
  productionRowsSorted,
  productionProcesses,
  materialTypeOptions,
  supplierOptions,
  supplierLoading,
  processOptions,
  productionPickerVisible,
  productionAddedIdsSignature,
  selectedProductionRows,
  productionCostMultiplier,
  profitMargin,
  savingDraft,
  confirmingQuote,
  importTemplateDialog,
  importTemplateOptions,
  saveTemplateDialog,
  canSubmitCost,
  costNotice,
  departmentOptions,
  materialTotal,
  processItemTotal,
  productionProcessBaseTotal,
  productionProcessTotal,
  totalCost,
  computedExFactoryPrice,
  materialSpanMethod,
  productionSpanMethod,
  getJobTypeGroupAmountByRowIndex,
  getDepartmentGroupAmountByRowIndex,
  getJobTypeOptions,
  getProductionProcessSelectOptions,
  formatMoney,
  onSupplierSelectVisibleChange,
  searchSuppliers,
  onProcessOptionsVisibleChange,
  addMaterialRow,
  removeMaterialRow,
  addProcessItemRow,
  removeProcessItemRow,
  openProductionPickerDialog,
  onProductionPickerAppend,
  removeProductionRow,
  onProductionSelectionChange,
  batchRemoveProductionRows,
  onProductionProcessChange,
  onProductionDepartmentChange,
  onProductionJobTypeChange,
  onAnyFieldInput,
  onAnyFieldChange,
  saveDraft,
  confirmQuote,
  goBack,
  openImportTemplateDialog,
  openSaveTemplateDialog,
  saveCurrentProcessesAsTemplate,
  applyImportTemplate,
} = useOrderCostPage(authStore)
</script>

<style src="./cost.css"></style>
