<template>
    <AppDialog
      :model-value="importOrderDialogVisible"
      title="从订单导入生产工序成本"
      width="760px"
      @close="$emit('importOrderDialogClose')"
      @update:model-value="(value) => emit('updateImportOrderDialogVisible', value)"
    >
      <div class="import-order-search">
        <el-input
          :model-value="importOrderKeyword"
          placeholder="输入订单号 / SKU 搜索"
          clearable
          class="import-order-search-input"
          @update:model-value="(value) => emit('updateImportOrderKeyword', String(value ?? ''))"
          @keyup.enter="emit('searchImportOrders')"
        />
        <el-button type="primary" :loading="importOrderLoading" @click="emit('searchImportOrders')">
          搜索
        </el-button>
      </div>
      <el-table
        :data="importOrderResults"
        v-loading="importOrderLoading"
        row-key="id"
        size="small"
        class="import-order-table"
      >
        <el-table-column label="图片" width="78" align="center">
          <template #default="{ row }">
            <AppImageThumb
              v-if="row.imageUrl"
              :raw-url="row.imageUrl"
              :width="48"
              :height="48"
              empty-text="-"
              preview-disabled
            />
            <span v-else class="import-order-empty">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="orderNo" label="订单号" min-width="130" />
        <el-table-column prop="skuCode" label="SKU" min-width="130" />
        <el-table-column label="状态" min-width="110">
          <template #default="{ row }">
            <el-tag size="small" effect="light" :type="getImportOrderStatusTagType(row.status)">
              {{ getImportOrderStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="82" align="center">
          <template #default="{ row }">
            <el-tag v-if="importOrderSelectedId === row.id" size="small" type="success">已选</el-tag>
            <el-button v-else link type="primary" size="small" @click="emit('updateImportOrderSelectedId', row.id)">
              选择
            </el-button>
          </template>
        </el-table-column>
        <template #empty>
          <span>{{ importOrderKeyword.trim() ? '未找到匹配订单' : '输入订单号或 SKU 后搜索' }}</span>
        </template>
      </el-table>
      <template #footer>
        <el-button :disabled="importOrderApplying" @click="emit('updateImportOrderDialogVisible', false)">取消</el-button>
        <el-button
          type="primary"
          :loading="importOrderApplying"
          :disabled="!importOrderSelectedId"
          @click="$emit('applyImportOrder')"
        >
          确定导入
        </el-button>
      </template>
    </AppDialog>
</template>

<script setup lang="ts">
import type { OrderListItem } from '@/api/orders'
import AppImageThumb from '@/components/AppImageThumb.vue'
defineProps<{
  importOrderDialogVisible: boolean
  importOrderKeyword: string
  importOrderLoading: boolean
  importOrderApplying: boolean
  importOrderResults: OrderListItem[]
  importOrderSelectedId: number | null
  getImportOrderStatusLabel: (status: string) => string
  getImportOrderStatusTagType: (status: string) => 'success' | 'warning' | 'info' | 'danger' | 'primary' | undefined
}>()
const emit = defineEmits<{
  updateImportOrderDialogVisible: [value: boolean]
  updateImportOrderKeyword: [value: string]
  updateImportOrderSelectedId: [value: number | null]
  searchImportOrders: []
  applyImportOrder: []
  importOrderDialogClose: []
}>()
</script>
