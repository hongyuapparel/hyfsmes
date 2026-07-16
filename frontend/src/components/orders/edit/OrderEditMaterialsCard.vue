<template>
  <el-card class="block-card">
    <template #header>
      <div class="block-header">
        <span class="block-title">C 物料信息</span>
        <el-button link type="primary" @click="addMaterialRow">新增物料</el-button>
      </div>
    </template>
    <el-table
      :ref="setMaterialsTableRef"
      :data="materials"
      row-key="__rowKey"
      border
      size="small"
      class="materials-table editable-grid"
    >
      <el-table-column width="32" align="center" header-align="center">
        <template #default>
          <span class="material-row-drag-handle" title="拖拽排序">≡</span>
        </template>
      </el-table-column>
      <el-table-column label="物料图" width="80" header-align="center" align="center">
        <template #default="{ row }">
          <ImageUploadArea v-model="row.referenceImageUrl" dense />
        </template>
      </el-table-column>
      <el-table-column label="物料来源" min-width="90" header-align="center" align="center">
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
      <el-table-column label="物料类型" min-width="90" header-align="center" align="center">
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
          <el-select
            v-model="row.materialName"
            placeholder="选择库存或输入物料名称"
            filterable
            allow-create
            default-first-option
            clearable
            remote
            :remote-method="(kw: string) => searchMaterialNames(kw, row)"
            :loading="materialNameLoading"
            @visible-change="(visible: boolean) => onMaterialNameVisibleChange(visible, row)"
            :ref="(el) => setMaterialCellRef(el, $index, 3)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 3)"
          >
            <el-option v-for="opt in materialNameOptions" :key="opt.id" :label="opt.name" :value="opt.name" />
          </el-select>
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
      <el-table-column label="幅宽(cm)" min-width="90" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-input
            v-model="row.fabricWidth"
            placeholder="如 183"
            :input-style="{ textAlign: 'center' }"
            :ref="(el) => setMaterialCellRef(el, $index, 5)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 5)"
          />
        </template>
      </el-table-column>
      <el-table-column label="成分" min-width="120" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-input
            v-model="row.composition"
            placeholder="如 100%棉"
            :input-style="{ textAlign: 'center' }"
            :ref="(el) => setMaterialCellRef(el, $index, 6)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 6)"
          />
        </template>
      </el-table-column>
      <el-table-column label="克重" min-width="90" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-input
            v-model="row.weight"
            placeholder="如 180g/m²"
            :input-style="{ textAlign: 'center' }"
            :ref="(el) => setMaterialCellRef(el, $index, 7)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 7)"
          />
        </template>
      </el-table-column>
      <el-table-column label="单件用量" width="100" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-input-number
            v-model="row.usagePerPiece"
            :min="0"
            :formatter="formatMaterialUsageQtyDisplay"
            :parser="parseMaterialUsageQtyInput"
            :controls="false"
            :input-style="{ textAlign: 'center' }"
            @update:modelValue="recalcPurchaseQuantity(row)"
            :ref="(el) => setMaterialCellRef(el, $index, 8)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 8)"
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
            :ref="(el) => setMaterialCellRef(el, $index, 9)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 9)"
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
            :ref="(el) => setMaterialCellRef(el, $index, 10)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 10)"
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
            :ref="(el) => setMaterialCellRef(el, $index, 11)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 11)"
          />
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="120" header-align="center" align="center">
        <template #default="{ row, $index }">
          <el-input
            v-model="row.remark"
            placeholder="其他说明"
            :input-style="{ textAlign: 'center' }"
            :ref="(el) => setMaterialCellRef(el, $index, 12)"
            @keydown.capture.stop="onMaterialCellKeydown($event, $index, 12)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="56" fixed="right" header-align="center" align="center">
        <template #default="{ $index }">
          <el-tooltip content="删除" placement="top">
            <el-button
              link
              type="danger"
              size="small"
              circle
              :aria-label="`Delete material row ${$index + 1}`"
              @click="removeMaterialRow($index)"
            >
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
import type { MaterialRow } from '@/composables/useOrderMaterials'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import {
  formatMaterialUsageQtyDisplay,
  parseMaterialUsageQtyInput,
} from '@/utils/material-usage-qty'

defineProps<{
  materials: MaterialRow[]
  setMaterialsTableRef: (el: unknown) => void
  materialSourceOptions: Array<{ id: number; label: string }>
  materialTypeOptions: Array<{ id: number; label: string }>
  supplierOptions: Array<{ id: number; name: string }>
  supplierLoading: boolean
  setMaterialCellRef: (el: unknown, rowIndex: number, colIndex: number) => void
  onMaterialCellKeydown: (event: KeyboardEvent, rowIndex: number, colIndex: number) => void
  addMaterialRow: () => void
  removeMaterialRow: (index: number) => void
  recalcPurchaseQuantity: (row: MaterialRow) => void
  onSupplierChange: (row: MaterialRow) => void
  onMaterialTypeChange: (row: MaterialRow) => void
  onMaterialSupplierVisibleChange: (visible: boolean, row: MaterialRow) => void
  searchMaterialSuppliers: (keyword: string, row: MaterialRow) => void
  materialNameOptions: Array<{ id: number; name: string; imageUrl: string }>
  materialNameLoading: boolean
  searchMaterialNames: (keyword: string, row: MaterialRow) => void
  onMaterialNameVisibleChange: (visible: boolean, row: MaterialRow) => void
}>()
</script>

<style scoped src="./order-edit-card.css"></style>
<style scoped src="./order-edit-materials.css"></style>
