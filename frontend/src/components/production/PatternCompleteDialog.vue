<template>
  <AppDialog
    v-model="visible"
    title="确认完成"
    width="480"
    destroy-on-close
    @close="emit('close')"
  >
    <div v-if="row" class="complete-brief">
      <div>订单号：{{ row.orderNo }}</div>
      <div>SKU：{{ row.skuCode }}</div>
    </div>
    <div class="complete-hint">样品图片可选：不上传也可以完成纸样</div>
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="样品图片" prop="sampleImageUrl">
        <div class="sample-image-upload" @click="emit('trigger-upload')">
          <div v-if="form.sampleImageUrl" class="image-preview-wrap">
            <el-image
              :src="form.sampleImageUrl"
              fit="contain"
              :preview-teleported="true"
              :preview-src-list="[form.sampleImageUrl]"
            />
            <el-button text type="danger" size="small" class="image-remove" @click.stop="emit('clear-image')">
              移除
            </el-button>
          </div>
          <div v-else class="image-placeholder">
            <span>点击上传样品图片</span>
          </div>
        </div>
        <input
          ref="fileInputRef"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          class="hidden-file-input"
          @change="(e) => emit('file-change', e)"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="emit('submit')">完成纸样</el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { PatternListItem } from '@/api/production-pattern'

const props = defineProps<{
  modelValue: boolean
  row: PatternListItem | null
  form: { sampleImageUrl: string }
  rules: FormRules
  submitting: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  submit: []
  'trigger-upload': []
  'clear-image': []
  'file-change': [event: Event]
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => emit('update:modelValue', v))

const formRef = ref<FormInstance>()
const fileInputRef = ref<HTMLInputElement | null>(null)
defineExpose({ formRef, fileInputRef })
</script>
