<template>
  <el-dialog
    :model-value="modelValue"
    title="选择辅料"
    width="720px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="accessory-dialog-filter">
      <el-input
        v-model="keyword"
        placeholder="输入名称 / 类别 / 客户名进行模糊搜索"
        clearable
        size="small"
      />
    </div>
    <el-table
      v-loading="loading"
      :data="filteredItems"
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
          <el-button type="primary" link size="small" @click="$emit('select', row)">选择</el-button>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import AppImageThumb from '@/components/AppImageThumb.vue'

const props = defineProps<{
  modelValue: boolean
  loading: boolean
  items: any[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', row: any): void
}>()

const keyword = ref('')

const filteredItems = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return props.items
  return props.items.filter((item) => {
    const name = item.name?.toLowerCase?.() ?? ''
    const category = item.category?.toLowerCase?.() ?? ''
    const customer = item.customerName?.toLowerCase?.() ?? ''
    return name.includes(kw) || category.includes(kw) || customer.includes(kw)
  })
})
</script>
