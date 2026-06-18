<template>
  <AppDialog v-model="visible" title="选择辅料" width="720px">
    <div class="accessory-dialog-filter">
      <el-input
        v-model="customerKeyword"
        class="accessory-dialog-filter-customer"
        placeholder="按客户筛选（留空看全部）"
        clearable
        size="small"
      >
        <template #prefix>
          <el-icon><User /></el-icon>
        </template>
      </el-input>
      <el-input
        v-model="keyword"
        placeholder="按名称模糊搜索"
        clearable
        size="small"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>
    </div>
    <el-table
      v-loading="loading"
      :data="filteredItems"
      class="dialog-select-table"
      height="360px"
      border
    >
      <el-table-column label="图片" :width="isMobile ? 76 : 90">
        <template #default="{ row }">
          <AppImageThumb
            v-if="row.imageUrl"
            :raw-url="row.imageUrl"
            variant="dialog"
            :width="isMobile ? 48 : undefined"
            :height="isMobile ? 48 : undefined"
          />
          <span v-else>无</span>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="名称" :min-width="isMobile ? 96 : 140" />
      <el-table-column prop="category" label="类别" :width="isMobile ? 72 : 120" />
      <el-table-column prop="customerName" label="客户" :min-width="isMobile ? 96 : 140" />
      <el-table-column label="操作" :width="isMobile ? 56 : 90" align="center">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="emit('select', row)">选择</el-button>
        </template>
      </el-table-column>
    </el-table>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Search, User } from '@element-plus/icons-vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import type { AccessoryItem } from '@/api/inventory'

const { isMobile } = useIsMobile()

const props = defineProps<{
  modelValue: boolean
  loading: boolean
  items: AccessoryItem[]
  defaultCustomer?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', item: AccessoryItem): void
}>()

const keyword = ref('')
const customerKeyword = ref('')

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      keyword.value = ''
      customerKeyword.value = (props.defaultCustomer ?? '').trim()
    }
  },
)

const filteredItems = computed(() => {
  const nameKw = keyword.value.trim().toLowerCase()
  const custKw = customerKeyword.value.trim().toLowerCase()
  return props.items.filter((item) => {
    if (nameKw && !String(item.name ?? '').toLowerCase().includes(nameKw)) return false
    if (custKw) {
      const itemCustomer = String(item.customerName ?? '').trim()
      // 客户匹配：命中该客户，或未绑定客户的通用辅料
      if (itemCustomer && !itemCustomer.toLowerCase().includes(custKw)) return false
    }
    return true
  })
})
</script>

<style scoped src="./dialog-select.css"></style>
