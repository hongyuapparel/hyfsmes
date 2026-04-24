<template>
  <el-dialog v-model="visible" title="选择客户" width="860px">
    <div class="customer-dialog-filter">
      <el-input
        v-model="keyword"
        placeholder="输入客户编号/国家/公司名称/联系人/业务员进行模糊搜索"
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
      <el-table-column prop="customerId" label="客户编号" min-width="120">
        <template #default="{ row }">
          {{ row.customerId || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="country" label="国家" min-width="120">
        <template #default="{ row }">
          {{ row.country || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="companyName" label="公司名称" min-width="180" />
      <el-table-column prop="contactPerson" label="联系人" min-width="120">
        <template #default="{ row }">
          {{ row.contactPerson || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="salesperson" label="业务员" min-width="120">
        <template #default="{ row }">
          {{ row.salesperson || '-' }}
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
