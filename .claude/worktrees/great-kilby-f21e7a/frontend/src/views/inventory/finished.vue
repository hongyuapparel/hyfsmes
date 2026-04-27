<template>
  <div class="page-card inventory-finished-page">
    <el-tabs v-model="pageTab" class="inventory-tabs" @tab-change="onPageTabChange">
      <el-tab-pane label="库存" name="stock">
        <div class="filter-bar">
          <el-input
            v-model="filter.orderNo"
            placeholder="订单号"
            clearable
            size="large"
            class="filter-bar-item"
            :style="getOrderNoFilterStyle(filter.orderNo, orderNoLabelVisible)"
            :input-style="getFilterInputStyle(filter.orderNo)"
            @input="debouncedSearch"
            @keyup.enter="onSearch(true)"
          >
            <template #prefix>
              <span
                v-if="filter.orderNo && orderNoLabelVisible"
                :style="{ color: ACTIVE_FILTER_COLOR }"
              >
                订单号：
              </span>
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
            @input="debouncedSearch"
            @keyup.enter="onSearch(true)"
          >
            <template #prefix>
              <span
                v-if="filter.skuCode && skuCodeLabelVisible"
                :style="{ color: ACTIVE_FILTER_COLOR }"
              >
                SKU：
              </span>
            </template>
          </el-input>
          <el-select
            v-model="filter.customerName"
            placeholder="客户"
            filterable
            clearable
            size="large"
            class="filter-bar-item"
            @change="onSearch(true)"
          >
            <el-option
              v-for="opt in customerOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <el-select
            v-model="filter.inventoryTypeId"
            placeholder="库存类型"
            filterable
            clearable
            size="large"
            class="filter-bar-item"
            @change="onSearch(true)"
          >
            <el-option
              v-for="opt in inventoryTypeOptions"
              :key="opt.id"
              :label="opt.label"
              :value="opt.id"
            />
          </el-select>
          <el-date-picker
            v-model="inboundDateRange"
            type="daterange"
            range-separator=""
            start-placeholder="入库时间"
            end-placeholder=""
            value-format="YYYY-MM-DD"
            :shortcuts="rangeShortcuts"
            unlink-panels
            clearable
            size="large"
            :class="['filter-bar-item', 'filter-range', { 'range-single': !inboundDateRange }]"
            :style="getFilterRangeStyle(inboundDateRange)"
            @change="onSearch(true)"
          />
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
            <el-button size="large" @click="onReset">清空</el-button>
            <el-button type="primary" size="large" @click="openCreateDialog">新增库存</el-button>
            <el-button
              v-if="hasPendingSelection"
              type="primary"
              size="large"
              @click="openInboundDialog"
            >
              入库
            </el-button>
            <el-button
              v-if="hasStoredSelection"
              type="warning"
              size="large"
              @click="openOutboundDialog"
            >
              出库
            </el-button>
          </div>
        </div>

        <div v-if="selectedRows.length" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

        <el-table
          ref="finishedStockTableRef"
          v-loading="loading"
          :data="stockTableData"
          border
          stripe
          class="finished-table"
          :row-key="getStockTableRowKey"
          :tree-props="{ children: '_children' }"
          :indent="8"
          :row-class-name="getFinishedStockRowClassName"
          :row-style="compactRowStyle"
          :cell-style="compactCellStyle"
          :header-cell-style="compactHeaderCellStyle"
          @header-dragend="onFinishedStockHeaderDragEnd"
          @selection-change="onSelectionChange"
        >
          <el-table-column type="selection" width="48" align="center" :selectable="isSelectableStockRow" />
          <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip align="center" header-align="center" />
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
              <span v-else class="text-placeholder">{{ getTableImagePlaceholder(row) }}</span>
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
                          <div
                            v-for="(h, idx) in getPreviewHeaders(row)"
                            :key="idx"
                            class="qty-tooltip-cell"
                          >
                            {{ h }}
                          </div>
                        </div>
                        <div
                          v-for="(r, rIdx) in getPreviewRows(row)"
                          :key="rIdx"
                          class="qty-tooltip-row"
                        >
                          <div class="qty-tooltip-cell qty-tooltip-color">{{ r.colorName || '-' }}</div>
                          <div
                            v-for="(v, vIdx) in r.values"
                            :key="vIdx"
                            class="qty-tooltip-cell qty-tooltip-num"
                          >
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
          <el-table-column prop="department" label="部门" min-width="90" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="库存类型" min-width="100" show-overflow-tooltip align="center" header-align="center">
            <template #default="{ row }">
              {{ findInventoryTypeLabelById(row.inventoryTypeId) || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="仓库" min-width="90" show-overflow-tooltip align="center" header-align="center">
            <template #default="{ row }">
              {{ findWarehouseLabelById(row.warehouseId) || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="location" label="存放地址" min-width="120" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column prop="createdAt" label="入库时间" width="160" align="center" header-align="center" />
          <el-table-column prop="orderNo" label="订单号" min-width="110" show-overflow-tooltip align="center" header-align="center" />
          <el-table-column label="操作" width="88" align="center" header-align="center" fixed="right">
            <template #default="{ row }">
              <el-button v-if="isStockTableLeafRow(row)" link type="primary" size="small" @click="openDetail(row)">详情</el-button>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-wrap pagination-wrap--with-summary">
          <div class="pagination-summary">总件数：{{ stockListFooterQuantity }} 件</div>
          <el-pagination
            v-model:current-page="pagination.page"
            v-model:page-size="pagination.pageSize"
            :total="pagination.total"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @current-change="load"
            @size-change="onPageSizeChange"
          />
        </div>
      </el-tab-pane>

      <el-tab-pane label="出库记录" name="outbounds">
        <div class="filter-bar">
          <el-input v-model="outboundFilter.orderNo" placeholder="订单号" clearable size="large" class="filter-bar-item" @keyup.enter="onOutboundSearch(true)" />
          <el-input v-model="outboundFilter.skuCode" placeholder="SKU" clearable size="large" class="filter-bar-item" @keyup.enter="onOutboundSearch(true)" />
          <el-select v-model="outboundFilter.customerName" placeholder="客户" filterable clearable size="large" class="filter-bar-item" @change="onOutboundSearch(true)">
            <el-option v-for="opt in customerOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <el-date-picker
            v-model="outboundFilter.dateRange"
            type="daterange"
            range-separator=""
            start-placeholder="出库时间"
            end-placeholder=""
            value-format="YYYY-MM-DD"
            :shortcuts="rangeShortcuts"
            unlink-panels
            size="large"
            :class="['filter-bar-item', { 'range-single': !(outboundFilter.dateRange && outboundFilter.dateRange.length === 2) }]"
            :style="getInventoryOutboundRangeStyle(outboundFilter.dateRange)"
            @change="onOutboundSearch(true)"
          />
          <div class="filter-bar-actions">
            <el-button type="primary" size="large" @click="onOutboundSearch(true)">搜索</el-button>
            <el-button size="large" @click="onOutboundReset">清空</el-button>
          </div>
        </div>

        <el-table
          ref="finishedOutboundTableRef"
          v-loading="outboundLoading2"
          :data="outboundList"
          border
          stripe
          class="finished-table"
          :row-style="compactRowStyle"
          :cell-style="compactCellStyle"
          :header-cell-style="compactHeaderCellStyle"
          @header-dragend="onFinishedOutboundHeaderDragEnd"
        >
          <el-table-column prop="createdAt" label="出库时间" width="160" align="center">
            <template #default="{ row }">{{ row.createdAt }}</template>
          </el-table-column>
          <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
          <el-table-column label="图片" :width="compactImageColumnMinWidth" align="center">
            <template #default="{ row }">
              <AppImageThumb
                v-if="row.imageUrl"
                :raw-url="row.imageUrl"
                :width="compactImageSize"
                :height="compactImageSize"
              />
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
                        <div v-for="(h, idx) in row.sizeBreakdown.headers" :key="idx" class="qty-tooltip-cell">
                          {{ h }}
                        </div>
                      </div>
                      <div v-for="(r, rIdx) in row.sizeBreakdown.rows" :key="rIdx" class="qty-tooltip-row">
                        <div class="qty-tooltip-cell qty-tooltip-color">{{ r.colorName || '-' }}</div>
                        <div v-for="(v, vIdx) in r.quantities" :key="vIdx" class="qty-tooltip-cell qty-tooltip-num">
                          {{ v }}
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
                <span class="qty-hover">{{ formatDisplayNumber(row.quantity) }}</span>
              </el-tooltip>
              <span v-else>{{ formatDisplayNumber(row.quantity) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="department" label="部门" min-width="90" show-overflow-tooltip />
          <el-table-column label="库存类型" min-width="100" show-overflow-tooltip>
            <template #default="{ row }">
              {{ findInventoryTypeLabelById(row.inventoryTypeId) || '-' }}
            </template>
          </el-table-column>
          <el-table-column label="仓库" min-width="90" show-overflow-tooltip>
            <template #default="{ row }">
              {{ findWarehouseLabelById(row.warehouseId) || '-' }}
            </template>
          </el-table-column>
          <el-table-column prop="pickupUserName" label="领取人" width="120" show-overflow-tooltip />
          <el-table-column prop="operatorUsername" label="操作人" width="120" show-overflow-tooltip />
          <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip />
        </el-table>

        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="outboundPagination.page"
            v-model:page-size="outboundPagination.pageSize"
            :total="outboundPagination.total"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @current-change="loadOutbounds"
            @size-change="onOutboundPageSizeChange"
          />
        </div>
      </el-tab-pane>
    </el-tabs>

    <FinishedInboundDialog
      v-model="inboundDialog.visible"
      :stock-id="inboundDialog.stockId"
      :stock-label="inboundDialog.stockLabel"
      @submitted="load()"
    />

    <FinishedOutboundDialog
      v-model="outboundDialog.visible"
      :stock-id="outboundDialog.stockId"
      :stock-info="outboundDialog.stockInfo"
      @submitted="load()"
    />

    <FinishedCreateDialog
      v-model="createDialogVisible"
      :warehouse-options="warehouseOptions"
      :inventory-type-options="inventoryTypeOptions"
      :department-options="departmentOptions"
      @created="load()"
    />

    <FinishedDetailDrawer
      v-model="detailDrawer.visible"
      :stock-id="detailDrawer.stockId"
      :initial-color-name="detailDrawer.selectedColorName"
      :initial-quantity="detailDrawer.selectedQuantity"
      :group-product-image="detailDrawer.groupProductImage"
      :group-size-headers="detailDrawer.groupSizeHeaders"
      :inventory-type-options="inventoryTypeOptions"
      :warehouse-options="warehouseOptions"
      :department-options="departmentOptions"
      @color-images-synced="onColorImagesSynced"
      @color-image-saved="onColorImageSaved"
      @meta-saved="onMetaSaved"
    />

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import FinishedDetailDrawer from '@/components/inventory/FinishedDetailDrawer.vue'
import FinishedInboundDialog from '@/components/inventory/FinishedInboundDialog.vue'
import FinishedOutboundDialog from '@/components/inventory/FinishedOutboundDialog.vue'
import FinishedCreateDialog from '@/components/inventory/FinishedCreateDialog.vue'
import {
  getFinishedStockList,
  type FinishedStockRow,
} from '@/api/inventory'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'
import { useFinishedOptions } from '@/composables/useFinishedOptions'
import { useFinishedOutboundRecords } from '@/composables/useFinishedOutboundRecords'
import { useFinishedStockTable } from '@/composables/useFinishedStockTable'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
  getFilterRangeStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import {
  normalizeColorName,
  isStockTableParentRow,
  isStockTableLeafRow,
  type StockTableRow,
  type StockTableLeafRow,
  type StockTableParentRow,
} from '@/utils/finishedStockTableUtils'

const pageTab = ref<'stock' | 'outbounds'>('stock')
const currentTab = ref<string>('stored')
const filter = reactive<{
  orderNo: string
  skuCode: string
  customerName: string
  inventoryTypeId: number | null
}>({ orderNo: '', skuCode: '', customerName: '', inventoryTypeId: null })
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)
const inboundDateRange = ref<[string, string] | null>(null)
const list = ref<FinishedStockRow[]>([])
const finishedStockTableRef = ref()
const {
  compactHeaderCellStyle,
  compactCellStyle,
  compactRowStyle,
  compactImageSize,
  compactImageColumnMinWidth,
} = useCompactTableStyle()
const {
  customerOptions,
  warehouseOptions,
  inventoryTypeOptions,
  departmentOptions,
  pickupUserOptions,
  loadWarehouseOptions,
  loadInventoryTypeOptions,
  loadDepartmentOptions,
  loadCustomerOptions,
  loadPickupUserOptions,
  findWarehouseLabelById,
  findInventoryTypeLabelById,
} = useFinishedOptions()
const {
  outboundFilter,
  outboundList,
  outboundLoading2,
  outboundPagination,
  finishedOutboundTableRef,
  loadOutbounds,
  onOutboundSearch,
  onOutboundReset,
  onOutboundPageSizeChange,
} = useFinishedOutboundRecords()
const {
  colorSizeCache,
  stockTableData,
  getGroupLeafRows,
  getGroupSizeHeaders,
  buildPreviewData,
  getGroupProductImageUrl,
  getSharedProductImageUrl,
  getProductImageUrl,
  getSplitColorBreakdown,
  ensureColorSizeBreakdown,
  prefetchStoredRowBreakdowns,
  scaleColorSizeRowsToQuantity,
  isQtyTooltipLoading,
  isQtyTooltipError,
  qtyTooltipEnabled,
  onQtyTooltipShow,
  getLeafPreviewData,
  filterEmptyPreviewRows,
  getPreviewBaseHeaders,
} = useFinishedStockTable(list)
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
/** 当前筛选下全量匹配的总件数（接口返回）；有表格勾选时底部改为已选行的件数合计 */
const stockTotalQuantity = ref(0)
const selectedRows = ref<StockTableLeafRow[]>([])

const stockListFooterQuantity = computed(() => {
  if (selectedRows.value.length > 0) {
    return selectedRows.value.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0)
  }
  return stockTotalQuantity.value
})

const detailDrawer = reactive<{
  visible: boolean
  stockId: number | null
  groupProductImage: string
  groupSizeHeaders: string[]
  selectedColorName: string | null
  selectedQuantity: number | null
}>({
  visible: false,
  stockId: null,
  groupProductImage: '',
  groupSizeHeaders: [],
  selectedColorName: null,
  selectedQuantity: null,
})




function getTableImageUrl(row: StockTableRow): string {
  return row._effectiveImageUrl || getProductImageUrl(row)
}

function getTableImagePlaceholder(row: StockTableRow): string {
  return '-'
}

function getTableColorText(row: StockTableRow): string {
  return row._displayColor || '-'
}

function getTableUnitPriceText(row: StockTableRow): string {
  if (isStockTableParentRow(row) && row._mixedUnitPrice) return '多个'
  return formatPrice(row.unitPrice)
}

function getTableGrandTotalText(row: StockTableRow): string {
  if (isStockTableParentRow(row)) {
    const total = row._children.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0
      const price = Number(item.unitPrice) || 0
      return sum + qty * price
    }, 0)
    return formatPrice(String(total))
  }
  return formatTotalPrice(row.quantity, row.unitPrice)
}

function getStockTableRowKey(row: StockTableRow): string {
  return row._uiKey
}

function getFinishedStockRowClassName({ row }: { row: StockTableRow }): string {
  return isStockTableParentRow(row) ? 'stock-parent-row' : 'stock-child-row'
}

function isSelectableStockRow(row: StockTableRow): boolean {
  return isStockTableLeafRow(row)
}

function getPreviewHeaders(row: StockTableRow): string[] {
  return buildPreviewData(row)?.headers ?? []
}

function getPreviewRows(row: StockTableRow) {
  return buildPreviewData(row)?.rows ?? []
}

function openDetail(row: StockTableRow) {
  if (!isStockTableLeafRow(row)) return
  detailDrawer.groupProductImage = getSharedProductImageUrl(row)
  detailDrawer.groupSizeHeaders = getGroupSizeHeaders(row)
  detailDrawer.stockId = row.id
  detailDrawer.selectedColorName = row._selectedColorName != null ? normalizeColorName(row._selectedColorName) : null
  detailDrawer.selectedQuantity = row.quantity != null ? Math.max(0, Math.trunc(Number(row.quantity) || 0)) : null
  detailDrawer.visible = true
}

function onColorImagesSynced(stockId: number, colorImages: Array<{ colorName?: string; imageUrl?: string }>) {
  syncStockColorImages(stockId, colorImages)
}

function onColorImageSaved(payload: { stockId: number; colorName: string; imageUrl: string }) {
  syncStockColorImage(payload.stockId, payload.colorName, payload.imageUrl)
}

async function onMetaSaved() {
  await load()
}

function syncStockColorImage(stockId: number, colorName: string, imageUrl: string) {
  const targetColorName = normalizeColorName(colorName)
  if (!targetColorName) return
  list.value = list.value.map((item) => {
    if (item.id !== stockId) return item
    const colorImages = Array.isArray(item.colorImages) ? [...item.colorImages] : []
    const index = colorImages.findIndex((entry) => normalizeColorName(entry.colorName) === targetColorName)
    if (imageUrl) {
      const nextEntry = { ...(index >= 0 ? colorImages[index] : {}), colorName: targetColorName, imageUrl }
      if (index >= 0) colorImages[index] = nextEntry
      else colorImages.push(nextEntry)
    } else if (index >= 0) {
      colorImages.splice(index, 1)
    }
    return { ...item, colorImages }
  })
}

function syncStockColorImages(stockId: number, colorImages: Array<{ colorName?: string; imageUrl?: string }> | null | undefined) {
  const normalized = Array.isArray(colorImages)
    ? colorImages
        .map((item) => ({
          colorName: normalizeColorName(item?.colorName),
          imageUrl: String(item?.imageUrl ?? '').trim(),
        }))
        .filter((item) => item.colorName && item.imageUrl)
    : []
  list.value = list.value.map((item) => (item.id === stockId ? { ...item, colorImages: normalized } : item))
}


const { onHeaderDragEnd: onFinishedStockHeaderDragEnd, restoreColumnWidths: restoreFinishedStockColumnWidths } =
  useTableColumnWidthPersist('inventory-finished-stock')
const { onHeaderDragEnd: onFinishedOutboundHeaderDragEnd } =
  useTableColumnWidthPersist('inventory-finished-outbounds')

function getInventoryOutboundRangeStyle(v: [string, string] | []) {
  const hasValue = Array.isArray(v) && v.length === 2
  if (!hasValue) return getFilterRangeStyle(v)
  const w = '240px'
  return { ...getFilterRangeStyle(v), width: w, minWidth: w, flex: `0 0 ${w}` }
}

const pendingRows = computed(() => selectedRows.value.filter((r) => r.type === 'pending'))
const storedRows = computed(() => selectedRows.value.filter((r) => r.type === 'stored'))
const hasPendingSelection = computed(() => pendingRows.value.length > 0)
const hasStoredSelection = computed(() => storedRows.value.length > 0)

const inboundDialog = reactive<{ visible: boolean; stockId: number | null; stockLabel: string }>({
  visible: false,
  stockId: null,
  stockLabel: '',
})

const outboundDialog = reactive<{
  visible: boolean
  stockId: number | null
  stockInfo: {
    orderId: number | null
    orderNo: string
    skuCode: string
    customerName: string
    quantity: number
    imageUrl: string
    colorName: string
    sizeBreakdown: FinishedStockRow['sizeBreakdown'] | null
    colorImages: Array<{ colorName: string; imageUrl: string }>
  } | null
}>({
  visible: false,
  stockId: null,
  stockInfo: null,
})

const createDialogVisible = ref(false)

async function load() {
  loading.value = true
  try {
    const [startDate, endDate] =
      inboundDateRange.value && inboundDateRange.value.length === 2 ? inboundDateRange.value : ['', '']
    const res = await getFinishedStockList({
      tab: currentTab.value,
      orderNo: filter.orderNo || undefined,
      skuCode: filter.skuCode || undefined,
      customerName: filter.customerName || undefined,
      inventoryTypeId: filter.inventoryTypeId ?? undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      stockTotalQuantity.value = Number(data.totalQuantity ?? 0) || 0
      restoreFinishedStockColumnWidths(finishedStockTableRef.value)
      void prefetchStoredRowBreakdowns(list.value)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function onPageTabChange() {
  if (pageTab.value === 'outbounds') {
    outboundPagination.page = 1
    loadOutbounds()
  }
}

function onSearch(byUser = false) {
  if (byUser) {
    if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
    if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
  }
  pagination.page = 1
  load()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    onSearch(false)
  }, 400)
}

function onReset() {
  orderNoLabelVisible.value = false
  skuCodeLabelVisible.value = false
  filter.orderNo = ''
  filter.skuCode = ''
  filter.customerName = ''
  filter.inventoryTypeId = null
  inboundDateRange.value = null
  currentTab.value = 'stored'
  pagination.page = 1
  selectedRows.value = []
  load()
}

function onTabChange() {
  pagination.page = 1
  selectedRows.value = []
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function onSelectionChange(rows: StockTableRow[]) {
  selectedRows.value = rows.filter((row): row is StockTableLeafRow => isStockTableLeafRow(row))
}

function openInboundDialog() {
  if (!pendingRows.value.length) return
  const first = pendingRows.value[0]
  inboundDialog.stockId = first?.id ?? null
  inboundDialog.stockLabel = `${first?.orderNo || '-'} / ${first?.skuCode || '-'}`
  inboundDialog.visible = true
}

async function openOutboundDialog() {
  if (storedRows.value.length === 0) return
  const row = { ...storedRows.value[0] }
  outboundDialog.stockId = row.id
  outboundDialog.stockInfo = {
    orderId: row.orderId ?? null,
    orderNo: row.orderNo || '',
    skuCode: row.skuCode || '',
    customerName: row.customerName || '',
    quantity: Number(row.quantity) || 0,
    imageUrl: getSharedProductImageUrl(row) || '',
    colorName: normalizeColorName(row._selectedColorName || row._displayColor),
    sizeBreakdown: row.sizeBreakdown ?? null,
    colorImages: Array.isArray(row.colorImages) ? row.colorImages : [],
  }
  outboundDialog.visible = true
}

function openCreateDialog() {
  createDialogVisible.value = true
}

function formatPrice(unitPrice: string | undefined): string {
  if (unitPrice == null || unitPrice === '') return '￥0'
  const n = Number(unitPrice)
  return Number.isFinite(n) ? `￥${formatDisplayNumber(n)}` : '￥0'
}

function formatTotalPrice(quantity: number, unitPrice: string | undefined): string {
  const n = Number(unitPrice)
  if (!Number.isFinite(n) || !Number.isFinite(quantity)) return '￥0'
  return `￥${formatDisplayNumber(quantity * n)}`
}

onMounted(async () => {
  await Promise.all([
    loadWarehouseOptions(),
    loadInventoryTypeOptions(),
    loadCustomerOptions(),
    loadDepartmentOptions(),
  ])
  await load()
})

</script>

<style scoped>
.inventory-finished-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.finished-table {
  margin-bottom: var(--space-md);
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.pagination-wrap--with-summary {
  margin-top: var(--space-md);
  justify-content: space-between;
  align-items: center;
}

.pagination-summary {
  font-size: var(--font-size-caption, 12px);
  color: var(--color-text-secondary, #606266);
}

.qty-hover {
  cursor: help;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}

.finished-table .stock-parent-row {
  --el-table-tr-bg-color: #f7f9fc;
}
</style>
