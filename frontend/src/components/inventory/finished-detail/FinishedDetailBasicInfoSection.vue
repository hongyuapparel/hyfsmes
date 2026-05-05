<template>
  <FinishedBasicInfoGrid title="基础信息与产品图" image-label="产品图">
    <template #actions>
      <el-button
        v-if="!metaEditing"
        size="small"
        text
        type="primary"
        class="detail-head-btn"
        @click="$emit('toggleEditMode')"
      >
        <el-icon><Edit /></el-icon>
        <span>编辑</span>
      </el-button>
      <template v-else>
        <el-button
          size="small"
          type="success"
          class="detail-head-btn"
          :loading="saving"
          @click="$emit('saveMeta')"
        >
          保存
        </el-button>
        <el-button size="small" class="detail-head-btn" @click="$emit('toggleEditMode')">
          取消
        </el-button>
      </template>
    </template>

    <div class="detail-basic-label">SKU</div>
    <div class="detail-basic-value">
      <el-input
        v-if="metaEditing"
        :model-value="editForm.skuCode"
        clearable
        size="small"
        placeholder="SKU"
        @update:model-value="(value) => updateField('skuCode', String(value ?? ''))"
      />
      <span v-else>{{ stock.skuCode || '-' }}</span>
    </div>

    <div class="detail-basic-label">部门</div>
    <div class="detail-basic-value">
      <el-select
        v-if="metaEditing"
        :model-value="editForm.department"
        filterable
        clearable
        size="small"
        placeholder="请选择部门"
        @update:model-value="(value) => updateField('department', String(value ?? ''))"
      >
        <el-option
          v-for="option in departmentOptions"
          :key="option.value"
          :label="option.label"
          :value="option.value"
        />
      </el-select>
      <span v-else>{{ stock.department || '-' }}</span>
    </div>

    <div class="detail-basic-label">库存类型</div>
    <div class="detail-basic-value">
      <el-select
        v-if="metaEditing"
        :model-value="editForm.inventoryTypeId"
        filterable
        clearable
        size="small"
        placeholder="请选择库存类型"
        @update:model-value="(value) => updateField('inventoryTypeId', value as number | null)"
      >
        <el-option
          v-for="option in inventoryTypeOptions"
          :key="option.id"
          :label="option.label"
          :value="option.id"
        />
      </el-select>
      <span v-else>{{ findInventoryTypeLabel(stock.inventoryTypeId) || '-' }}</span>
    </div>

    <div class="detail-basic-label">仓库</div>
    <div class="detail-basic-value">
      <el-select
        v-if="metaEditing"
        :model-value="editForm.warehouseId"
        filterable
        clearable
        size="small"
        placeholder="请选择仓库"
        @update:model-value="(value) => updateField('warehouseId', value as number | null)"
      >
        <el-option
          v-for="option in warehouseOptions"
          :key="option.id"
          :label="option.label"
          :value="option.id"
        />
      </el-select>
      <span v-else>{{ findWarehouseLabel(stock.warehouseId) || '-' }}</span>
    </div>

    <div class="detail-basic-label">存放地址</div>
    <div class="detail-basic-value">
      <el-input
        v-if="metaEditing"
        :model-value="editForm.location"
        clearable
        size="small"
        placeholder="存放地址（默认值）"
        @update:model-value="(value) => updateField('location', String(value ?? ''))"
      />
      <span v-else>{{ stock.location || '-' }}</span>
    </div>

    <div class="detail-basic-label">备注</div>
    <div class="detail-basic-value">
      <el-input
        v-if="metaEditing"
        :model-value="editForm.remark"
        clearable
        size="small"
        placeholder="选填"
        @update:model-value="(value) => updateField('remark', String(value ?? ''))"
      />
      <span v-else>{{ editForm.remark || '-' }}</span>
    </div>

    <template #image>
      <ImageUploadArea
        v-if="metaEditing"
        :model-value="editForm.imageUrl"
        compact
        @update:model-value="(value) => updateField('imageUrl', String(value ?? ''))"
      />
      <AppImageThumb
        v-else-if="displayProductImage"
        :raw-url="displayProductImage"
        :width="160"
        :height="120"
      />
      <div v-else class="detail-image-empty">-</div>
    </template>
  </FinishedBasicInfoGrid>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'
import { Edit } from '@element-plus/icons-vue'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import FinishedBasicInfoGrid from '@/components/inventory/finished-shared/FinishedBasicInfoGrid.vue'
import type { FinishedDetailEditForm } from '@/composables/useFinishedDetailData'

type StockInfo = {
  skuCode?: string
  inventoryTypeId?: number | null
  warehouseId?: number | null
  department?: string
  location?: string
}

const props = defineProps<{
  stock: StockInfo
  displayProductImage: string
  metaEditing: boolean
  saving: boolean
  editForm: FinishedDetailEditForm
  inventoryTypeOptions: { id: number; label: string }[]
  warehouseOptions: { id: number; label: string }[]
  departmentOptions: { value: string; label: string }[]
  findInventoryTypeLabel: (id: number | null | undefined) => string
  findWarehouseLabel: (id: number | null | undefined) => string
  updateField: <K extends keyof FinishedDetailEditForm>(key: K, value: FinishedDetailEditForm[K]) => void
}>()

defineEmits<{
  (e: 'toggleEditMode'): void
  (e: 'saveMeta'): void
}>()

const {
  stock,
  displayProductImage,
  metaEditing,
  saving,
  editForm,
  inventoryTypeOptions,
  warehouseOptions,
  departmentOptions,
  findInventoryTypeLabel,
  findWarehouseLabel,
  updateField,
} = toRefs(props)
</script>

<style scoped>
.detail-head-btn { padding-inline: 8px; }
.detail-image-empty { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
