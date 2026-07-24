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
      :data="displayItems"
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
    <p v-if="!itemsFullLoaded && customerKeyword.trim()" class="accessory-dialog-hint">
      当前优先显示客户匹配辅料。清除客户筛选或输入名称可查找通用辅料。
    </p>
    <p v-else-if="itemsFullLoaded && !keyword.trim()" class="accessory-dialog-hint">
      显示最近 {{ displayItems.length }} 条。更多请用名称搜索。
    </p>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Search, User } from '@element-plus/icons-vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import { useIsMobile } from '@/composables/useIsMobile'
import type { AccessoryItem } from '@/api/inventory'

const { isMobile } = useIsMobile()

const props = defineProps<{
  modelValue: boolean
  loading: boolean
  items: AccessoryItem[]
  itemsFullLoaded?: boolean
  defaultCustomer?: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', item: AccessoryItem): void
  (e: 'search', query: { name: string; customerName: string }): void
}>()

const keyword = ref('')
const customerKeyword = ref('')
/** 打开弹窗写入 defaultCustomer 时跳过一轮远程搜索 */
const suppressSearch = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | null = null

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

function clearSearchTimer() {
  if (!searchTimer) return
  clearTimeout(searchTimer)
  searchTimer = null
}

function emitSearch() {
  emit('search', {
    name: keyword.value.trim(),
    customerName: customerKeyword.value.trim(),
  })
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      clearSearchTimer()
      suppressSearch.value = true
      keyword.value = ''
      customerKeyword.value = (props.defaultCustomer ?? '').trim()
      void nextTick(() => {
        suppressSearch.value = false
      })
    } else {
      clearSearchTimer()
    }
  },
)

watch([keyword, customerKeyword], ([nameKw], [prevName]) => {
  if (!props.modelValue || suppressSearch.value) return
  clearSearchTimer()
  const name = nameKw.trim()
  const prevNameTrim = String(prevName ?? '').trim()
  // 名称输入防抖；清空名称 / 改客户立即请求
  if (name && name !== prevNameTrim) {
    searchTimer = setTimeout(() => {
      searchTimer = null
      emitSearch()
    }, 280)
    return
  }
  emitSearch()
})

onBeforeUnmount(() => clearSearchTimer())

function customerRank(item: AccessoryItem, custKw: string): number {
  if (!custKw) return 1
  const itemCustomer = String(item.customerName ?? '').trim().toLowerCase()
  if (itemCustomer && itemCustomer.includes(custKw)) return 0
  if (!itemCustomer) return 1
  return 2
}

const displayItems = computed(() => {
  const nameKw = keyword.value.trim().toLowerCase()
  const custKw = customerKeyword.value.trim().toLowerCase()
  return props.items
    .filter((item) => {
      // 名称已由服务端过滤时仍做一次本地收紧，避免旧结果闪烁
      if (nameKw && !String(item.name ?? '').toLowerCase().includes(nameKw)) return false
      if (custKw) {
        const itemCustomer = String(item.customerName ?? '').trim()
        if (itemCustomer && !itemCustomer.toLowerCase().includes(custKw)) return false
      }
      return true
    })
    .slice()
    .sort((a, b) => customerRank(a, custKw) - customerRank(b, custKw))
})
</script>

<style scoped src="./dialog-select.css"></style>
<style scoped>
.accessory-dialog-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.4;
}
</style>
