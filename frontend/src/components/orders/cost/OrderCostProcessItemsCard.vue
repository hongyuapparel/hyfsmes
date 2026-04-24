<template>
  <el-card class="block-card table-card" shadow="never">
    <template #header>
      <div class="block-header">
        <span class="block-title">工艺项目成本</span>
        <el-button link type="primary" size="small" @click="$emit('add')">新增</el-button>
      </div>
    </template>
    <el-table :data="rows" border size="small" class="cost-table">
      <el-table-column label="工艺项目" min-width="120">
        <template #default="{ row }">
          <el-tree-select
            v-model="row.processName"
            placeholder="选择工艺项目"
            filterable
            clearable
            check-strictly
            :data="processOptions"
            :props="{ label: 'label', value: 'value', children: 'children' }"
            @visible-change="onProcessVisibleChange"
            size="small"
            style="width: 100%"
          />
        </template>
      </el-table-column>
      <el-table-column label="供应商" min-width="100">
        <template #default="{ row }">
          <el-select
            v-model="row.supplierName"
            placeholder="选择供应商"
            filterable
            clearable
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
      <el-table-column label="部位" min-width="120">
        <template #default="{ row }">
          <el-input v-model="row.part" placeholder="如：前幅 / 后幅 / 袖子" size="small" />
        </template>
      </el-table-column>
      <el-table-column label="工艺说明 / 备注" min-width="160">
        <template #default="{ row }">
          <el-input v-model="row.remark" placeholder="说明 / 备注" size="small" />
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
      <el-table-column label="数量" width="80" align="right">
        <template #default="{ row }">
          <el-input-number
            v-model="row.quantity"
            :min="0"
            :controls="false"
            size="small"
          />
        </template>
      </el-table-column>
      <el-table-column label="金额(元)" width="90" align="right">
        <template #default="{ row }">
          {{ formatMoney(processItemAmount(row)) }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="56" align="center">
        <template #default="{ $index }">
          <el-button link type="danger" size="small" @click="$emit('remove', $index)">
            <el-icon><Delete /></el-icon>
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="subtotal">工艺项目小计：<strong>{{ formatMoney(total) }}</strong> 元</div>
  </el-card>
</template>

<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'
import { processItemAmount, type ProcessItemRow } from '@/utils/order-cost'

interface ProcessOptionNode {
  label: string
  value: string
  children?: ProcessOptionNode[]
}

defineProps<{
  rows: ProcessItemRow[]
  total: number
  processOptions: ProcessOptionNode[]
  supplierOptions: Array<{ id: number; name: string }>
  supplierLoading: boolean
  formatMoney: (value: number) => string
  remoteSupplierSearch: (keyword: string) => void
  onSupplierVisibleChange: (visible: boolean) => void
  onProcessVisibleChange: (visible: boolean) => void
}>()

defineEmits<{
  add: []
  remove: [index: number]
}>()
</script>
