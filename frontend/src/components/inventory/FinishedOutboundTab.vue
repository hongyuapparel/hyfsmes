<template>
  <div class="finished-outbound-tab-root">
    <div class="filter-bar">
      <el-input
        v-model="outboundFilter.orderNo"
        placeholder="订单号"
        clearable
        size="large"
        class="filter-bar-item"
        @keyup.enter="emit('search', true)"
      />
      <el-input
        v-model="outboundFilter.skuCode"
        placeholder="SKU"
        clearable
        size="large"
        class="filter-bar-item"
        @keyup.enter="emit('search', true)"
      />
      <el-select
        v-model="outboundFilter.customerName"
        placeholder="客户"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        @change="emit('search', true)"
      >
        <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-date-picker
        v-model="dateRangeModel"
        type="daterange"
        range-separator=""
        start-placeholder="出库时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        size="large"
        :class="['filter-bar-item', { 'range-single': !(dateRangeModel && dateRangeModel.length === 2) }]"
        :style="getInventoryOutboundRangeStyle(dateRangeModel)"
        @change="emit('search', true)"
      />
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="emit('search', true)">搜索</el-button>
        <el-button size="large" @click="emit('reset')">清空</el-button>
      </div>
    </div>

    <div ref="outboundShellRef" class="list-page-table-shell">
    <el-table
      v-loading="loading"
      :data="outboundList"
      border
      stripe
      class="finished-table"
      :ref="tableRef"
      :height="outboundTableHeight"
      :row-style="compactRowStyle"
      :cell-style="compactCellStyle"
      :header-cell-style="compactHeaderCellStyle"
      @header-dragend="handleHeaderDragEnd"
    >
      <el-table-column
        v-for="column in outboundPrimaryColumns"
        :key="column.prop"
        :prop="column.prop"
        :label="column.label"
        :min-width="column.minWidth"
        :width="column.width"
        :show-overflow-tooltip="column.prop !== 'createdAt'"
        align="center"
      />
      <el-table-column label="图片" :width="compactImageColumnMinWidth" align="center">
        <template #default="{ row }">
          <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" :width="compactImageSize" :height="compactImageSize" />
          <span v-else class="text-placeholder">-</span>
        </template>
      </el-table-column>
      <el-table-column label="出库数量" width="90" align="right">
        <template #default="{ row }">
          <el-tooltip
            v-if="row.sizeBreakdown?.headers?.length && row.sizeBreakdown?.rows?.length"
            placement="top"
            effect="light"
            popper-class="finished-qty-popper"
          >
            <template #content>
              <div class="qty-tooltip">
                <div class="qty-tooltip-grid">
                  <div class="qty-tooltip-row qty-tooltip-head">
                    <div class="qty-tooltip-cell qty-tooltip-color">颜色</div>
                    <div v-for="(h, idx) in row.sizeBreakdown.headers" :key="idx" class="qty-tooltip-cell">{{ h }}</div>
                  </div>
                  <div v-for="(r, rIdx) in row.sizeBreakdown.rows" :key="rIdx" class="qty-tooltip-row">
                    <div class="qty-tooltip-cell qty-tooltip-color">{{ r.colorName || '-' }}</div>
                    <div v-for="(v, vIdx) in r.quantities" :key="vIdx" class="qty-tooltip-cell qty-tooltip-num">{{ v }}</div>
                  </div>
                </div>
              </div>
            </template>
            <span class="qty-hover">{{ formatDisplayNumber(row.quantity) }}</span>
          </el-tooltip>
          <span v-else>{{ formatDisplayNumber(row.quantity) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="库存类型" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">{{ findInventoryTypeLabelById(row.inventoryTypeId) || '-' }}</template>
      </el-table-column>
      <el-table-column label="仓库" min-width="90" show-overflow-tooltip>
        <template #default="{ row }">{{ findWarehouseLabelById(row.warehouseId) || '-' }}</template>
      </el-table-column>
      <el-table-column
        v-for="column in outboundTailColumns"
        :key="column.prop"
        :prop="column.prop"
        :label="column.label"
        :min-width="column.minWidth"
        :width="column.width"
        show-overflow-tooltip
      />
    </el-table>
    </div>

    <AppPaginationBar
      :current-page="outboundPagination.page"
      :page-size="outboundPagination.pageSize"
      :total="outboundPagination.total"
      :total-quantity="outboundPageTotalQuantity"
      summary-label="出库数量"
      unit="件"
      @current-change="emit('current-change', $event)"
      @size-change="emit('page-size-change', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, type Ref } from 'vue'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { formatDisplayNumber } from '@/utils/display-number'
import { useFinishedViewColumns } from '@/composables/useFinishedViewColumns'
import type { FinishedOutboundRecord } from '@/api/inventory'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'

type OutboundFilter = {
  orderNo: string
  skuCode: string
  customerName: string
  dateRange: [string, string] | []
}

const props = defineProps<{
  outboundFilter: OutboundFilter
  customerOptions: Array<{ label: string; value: string }>
  loading: boolean
  outboundList: FinishedOutboundRecord[]
  outboundPagination: { page: number; pageSize: number; total: number }
  tableRef: Ref<unknown>
  compactHeaderCellStyle: unknown
  compactCellStyle: unknown
  compactRowStyle: unknown
  compactImageSize: number
  compactImageColumnMinWidth: number
  findInventoryTypeLabelById: (id: number | null | undefined) => string
  findWarehouseLabelById: (id: number | null | undefined) => string
}>()

const emit = defineEmits<{
  (e: 'update:dateRange', value: [string, string] | []): void
  (e: 'search', byUser: boolean): void
  (e: 'reset'): void
  (e: 'current-change', page: number): void
  (e: 'page-size-change', pageSize: number): void
  (e: 'header-dragend', ...args: unknown[]): void
}>()

const outboundShellRef = ref<HTMLElement | null>(null)
const { tableHeight: outboundTableHeight } = useFlexShellTableHeight(outboundShellRef)

const { outboundPrimaryColumns, outboundTailColumns, getInventoryOutboundRangeStyle } = useFinishedViewColumns()

const dateRangeModel = computed({
  get: () => props.outboundFilter.dateRange,
  set: (value: [string, string] | []) => emit('update:dateRange', value),
})

const outboundPageTotalQuantity = computed(() =>
  props.outboundList.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0),
)

function handleHeaderDragEnd(...args: unknown[]) {
  emit('header-dragend', ...args)
}
</script>

<style scoped>
.finished-outbound-tab-root {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
