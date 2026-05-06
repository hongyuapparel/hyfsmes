<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑辅料' : '新增辅料'"
    width="480"
    top="4vh"
    destroy-on-close
    @close="onClose"
  >
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="80px">
      <el-alert
        v-if="quickAddSource"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 10px"
        :title="`已按「${quickAddSource.name || '-'}」回填，提交后会把本次数量增量到该记录`"
      />
      <el-form-item label="名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入名称" clearable :disabled="Boolean(quickAddSource)" />
      </el-form-item>
      <el-form-item label="类别" prop="category">
        <el-select
          v-model="form.category"
          placeholder="请选择类别（来自供应商设置）"
          filterable
          clearable
          style="width: 100%"
          :disabled="categoryOptions.length === 0 || Boolean(quickAddSource)"
        >
          <el-option v-for="opt in categoryOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
        <div v-if="categoryOptions.length === 0" class="category-empty-tip">
          暂无可选类别，请先在「系统设置 → 供应商设置 → 辅料供应商」中配置经营范围
        </div>
      </el-form-item>
      <el-form-item label="客户" prop="customerName">
        <el-select v-model="form.customerName" placeholder="请选择客户" filterable clearable :disabled="Boolean(quickAddSource)">
          <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="业务员" prop="salesperson" required>
        <el-select v-model="form.salesperson" placeholder="请选择业务员" filterable clearable style="width: 100%" :disabled="Boolean(quickAddSource)">
          <el-option v-for="s in salespersonOptions" :key="s" :label="s" :value="s" />
        </el-select>
      </el-form-item>
      <el-form-item label="数量" prop="quantity">
        <div class="qty-unit-row">
          <el-input-number v-model="form.quantity" :min="0" :precision="0" controls-position="right" class="qty-input" :disabled="isEdit" />
          <el-input v-model="form.unit" placeholder="单位（如个、卷）" clearable class="unit-input" :disabled="Boolean(quickAddSource)" />
        </div>
      </el-form-item>
      <el-form-item label="仓库" prop="warehouseId">
        <el-select v-model="form.warehouseId" placeholder="请选择仓库" filterable clearable style="width: 100%">
          <el-option v-for="opt in warehouseOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="存放地址" prop="location">
        <el-input v-model="form.location" placeholder="请输入存放地址" clearable />
      </el-form-item>
      <el-form-item label="图片" prop="imageUrls">
        <div class="multi-image-wrap">
          <div class="multi-image-row">
            <div v-for="(_url, idx) in form.imageUrls" :key="`img-${idx}`" class="multi-image-item">
              <ImageUploadArea v-model="form.imageUrls[idx]" compact class="multi-image-upload" />
              <el-button
                v-if="form.imageUrls.length > 1"
                class="remove-image-btn"
                type="danger"
                link
                size="small"
                @click="removeImage(idx)"
              >
                删除
              </el-button>
            </div>
            <el-button
              v-if="form.imageUrls.length < 9"
              class="add-image-btn"
              type="primary"
              plain
              size="small"
              @click="addImage"
            >
              + 添加
            </el-button>
          </div>
          <div class="image-tip">第一张为主图（用于表格展示）</div>
        </div>
      </el-form-item>
      <el-form-item label="备注" prop="remark">
        <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注" clearable />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="emit('confirm')">确定</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { AccessoryItem } from '@/api/inventory'
import ImageUploadArea from '@/components/ImageUploadArea.vue'

interface AccessoriesFormModel {
  name: string
  category: string
  quantity: number
  unit: string
  warehouseId: number | null
  location: string
  customerName: string
  salesperson: string
  imageUrl: string
  imageUrls: string[]
  remark: string
}

const props = defineProps<{
  visible: boolean
  submitting: boolean
  isEdit: boolean
  quickAddSource: AccessoryItem | null
  form: AccessoriesFormModel
  formRules: FormRules
  categoryOptions: string[]
  customerOptions: Array<{ label: string; value: string; salesperson?: string }>
  salespersonOptions: string[]
  warehouseOptions: Array<{ id: number; label: string }>
}>()

const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'confirm'): void
  (e: 'close'): void
}>()

const formRef = ref<FormInstance>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

function onClose() {
  emit('close')
}

function addImage() {
  if (props.form.imageUrls.length >= 9) return
  props.form.imageUrls.push('')
}

function removeImage(index: number) {
  if (props.form.imageUrls.length <= 1) {
    props.form.imageUrls[0] = ''
    return
  }
  props.form.imageUrls.splice(index, 1)
}

watch(
  () => props.form.customerName,
  (customerName) => {
    const name = String(customerName ?? '').trim()
    if (!name) return
    const matched = props.customerOptions.find((opt) => opt.value === name)
    const sp = String(matched?.salesperson ?? '').trim()
    if (sp && !props.form.salesperson) {
      props.form.salesperson = sp
      return
    }
    if (sp) props.form.salesperson = sp
  },
)

defineExpose({
  validate: () => formRef.value?.validate(),
  clearValidate: () => formRef.value?.clearValidate(),
})
</script>

<style scoped>
.category-empty-tip {
  margin-top: 6px;
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  line-height: 1.4;
}

.qty-unit-row {
  display: flex;
  gap: var(--space-sm);
  width: 100%;
}

.qty-input {
  flex: 1.2;
}

.unit-input {
  flex: 1;
}

.multi-image-wrap {
  display: grid;
  gap: 8px;
  width: 100%;
}

.multi-image-row {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  overflow-x: auto;
  padding-bottom: 2px;
}

.multi-image-item {
  display: grid;
  gap: 4px;
  width: 110px;
  min-width: 110px;
}

.remove-image-btn {
  justify-self: center;
}

.add-image-btn {
  width: 76px;
  min-width: 76px;
  height: 76px;
  align-self: center;
}

.multi-image-upload {
  width: 110px;
}

.multi-image-upload :deep(.image-upload-area) {
  min-height: 110px;
  height: 110px;
}

.multi-image-upload :deep(.preview-img) {
  aspect-ratio: 1 / 1;
  max-width: 100px;
}

.image-tip {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
}
</style>
