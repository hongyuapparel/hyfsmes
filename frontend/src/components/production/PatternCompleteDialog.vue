<template>
  <AppDialog
    v-model="visible"
    :title="mode === 'edit' ? '修改样品图片' : '确认完成'"
    width="480"
    :show-close="!submitting && !uploading"
    :close-on-press-escape="!submitting && !uploading"
    destroy-on-close
    @close="emit('close')"
  >
    <div v-if="batch" class="complete-brief">
      <div>将完成所选的 {{ rows.length }} 张订单：</div>
      <div>{{ rows.map((item) => item.orderNo).join('、') }}</div>
      <div>保留各订单已有的样品图片；如需上传，请逐单完成或完成后编辑。</div>
    </div>
    <div v-else-if="row" class="complete-brief">
      <div>订单号：{{ row.orderNo }}</div>
      <div>SKU：{{ row.skuCode }}</div>
    </div>
    <el-alert v-if="mode === 'complete'" title="完成前会检查已保存的物料名称和单件用量，缺项的订单不能完成。" type="info" :closable="false" />
    <el-alert v-if="error" type="error" :closable="false"><div role="alert" style="white-space: pre-line; max-height: 240px; overflow: auto">{{ error }}</div></el-alert>
    <div v-if="!batch" class="complete-hint">{{ mode === 'edit' ? '修改样品图片，不改变完成时间和订单状态' : '样品图片可选：不上传也可以完成纸样' }}</div>
    <el-form v-if="!batch" :disabled="submitting || uploading" ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="样品图片" prop="sampleImageUrl">
        <div class="sample-image-upload" @click="!submitting && !uploading && emit('trigger-upload')">
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
      <el-button :disabled="submitting || uploading" @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" :disabled="uploading" @click="emit('submit')">
        {{ mode === 'edit' ? '保存图片' : '确认完成' }}
      </el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { PatternListItem } from '@/api/production-pattern'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    row: PatternListItem | null
    form: { sampleImageUrl: string }
    rules: FormRules
    submitting: boolean
    rows: PatternListItem[]
    batch: boolean
    error: string
    uploading: boolean
    mode?: 'complete' | 'edit'
  }>(),
  { mode: 'complete' },
)

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
