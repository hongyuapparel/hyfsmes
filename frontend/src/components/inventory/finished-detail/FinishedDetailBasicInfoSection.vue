<template>
  <div class="detail-top-row">
    <div class="detail-section">
      <div class="detail-section-head">
        <div class="detail-section-title">基础信息与产品图</div>
        <div class="detail-head-actions">
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
        </div>
      </div>
      <div class="detail-basic-main">
        <div class="detail-basic-grid">
          <div class="detail-basic-label">入库时间</div>
          <div class="detail-basic-value">{{ formatDateTime(stock.createdAt) }}</div>
          <div class="detail-basic-label">订单号</div>
          <div class="detail-basic-value">{{ orderNo || '-' }}</div>

          <div class="detail-basic-label">SKU</div>
          <div class="detail-basic-value">{{ stock.skuCode }}</div>
          <div class="detail-basic-label">客户</div>
          <div class="detail-basic-value">{{ stock.customerName || '-' }}</div>

          <div class="detail-basic-label">库存类型</div>
          <div class="detail-basic-value">
            <el-select
              v-if="metaEditing"
              :model-value="editForm.inventoryTypeId"
              filterable
              clearable
              size="small"
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

          <div class="detail-basic-label">部门</div>
          <div class="detail-basic-value">
            <el-select
              v-if="metaEditing"
              :model-value="editForm.department"
              filterable
              clearable
              size="small"
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

          <div class="detail-basic-label">存放地址</div>
          <div class="detail-basic-value">
            <el-input
              v-if="metaEditing"
              :model-value="editForm.location"
              clearable
              size="small"
              @update:model-value="(value) => updateField('location', String(value ?? ''))"
            />
            <span v-else>{{ stock.location || '-' }}</span>
          </div>

          <div class="detail-basic-label">备注</div>
          <div class="detail-basic-value detail-basic-value-span-3">
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
        </div>
        <div class="detail-product-image-panel">
          <div class="detail-image-label">产品图（可更换）</div>
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
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { toRefs } from 'vue'
import { Edit } from '@element-plus/icons-vue'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import type { FinishedDetailEditForm } from '@/composables/useFinishedDetailData'

type StockInfo = {
  createdAt?: string
  skuCode?: string
  customerName?: string
  inventoryTypeId?: number | null
  warehouseId?: number | null
  department?: string
  location?: string
}

const props = defineProps<{
  stock: StockInfo
  orderNo: string
  displayProductImage: string
  metaEditing: boolean
  saving: boolean
  editForm: FinishedDetailEditForm
  inventoryTypeOptions: { id: number; label: string }[]
  warehouseOptions: { id: number; label: string }[]
  departmentOptions: { value: string; label: string }[]
  formatDateTime: (value: unknown) => string
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
  orderNo,
  displayProductImage,
  metaEditing,
  saving,
  editForm,
  inventoryTypeOptions,
  warehouseOptions,
  departmentOptions,
  formatDateTime,
  findInventoryTypeLabel,
  findWarehouseLabel,
  updateField,
} = toRefs(props)
</script>

<style scoped>
.detail-top-row { display: flex; gap: 0; align-items: stretch; }
.detail-section {
  min-width: 0;
  flex: 1;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
}
.detail-top-row .detail-section { flex: 1 1 100%; width: 100%; }
.detail-section-title {
  font-weight: 600;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--el-text-color-primary);
}
.detail-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.detail-section-head .detail-section-title { margin-bottom: 0; }
.detail-head-actions { display: flex; align-items: center; gap: 6px; }
.detail-head-btn { padding-inline: 8px; }
.detail-basic-main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 170px;
  gap: 12px;
  align-items: stretch;
}
.detail-basic-grid {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr) 96px minmax(0, 1fr);
  border: 1px solid var(--el-border-color-lighter);
  font-size: 12px;
}
.detail-basic-label,
.detail-basic-value {
  min-width: 0;
  padding: 7px 10px;
  border-right: 1px solid var(--el-border-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
  display: flex;
  align-items: center;
  box-sizing: border-box;
}
.detail-basic-label {
  font-weight: 600;
  color: var(--el-text-color-primary);
  background: var(--el-fill-color-lighter);
}
.detail-basic-value { color: var(--el-text-color-regular); overflow: hidden; }
.detail-basic-value-span-3 { grid-column: 2 / 5; }
.detail-basic-grid > :nth-child(4n) { border-right: none; }
.detail-basic-grid > :nth-last-child(-n + 2) { border-bottom: none; }
.detail-product-image-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: 170px;
  min-width: 170px;
}
.detail-image-label { font-size: 12px; color: var(--el-text-color-secondary); }
.detail-image-empty { font-size: 12px; color: var(--el-text-color-secondary); }

:deep(.detail-basic-grid .el-select),
:deep(.detail-basic-grid .el-input) { width: 100%; max-width: 100%; }
:deep(.detail-basic-grid .el-select__wrapper) { min-width: 0 !important; }
:deep(.detail-product-image-panel .image-upload-area) { width: 100%; }

@media (max-width: 860px) {
  .detail-top-row { flex-direction: column; }
  .detail-basic-main { grid-template-columns: 1fr; }
}
</style>
