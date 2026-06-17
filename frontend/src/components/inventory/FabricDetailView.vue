<template>
  <div class="fabric-detail-wrap">
    <FinishedBasicInfoGrid title="基础信息">
      <template #actions>
        <el-button v-if="isView" text type="primary" class="detail-head-btn" @click="emit('edit')">
          <el-icon><Edit /></el-icon>
          <span>编辑</span>
        </el-button>
        <template v-else>
          <el-button type="primary" size="small" class="detail-head-btn" :loading="submitting" @click="emit('confirm')">保存</el-button>
          <el-button size="small" class="detail-head-btn" @click="emit('exitEdit')">取消</el-button>
        </template>
      </template>

      <div class="detail-basic-label">名称</div>
      <div class="detail-basic-value">
        <el-input v-if="isEdit" v-model="form.name" size="small" placeholder="面料名称/编号" clearable />
        <span v-else>{{ form.name || '-' }}</span>
      </div>
      <div class="detail-basic-label">客户</div>
      <div class="detail-basic-value">
        <el-select v-if="isEdit" v-model="form.customerName" size="small" filterable clearable placeholder="请选择客户">
          <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <span v-else>{{ form.customerName || '-' }}</span>
      </div>
      <div class="detail-basic-label">供应商</div>
      <div class="detail-basic-value">
        <el-select
          v-if="isEdit"
          :key="fabricSupplierSelectKey"
          v-model="form.supplierId"
          size="small"
          filterable
          clearable
          placeholder="面料供应商"
          :loading="fabricSupplierOptionsLoading"
        >
          <el-option v-for="opt in fabricSupplierOptions" :key="opt.id" :label="opt.name" :value="opt.id" />
        </el-select>
        <span v-else>{{ supplierText }}</span>
      </div>
      <div class="detail-basic-label">库存类型</div>
      <div class="detail-basic-value">
        <el-select v-if="isEdit" v-model="form.inventoryTypeId" size="small" filterable clearable placeholder="库存类型">
          <el-option v-for="opt in inventoryTypeOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
        </el-select>
        <span v-else>{{ inventoryTypeText }}</span>
      </div>
      <div class="detail-basic-label">仓库</div>
      <div class="detail-basic-value">
        <el-select v-if="isEdit" v-model="form.warehouseId" size="small" filterable clearable placeholder="仓库">
          <el-option v-for="opt in warehouseOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
        </el-select>
        <span v-else>{{ warehouseText }}</span>
      </div>
      <div class="detail-basic-label">存放地址</div>
      <div class="detail-basic-value">
        <el-input v-if="isEdit" v-model="form.storageLocation" size="small" placeholder="存放位置" clearable />
        <span v-else>{{ form.storageLocation || '-' }}</span>
      </div>
      <div class="detail-basic-label">数量</div>
      <div class="detail-basic-value">
        <span v-if="isEdit" class="qty-readonly">{{ formatDisplayNumber(form.quantity) }}</span>
        <span v-else>{{ quantityText }}</span>
      </div>
      <div class="detail-basic-label">单位</div>
      <div class="detail-basic-value">
        <el-input v-if="isEdit" v-model="form.unit" size="small" placeholder="如米、公斤" clearable />
        <span v-else>{{ form.unit || '-' }}</span>
      </div>
      <div class="detail-basic-label detail-basic-label-row-start">备注</div>
      <div class="detail-basic-value detail-basic-value-span-3">
        <el-input v-if="isEdit" v-model="form.remark" size="small" type="textarea" :rows="2" placeholder="备注" />
        <span v-else>{{ form.remark || '-' }}</span>
      </div>
    </FinishedBasicInfoGrid>

    <div class="fabric-section">
      <div class="fabric-section-title">图片</div>
      <ImageUploadArea v-if="isEdit" v-model="form.imageUrl" />
      <template v-else>
        <AppImageThumb v-if="form.imageUrl" :raw-url="form.imageUrl" variant="dialog" :lazy="false" />
        <span v-else class="fabric-muted">-</span>
      </template>
    </div>

    <div v-if="isView" v-loading="logsLoading" class="fabric-section-logs">
      <OperationLogsSection :logs="formattedLogs" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Edit } from '@element-plus/icons-vue'
import type { FabricOperationLog, FabricSupplierOption } from '@/api/inventory'
import type { FabricFormModel } from '@/composables/useFabricFormDialog'
import AppImageThumb from '@/components/AppImageThumb.vue'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'
import FinishedBasicInfoGrid from '@/components/inventory/finished-shared/FinishedBasicInfoGrid.vue'
import { formatDateTime as formatDate } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'

const props = defineProps<{
  form: FabricFormModel
  isView: boolean
  isEdit: boolean
  submitting: boolean
  customerOptions: Array<{ label: string; value: string }>
  fabricSupplierOptions: FabricSupplierOption[]
  fabricSupplierSelectKey: number
  fabricSupplierOptionsLoading: boolean
  warehouseOptions: Array<{ id: number; label: string }>
  inventoryTypeOptions: Array<{ id: number; label: string }>
  logs: FabricOperationLog[]
  logsLoading: boolean
  formatLogAction: (action: string) => string
}>()

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'exitEdit'): void
  (e: 'confirm'): void
}>()

const supplierText = computed(() => {
  const id = props.form.supplierId
  if (id == null) return '-'
  return props.fabricSupplierOptions.find((o) => o.id === id)?.name || '-'
})

const inventoryTypeText = computed(() => {
  const id = props.form.inventoryTypeId
  if (id == null) return '-'
  return props.inventoryTypeOptions.find((o) => o.id === id)?.label || '-'
})

const warehouseText = computed(() => {
  const id = props.form.warehouseId
  if (id == null) return '-'
  return props.warehouseOptions.find((o) => o.id === id)?.label || '-'
})

const quantityText = computed(() => `${formatDisplayNumber(props.form.quantity)} ${props.form.unit || ''}`.trim())

const formattedLogs = computed(() =>
  props.logs.map((log) => ({
    id: log.id,
    operatorUsername: log.operatorUsername,
    createdAt: formatDate(log.createdAt),
    summary: `${props.formatLogAction(log.action)}${log.remark ? ` · 备注：${log.remark}` : ''}`,
  })),
)

defineOptions({ name: 'FabricDetailView' })
</script>

<style scoped>
.fabric-detail-wrap { display: flex; flex-direction: column; gap: 10px; }
.detail-head-btn { padding-inline: 8px; }
.fabric-section {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
}
.fabric-section-title { font-weight: 600; font-size: 13px; color: var(--el-text-color-primary); margin-bottom: 8px; }
.fabric-muted { font-size: var(--font-size-caption); color: var(--el-text-color-secondary); }
.qty-readonly { color: var(--el-text-color-regular); }
</style>
