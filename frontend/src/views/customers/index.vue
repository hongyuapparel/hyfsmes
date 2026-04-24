<template>
  <div class="page-card page-card--fill">
    <CustomerToolbar
      :company-name="filter.companyName"
      :salesperson="filter.salesperson"
      :salespeople="salespeople"
      :selected-count="selectedIds.length"
      :company-name-label-visible="companyNameLabelVisible"
      @update:company-name="filter.companyName = $event"
      @update:salesperson="filter.salesperson = $event"
      @company-name-input="debouncedSearch"
      @search="onFilterChange"
      @reset="resetFilter"
      @create="openCreate"
      @batch-delete="batchDelete"
      @open-xiaoman="openXiaomanImport"
    />

    <CustomerListTable
      :list="list"
      :fields="CUSTOMER_TABLE_FIELDS"
      :selected-count="selectedIds.length"
      @selection-change="onSelectionChange"
      @sort-change="onSortChange"
      @edit="openEdit"
    />

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

    <CustomerFormDialog
      v-model:visible="dialogVisible"
      :is-edit="isEdit"
      :fields="CUSTOMER_FORM_FIELDS"
      :form="form"
      :form-rules="formRules"
      :submit-loading="submitLoading"
      :salespeople="salespeople"
      :product-group-tree-select-data="productGroupTreeSelectData"
      @submit="submit"
    />

    <CustomerXiaomanImportDialog
      :visible="xiaomanDialogVisible"
      :loading="xiaomanLoading"
      :importing="xiaomanImporting"
      :keyword="xiaomanKeyword"
      :list="xiaomanList"
      :result="xiaomanResult"
      :selected-count="xiaomanSelectedIds.length"
      :pagination-page="xiaomanPagination.page"
      :pagination-page-size="xiaomanPagination.pageSize"
      :pagination-total="xiaomanPagination.total"
      @update:visible="xiaomanDialogVisible = $event"
      @update:keyword="xiaomanKeyword = $event"
      @update:pagination-page="xiaomanPagination.page = $event"
      @update:pagination-page-size="xiaomanPagination.pageSize = $event"
      @open="loadXiaomanList"
      @close="resetXiaomanDialog"
      @search="onXiaomanSearch"
      @clear="onXiaomanClear"
      @selection-change="onXiaomanSelectionChange"
      @page-change="loadXiaomanList"
      @size-change="loadXiaomanList"
      @import="doXiaomanImport"
      @close-refresh="closeXiaomanAndRefresh"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import CustomerToolbar from '@/components/customers/CustomerToolbar.vue'
import CustomerListTable from '@/components/customers/CustomerListTable.vue'
import CustomerFormDialog from '@/components/customers/CustomerFormDialog.vue'
import CustomerXiaomanImportDialog from '@/components/customers/CustomerXiaomanImportDialog.vue'
import { useCustomerPage } from '@/composables/useCustomerPage'
import { useCustomerXiaomanImport } from '@/composables/useCustomerXiaomanImport'

const {
  list,
  salespeople,
  dialogVisible,
  isEdit,
  submitLoading,
  selectedIds,
  companyNameLabelVisible,
  filter,
  pagination,
  CUSTOMER_TABLE_FIELDS,
  CUSTOMER_FORM_FIELDS,
  productGroupTreeSelectData,
  form,
  formRules,
  load,
  loadOptions,
  debouncedSearch,
  onFilterChange,
  resetFilter,
  onSelectionChange,
  onSortChange,
  openCreate,
  openEdit,
  submit,
  batchDelete,
} = useCustomerPage()

const {
  xiaomanDialogVisible,
  xiaomanKeyword,
  xiaomanList,
  xiaomanLoading,
  xiaomanImporting,
  xiaomanSelectedIds,
  xiaomanResult,
  xiaomanPagination,
  openXiaomanImport,
  loadXiaomanList,
  onXiaomanSearch,
  onXiaomanClear,
  onXiaomanSelectionChange,
  doXiaomanImport,
  resetXiaomanDialog,
  closeXiaomanAndRefresh,
} = useCustomerXiaomanImport(load)

onMounted(() => {
  void load()
  void loadOptions()
})
</script>

<style scoped>
.page-card {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.pagination-wrap {
  margin-top: var(--space-sm);
  display: flex;
  justify-content: flex-end;
}
</style>
