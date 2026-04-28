<template>
  <el-dialog v-model="visible" title="选择辅料" width="720px">
    <div class="accessory-dialog-filter">
      <el-input
        v-model="keyword"
        placeholder="输入名称进行模糊搜索"
        clearable
        size="small"
      />
    </div>
    <el-table
      v-loading="loading"
      :data="filteredItems"
      class="dialog-select-table"
      height="360px"
      border
    >
      <el-table-column label="图片" width="90">
        <template #default="{ row }">
          <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" variant="dialog" />
          <span v-else>无</span>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" min-width="140" />
      <el-table-column prop="category" label="类别" width="120" />
      <el-table-column prop="customerName" label="客户" min-width="140" />
      <el-table-column label="操作" width="90" align="center">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="emit('select', row)">选择</el-button>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AppImageThumb from '@/components/AppImageThumb.vue'

interface AccessoryDialogItem {
  id: number
  name: string
  unit?: string
  [key: string]: any
}

const props = defineProps<{
  modelValue: boolean
  loading: boolean
  items: AccessoryDialogItem[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', item: AccessoryDialogItem): void
}>()

const keyword = ref('')

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

const filteredItems = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return props.items
  return props.items.filter((item) => String(item.name ?? '').toLowerCase().includes(kw))
})
</script>

<style scoped src="./dialog-select.css"></style>
