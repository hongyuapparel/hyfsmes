<template>
  <div class="detail-section">
    <div class="detail-section-head">
      <div class="detail-section-title">颜色图片与码数明细</div>
      <div class="detail-head-actions">
        <template v-if="!structureReadonly">
          <el-button type="primary" link size="small" @click="emit('addColorRow')">+ 新增颜色</el-button>
          <el-button type="primary" link size="small" @click="emit('addSizeColumn')">+ 新增尺码列</el-button>
        </template>
        <el-button type="success" link size="small" @click="emit('applyBasicInfoToAllRows')">
          ↓ 应用基础信息到所有行
        </el-button>
      </div>
    </div>
    <div class="detail-section-tip">
      默认每行继承上方"基础信息"中的部门 / 库存类型 / 仓库 / 存放地址；只在该行单独修改后，基础信息变化才不再覆盖该行。
    </div>
    <div class="create-size-table-wrap">
      <el-table
        :data="sizeRows"
        :row-key="(row) => row._key"
        border
        size="small"
        class="create-size-table detail-color-size-table"
        show-summary
        :summary-method="summaryMethod"
      >
        <el-table-column label="颜色" width="88" align="center" header-align="center">
          <template #default="{ row }">
            <el-input v-model="row.colorName" placeholder="颜色" clearable size="small" :disabled="structureReadonly" />
          </template>
        </el-table-column>
        <el-table-column label="颜色图片" width="122" align="center" header-align="center">
          <template #default="{ row }">
            <ImageUploadArea v-model="row.imageUrl" compact />
          </template>
        </el-table-column>
        <el-table-column
          v-for="(size, idx) in sizeHeaders"
          :key="`create-size-${idx}-${size}`"
          min-width="78"
          align="center"
          header-align="center"
        >
          <template #header>
            <div class="b-header-cell">
              <el-input
                v-model="sizeHeaders[idx]"
                size="small"
                class="b-header-input"
                :input-style="{ textAlign: 'center' }"
                :disabled="structureReadonly"
              />
              <div class="b-header-actions">
                <el-button
                  v-if="!structureReadonly && sizeHeaders.length > 1"
                  link
                  type="danger"
                  size="small"
                  class="b-header-remove"
                  @click.stop="emit('removeSizeColumn', idx)"
                >
                  <el-icon><Close /></el-icon>
                </el-button>
              </div>
            </div>
          </template>
          <template #default="{ row }">
            <el-input-number
              v-model="row.quantities[idx]"
              :min="0"
              :precision="0"
              :controls="false"
              size="small"
              style="width: 100%"
            />
          </template>
        </el-table-column>
        <el-table-column label="合计" width="72" align="center" header-align="center">
          <template #default="{ row }">{{ sumDetailRowQty(row.quantities) }}</template>
        </el-table-column>
        <el-table-column label="出厂价" width="88" align="center" header-align="center">
          <template #default>
            <el-input v-model="unitPrice" placeholder="请输入" clearable size="small" :disabled="structureReadonly" />
          </template>
        </el-table-column>
        <el-table-column label="总价" width="120" align="center" header-align="center">
          <template #default="{ row }">{{ createRowTotalPrice(row.quantities) }}</template>
        </el-table-column>

        <el-table-column label="部门" width="120" align="center" header-align="center">
          <template #header>
            <span :class="{ 'col-header-overridden': hasAnyOverride('department') }">部门</span>
          </template>
          <template #default="{ row }">
            <el-select
              :model-value="row.department"
              filterable
              clearable
              size="small"
              :placeholder="row._overrides.department ? '已自定义' : '继承基础信息'"
              :class="{ 'row-override': row._overrides.department }"
              @update:model-value="(v) => emit('rowMetaChange', row._key, 'department', String(v ?? ''))"
            >
              <el-option v-for="opt in departmentOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="库存类型" width="120" align="center" header-align="center">
          <template #header>
            <span :class="{ 'col-header-overridden': hasAnyOverride('inventoryTypeId') }">库存类型</span>
          </template>
          <template #default="{ row }">
            <el-select
              :model-value="row.inventoryTypeId"
              filterable
              clearable
              size="small"
              :placeholder="row._overrides.inventoryTypeId ? '已自定义' : '继承基础信息'"
              :class="{ 'row-override': row._overrides.inventoryTypeId }"
              @update:model-value="(v) => emit('rowMetaChange', row._key, 'inventoryTypeId', (v as number | null) ?? null)"
            >
              <el-option v-for="opt in inventoryTypeOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="仓库" width="120" align="center" header-align="center">
          <template #header>
            <span :class="{ 'col-header-overridden': hasAnyOverride('warehouseId') }">仓库</span>
          </template>
          <template #default="{ row }">
            <el-select
              :model-value="row.warehouseId"
              filterable
              clearable
              size="small"
              :placeholder="row._overrides.warehouseId ? '已自定义' : '继承基础信息'"
              :class="{ 'row-override': row._overrides.warehouseId }"
              @update:model-value="(v) => emit('rowMetaChange', row._key, 'warehouseId', (v as number | null) ?? null)"
            >
              <el-option v-for="opt in warehouseOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="存放地址" width="150" align="center" header-align="center">
          <template #header>
            <span :class="{ 'col-header-overridden': hasAnyOverride('location') }">存放地址</span>
          </template>
          <template #default="{ row }">
            <el-input
              :model-value="row.location"
              :placeholder="row._overrides.location ? '已自定义' : '继承基础信息'"
              clearable
              size="small"
              style="width: 100%"
              :class="{ 'row-override': row._overrides.location }"
              @update:model-value="(v) => emit('rowMetaChange', row._key, 'location', String(v ?? ''))"
            />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="48" align="center" header-align="center">
          <template #default="{ $index }">
            <el-button
              v-if="!structureReadonly && sizeRows.length > 1"
              type="danger"
              link
              size="small"
              class="create-row-remove-btn"
              @click="emit('removeColorRow', $index)"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Close, Delete } from '@element-plus/icons-vue'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import type {
  FinishedCreateSizeRow,
  FinishedCreateRowMetaField,
} from '@/composables/useFinishedCreateForm'

