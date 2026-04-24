<template>
  <el-card class="block-card table-card" shadow="never">
    <template #header>
      <div class="block-header">
        <span class="block-title">物料成本</span>
        <el-button link type="primary" size="small" @click="$emit('add')">新增</el-button>
      </div>
    </template>
    <el-table
      :data="rows"
      border
      size="small"
      class="cost-table"
      :span-method="spanMethod"
      :row-class-name="rowClassName"
    >
      <el-table-column label="物料类型" min-width="90">
        <template #default="{ row }">
          <el-select
            v-model="row.materialTypeId"
            placeholder="选择物料类型"
            filterable
            clearable
            size="small"
          >
            <el-option
              v-for="opt in materialTypeOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="供应商" min-width="100">
        <template #default="{ row }">
          <el-select
            v-model="row.supplierName"
            placeholder="选择或输入供应商"
            filterable
            allow-create
            default-first-option
            :remote-method="remoteSupplierSearch"
            remote
            :loading="supplierLoading"
            @visible-change="onSupplierVisibleChange"
            size="small"
          >
            <el-option
              v-for="s in supplierOptions"
              :key="s.id"
              :label="s.name"
              :value="s.name"
            />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="物料名称" min-width="140">
        <template #default="{ row }">
          <el-input v-model="row.materialName" size="small" />
        </template>
      </el-table-column>
      <el-table-column label="颜色" min-width="100">
        <template #default="{ row }">
          <el-input v-model="row.color" size="small" />
        </template>
      </el-table-column>
      <el-table-column label="幅宽(cm)" width="100" align="right">
        <template #default="{ row }">
          <el-input v-model="row.fabricWidth" size="small" placeholder="如 183cm" />
        </template>
      </el-table-column>
      <el-table-column label="单件用量" width="82" align="right">
        <template #default="{ row }">
          <el-input-number v-model="row.usagePerPiece" :min="0" :controls="false" size="small" />
        </template>
      </el-table-column>
      <el-table-column label="损耗%" width="72" align="right">
        <template #default="{ row }">
          <el-input-number v-model="row.lossPercent" :min="0" :controls="false" size="small" />
        </template>
      </el-table-column>
      <el-table-column label="单价(元)" width="90" align="right">
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
      <el-table-column label="金额(元)" width="90" align="right">
        <template #default="{ row }">
          {{ formatMoney(materialAmount(row)) }}
        </template>
      </el-table-column>
      <el-table-column label="计入成本" width="86" align="center">
        <template #default="{ row }">
          <el-switch
            v-model="row.includeInCost"
            :active-value="true"
            :inactive-value="false"
            size="small"
          />
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="120">
        <template #default="{ row }">
          <el-input v-model="row.remark" size="small" />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="56" align="center">
        <template #default="{ row }">
          <el-button link type="danger" size="small" @click="$emit('remove', row)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="subtotal">物料小计：<strong>{{ formatMoney(total) }}</strong> 元</div>
  </el-card>
</template>

<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'
import { materialAmount, isMaterialIncluded, type MaterialRow } from '@/utils/order-cost'

defineProps<{
  rows: MaterialRow[]
  total: number
  materialTypeOptions: Array<{ id: number; label: string }>
  supplierOptions: Array<{ id: number; name: string }>
  supplierLoading: boolean
  spanMethod: (params: { row: MaterialRow; columnIndex: number; rowIndex: number }) => { rowspan: number; colspan: number }
  formatMoney: (value: number) => string
  remoteSupplierSearch: (keyword: string) => void
  onSupplierVisibleChange: (visible: boolean) => void
}>()

defineEmits<{
  add: []
  remove: [row: MaterialRow]
}>()

function rowClassName({ row }: { row: MaterialRow }) {
  return isMaterialIncluded(row) ? '' : 'material-row-excluded'
}
</script>
