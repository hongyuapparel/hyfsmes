<template>
  <div>
    <div class="filter-bar">
      <el-input
        v-model="filter.orderNo"
        placeholder="订单号"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getOrderNoFilterStyle(filter.orderNo, orderNoLabelVisible)"
        :input-style="getFilterInputStyle(filter.orderNo)"
        @input="emit('debounced-search')"
        @keyup.enter="emit('search', true)"
      >
        <template #prefix>
          <span v-if="filter.orderNo && orderNoLabelVisible" :style="{ color: activeFilterColor }">订单号：</span>
        </template>
      </el-input>
      <el-input
        v-model="filter.skuCode"
        placeholder="SKU"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getSkuCodeFilterStyle(filter.skuCode, skuCodeLabelVisible)"
        :input-style="getFilterInputStyle(filter.skuCode)"
        @input="emit('debounced-search')"
        @keyup.enter="emit('search', true)"
      >
        <template #prefix>
          <span v-if="filter.skuCode && skuCodeLabelVisible" :style="{ color: activeFilterColor }">SKU：</span>
        </template>
      </el-input>
      <el-select
        v-model="filter.customerName"
        placeholder="客户"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        @change="emit('search', true)"
      >
        <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-select
        v-model="filter.inventoryTypeId"
        placeholder="库存类型"
        filterable
        clearable
        size="large"
        class="filter-bar-item"
        @change="emit('search', true)"
      >
        <el-option v-for="opt in inventoryTypeOptions" :key="opt.id" :label="opt.label" :value="opt.id" />
      </el-select>
      <el-date-picker
        v-model="inboundDateRangeModel"
        type="daterange"
        range-separator=""
        start-placeholder="入库时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        size="large"
        :class="['filter-bar-item', 'filter-range', { 'range-single': !inboundDateRangeModel }]"
        :style="getFilterRangeStyle(inboundDateRangeModel)"
        @change="emit('search', true)"
      />
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="emit('search', true)">搜索</el-button>
        <el-button size="large" @click="emit('reset')">清空</el-button>
        <el-button type="primary" size="large" @click="emit('open-create')">新增库存</el-button>
        <el-button v-if="hasPendingSelection" type="primary" size="large" @click="emit('open-inbound')">
          入库
        </el-button>
        <el-button v-if="hasStoredSelection" type="warning" size="large" @click="emit('open-outbound')">
          出库
        </el-button>
      </div>
    </div>

    <div v-if="selectedRows.length" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <el-table
      v-loading="loading"
      :data="stockTableData"
      border
      stripe
      class="finished-table"
      :ref="tableRef"
      :row-key="getStockTableRowKey"
      :tree-props="{ children: '_children' }"
      :indent="8"
      :row-class-name="getFinishedStockRowClassName"
      :row-style="compactRowStyle"
      :cell-style="compactCellStyle"
      :header-cell-style="compactHeaderCellStyle"
      @header-dragend="handleHeaderDragEnd"
      @selection-change="emit('selection-change', $event)"
    >
      <el-table-column type="selection" width="48" align="center" :selectable="isSelectableStockRow" />
      <el-table-column
        v-for="column in stockPrimaryColumns"
        :key="column.prop"
        :prop="column.prop"
        :label="column.label"
        :min-width="column.minWidth"
        :width="column.width"
        :show-overflow-tooltip="column.prop !== 'createdAt'"
        align="center"
        header-align="center"
      />
      <el-table-column label="颜色" min-width="92" align="center" header-align="center">
        <template #default="{ row }">
          {{ getTableColorText(row) }}
        </template>
      </el-table-column>
      <el-table-column label="图片" :width="compactImageColumnMinWidth" align="center" header-align="center">
        <template #default="{ row }">
          <AppImageThumb
            v-if="getTableImageUrl(row)"
            :raw-url="getTableImageUrl(row)"
            :width="compactImageSize"
            :height="compactImageSize"
          />
          <span v-else class="text-placeholder">-</span>
        </template>
      </el-table-column>
      <el-table-column label="数量" width="90" align="center" header-align="center">
        <template #default="{ row }">
          <el-tooltip
            placement="top"
            effect="light"
            :show-after="250"
            :hide-after="0"
            :disabled="!qtyTooltipEnabled(row)"
            popper-class="finished-qty-popper"
            @show="onQtyTooltipShow(row)"
          >
            <template #content>
              <div class="qty-tooltip">
                <template v-if="isQtyTooltipLoading(row)">
                  <div class="qty-tooltip-loading">加载中...</div>
                </template>
                <template v-else-if="isQtyTooltipError(row)">
                  <div class="qty-tooltip-error">明细加载失败</div>
                </template>
                <template v-else>
                  <div v-if="getPreviewHeaders(row).length === 0 || getPreviewRows(row).length === 0" class="qty-tooltip-empty">
                    暂无明细
                  </div>
                  <div v-else class="qty-tooltip-grid">
                    <div class="qty-tooltip-row qty-tooltip-head">
                      <div class="qty-tooltip-cell qty-tooltip-color">颜色</div>
                      <div v-for="(h, idx) in getPreviewHeaders(row)" :key="idx" class="qty-tooltip-cell">{{ h }}</div>
                    </div>
                    <div v-for="(r, rIdx) in getPreviewRows(row)" :key="rIdx" class="qty-tooltip-row">
                      <div class="qty-tooltip-cell qty-tooltip-color">{{ r.colorName || '-' }}</div>
                      <div v-for="(v, vIdx) in r.values" :key="vIdx" class="qty-tooltip-cell qty-tooltip-num">
                        {{ formatDisplayNumber(v) }}
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </template>
            <span class="qty-hover">{{ formatDisplayNumber(row.quantity) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="出厂价" width="100" align="center" header-align="center">
        <template #default="{ row }">
          {{ getTableUnitPriceText(row) }}
        </template>
      </el-table-column>
      <el-table-column label="总价" width="100" align="center" header-align="center">
        <template #default="{ row }">
          {{ getTableGrandTotalText(row) }}
        </template>
      </el-table-column>
      <el-table-column label="库存类型" min-width="100" show-overflow-tooltip align="center" header-align="center">
        <template #default="{ row }">{{ findInventoryTypeLabelById(row.inventoryTypeId) || '-' }}</template>
      </el-table-column>
      <el-table-column label="仓库" min-width="90" show-overflow-tooltip align="center" header-align="center">
        <template #default="{ row }">{{ findWarehouseLabelById(row.warehouseId) || '-' }}</template>
      </el-table-column>
      <el-table-column
        v-for="column in stockTailColumns"
        :key="column.prop"
        :prop="column.prop"
        :label="column.label"
        :min-width="column.minWidth"
        :width="column.width"
        :show-overflow-tooltip="column.prop !== 'createdAt'"
        align="center"
        header-align="center"
      />
      <el-table-column label="操作" width="88" align="center" header-align="center" fixed="right">
        <template #default="{ row }">
          <el-button v-if="isStockTableLeafRow(row)" link type="primary" size="small" @click="emit('open-detail', row)">
            详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <AppPaginationBar
      :current-page="pagination.page"
      :page-size="pagination.pageSize"
      :total="pagination.total"
      :total-quantity="stockListFooterQuantity"
      :total-amount="stockListFooterAmount"
      unit="件"
      summary-label="总件数"
      @current-change="emit('current-change', $event)"
      @size-change="emit('page-size-change', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, type Ref } from 'vue'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { formatDisplayNumber } from '@/utils/display-number'
import { useFinishedViewColumns } from '@/composables/useFinishedViewColumns'
import { getFilterInputStyle, getOrderNoFilterStyle, getSkuCodeFilterStyle, getFilterRangeStyle } from '@/composables/useFilterBarHelpers'
import { isStockTableLeafRow, isStockTableParentRow, type StockTableLeafRow, type StockTableRow } from '@/utils/finishedStockTableUtils'
import AppPaginationBar from '@/components/AppPaginationBar.vue'

type FinishedStockFilter = {
  orderNo: string
  skuCode: string
  customerName: string
  inventoryTypeId: number | null
}

const props = defineProps<{
  filter: FinishedStockFilter
  orderNoLabelVisible: boolean
  skuCodeLabelVisible: boolean
  inboundDateRange: [string, string] | null
  customerOptions: Array<{ label: string; value: string }>
  inventoryTypeOptions: Array<{ id: number; label: string }>
  activeFilterColor: string
  hasPendingSelection: boolean
  hasStoredSelection: boolean
  selectedRows: StockTableLeafRow[]
  loading: boolean
  stockTableData: StockTableRow[]
  tableRef: Ref<unknown>
  compactHeaderCellStyle: unknown
  compactCellStyle: unknown
  compactRowStyle: unknown
  compactImageSize: number
  compactImageColumnMinWidth: number
  stockListFooterQuantity: number
  stockListFooterAmount: number
  pagination: { page: number; pageSize: number; total: number }
  findInventoryTypeLabelById: (id: number | null | undefined) => string
  findWarehouseLabelById: (id: number | null | undefined) => string
  getTableColorText: (row: StockTableRow) => string
  getTableImageUrl: (row: StockTableRow) => string
  getStockTableRowKey: (row: StockTableRow) => string
  getFinishedStockRowClassName: (payload: { row: StockTableRow }) => string
  isSelectableStockRow: (row: StockTableRow) => boolean
  qtyTooltipEnabled: (row: StockTableRow) => boolean
  onQtyTooltipShow: (row: StockTableRow) => void
  isQtyTooltipLoading: (row: StockTableRow) => boolean
  isQtyTooltipError: (row: StockTableRow) => boolean
  getPreviewHeaders: (row: StockTableRow) => string[]
  getPreviewRows: (row: StockTableRow) => Array<{ colorName: string; values: number[] }>
}>()

const emit = defineEmits<{
  (e: 'update:inboundDateRange', value: [string, string] | null): void
  (e: 'search', byUser: boolean): void
  (e: 'debounced-search'): void
  (e: 'reset'): void
  (e: 'open-create'): void
  (e: 'open-inbound'): void
  (e: 'open-outbound'): void
  (e: 'selection-change', rows: StockTableRow[]): void
  (e: 'open-detail', row: StockTableRow): void
  (e: 'current-change', page: number): void
  (e: 'page-size-change', pageSize: number): void
  (e: 'header-dragend', ...args: unknown[]): void
}>()

const { stockPrimaryColumns, stockTailColumns } = useFinishedViewColumns()

const inboundDateRangeModel = computed({
  get: () => props.inboundDateRange,
  set: (value: [string, string] | null) => emit('update:inboundDateRange', value),
})

function getTableUnitPriceText(row: StockTableRow): string {
  if (isStockTableParentRow(row) && row._mixedUnitPrice) return '多个'
  const n = Number(row.unitPrice ?? '')
  return Number.isFinite(n) ? `￥${formatDisplayNumber(n)}` : '￥0'
}

function getTableGrandTotalText(row: StockTableRow): string {
  if (isStockTableParentRow(row)) {
    const total = row._children.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0), 0)
    return `￥${formatDisplayNumber(total)}`
  }
  const total = (Number(row.quantity) || 0) * (Number(row.unitPrice) || 0)
  return Number.isFinite(total) ? `￥${formatDisplayNumber(total)}` : '￥0'
}

function handleHeaderDragEnd(...args: unknown[]) {
  emit('header-dragend', ...args)
}
</script>
