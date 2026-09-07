<template>
    <AppDialog
      :model-value="saveDialogVisible"
      title="保存为工序报价模板"
      width="420px"
      @close="$emit('saveDialogClose')"
      @update:model-value="(value) => emit('updateSaveDialogVisible', value)"
    >
      <el-input
        :model-value="saveDialogName"
        placeholder="请输入模板名称（如：卫衣-基础版）"
        maxlength="40"
        show-word-limit
        @update:model-value="(value) => emit('updateSaveDialogName', String(value ?? ''))"
      />
      <template #footer>
        <el-button :disabled="saveDialogSubmitting" @click="emit('updateSaveDialogVisible', false)">取消</el-button>
        <el-button
          type="primary"
          :loading="saveDialogSubmitting"
          :disabled="!saveDialogName.trim()"
          @click="$emit('saveCurrentTemplate')"
        >
          保存
        </el-button>
      </template>
    </AppDialog>
</template>

<script setup lang="ts">
defineProps<{
  saveDialogVisible: boolean
  saveDialogName: string
  saveDialogSubmitting: boolean
}>()
const emit = defineEmits<{
  updateSaveDialogVisible: [value: boolean]
  updateSaveDialogName: [value: string]
  saveCurrentTemplate: []
  saveDialogClose: []
}>()
</script>
