<template>
  <el-dialog
    :model-value="modelValue"
    title="选择 SKU"
    width="720px"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <div class="sku-dialog-filter">
      <el-input
        v-model="keyword"
        placeholder="输入 SKU 编号或客户名称进行模糊搜索"
        clearable
        size="small"
        @update:model-value="$emit('keyword-change', $event)"
      />
    </div>
    <el-table
      v-loading="loading"
      :data="items"
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
      <el-table-column prop="skuCode" label="SKU 编号" min-width="140" />
      <el-table-column prop="productName" label="产品名称" min-width="160" />
      <el-table-column prop="customerName" label="客户" min-width="160">
        <template #default="{ row }">
          {{ row.customerName || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" align="center">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="$emit('select', row)">选择</el-button>
        </template>
      </el-table-column>
    </el-table>
    <div class="dialog-pagination">
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        small
        background
        layout="total, sizes, prev, pager, next"
        :total="total"
        :page-sizes="[20, 50, 100]"
        @current-change="$emit('page-change', $event)"
        @size-change="$emit('page-size-change', $event)"
      />
    </div>
    <template #footer>
      <el-button @click="$emit('update:modelValue', false)">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import AppImageThumb from '@/components/AppImageThumb.vue'

const props = defineProps<{
  modelValue: boolean
  loading: boolean
  items: any[]
  total: number
  page: number
  pageSize: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'select', row: any): void
  (e: 'page-change', page: number): void
  (e: 'page-size-change', pageSize: number): void
  (e: 'keyword-change', keyword: string): void
}>()

const keyword = ref('')

watch(keyword, (val) => {
  emit('keyword-change', val)
})
</script>
