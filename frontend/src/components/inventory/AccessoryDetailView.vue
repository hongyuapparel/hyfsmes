<template>
  <div class="acc-detail-wrap">
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
        <el-input v-if="isEdit" v-model="form.name" size="small" placeholder="请输入名称" clearable />
        <span v-else>{{ form.name || '-' }}</span>
      </div>
      <div class="detail-basic-label">类别</div>
      <div class="detail-basic-value">
        <el-select v-if="isEdit" v-model="form.category" size="small" filterable clearable placeholder="请选择类别" :disabled="categoryOptions.length === 0">
          <el-option v-for="opt in categoryOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
        <span v-else>{{ form.category || '-' }}</span>
      </div>
      <div class="detail-basic-label">客户</div>
      <div class="detail-basic-value">
        <el-select v-if="isEdit" v-model="form.customerName" size="small" filterable clearable placeholder="请选择客户">
          <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
        <span v-else>{{ form.customerName || '-' }}</span>
      </div>
      <div class="detail-basic-label">业务员</div>
      <div class="detail-basic-value">
        <el-select v-if="isEdit" v-model="form.salesperson" size="small" filterable clearable placeholder="请选择业务员">
          <el-option v-for="s in salespersonOptions" :key="s" :label="s" :value="s" />
        </el-select>
        <span v-else>{{ form.salesperson || '-' }}</span>
      </div>
      <div class="detail-basic-label">仓库</div>
      <div class="detail-basic-value">
        <el-select v-if="isEdit" v-model="form.warehouseId" size="small" filterable clearable placeholder="请选择仓库">
          <el-option v-for="opt in warehouseOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
        </el-select>
        <span v-else>{{ warehouseLabelText }}</span>
      </div>
      <div class="detail-basic-label">存放地址</div>
      <div class="detail-basic-value">
        <el-input v-if="isEdit" v-model="form.location" size="small" placeholder="存放地址" clearable />
        <span v-else>{{ form.location || '-' }}</span>
      </div>
      <div class="detail-basic-label">分码</div>
      <div class="detail-basic-value">
        <el-switch v-if="isEdit" v-model="form.isSized" size="small" @change="onSizedChange" />
        <span v-else>{{ form.isSized ? '是' : '否' }}</span>
      </div>
      <template v-if="form.isSized">
        <div class="detail-basic-label">单位</div>
        <div class="detail-basic-value">
          <el-input v-if="isEdit" v-model="form.unit" size="small" placeholder="单位" clearable />
          <span v-else>{{ form.unit || '-' }}</span>
        </div>
      </template>
      <template v-else>
        <div class="detail-basic-label">数量</div>
        <div class="detail-basic-value">
          <div v-if="isEdit" class="qty-unit-row">
            <span class="qty-readonly">{{ formatDisplayNumber(form.quantity) }}</span>
            <el-input v-model="form.unit" size="small" placeholder="单位" clearable class="unit-input" />
          </div>
          <span v-else>{{ viewQuantityText }}</span>
        </div>
      </template>
      <div class="detail-basic-label detail-basic-label-row-start">备注</div>
      <div class="detail-basic-value detail-basic-value-span-3">
        <el-input v-if="isEdit" v-model="form.remark" size="small" type="textarea" :rows="2" placeholder="备注" />
        <span v-else>{{ form.remark || '-' }}</span>
      </div>
    </FinishedBasicInfoGrid>

    <div v-if="form.isSized" class="acc-section">
      <div class="acc-section-title">分码明细</div>
      <AccessorySizeMatrix v-model:size-headers="form.sizeHeaders" v-model:size-quantities="form.sizeQuantities" :readonly="isView" />
    </div>

    <div class="acc-section">
      <div class="acc-section-title">图片</div>
      <div v-if="isView" class="acc-images">
        <AppImageThumb v-for="(url, idx) in viewImages" :key="`v-img-${idx}`" :raw-url="url" variant="dialog" :lazy="false" />
        <span v-if="!viewImages.length" class="acc-muted">-</span>
      </div>
      <div v-else class="multi-image-wrap">
        <div class="multi-image-row">
          <div v-for="(_url, idx) in form.imageUrls" :key="`e-img-${idx}`" class="multi-image-item">
            <ImageUploadArea v-model="form.imageUrls[idx]" compact class="multi-image-upload" />
            <el-button v-if="form.imageUrls.length > 1" class="remove-image-btn" type="danger" link size="small" @click="removeImage(idx)">删除</el-button>
          </div>
          <el-button v-if="form.imageUrls.length < 9" class="add-image-btn" type="primary" plain size="small" @click="addImage">+ 添加</el-button>
        </div>
        <div class="image-tip">第一张为主图（用于表格展示）</div>
      </div>
    </div>

    <div v-if="isView" v-loading="logsLoading" class="acc-section-logs">
      <OperationLogsSection :logs="formattedLogs" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Edit } from '@element-plus/icons-vue'
