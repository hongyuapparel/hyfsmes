<template>
  <el-card class="block-card table-card" shadow="never">
    <template #header>
      <div class="block-header">
        <span class="block-title">生产工序成本</span>
        <div class="block-header-actions">
          <el-button link type="primary" size="small" @click="$emit('openImportDialog')">导入模板</el-button>
          <el-button link type="primary" size="small" @click="$emit('openImportOrderDialog')">导入订单</el-button>
          <el-button link type="primary" size="small" @click="$emit('openSaveDialog')">保存为模板</el-button>
          <el-button link type="primary" size="small" @click="$emit('openPicker')">新增</el-button>
          <el-button
            link
            type="danger"
            size="small"
            :disabled="!selectedRows.length"
            @click="$emit('batchRemove')"
          >
            批量删除
          </el-button>
        </div>
      </div>
    </template>
    <el-table
      :data="rows"
      border
      size="small"
      class="cost-table production-cost-table editable-grid"
      :span-method="spanMethod"
      @selection-change="(rows) => $emit('selectionChange', rows)"
    >
      <el-table-column type="selection" width="44" align="center" />
      <el-table-column label="部门" min-width="100" align="center" header-align="center">
        <template #default="{ row }">
          <el-select
            v-model="row.department"
            placeholder="选择部门"
            filterable
            allow-create
            default-first-option
            size="small"
            @change="() => $emit('departmentChange', row)"
          >
            <el-option
              v-for="d in departmentOptions"
              :key="d"
              :label="d"
              :value="d"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="工种" min-width="100" align="center" header-align="center">
        <template #default="{ row }">
          <el-select
            v-model="row.jobType"
            placeholder="选择工种"
            filterable
            allow-create
            default-first-option
            size="small"
            @change="() => $emit('jobTypeChange', row)"
          >
            <el-option
              v-for="j in getJobTypeOptions(row)"
              :key="j"
              :label="getJobTypeLabel(j)"
              :value="j"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="工序" min-width="140" align="center" header-align="center">
        <template #default="{ row }">
          <el-select-v2
            v-model="row.processId"
            :options="getProcessOptions(row)"
            placeholder="选择工序"
            filterable
            clearable
            size="small"
            class="production-process-select"
            @change="() => $emit('processChange', row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="单价(元)" width="90" align="center" header-align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="row.unitPrice"
            :min="0"
            :precision="2"
            :controls="false"
            size="small"
            class="price-input"
          />
        </template>
      </el-table-column>
      <el-table-column label="数量" width="80" align="center" header-align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="row.quantity"
            :min="0"
            :controls="false"
            size="small"
          />
        </template>
      </el-table-column>
      <el-table-column label="工种价格(元)" width="100" class-name="col-num-right" label-class-name="col-num-right">
        <template #default="{ $index }">
          {{ formatMoneyAligned(getJobTypeAmountByIndex($index)) }}
        </template>
      </el-table-column>
      <el-table-column label="小计(元)" width="90" class-name="col-num-right" label-class-name="col-num-right">
        <template #default="{ $index }">
          {{ formatMoneyAligned(getDepartmentAmountByIndex($index)) }}
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="120" align="center" header-align="center">
        <template #default="{ row }">
          <el-input v-model="row.remark" size="small" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="56" align="center">
        <template #default="{ row }">
          <el-button link type="danger" size="small" @click="$emit('removeRow', row)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <p v-if="!productionProcesses.length" class="empty-hint">
      暂无配置工序，请在系统设置中维护生产工序部门/工种/工序及单价。
    </p>
    <div class="subtotal production-subtotal">
      <span class="production-selected-count">已选 {{ selectedRows.length }} 条</span>
      <span class="production-multiplier-wrap">
        工序倍率
        <el-input-number
          v-model="productionCostMultiplierModel"
          :min="0"
          :step="0.1"
          :controls="false"
          size="small"
          class="production-multiplier-input"
        />
        ×
      </span>
      <span>
        生产工序小计：<strong>{{ formatMoney(baseTotal) }}</strong> × {{ formatDisplayNumber(productionCostMultiplier) }}
        = <strong>{{ formatMoney(total) }}</strong> 元
      </span>
    </div>

    <OrderCostImportTemplateDialog
      :import-template-options="importTemplateOptions"
      :import-dialog-visible="importDialogVisible"
      :import-template-id="importTemplateId"
      @update-import-dialog-visible="(value) => emit('updateImportDialogVisible', value)"
      @update-import-template-id="(value) => emit('updateImportTemplateId', value)"
      @apply-import-template="emit('applyImportTemplate')"
      @import-dialog-close="emit('importDialogClose')"
    />

    <OrderCostImportOrderDialog
      :import-order-dialog-visible="importOrderDialogVisible"
      :import-order-keyword="importOrderKeyword"
      :import-order-loading="importOrderLoading"
      :import-order-applying="importOrderApplying"
      :import-order-results="importOrderResults"
      :import-order-selected-id="importOrderSelectedId"
      :get-import-order-status-label="getImportOrderStatusLabel"
      :get-import-order-status-tag-type="getImportOrderStatusTagType"
      @update-import-order-dialog-visible="(value) => emit('updateImportOrderDialogVisible', value)"
      @update-import-order-keyword="(value) => emit('updateImportOrderKeyword', value)"
      @update-import-order-selected-id="(value) => emit('updateImportOrderSelectedId', value)"
      @search-import-orders="emit('searchImportOrders')"
      @apply-import-order="emit('applyImportOrder')"
      @import-order-dialog-close="emit('importOrderDialogClose')"
    />

    <OrderCostSaveTemplateDialog
      :save-dialog-visible="saveDialogVisible"
      :save-dialog-name="saveDialogName"
      :save-dialog-submitting="saveDialogSubmitting"
      @update-save-dialog-visible="(value) => emit('updateSaveDialogVisible', value)"
      @update-save-dialog-name="(value) => emit('updateSaveDialogName', value)"
      @save-current-template="emit('saveCurrentTemplate')"
      @save-dialog-close="emit('saveDialogClose')"
    />

    <ProductionProcessPickerDialog
      :model-value="productionPickerVisible"
      :production-processes="productionProcesses"
      :added-ids-signature="productionAddedIdsSignature"
      @update:model-value="$emit('update:productionPickerVisible', $event)"
      @append="(items) => $emit('pickerAppend', items)"
    />
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Delete } from '@element-plus/icons-vue'
import { formatDisplayNumber, formatMoneyAligned } from '@/utils/display-number'
import { getJobTypeLabel, type ProductionRow } from '@/utils/order-cost'
import type { OrderListItem } from '@/api/orders'
import type { ProductionProcessItem } from '@/api/production-processes'
import OrderCostImportTemplateDialog from './OrderCostImportTemplateDialog.vue'
import OrderCostImportOrderDialog from './OrderCostImportOrderDialog.vue'
import OrderCostSaveTemplateDialog from './OrderCostSaveTemplateDialog.vue'
import ProductionProcessPickerDialog from '@/views/orders/components/ProductionProcessPickerDialog.vue'

