<template>
  <AppDialog
    v-model="visible"
    title="分配纸样师和车版师"
    width="420"
    destroy-on-close
    @close="emit('close')"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
      <el-form-item label="纸样师" prop="patternMaster">
        <el-select
          v-model="form.patternMaster"
          placeholder="请选择纸样师"
          clearable
          filterable
          style="width: 100%"
        >
          <el-option v-for="e in patternMasterOptions" :key="e.id" :label="e.name" :value="e.name" />
        </el-select>
      </el-form-item>
      <el-form-item label="车版师" prop="sampleMaker">
        <el-select
          v-model="form.sampleMaker"
          placeholder="请选择车版师"
          clearable
          filterable
          style="width: 100%"
        >
          <el-option v-for="e in sampleMakerOptions" :key="e.id" :label="e.name" :value="e.name" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleConfirm">确定</el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import type { StaffOptionItem } from '@/api/hr'

const props = defineProps<{
  modelValue: boolean
  form: { patternMaster: string; sampleMaker: string }
  rules: FormRules
  patternMasterOptions: StaffOptionItem[]
  sampleMakerOptions: StaffOptionItem[]
  submitting: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  close: []
  submit: []
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => emit('update:modelValue', v))

const formRef = ref<FormInstance>()

async function handleConfirm() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  emit('submit')
}

defineExpose({ formRef })
</script>
