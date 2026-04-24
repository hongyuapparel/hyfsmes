<template>
  <el-card class="block-card">
    <template #header>
      <div class="block-header">
        <span class="block-title">C 物料信息</span>
        <el-button link type="primary" @click="addMaterialRow">新增物料</el-button>
      </div>
    </template>
    <el-table :data="materials" border size="small" class="materials-table">
      <el-table-column label="物料来源" min-width="120" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-select
            v-model="row.materialSourceId"
            placeholder="选择物料来源"
            filterable
            clearable
            :ref="(el) => setMaterialCellRef(el, $index, 0)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 0)"
          >
            <el-option v-for="opt in materialSourceOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="物料类型" min-width="120" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-select
            v-model="row.materialTypeId"
            placeholder="选择物料类型"
            filterable
            clearable
            @change="onMaterialTypeChange(row)"
            :ref="(el) => setMaterialCellRef(el, $index, 1)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 1)"
          >
            <el-option v-for="opt in materialTypeOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="供应商" min-width="140" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-select
            v-model="row.supplierName"
            placeholder="选择或输入供应商"
            filterable
            allow-create
            default-first-option
            remote
            :remote-method="(kw: string) => searchMaterialSuppliers(kw, row)"
            :loading="supplierLoading"
            @visible-change="(visible: boolean) => onMaterialSupplierVisibleChange(visible, row)"
            @change="onSupplierChange(row)"
            :ref="(el) => setMaterialCellRef(el, $index, 2)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 2)"
          >
            <el-option v-for="s in supplierOptions" :key="s.id" :label="s.name" :value="s.name" />
          </el-select>
        </template>
      </el-table-column>
      <el-table-column label="物料名称" min-width="160" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-input
            v-model="row.materialName"
            placeholder="物料名称"
            :input-style="{ textAlign: 'center' }"
            :ref="(el) => setMaterialCellRef(el, $index, 3)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 3)"
          />
        </template>
      </el-table-column>
      <el-table-column label="颜色" min-width="120" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-input
            v-model="row.color"
            placeholder="颜色"
            :input-style="{ textAlign: 'center' }"
            :ref="(el) => setMaterialCellRef(el, $index, 4)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 4)"
          />
        </template>
      </el-table-column>
      <el-table-column label="单件用量" width="100" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-input-number
            v-model="row.usagePerPiece"
            :min="0"
            :precision="2"
            :controls="false"
            :input-style="{ textAlign: 'center' }"
            @update:modelValue="recalcPurchaseQuantity(row)"
            :ref="(el) => setMaterialCellRef(el, $index, 5)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 5)"
          />
        </template>
      </el-table-column>
      <el-table-column label="损耗%" width="90" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-input-number
            v-model="row.lossPercent"
            :min="0"
            :controls="false"
            :input-style="{ textAlign: 'center' }"
            @update:modelValue="recalcPurchaseQuantity(row)"
            :ref="(el) => setMaterialCellRef(el, $index, 6)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 6)"
          />
        </template>
      </el-table-column>
      <el-table-column label="订单件数" width="100" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-input-number
            v-model="row.orderPieces"
            :min="0"
            :controls="false"
            :input-style="{ textAlign: 'center' }"
            @update:modelValue="recalcPurchaseQuantity(row)"
            :ref="(el) => setMaterialCellRef(el, $index, 7)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 7)"
          />
        </template>
      </el-table-column>
      <el-table-column label="采购总量" width="100" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-input-number
            v-model="row.purchaseQuantity"
            :min="0"
            :precision="2"
            :controls="false"
            :input-style="{ textAlign: 'center' }"
            :readonly="true"
            :ref="(el) => setMaterialCellRef(el, $index, 8)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 8)"
          />
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="120" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-input
            v-model="row.remark"
            placeholder="面料成分 / 克重等"
            :input-style="{ textAlign: 'center' }"
            :ref="(el) => setMaterialCellRef(el, $index, 9)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 9)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="80" fixed="right" header-align="center" align="center">
        <template #default="{ $index }">
          <el-tooltip content="删除" placement="top">
            <el-button link type="danger" size="small" circle @click="removeMaterialRow($index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </el-tooltip>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>

<script setup lang="ts">
import { Delete } from '@element-plus/icons-vue'

defineProps<{
  materials: any[]
  materialSourceOptions: Array<{ id: number; label: string }>
  materialTypeOptions: Array<{ id: number; label: string }>
  supplierOptions: Array<{ id: number; name: string }>
  supplierLoading: boolean
  setMaterialCellRef: (el: unknown, rowIndex: number, colIndex: number) => void
  onMaterialCellKeydown: (event: KeyboardEvent, rowIndex: number, colIndex: number) => void
  addMaterialRow: () => void
  removeMaterialRow: (index: number) => void
  recalcPurchaseQuantity: (row: any) => void
  onSupplierChange: (row: any) => void
  onMaterialTypeChange: (row: any) => void
  onMaterialSupplierVisibleChange: (visible: boolean, row: any) => void
  searchMaterialSuppliers: (keyword: string, row: any) => void
}>()
</script>
