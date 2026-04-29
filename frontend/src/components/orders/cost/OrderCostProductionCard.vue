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
      class="cost-table production-cost-table"
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
      <el-table-column label="工种价格(元)" width="100" align="center" header-align="center">
        <template #default="{ $index }">
          {{ formatMoney(getJobTypeAmountByIndex($index)) }}
        </template>
      </el-table-column>
      <el-table-column label="小计(元)" width="90" align="center" header-align="center">
        <template #default="{ $index }">
          {{ formatMoney(getDepartmentAmountByIndex($index)) }}
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

    <el-dialog
      :model-value="importDialogVisible"
      title="导入工序模板"
      width="400px"
      @close="onImportDialogClose"
      @update:model-value="(value) => emit('updateImportDialogVisible', value)"
    >
      <p class="import-template-hint">选择服装类型模板，将其中工序一键填入下方表格，再按款式做个别增减。</p>
      <el-select
        :model-value="importTemplateId"
        placeholder="选择模板"
        filterable
        clearable
        style="width: 100%"
        @update:model-value="(value) => emit('updateImportTemplateId', value as number | null)"
      >
        <el-option
          v-for="t in importTemplateOptions"
          :key="t.id"
          :label="t.name"
          :value="t.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="emit('updateImportDialogVisible', false)">取消</el-button>
        <el-button type="primary" :disabled="!importTemplateId" @click="$emit('applyImportTemplate')">
          确定导入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      :model-value="importOrderDialogVisible"
      title="从订单导入生产工序成本"
      width="760px"
      @close="$emit('importOrderDialogClose')"
      @update:model-value="(value) => emit('updateImportOrderDialogVisible', value)"
    >
      <div class="import-order-search">
        <el-input
          :model-value="importOrderKeyword"
          placeholder="输入订单号 / SKU 搜索"
          clearable
          class="import-order-search-input"
          @update:model-value="(value) => emit('updateImportOrderKeyword', String(value ?? ''))"
          @keyup.enter="emit('searchImportOrders')"
        />
        <el-button type="primary" :loading="importOrderLoading" @click="emit('searchImportOrders')">
          搜索
        </el-button>
      </div>
      <el-table
        :data="importOrderResults"
        v-loading="importOrderLoading"
        row-key="id"
        size="small"
        class="import-order-table"
      >
        <el-table-column label="图片" width="78" align="center">
          <template #default="{ row }">
            <AppImageThumb
              v-if="row.imageUrl"
              :raw-url="row.imageUrl"
              :width="48"
              :height="48"
              empty-text="-"
              preview-disabled
            />
            <span v-else class="import-order-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="orderNo" label="订单号" min-width="130" />
        <el-table-column prop="skuCode" label="SKU" min-width="130" />
        <el-table-column label="状态" min-width="110">
          <template #default="{ row }">
            <el-tag size="small" effect="light" :type="getImportOrderStatusTagType(row.status)">
              {{ getImportOrderStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="82" align="center">
          <template #default="{ row }">
            <el-tag v-if="importOrderSelectedId === row.id" size="small" type="success">已选</el-tag>
            <el-button v-else link type="primary" size="small" @click="emit('updateImportOrderSelectedId', row.id)">
              选择
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <span>{{ importOrderKeyword.trim() ? '未找到匹配订单' : '输入订单号或 SKU 后搜索' }}</span>
        </template>
      </el-table>
      <template #footer>
        <el-button :disabled="importOrderApplying" @click="emit('updateImportOrderDialogVisible', false)">取消</el-button>
        <el-button
          type="primary"
          :loading="importOrderApplying"
          :disabled="!importOrderSelectedId"
          @click="$emit('applyImportOrder')"
        >
          确定导入
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      :model-value="saveDialogVisible"
      title="保存为工序报价模板"
      width="420px"
      @close="$emit('saveDialogClose')"
      @update:model-value="(value) => emit('updateSaveDialogVisible', value)"
    >
      <el-input
        :model-value="saveDialogName"
        placeholder="请输入模板名称（如：卫衣-基础版）"
        maxlength="40"
        show-word-limit
        @update:model-value="(value) => emit('updateSaveDialogName', String(value ?? ''))"
      />
      <template #footer>
        <el-button :disabled="saveDialogSubmitting" @click="emit('updateSaveDialogVisible', false)">取消</el-button>
        <el-button
          type="primary"
          :loading="saveDialogSubmitting"
          :disabled="!saveDialogName.trim()"
          @click="$emit('saveCurrentTemplate')"
        >
          保存
        </el-button>
      </template>
    </el-dialog>

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
import { formatDisplayNumber } from '@/utils/display-number'
import { getJobTypeLabel, type ProductionRow } from '@/utils/order-cost'
import type { OrderListItem } from '@/api/orders'
import type { ProductionProcessItem } from '@/api/production-processes'
import AppImageThumb from '@/components/AppImageThumb.vue'
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

function onImportDialogClose() {
  emit('importDialogClose')
}
</script>
