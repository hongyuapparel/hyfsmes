<template>
  <div class="tab-pane-scroll">
    <el-form class="filter-bar" @submit.prevent>
      <el-input
        v-model="filter.name"
        placeholder="面料名称"
        clearable
        class="filter-bar-item"
        @keyup.enter="search"
      />
      <el-select v-model="filter.customerName" placeholder="客户" filterable clearable class="filter-bar-item" @change="search">
        <el-option v-for="option in customerOptions" :key="option.value" :label="option.label" :value="option.value" />
      </el-select>
      <el-select v-model="filter.inventoryTypeId" placeholder="库存类型" filterable clearable class="filter-bar-item" @change="search">
        <el-option v-for="option in inventoryTypeOptions" :key="option.id" :label="option.label" :value="option.id" />
      </el-select>
      <el-date-picker
        v-model="filter.dateRange"
        type="daterange"
        class="filter-bar-item"
        start-placeholder="出库时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        @change="search"
      />
      <div class="filter-bar-actions">
        <el-button type="primary" @click="search">搜索</el-button>
        <el-button @click="reset">清空</el-button>
      </div>
    </el-form>

    <div ref="shellRef" class="list-page-table-shell">
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="list"
        border
        stripe
        class="fabric-table"
        :height="tableHeight"
        :row-style="compactRowStyle"
        :cell-style="compactCellStyle"
        :header-cell-style="compactHeaderCellStyle"
        @header-dragend="onHeaderDragEnd"
      >
        <el-table-column prop="createdAt" label="时间" width="160" align="center" />
        <el-table-column prop="name" label="面料名称" min-width="150" show-overflow-tooltip align="center" />
        <el-table-column prop="inventoryTypeLabel" label="库存类型" min-width="120" show-overflow-tooltip align="center" />
        <el-table-column prop="customerName" label="客户" min-width="130" show-overflow-tooltip align="center" />
        <el-table-column prop="pickupUserName" label="领取人" min-width="100" show-overflow-tooltip align="center" />
        <el-table-column label="出库数量" width="110" align="center">
          <template #default="{ row }">
            {{ formatDisplayNumber(row.quantity) }} {{ row.unit || '（单位未记录）' }}
          </template>
        </el-table-column>
        <el-table-column label="实际成本单价" width="130" align="right">
          <template #default="{ row }">{{ row.unitPrice == null ? '未计价' : formatMoneyAligned(row.unitPrice) }}</template>
        </el-table-column>
        <el-table-column label="出库金额" width="130" align="right">
          <template #default="{ row }">{{ row.amount == null ? '未计价' : formatMoneyAligned(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="remark" label="备注" min-width="180" show-overflow-tooltip align="center" />
        <el-table-column label="照片" :width="compactImageColumnMinWidth" align="center">
          <template #default="{ row }">
            <AppImageThumb
              v-if="row.photoUrl"
              :raw-url="row.photoUrl"
              :width="compactImageSize"
              :height="compactImageSize"
            />
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <AppPaginationBar
      v-model:current-page="pagination.page"
      v-model:page-size="pagination.pageSize"
      :total="pagination.total"
      :total-quantity="totalQuantity"
      :total-amount="totalAmount"
      :secondary-quantity="unpricedQuantity"
      :secondary-label="`未计价（${unpricedCount}条）`"
      summary-label="出库数量"
      total-amount-label="已计价金额"
      @current-change="load"
      @size-change="pageSizeChanged"
    />
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getFabricOutboundRecords, type FabricOutboundRecord } from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { formatDisplayNumber, formatMoneyAligned } from '@/utils/display-number'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import AppImageThumb from '@/components/AppImageThumb.vue'
import AppPaginationBar from '@/components/AppPaginationBar.vue'

defineProps<{
  customerOptions: Array<{ label: string; value: string }>
  inventoryTypeOptions: Array<{ id: number; label: string }>
}>()

const filter = reactive<{ name: string; customerName: string; inventoryTypeId: number | null; dateRange: [string, string] | [] }>({
  name: '', customerName: '', inventoryTypeId: null, dateRange: [],
})
const list = ref<FabricOutboundRecord[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const totalQuantity = ref(0)
const totalAmount = ref(0)
const unpricedCount = ref(0)
const unpricedQuantity = ref(0)
const tableRef = ref()
const shellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(shellRef)
const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('inventory-fabric-outbounds')
const { compactHeaderCellStyle, compactCellStyle, compactRowStyle, compactImageSize, compactImageColumnMinWidth } = useCompactTableStyle()

async function load() {
  loading.value = true
  try {
    const [startDate, endDate] = filter.dateRange.length === 2 ? filter.dateRange : ['', '']
    const { data } = await getFabricOutboundRecords({
      name: filter.name || undefined,
      customerName: filter.customerName || undefined,
      inventoryTypeId: filter.inventoryTypeId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    list.value = data?.list ?? []
    pagination.total = data?.total ?? 0
    totalQuantity.value = data?.totalQuantity ?? 0
    totalAmount.value = data?.totalAmount ?? 0
    unpricedCount.value = data?.unpricedCount ?? 0
    unpricedQuantity.value = data?.unpricedQuantity ?? 0
    restoreColumnWidths(tableRef.value)
  } catch (error: unknown) {
    if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
  } finally {
    loading.value = false
  }
}

function search() {
  pagination.page = 1
  void load()
}

function reset() {
  Object.assign(filter, { name: '', customerName: '', inventoryTypeId: null, dateRange: [] })
  search()
}

function pageSizeChanged() {
  pagination.page = 1
  void load()
}

onMounted(load)
defineExpose({ load })
</script>

<style scoped>
.fabric-table { flex: 1; min-height: 0; }
.fabric-table :deep(.cell) { padding-left: 6px; padding-right: 6px; line-height: 20px; }
.fabric-table :deep(td.el-table__cell) { height: 52px; }
</style>