import type { AccessoryOperationLog } from '@/api/inventory'
import AppImageThumb from '@/components/AppImageThumb.vue'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import AccessorySizeMatrix from '@/components/inventory/AccessorySizeMatrix.vue'
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'
import FinishedBasicInfoGrid from '@/components/inventory/finished-shared/FinishedBasicInfoGrid.vue'
import { formatDateTime as formatDate } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import { sumDetailRowQty } from '@/utils/finishedStockTableUtils'
import type { AccessoriesFormModel } from '@/composables/useAccessoriesFormDialog'

const props = defineProps<{
  form: AccessoriesFormModel
  isView: boolean
  isEdit: boolean
  submitting: boolean
  categoryOptions: string[]
  customerOptions: Array<{ label: string; value: string; salesperson?: string }>
  salespersonOptions: string[]
  warehouseOptions: Array<{ id: number; label: string }>
  logs: AccessoryOperationLog[]
  logsLoading: boolean
  formatLogAction: (action: string) => string
  onSizedChange: (val: string | number | boolean) => void
  addImage: () => void
  removeImage: (index: number) => void
}>()

const emit = defineEmits<{
  (e: 'edit'): void
  (e: 'exitEdit'): void
  (e: 'confirm'): void
}>()

const warehouseLabelText = computed(() => {
  const id = props.form.warehouseId
  if (id == null) return '-'
  return props.warehouseOptions.find((o) => o.id === id)?.label || '-'
})

const viewQuantityText = computed(() => {
  const unit = props.form.unit || ''
  const qty = props.form.isSized ? sumDetailRowQty(props.form.sizeQuantities) : Number(props.form.quantity) || 0
  return `${formatDisplayNumber(qty)} ${unit}`.trim()
})

const viewImages = computed(() => props.form.imageUrls.filter((u) => !!String(u ?? '').trim()))

const formattedLogs = computed(() =>
  props.logs.map((log) => ({
    id: log.id,
    operatorUsername: log.operatorUsername,
    createdAt: formatDate(log.createdAt),
    summary: `${props.formatLogAction(log.action)}${log.remark ? ` · 备注：${log.remark}` : ''}`,
  })),
)

defineOptions({ name: 'AccessoryDetailView' })
</script>

<style scoped>
.acc-detail-wrap { display: flex; flex-direction: column; gap: 10px; }
.detail-head-btn { padding-inline: 8px; }
.acc-section {
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: #fff;
}
.acc-section-title { font-weight: 600; font-size: 13px; color: var(--el-text-color-primary); margin-bottom: 8px; }
.acc-images { display: flex; flex-wrap: wrap; gap: 10px; }
.acc-muted { font-size: var(--font-size-caption); color: var(--el-text-color-secondary); }
.qty-unit-row { display: flex; gap: var(--space-sm); width: 100%; align-items: center; }
.qty-readonly { flex: 1.2; color: var(--el-text-color-regular); }
.unit-input { flex: 1; }
.multi-image-wrap { display: grid; gap: 8px; width: 100%; }
.multi-image-row { display: flex; gap: 10px; align-items: flex-start; overflow-x: auto; padding-bottom: 2px; }
.multi-image-item { display: grid; gap: 4px; width: 110px; min-width: 110px; }
.remove-image-btn { justify-self: center; }
.add-image-btn { width: 76px; min-width: 76px; height: 76px; align-self: center; }
.multi-image-upload { width: 110px; }
.multi-image-upload :deep(.image-upload-area) { min-height: 110px; height: 110px; }
.multi-image-upload :deep(.preview-img) { aspect-ratio: 1 / 1; max-width: 100px; }
.image-tip { font-size: var(--font-size-caption); color: var(--color-text-muted); }
</style>
