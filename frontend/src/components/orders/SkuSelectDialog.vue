<template>
  <el-dialog v-model="visible" title="选择 SKU" width="720px">
    <div class="sku-dialog-filter">
      <el-input
        v-model="keyword"
        placeholder="输入 SKU 编号或客户名称进行模糊搜索"
        clearable
        size="small"
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
          <el-button type="primary" link size="small" @click="emit('select', row)">选择</el-button>
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
        @current-change="(value) => emit('page-change', value)"
        @size-change="(value) => emit('page-size-change', value)"
      />
    </div>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', item: any): void
  (e: 'keyword-change', keyword: string): void
  (e: 'page-change', page: number): void
  (e: 'page-size-change', size: number): void
}>()

const keyword = ref('')

const visible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit('update:modelValue', value),
})

watch(keyword, (value) => {
  emit('keyword-change', value)
})
</script>

<style scoped src="./dialog-select.css"></style>
