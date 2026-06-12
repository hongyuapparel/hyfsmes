<template>
  <AppDialog
    :model-value="visible"
    title="选货进箱"
    width="900px"
    @update:model-value="emit('update:visible', $event)"
    @open="onOpen"
  >
    <el-tabs v-model="tab" @tab-change="onTabChange">
      <el-tab-pane label="待仓处理" name="pending" />
      <el-tab-pane label="成品库存" name="finished" />
    </el-tabs>

    <el-form class="picker-toolbar" @submit.prevent>
      <el-input
        v-model="keyword"
        placeholder="款号 / 订单号"
        clearable
        class="picker-keyword"
        @keyup.enter="onSearch"
        @clear="onSearch"
      />
      <el-button type="primary" @click="onSearch">搜索</el-button>
      <span v-if="customerName" class="picker-customer-tip">客户：{{ customerName }}</span>
    </el-form>

    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="list"
      border
      height="420"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="44" align="center" :selectable="isSelectable" />
      <el-table-column prop="styleNo" label="款号" min-width="110" show-overflow-tooltip align="center" header-align="center" />
      <el-table-column prop="orderNo" label="订单号" min-width="110" show-overflow-tooltip align="center" header-align="center" />
      <el-table-column label="颜色图" width="70" align="center" header-align="center">
        <template #default="{ row }">
          <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" :width="40" :height="40" />
          <span v-else class="text-placeholder">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="colorName" label="颜色" min-width="90" show-overflow-tooltip align="center" header-align="center">
        <template #default="{ row }">{{ row.colorName || '-' }}</template>
      </el-table-column>
      <el-table-column label="各码可发" min-width="180" align="center" header-align="center">
        <template #default="{ row }">
          <span v-if="row.hasSnapshot">{{ formatSizes(row) }}</span>
          <span v-else class="text-placeholder">不分码（{{ formatDisplayNumber(row.totalQty) }} 件）</span>
        </template>
      </el-table-column>
      <el-table-column label="合计" width="80" align="center" header-align="center">
        <template #default="{ row }">{{ formatDisplayNumber(row.totalQty) }}</template>
      </el-table-column>
      <el-table-column label="已分配" width="100" align="center" header-align="center">
        <template #default="{ row }">
          <el-tag v-if="allocatedQty(row) > 0" :type="remainingQty(row) > 0 ? 'warning' : 'info'" size="small">
            {{ remainingQty(row) > 0 ? `已配 ${allocatedQty(row)}` : '已配完' }}
          </el-tag>
          <span v-else class="text-placeholder">-</span>
        </template>
      </el-table-column>
    </el-table>

    <AppPaginationBar
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      @current-change="load"
      @size-change="onPageSizeChange"
    />

    <template #footer>
      <el-button @click="emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :disabled="!selectedRows.length" @click="onConfirm">
        加入本箱{{ selectedRows.length ? `（${selectedRows.length} 行）` : '' }}
      </el-button>
    </template>
  </AppDialog>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import AppDialog from '@/components/AppDialog.vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import { formatDisplayNumber } from '@/utils/display-number'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getPickableFinished, getPickablePending, type PickableLine } from '@/api/packing-lists'
import { allocationKey } from '@/composables/usePackingGridRows'

const props = defineProps<{
  visible: boolean
  customerName: string
  /** 已分配数量（来自表格汇总），key 为 sourceType:sourceId:colorName */
  allocation: Map<string, { totalQty: number; sizeQuantities: Record<string, number> }>
}>()

const emit = defineEmits<{
  'update:visible': [visible: boolean]
  picked: [lines: PickableLine[]]
}>()

const tab = ref<'pending' | 'finished'>('pending')
const keyword = ref('')
const list = ref<PickableLine[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<PickableLine[]>([])

function lineKey(line: PickableLine): string {
  return allocationKey(line.sourceType, line.sourceId, line.colorName)
}

function allocatedQty(line: PickableLine): number {
  return props.allocation.get(lineKey(line))?.totalQty ?? 0
}

function remainingQty(line: PickableLine): number {
  return Math.max(0, line.totalQty - allocatedQty(line))
}

function isSelectable(line: PickableLine): boolean {
  return remainingQty(line) > 0
}

function formatSizes(line: PickableLine): string {
  const parts = Object.entries(line.sizeQuantities).map(([size, qty]) => `${size}×${qty}`)
  return parts.length ? parts.join('  ') : '-'
}

async function load() {
  loading.value = true
  try {
    const fetcher = tab.value === 'pending' ? getPickablePending : getPickableFinished
    const res = await fetcher({
      customerName: props.customerName || undefined,
      keyword: keyword.value || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    list.value = res.data.list
    pagination.total = res.data.total
  } catch (e) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载可选货失败'))
  } finally {
    loading.value = false
  }
}

function onOpen() {
  pagination.page = 1
  keyword.value = ''
  load()
}

function onTabChange() {
  pagination.page = 1
  load()
}

function onSearch() {
  pagination.page = 1
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function onSelectionChange(rows: PickableLine[]) {
  selectedRows.value = rows
}

function onConfirm() {
  if (!selectedRows.value.length) return
  emit('picked', [...selectedRows.value])
  emit('update:visible', false)
}
</script>

<style scoped>
.picker-toolbar {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.picker-keyword {
  width: 220px;
}

.picker-customer-tip {
  color: var(--color-text-secondary);
  font-size: var(--font-size-caption);
}
</style>
