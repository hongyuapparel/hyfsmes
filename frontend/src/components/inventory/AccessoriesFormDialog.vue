<template>
  <el-dialog
    v-model="dialogVisible"
    :title="isEdit ? '编辑辅料' : '新增辅料'"
    width="480"
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
        <el-input v-model="form.name" placeholder="请输入名称" clearable />
      </el-form-item>
      <el-form-item label="类别" prop="category">
        <el-select
          v-model="form.category"
          placeholder="请选择类别（来自供应商设置）"
          filterable
          clearable
          style="width: 100%"
          :disabled="categoryOptions.length === 0"
        >
          <el-option v-for="opt in categoryOptions" :key="opt" :label="opt" :value="opt" />
        </el-select>
        <div v-if="categoryOptions.length === 0" class="category-empty-tip">
          暂无可选类别，请先在「系统设置 → 供应商设置 → 辅料供应商」中配置经营范围
        </div>
      </el-form-item>
      <el-form-item label="客户" prop="customerName">
        <el-select v-model="form.customerName" placeholder="请选择客户" filterable clearable>
          <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="业务员" prop="salesperson" required>
        <el-select v-model="form.salesperson" placeholder="请选择业务员" filterable clearable style="width: 100%">
          <el-option v-for="s in salespersonOptions" :key="s" :label="s" :value="s" />
        </el-select>
      </el-form-item>
      <el-form-item label="数量" prop="quantity">
        <div class="qty-unit-row">
          <el-input-number v-model="form.quantity" :min="0" :precision="0" controls-position="right" class="qty-input" />
          <el-input v-model="form.unit" placeholder="单位（如个、卷）" clearable class="unit-input" />
        </div>
      </el-form-item>
      <el-form-item label="图片" prop="imageUrl">
        <ImageUploadArea v-model="form.imageUrl" />
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
import { computed, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { AccessoryItem } from '@/api/inventory'
import ImageUploadArea from '@/components/ImageUploadArea.vue'

interface AccessoriesFormModel {
  name: string
  category: string
  quantity: number
  unit: string
  customerName: string
  salesperson: string
  imageUrl: string
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
  customerOptions: Array<{ label: string; value: string }>
  salespersonOptions: string[]
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
</style>
