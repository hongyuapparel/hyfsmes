<template>
  <div class="page-card order-cost-page">
    <div class="page-header">
      <div class="left">
        <el-button link type="primary" :disabled="savingDraft || confirmingQuote" @click="goBack">返回列表</el-button>
        <span class="title">订单成本</span>
        <span v-if="order" class="sub-title">{{ order.orderNo }} · {{ order.skuCode }}</span>
        <el-tag v-if="!initialLoading && !initialLoadFailed" :type="hasLocalDraftChanges ? 'warning' : 'info'">{{ hasLocalDraftChanges ? '有未保存修改' : '无未保存修改' }}</el-tag>
      </div>
    </div>

    <el-card v-if="initialLoading" class="block-card" shadow="never">
      <el-skeleton :rows="10" animated />
    </el-card>

    <el-result
      v-else-if="initialLoadFailed"
      icon="error"
      title="订单成本加载失败"
      sub-title="请检查网络后重新进入页面，当前页面已禁止保存，避免覆盖原有成本数据。"
    >
      <template #extra><el-button type="primary" @click="retryLoad">重新加载</el-button></template>
    </el-result>

    <template v-else>
    <OrderCostSummary :order="order" :notice="costNotice" />
    <el-alert v-if="optionsLoading || optionsLoadFailed" :title="optionsLoading ? '成本已显示，正在准备工序和物料选项…' : '工序或物料选项加载失败，请重试后编辑和提交。'" :type="optionsLoadFailed ? 'warning' : 'info'" :closable="false" show-icon>
      <el-button v-if="optionsLoadFailed" link type="primary" @click="retryOptions">重试选项</el-button>
    </el-alert>
    <el-alert v-if="structureDifferences.length" :title="`${structureDifferences.join('、')}与当前订单内容不同，请核对是否为成本页单独调整。`" type="warning" :closable="false" show-icon>
      <el-button link type="primary" :disabled="editingDisabled" @click="syncOrderStructure">按订单同步</el-button>
    </el-alert>
    <fieldset class="cost-edit-fields" :disabled="editingDisabled" :inert="editingDisabled">

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
      :import-order-dialog-visible="importOrderDialog.visible"
      :import-order-keyword="importOrderDialog.keyword"
      :import-order-loading="importOrderDialog.loading"
      :import-order-applying="importOrderDialog.applying"
      :import-order-results="importOrderDialog.results"
      :import-order-selected-id="importOrderDialog.selectedId"
      :save-dialog-visible="saveTemplateDialog.visible"
      :save-dialog-name="saveTemplateDialog.name"
      :save-dialog-submitting="saveTemplateDialog.submitting"
      :department-options="departmentOptions"
      :span-method="productionSpanMethod"
      :get-job-type-options="getJobTypeOptions"
      :get-process-options="getProductionProcessSelectOptions"
      :get-job-type-amount-by-index="getJobTypeGroupAmountByRowIndex"
      :get-department-amount-by-index="getDepartmentGroupAmountByRowIndex"
      :get-import-order-status-label="getImportOrderStatusLabel"
      :get-import-order-status-tag-type="getImportOrderStatusTagType"
      :format-money="formatMoney"
      @open-import-dialog="openImportTemplateDialog"
      @open-import-order-dialog="openImportOrderDialog"
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
      @update-import-order-dialog-visible="(v) => (importOrderDialog.visible = v)"
      @update-import-order-keyword="(v) => (importOrderDialog.keyword = v)"
      @update-import-order-selected-id="(v) => (importOrderDialog.selectedId = v)"
      @update-save-dialog-visible="(v) => (saveTemplateDialog.visible = v)"
      @update-save-dialog-name="(v) => (saveTemplateDialog.name = v)"
      @import-dialog-close="importTemplateDialog.templateId = null"
      @import-order-dialog-close="closeImportOrderDialog"
      @search-import-orders="searchImportOrders"
      @save-dialog-close="saveTemplateDialog.name = ''"
      @apply-import-template="applyImportTemplate"
      @apply-import-order="applyImportOrder"
      @save-current-template="saveCurrentProcessesAsTemplate"
      @update:production-picker-visible="(v) => (productionPickerVisible = v)"
      @picker-append="onProductionPickerAppend"
    />

    </fieldset>
    <OrderCostResult
      v-model:margin="profitMargin" :material-total="materialTotal" :process-total="processItemTotal"
      :production-total="productionProcessTotal" :total="totalCost" :price="computedExFactoryPrice"
      :sale-price="order?.salePrice" :issues="costIssues" :disabled="editingDisabled || !canSubmitCost"
      :saving="savingDraft" :confirming="confirmingQuote" :is-quote-queue="isQuoteQueue"
      @back="goBack" @save="saveDraft" @confirm="confirmQuote"
    />
    </template>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'
import { computed } from 'vue'
import { useOrderCostPage } from '@/composables/useOrderCostPage'
import OrderCostMaterialCard from '@/components/orders/cost/OrderCostMaterialCard.vue'
import OrderCostProcessItemsCard from '@/components/orders/cost/OrderCostProcessItemsCard.vue'
import OrderCostProductionCard from '@/components/orders/cost/OrderCostProductionCard.vue'
import OrderCostSummary from '@/components/orders/cost/OrderCostSummary.vue'
import OrderCostResult from '@/components/orders/cost/OrderCostResult.vue'

const authStore = useAuthStore()
const {
  initialLoading,
  initialLoadFailed,
  optionsLoading, optionsLoadFailed, retryOptions, retryLoad,
  hasLocalDraftChanges, costIssues, structureDifferences, syncOrderStructure,
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
  importOrderDialog,
  saveTemplateDialog,
  canSubmitCost,
  isQuoteQueue,
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
  getImportOrderStatusLabel,
  getImportOrderStatusTagType,
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
  saveDraft,
  confirmQuote,
  goBack,
  openImportTemplateDialog,
  openImportOrderDialog,
  closeImportOrderDialog,
  searchImportOrders,
  openSaveTemplateDialog,
  saveCurrentProcessesAsTemplate,
  applyImportTemplate,
  applyImportOrder,
} = useOrderCostPage(authStore)
const editingDisabled = computed(() => initialLoading.value || initialLoadFailed.value || optionsLoading.value || optionsLoadFailed.value || savingDraft.value || confirmingQuote.value)
</script>

<style src="./cost.css"></style>