const props = defineProps<{
  rows: ProductionRow[]
  productionProcesses: ProductionProcessItem[]
  selectedRows: ProductionRow[]
  productionCostMultiplier: number
  baseTotal: number
  total: number
  productionPickerVisible: boolean
  productionAddedIdsSignature: string
  importTemplateOptions: Array<{ id: number; name: string }>
  importDialogVisible: boolean
  importTemplateId: number | null
  importOrderDialogVisible: boolean
  importOrderKeyword: string
  importOrderLoading: boolean
  importOrderApplying: boolean
  importOrderResults: OrderListItem[]
  importOrderSelectedId: number | null
  saveDialogVisible: boolean
  saveDialogName: string
  saveDialogSubmitting: boolean
  departmentOptions: string[]
  spanMethod: (params: { row: ProductionRow; columnIndex: number; rowIndex: number }) => { rowspan: number; colspan: number }
  getJobTypeOptions: (row: ProductionRow) => string[]
  getProcessOptions: (row: ProductionRow) => Array<{ value: number; label: string }>
  getJobTypeAmountByIndex: (index: number) => number
  getDepartmentAmountByIndex: (index: number) => number
  getImportOrderStatusLabel: (status: string) => string
  getImportOrderStatusTagType: (status: string) => 'success' | 'warning' | 'info' | 'danger' | 'primary' | undefined
  formatMoney: (value: number) => string
}>()

const emit = defineEmits<{
  openImportDialog: []
  openImportOrderDialog: []
  openSaveDialog: []
  openPicker: []
  batchRemove: []
  selectionChange: [rows: ProductionRow[]]
  departmentChange: [row: ProductionRow]
  jobTypeChange: [row: ProductionRow]
  processChange: [row: ProductionRow]
  removeRow: [row: ProductionRow]
  updateProductionCostMultiplier: [value: number]
  updateImportDialogVisible: [value: boolean]
  updateImportTemplateId: [value: number | null]
  updateImportOrderDialogVisible: [value: boolean]
  updateImportOrderKeyword: [value: string]
  updateImportOrderSelectedId: [value: number | null]
  updateSaveDialogVisible: [value: boolean]
  updateSaveDialogName: [value: string]
  applyImportTemplate: []
  searchImportOrders: []
  applyImportOrder: []
  saveCurrentTemplate: []
  saveDialogClose: []
  importDialogClose: []
  importOrderDialogClose: []
  'update:productionPickerVisible': [value: boolean]
  pickerAppend: [items: ProductionProcessItem[]]
}>()

const productionCostMultiplierModel = computed({
  get: () => props.productionCostMultiplier,
  set: (value: number) => emit('updateProductionCostMultiplier', value),
})

</script>
