<template>
  <el-dialog
    :model-value="visible"
    title="入库"
    width="440"
    destroy-on-close
    @update:model-value="onVisibleChange"
    @close="onClose"
  >
    <div v-if="previewItems.length" class="inbound-preview">
      <div class="inbound-preview-title">待处理数量明细</div>
      <div
        v-for="item in previewItems"
        :key="item.id"
        class="inbound-preview-item"
      >
        <div class="inbound-preview-meta">
          <span>订单号：{{ item.orderNo }}</span>
          <span>SKU：{{ item.skuCode }}</span>
          <span>待处理：{{ formatDisplayNumber(item.quantity) }}</span>
        </div>
        <div v-if="item.headers.length && item.rows.length" class="inbound-preview-breakdown">
          <el-table :data="toPreviewTableRows(item)" border size="small" class="inbound-preview-table">
            <el-table-column label="颜色" min-width="90" align="center">
              <template #default="{ row }">
                {{ row.colorName || '-' }}
              </template>
            </el-table-column>
            <el-table-column
              v-for="(h, hIdx) in item.headers"
              :key="`${item.id}-${hIdx}`"
              :label="h"
              min-width="72"
              align="center"
            >
              <template #default="{ row }">
                {{ formatDisplayNumber(row.values[hIdx] ?? 0) }}
              </template>
            </el-table-column>
            <el-table-column label="总数" min-width="80" align="center">
              <template #default="{ row }">
                {{ formatDisplayNumber(getPreviewRowTotal(row.values)) }}
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </div>
    <el-form
      :ref="formRef"
      :model="form"
      :rules="rules"
      label-width="100px"
    >
      <el-form-item label="部门" prop="department">
        <el-select
          v-model="form.department"
          placeholder="请选择部门"
          filterable
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="opt in departmentOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="库存类型" prop="inventoryTypeId">
        <el-select
          v-model="form.inventoryTypeId"
          placeholder="请选择库存类型"
          filterable
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="opt in inventoryTypeOptions"
            :key="opt.id"
            :label="opt.label"
            :value="opt.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="仓库" prop="warehouseId">
        <el-select
          v-model="form.warehouseId"
          placeholder="请选择仓库"
          filterable
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="opt in warehouseOptions"
            :key="opt.id"
            :label="opt.label"
            :value="opt.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="存放地址" prop="location">
        <el-input v-model="form.location" placeholder="请输入具体存放地址" clearable />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="onCancel">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="$emit('submit')">
        确定入库
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
type InboundPreviewItem = {
  id: number
  orderNo: string
  skuCode: string
  quantity: number
  headers: string[]
  rows: Array<{ colorName: string; values: number[] }>
}

type PreviewRow = { colorName: string; values: number[] }

defineProps<{
  visible: boolean
  submitting: boolean
  previewItems: InboundPreviewItem[]
  formRef: object
  form: {
    warehouseId: number | null
    inventoryTypeId: number | null
    department: string
    location: string
  }
  rules: object
  departmentOptions: Array<{ value: string; label: string }>
  inventoryTypeOptions: Array<{ id: number; label: string }>
  warehouseOptions: Array<{ id: number; label: string }>
  formatDisplayNumber: (value: unknown) => string | number
  toPreviewTableRows: (item: InboundPreviewItem) => PreviewRow[]
  getPreviewRowTotal: (values: number[]) => number
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'close'): void
  (e: 'submit'): void
}>()

function onVisibleChange(value: boolean) {
  emit('update:visible', value)
}

function onClose() {
  emit('close')
}

function onCancel() {
  emit('update:visible', false)
}
</script>

<style scoped>
.inbound-preview {
  margin-bottom: 12px;
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-light);
}

.inbound-preview-title {
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.inbound-preview-item + .inbound-preview-item {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--el-border-color-lighter);
}

.inbound-preview-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  color: var(--el-text-color-regular);
}

.inbound-preview-breakdown {
  margin-top: 6px;
}

.inbound-preview-table :deep(th),
.inbound-preview-table :deep(td) {
  text-align: center;
}
</style>
