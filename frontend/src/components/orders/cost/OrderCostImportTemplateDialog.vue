<template>
    <AppDialog
      :model-value="importDialogVisible"
      title="导入工序模板"
      width="400px"
      @close="() => emit('importDialogClose')"
      @update:model-value="(value) => emit('updateImportDialogVisible', value)"
    >
      <p class="import-template-hint">选择服装类型模板，将其中工序一键填入下方表格，再按款式做个别增减。</p>
      <el-select
        :model-value="importTemplateId"
        placeholder="选择模板"
        filterable
        clearable
        style="width: 100%"
        @update:model-value="(value) => emit('updateImportTemplateId', value as number | null)"
      >
        <el-option
          v-for="t in importTemplateOptions"
          :key="t.id"
          :label="t.name"
          :value="t.id"
        />
      </el-select>
      <template #footer>
        <el-button @click="emit('updateImportDialogVisible', false)">取消</el-button>
        <el-button type="primary" :disabled="!importTemplateId" @click="$emit('applyImportTemplate')">
          确定导入
        </el-button>
      </template>
    </AppDialog>
</template>

<script setup lang="ts">
defineProps<{
  importTemplateOptions: Array<{ id: number; name: string }>
  importDialogVisible: boolean
  importTemplateId: number | null
}>()
const emit = defineEmits<{
  updateImportDialogVisible: [value: boolean]
  updateImportTemplateId: [value: number | null]
  applyImportTemplate: []
  importDialogClose: []
}>()
</script>
