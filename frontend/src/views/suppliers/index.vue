<template>
  <div class="page-card page-card--fill suppliers-page">
    <div class="filter-bar">
      <el-input
        v-model="filter.name"
        placeholder="供应商名称"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getTextFilterStyle('供应商名称：', filter.name, nameLabelVisible)"
        :input-style="getFilterInputStyle(filter.name)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span v-if="filter.name && nameLabelVisible" :style="{ color: ACTIVE_FILTER_COLOR }">供应商名称：</span>
        </template>
      </el-input>
      <el-select
        v-model="filter.supplierTypeId"
        placeholder="供应商类型"
        clearable
        filterable
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.supplierTypeId != null
              ? `供应商类型：${findSupplierTypeLabelById(filter.supplierTypeId)}`
              : '供应商类型',
            filter.supplierTypeId != null
          )
        "
        @change="onSearch"
      >
        <template #label="{ label }">
          <span v-if="filter.supplierTypeId != null">供应商类型：{{ label }}</span>
          <span v-else>{{ label }}</span>
        </template>
        <el-option v-for="option in supplierTypeOptions" :key="option.id" :label="option.label" :value="option.id" />
      </el-select>
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button v-if="selectedIds.length" type="danger" size="large" circle @click="onBatchDelete">
          <el-icon><Delete /></el-icon>
        </el-button>
        <el-button type="primary" size="large" @click="openForm(null)">新建供应商</el-button>
      </div>
    </div>

    <div v-if="selectedIds.length" class="table-selection-count">已选 {{ selectedIds.length }} 项</div>

    <div ref="tableShellRef" class="list-page-table-shell">
      <el-table
        v-loading="loading"
        :data="list"
        border
        stripe
        row-key="id"
        class="suppliers-table"
        :height="tableHeight"
        scrollbar-always-on
        @selection-change="onSelectionChange"
      >
        <el-table-column type="selection" width="48" align="center" />
        <el-table-column label="供应商名称" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetailDrawer(row)">
              {{ row.name }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="供应商类型" width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ findSupplierTypeLabelById(row.supplierTypeId) || '-' }}</template>
        </el-table-column>
        <el-table-column label="业务范围" min-width="100" show-overflow-tooltip>
          <template #default="{ row }">{{ formatBusinessScopes(row.businessScopeIds, row.businessScopeId) }}</template>
        </el-table-column>
        <el-table-column label="最近活跃时间" width="160" align="center">
          <template #default="{ row }">{{ formatDateTime(row.lastActiveAt) }}</template>
        </el-table-column>
        <el-table-column prop="contactPerson" label="联系人" width="90" show-overflow-tooltip />
        <el-table-column prop="contactInfo" label="联系电话" width="120" show-overflow-tooltip />
        <el-table-column prop="factoryAddress" label="工厂地址" min-width="140" show-overflow-tooltip />
        <el-table-column prop="settlementTime" label="结款时间" width="100" show-overflow-tooltip />
        <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
        <el-table-column label="操作" width="80" align="center" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openForm(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
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

    <SupplierFormDialog
      :visible="formDialog.visible"
      :is-edit="formDialog.isEdit"
      :submitting="formDialog.submitting"
      :form-ref="formRef"
      :form="form"
      :form-rules="formRules"
      :supplier-type-options="supplierTypeOptions"
      :business-scope-options="businessScopeOptions"
      @update:visible="(value) => (formDialog.visible = value)"
      @form-type-change="onFormTypeChange"
      @close="resetForm"
      @submit="submitForm"
    />

    <SupplierDetailDrawer
      :visible="detailDrawer.visible"
      :width="detailDrawerWidth"
      :loading="detailDrawer.loading"
      :data="detailDrawer.data"
      :recent-records="detailDrawer.recentRecords"
      :find-supplier-type-label-by-id="findSupplierTypeLabelById"
      :get-scope-labels="getScopeLabels"
      @update:visible="(value) => (detailDrawer.visible = value)"
      @start-resize="startResizeDetailDrawer"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import SupplierDetailDrawer from '@/components/suppliers/SupplierDetailDrawer.vue'
import SupplierFormDialog from '@/components/suppliers/SupplierFormDialog.vue'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getTextFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useSupplierDetailDrawer } from '@/composables/useSupplierDetailDrawer'
import { useSupplierForm } from '@/composables/useSupplierForm'
import { useSupplierOptions } from '@/composables/useSupplierOptions'
import { useSuppliersList } from '@/composables/useSuppliersList'
import { formatDateTime } from '@/utils/date-format'

const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }

function getFilterSelectAutoWidthStyle(labelText: string, active = false) {
  if (!labelText) return undefined
  const estimated = labelText.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return active
    ? { ...activeSelectStyle, width: `${width}px`, flex: `0 0 ${width}px` }
    : { width: `${width}px`, flex: `0 0 ${width}px` }
}

const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)

const { filter, nameLabelVisible, list, selectedIds, loading, pagination, load, onSearch, debouncedSearch, onReset, onPageSizeChange, onSelectionChange, onBatchDelete } = useSuppliersList()

const {
  supplierTypeOptions,
  findSupplierTypeLabelById,
  getScopeLabels,
  formatBusinessScopes,
  getBusinessScopeTreeByTypeId,
  loadSupplierOptions,
} = useSupplierOptions()

const { formDialog, formRef, form, formRules, businessScopeOptions, resetForm, onFormTypeChange, openForm, submitForm } =
  useSupplierForm({
    getBusinessScopeTreeByTypeId,
    onSubmitSuccess: load,
  })

const { detailDrawer, detailDrawerWidth, startResizeDetailDrawer, openDetailDrawer } = useSupplierDetailDrawer()

onMounted(async () => {
  await loadSupplierOptions()
  await load()
})
</script>

<style scoped>
.suppliers-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.suppliers-table {
  flex: 1;
  min-height: 0;
}

.table-selection-count {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 8px 0;
}
</style>