type SummaryMethod = (params: { columns: Array<{ label?: string }> }) => string[]

defineProps<{
  summaryMethod: SummaryMethod
  sumDetailRowQty: (quantities: unknown[]) => number
  createRowTotalPrice: (quantities: unknown[]) => string
  structureReadonly?: boolean
  warehouseOptions: Array<{ id: number; label: string }>
  inventoryTypeOptions: Array<{ id: number; label: string }>
  departmentOptions: Array<{ value: string; label: string }>
}>()

const emit = defineEmits<{
  (e: 'addColorRow'): void
  (e: 'addSizeColumn'): void
  (e: 'removeColorRow', index: number): void
  (e: 'removeSizeColumn', index: number): void
  (e: 'applyBasicInfoToAllRows'): void
  (e: 'rowMetaChange', rowKey: string, field: FinishedCreateRowMetaField, value: string | number | null): void
}>()

const sizeHeaders = defineModel<string[]>('sizeHeaders', { required: true })
const sizeRows = defineModel<FinishedCreateSizeRow[]>('sizeRows', { required: true })
const unitPrice = defineModel<string>('unitPrice', { required: true })

function hasAnyOverride(field: FinishedCreateRowMetaField): boolean {
  return (sizeRows.value ?? []).some((row) => row._overrides[field])
}
</script>

<style scoped>
.create-size-table-wrap { width: 100%; border: 1px solid var(--el-border-color); border-radius: var(--el-border-radius-base); overflow: hidden; }
.create-size-table { margin: 0; }
.create-size-table .el-table__inner-wrapper::before { display: none; }
.b-header-cell { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; box-sizing: border-box; }
.b-header-input { width: 100%; flex: 1; min-width: 0; text-align: center; }
.b-header-input :deep(.el-input__wrapper) { padding-left: 6px; padding-right: 6px; }
.b-header-input :deep(.el-input__inner) { text-align: center; }
.b-header-actions { position: absolute; top: 50%; right: -2px; transform: translateY(-50%); display: flex; align-items: center; gap: 1px; opacity: 0; transition: opacity 0.15s; }
.b-header-remove { width: 14px; height: 14px; padding: 0; min-height: 14px; min-width: 14px; display: flex; align-items: center; justify-content: center; font-size: 10px; }
.b-header-remove :deep(.el-icon) { font-size: 8px; line-height: 8px; }
.b-header-cell:hover .b-header-actions { opacity: 1; }
.create-row-remove-btn { padding: 0; }
.detail-section { min-width: 0; flex: 1; padding: 10px 12px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; background: #fff; }
.detail-section-title { font-weight: 600; margin-bottom: 6px; font-size: 13px; color: var(--el-text-color-primary); }
.detail-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; }
.detail-head-actions { display: flex; align-items: center; gap: 6px; }
.detail-section-tip { font-size: 12px; color: var(--el-text-color-secondary); margin-bottom: 8px; line-height: 1.5; }
.col-header-overridden { color: var(--el-color-warning); }

/* 单元格内容上下左右居中 */
:deep(.create-size-table .el-table__cell) { vertical-align: middle; }
:deep(.create-size-table .cell) {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 6px;
  line-height: 1.4;
}
:deep(.create-size-table .el-input-number) { width: 100%; }
:deep(.create-size-table .el-input) { width: 100%; }
:deep(.create-size-table .el-select) { width: 100%; }
/* 已脱钩的行字段：橙色边框示意 */
:deep(.row-override .el-input__wrapper),
:deep(.row-override .el-select__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-warning) inset !important;
}
</style>
