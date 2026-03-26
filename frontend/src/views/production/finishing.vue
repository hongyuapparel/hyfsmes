<template>
  <div class="page-card finishing-page">
    <!-- Tab：全部 / 尾部完成 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button
            v-for="tab in FINISHING_TABS"
            :key="tab.value"
            :label="tab.value"
          >
            {{ getTabLabel(tab) }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 筛选区：与订单列表同一设计（订单号、SKU） -->
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
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button size="large" :loading="exporting" @click="onExport">导出表格</el-button>
        <el-button
          v-if="hasSelection && canRegisterReceiveSelection"
          type="primary"
          size="large"
          @click="openReceiveDialog"
        >
          登记收货
        </el-button>
        <el-button
          v-if="hasSelection && canPackagingCompleteSelection"
          type="primary"
          size="large"
          @click="openPackagingCompleteDialog"
        >
          登记包装完成
        </el-button>
        <!-- 新流程：尾部不再处理发货/入库/财务审批，交由仓库模块 -->
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <!-- 待尾部订单列表 -->
    <el-table
      ref="finishingTableRef"
      v-loading="loading"
      :data="list"
      border
      stripe
      class="finishing-table"
      @header-dragend="onHeaderDragEnd"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column prop="arrivedAt" label="到尾部时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.arrivedAt) }}</template>
      </el-table-column>
      <el-table-column prop="completedAt" label="完成时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.completedAt) }}</template>
      </el-table-column>
      <el-table-column prop="orderNo" label="订单号" min-width="100" show-overflow-tooltip />
      <el-table-column prop="skuCode" label="SKU" min-width="100" show-overflow-tooltip />
      <el-table-column label="图片" width="72" align="center">
        <template #default="{ row }">
          <el-image
            v-if="row.imageUrl"
            :src="row.imageUrl"
            fit="cover"
            class="table-thumb"
            :preview-teleported="true"
            :preview-src-list="[row.imageUrl]"
          />
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="裁床数量" width="96" align="right">
        <template #default="{ row }">
          <el-popover
            placement="top-start"
            trigger="hover"
            :width="Math.max(320, (sizeBreakdownCache[row.orderId]?.headers?.length ?? 1) * 72)"
            :show-arrow="true"
            @show="onShowQtyPopover(row)"
          >
            <template #reference>
              <span class="qty-trigger">{{ row.cutTotal != null ? row.cutTotal : '-' }}</span>
            </template>
            <div class="qty-popover">
              <div class="qty-popover-title">数量追踪</div>
              <div v-if="sizePopoverLoadingId === row.orderId" class="qty-popover-loading">加载中...</div>
              <div v-else>
                <table v-if="sizeBreakdownCache[row.orderId]?.rows?.length" class="qty-popover-table">
                  <thead>
                    <tr>
                      <th class="qty-header">尺码</th>
                      <th v-for="(h, hIdx) in sizeBreakdownCache[row.orderId].headers" :key="hIdx" class="qty-header">{{ h }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in sizeBreakdownCache[row.orderId].rows" :key="r.label">
                      <td class="qty-label">{{ r.label }}</td>
                      <td v-for="(v, vIdx) in r.values" :key="vIdx" class="qty-value">{{ v != null ? v : '-' }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="qty-popover-empty">暂无尺码明细</div>
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column label="车缝数量" width="96" align="right">
        <template #default="{ row }">
          <el-popover
            placement="top-start"
            trigger="hover"
            :width="Math.max(320, (sizeBreakdownCache[row.orderId]?.headers?.length ?? 1) * 72)"
            :show-arrow="true"
            @show="onShowQtyPopover(row)"
          >
            <template #reference>
              <span class="qty-trigger">{{ row.sewingQuantity != null ? row.sewingQuantity : '-' }}</span>
            </template>
            <div class="qty-popover">
              <div class="qty-popover-title">数量追踪</div>
              <div v-if="sizePopoverLoadingId === row.orderId" class="qty-popover-loading">加载中...</div>
              <div v-else>
                <table v-if="sizeBreakdownCache[row.orderId]?.rows?.length" class="qty-popover-table">
                  <thead>
                    <tr>
                      <th class="qty-header">尺码</th>
                      <th v-for="(h, hIdx) in sizeBreakdownCache[row.orderId].headers" :key="hIdx" class="qty-header">{{ h }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in sizeBreakdownCache[row.orderId].rows" :key="r.label">
                      <td class="qty-label">{{ r.label }}</td>
                      <td v-for="(v, vIdx) in r.values" :key="vIdx" class="qty-value">{{ v != null ? v : '-' }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="qty-popover-empty">暂无尺码明细</div>
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column label="尾部收货数" width="100" align="right">
        <template #default="{ row }">
          <el-popover
            placement="top-start"
            trigger="hover"
            :width="Math.max(320, (sizeBreakdownCache[row.orderId]?.headers?.length ?? 1) * 72)"
            :show-arrow="true"
            @show="onShowQtyPopover(row)"
          >
            <template #reference>
              <span class="qty-trigger">{{ row.tailReceivedQty != null ? row.tailReceivedQty : '-' }}</span>
            </template>
            <div class="qty-popover">
              <div class="qty-popover-title">数量追踪</div>
              <div v-if="sizePopoverLoadingId === row.orderId" class="qty-popover-loading">加载中...</div>
              <div v-else>
                <table v-if="sizeBreakdownCache[row.orderId]?.rows?.length" class="qty-popover-table">
                  <thead>
                    <tr>
                      <th class="qty-header">尺码</th>
                      <th v-for="(h, hIdx) in sizeBreakdownCache[row.orderId].headers" :key="hIdx" class="qty-header">{{ h }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in sizeBreakdownCache[row.orderId].rows" :key="r.label">
                      <td class="qty-label">{{ r.label }}</td>
                      <td v-for="(v, vIdx) in r.values" :key="vIdx" class="qty-value">{{ v != null ? v : '-' }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="qty-popover-empty">暂无尺码明细</div>
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column label="尾部入库数" width="100" align="right">
        <template #default="{ row }">
          <el-popover
            placement="top-start"
            trigger="hover"
            :width="Math.max(320, (sizeBreakdownCache[row.orderId]?.headers?.length ?? 1) * 72)"
            :show-arrow="true"
            @show="onShowQtyPopover(row)"
          >
            <template #reference>
              <span class="qty-trigger">{{ row.tailInboundQty != null ? row.tailInboundQty : '-' }}</span>
            </template>
            <div class="qty-popover">
              <div class="qty-popover-title">数量追踪</div>
              <div v-if="sizePopoverLoadingId === row.orderId" class="qty-popover-loading">加载中...</div>
              <div v-else>
                <table v-if="sizeBreakdownCache[row.orderId]?.rows?.length" class="qty-popover-table">
                  <thead>
                    <tr>
                      <th class="qty-header">尺码</th>
                      <th v-for="(h, hIdx) in sizeBreakdownCache[row.orderId].headers" :key="hIdx" class="qty-header">{{ h }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in sizeBreakdownCache[row.orderId].rows" :key="r.label">
                      <td class="qty-label">{{ r.label }}</td>
                      <td v-for="(v, vIdx) in r.values" :key="vIdx" class="qty-value">{{ v != null ? v : '-' }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="qty-popover-empty">暂无尺码明细</div>
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column label="次品数" width="80" align="right">
        <template #default="{ row }">{{ row.defectQuantity != null ? row.defectQuantity : '-' }}</template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap">
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

    <!-- 登记收货弹窗：待尾部 tab 使用，支持按尺码填写收货数量 -->
    <el-dialog
      v-model="receiveDialog.visible"
      title="登记收货"
      width="720"
      destroy-on-close
      @close="resetReceiveForm"
    >
      <template v-if="receiveDialog.row">
        <div class="register-brief">
          <div>订单号：{{ receiveDialog.row.orderNo }}</div>
          <div>SKU：{{ receiveDialog.row.skuCode }}</div>
        </div>
        <div v-if="receiveDialog.formLoading" class="register-loading">加载尺寸细数...</div>
        <template v-else-if="receiveDialog.headers?.length">
          <div class="register-qty-title">尺寸细数</div>
          <el-table :data="receiveSizeTableRows" border size="small" class="register-qty-table" style="width: 100%">
            <el-table-column prop="label" label="" width="90" align="right" />
            <el-table-column
              v-for="(h, idx) in receiveDialog.headers"
              :key="idx"
              :label="h"
              min-width="100"
              align="center"
            >
              <template #default="{ row }">
                <template v-if="row.key === 'order' || row.key === 'cut' || row.key === 'sewing'">
                  {{ row.values[idx] != null ? row.values[idx] : '-' }}
                </template>
                <template v-else-if="row.key === 'tail' && idx === receiveDialog.headers.length - 1 && receiveDialog.headers.length > 1">
                  {{ receiveTailReceivedTotal }}
                </template>
                <template v-else>
                  <el-input-number
                    v-model="receiveDialog.tailReceivedQuantities[idx]"
                    :min="0"
                    :max="receiveDialog.sewingRow[idx] != null ? Number(receiveDialog.sewingRow[idx]) : undefined"
                    :precision="0"
                    controls-position="right"
                    size="small"
                    style="width: 100%"
                  />
                </template>
              </template>
            </el-table-column>
          </el-table>
          <p class="register-qty-sum">尾部收货数合计：{{ receiveTailReceivedTotal }}</p>
        </template>
      </template>
      <template #footer>
        <el-button @click="receiveDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="receiveDialog.submitting" @click="submitReceive">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 登记包装完成弹窗：默认全部入库，生成待入库并完成订单 -->
    <el-dialog
      v-model="packagingCompleteDialog.visible"
      title="登记包装完成"
      width="800"
      destroy-on-close
      @close="packagingCompleteDialog.items = []"
    >
      <p class="dialog-tip">登记包装完成后将默认“全部入库”，自动生成一条仓库「待仓处理」记录，同时订单状态变为「订单完成」。后续发货/入库等由仓库模块处理。</p>
      <div v-if="packagingCompleteDialog.formLoading" class="register-loading">加载尺寸细数...</div>
      <template v-else>
        <div
          v-for="(item, itemIdx) in packagingCompleteDialog.items"
          :key="item.row.orderId"
          class="packaging-block"
        >
          <div class="register-brief">
            <div>订单号：{{ item.row.orderNo }}</div>
            <div>SKU：{{ item.row.skuCode }}</div>
            <div>尾部收货数合计：{{ item.row.tailReceivedQty ?? 0 }}</div>
          </div>
          <template v-if="item.headers?.length">
            <div class="register-qty-title">尾部收货数 / 入库数</div>
            <el-table :data="packagingSizeTableRows(item)" border size="small" class="register-qty-table" style="width: 100%">
              <el-table-column prop="label" label="" width="100" align="right" />
              <el-table-column
                v-for="(h, hIdx) in item.headers"
                :key="hIdx"
                :label="h"
                min-width="90"
                align="center"
              >
                <template #default="{ row }">
                  <template v-if="row.key === 'tail_received'">
                    {{ row.values[hIdx] != null ? row.values[hIdx] : '-' }}
                  </template>
                  <template v-else-if="row.key === 'inbound'">
                    <template v-if="item.headers.length > 1 && hIdx === item.headers.length - 1">
                      {{ row.values[hIdx] != null ? row.values[hIdx] : 0 }}
                    </template>
                    <el-input-number
                      v-else
                      v-model="item.inboundQuantities[hIdx]"
                      :min="0"
                      :max="maxPackagingQtyForSize(item, hIdx)"
                      :precision="0"
                      controls-position="right"
                      size="small"
                      style="width: 100%"
                    />
                  </template>
                  <template v-else-if="row.key === 'defect'">
                    <template v-if="item.headers.length > 1 && hIdx === item.headers.length - 1">
                      {{ defectTotal(item) }}
                    </template>
                    <el-input-number
                      v-else
                      v-model="item.defectQuantities[hIdx]"
                      :min="0"
                      :max="item.row.tailReceivedQty ?? 0"
                      :precision="0"
                      controls-position="right"
                      size="small"
                      style="width: 100%"
                    />
                  </template>
                  <template v-else>
                    {{ row.values[hIdx] != null ? row.values[hIdx] : '-' }}
                  </template>
                </template>
              </el-table-column>
            </el-table>
            <div class="packaging-extra">
              <el-form-item label="备注" class="packaging-form-item">
                <el-input
                  v-model="item.remark"
                  type="textarea"
                  :rows="2"
                  placeholder="选填"
                  size="small"
                  maxlength="200"
                  show-word-limit
                  style="width: 360px"
                />
              </el-form-item>
            </div>
          </template>
        </div>
      </template>
      <template #footer>
        <el-button @click="packagingCompleteDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="packagingCompleteDialog.submitting" @click="submitPackagingComplete">
          确定
        </el-button>
      </template>
    </el-dialog>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getFinishingItems,
  getFinishingRegisterFormData,
  registerFinishingReceive,
  registerFinishingPackagingComplete,
  exportFinishingItems,
  type FinishingListItem,
  type FinishingListQuery,
} from '@/api/production-finishing'
import { getOrderSizeBreakdown, type OrderSizeBreakdownRes } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDateTime } from '@/utils/date-format'

const FINISHING_TABS = [
  { label: '全部', value: 'all' },
  { label: '待尾部', value: 'pending_receive' },
  { label: '尾部中', value: 'pending_assign' },
  { label: '尾部完成', value: 'inbound' },
] as const

type FinishingTabConfig = (typeof FINISHING_TABS)[number]

const filter = reactive({ orderNo: '', skuCode: '' })
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)

const currentTab = ref<string>('all')
const tabCounts = ref<Record<string, number>>({})
const tabTotal = ref(0)
const list = ref<FinishingListItem[]>([])
const finishingTableRef = ref()
const loading = ref(false)
const exporting = ref(false)
const sizeBreakdownCache = ref<Record<number, OrderSizeBreakdownRes>>({})
const sizePopoverLoadingId = ref<number | null>(null)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<FinishingListItem[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)
/** 待尾部 tab：可登记收货 */
const canRegisterReceiveSelection = computed(() =>
  selectedRows.value.length > 0 &&
  selectedRows.value.every((r) => r.finishingStatus === 'pending_receive'),
)
/** 尾部 tab：可登记包装完成（发货数、入库数、次品数、备注） */
const canPackagingCompleteSelection = computed(() =>
  selectedRows.value.length > 0 &&
  selectedRows.value.every((r) => r.finishingStatus === 'pending_assign'),
)
const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('production-finishing-main')

function getTabLabel(tab: FinishingTabConfig): string {
  const counts = tabCounts.value
  const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
  return `${tab.label}(${count})`
}

const receiveDialog = reactive<{
  visible: boolean
  submitting: boolean
  formLoading: boolean
  row: FinishingListItem | null
  headers: string[]
  orderRow: (number | null)[]
  cutRow: (number | null)[]
  sewingRow: (number | null)[]
  tailReceivedQuantities: number[]
}>({
  visible: false,
  submitting: false,
  formLoading: false,
  row: null,
  headers: [],
  orderRow: [],
  cutRow: [],
  sewingRow: [],
  tailReceivedQuantities: [],
})
const receiveSizeTableRows = computed(() => {
  const h = receiveDialog.headers
  if (!h.length) return []
  return [
    { key: 'order', label: '订单数量', values: receiveDialog.orderRow },
    { key: 'cut', label: '裁床数量', values: receiveDialog.cutRow },
    { key: 'sewing', label: '车缝数量', values: receiveDialog.sewingRow },
    { key: 'tail', label: '尾部收货数', values: receiveDialog.tailReceivedQuantities },
  ]
})
const receiveTailReceivedTotal = computed(() =>
  receiveDialog.tailReceivedQuantities.reduce((a, b) => a + (Number(b) || 0), 0),
)
function resetReceiveForm() {
  receiveDialog.row = null
  receiveDialog.headers = []
  receiveDialog.orderRow = []
  receiveDialog.cutRow = []
  receiveDialog.sewingRow = []
  receiveDialog.tailReceivedQuantities = []
}

interface PackagingCompleteItem {
  row: FinishingListItem
  headers: string[]
  orderRow: (number | null)[]
  cutRow: (number | null)[]
  sewingRow: (number | null)[]
  tailReceivedRow: (number | null)[]
  inboundQuantities: number[]
  defectQuantities: number[]
  remark: string
}

const packagingCompleteDialog = reactive<{
  visible: boolean
  submitting: boolean
  formLoading: boolean
  items: PackagingCompleteItem[]
}>({ visible: false, submitting: false, formLoading: false, items: [] })

function packagingSizeTableRows(item: PackagingCompleteItem) {
  const received = item.row.tailReceivedQty ?? 0
  const i = item.inboundQuantities
  const sumI = i.reduce((a, b) => a + b, 0)
  const sumD = defectTotal(item)
  const valuesReceived =
    Array.isArray(item.tailReceivedRow) && item.tailReceivedRow.length === item.headers.length
      ? item.tailReceivedRow
      : item.headers.length === 1
        ? [received]
        : [...Array(item.headers.length - 1).fill(null), received]
  const valuesInbound = item.headers.length === 1 ? [...i] : [...i, sumI]
  return [
    { key: 'tail_received', label: '尾部收货数', values: valuesReceived },
    { key: 'inbound', label: '入库数', values: valuesInbound },
    { key: 'defect', label: '次品数', values: item.headers.length === 1 ? [...item.defectQuantities] : [...item.defectQuantities, sumD] },
  ]
}

function defectTotal(item: PackagingCompleteItem): number {
  return (item.defectQuantities ?? []).reduce((a, b) => a + (Number(b) || 0), 0)
}

function packagingSetZero(item: PackagingCompleteItem) {
  item.inboundQuantities.fill(0)
  item.defectQuantities.fill(0)
}

function packagingSetInboundToReceived(item: PackagingCompleteItem) {
  const total = item.row.tailReceivedQty ?? 0
  const len = item.inboundQuantities.length
  if (len === 0) return
  // 默认入库数按收货细数回填（仅尺码列，合计列在表格中自动计算）
  const sizeValues = Array.isArray(item.tailReceivedRow) && item.tailReceivedRow.length === item.headers.length
    ? item.tailReceivedRow.slice(0, len).map((v) => (v != null ? Number(v) : 0))
    : null
  if (sizeValues) {
    for (let i = 0; i < len; i++) item.inboundQuantities[i] = Math.max(0, Number(sizeValues[i]) || 0)
  } else {
    item.inboundQuantities[0] = total
    for (let i = 1; i < len; i++) item.inboundQuantities[i] = 0
  }
  item.defectQuantities.fill(0)
}

function maxPackagingQtyForSize(item: PackagingCompleteItem, _hIdx: number): number {
  return item.row.tailReceivedQty ?? 0
}

async function onShowQtyPopover(row: FinishingListItem) {
  const id = row.orderId
  if (sizeBreakdownCache.value[id] || sizePopoverLoadingId.value === id) return
  sizePopoverLoadingId.value = id
  try {
    const res = await getOrderSizeBreakdown(id)
    sizeBreakdownCache.value[id] = res.data ?? { headers: [], rows: [] }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '尺码明细加载失败'))
  } finally {
    if (sizePopoverLoadingId.value === id) sizePopoverLoadingId.value = null
  }
}

function buildQuery(): FinishingListQuery {
  return {
    tab: currentTab.value,
    orderNo: filter.orderNo || undefined,
    skuCode: filter.skuCode || undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
}

async function loadTabCounts() {
  const base = buildQuery()
  base.page = 1
  base.pageSize = 1
  const counts: Record<string, number> = {}
  await Promise.all(
    FINISHING_TABS.map(async (tab) => {
      try {
        const res = await getFinishingItems({ ...base, tab: tab.value })
        const data = res.data
        counts[tab.value] = data?.total ?? 0
      } catch {
        counts[tab.value] = 0
      }
    }),
  )
  tabCounts.value = counts
  tabTotal.value = counts.all ?? 0
}

async function load() {
  loading.value = true
  try {
    const res = await getFinishingItems(buildQuery())
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      restoreColumnWidths(finishingTableRef.value)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

async function onExport() {
  const query = buildQuery()
  const { page, pageSize, ...rest } = query
  exporting.value = true
  try {
    const res = await exportFinishingItems(rest)
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `尾部管理_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '导出失败'))
  } finally {
    exporting.value = false
  }
}

function onSearch(byUser = false) {
  if (byUser) {
    if (filter.orderNo && String(filter.orderNo).trim()) orderNoLabelVisible.value = true
    if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
  }
  pagination.page = 1
  load()
  void loadTabCounts()
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
  currentTab.value = 'all'
  pagination.page = 1
  selectedRows.value = []
  load()
  void loadTabCounts()
}

function onTabChange() {
  pagination.page = 1
  selectedRows.value = []
  load()
  void loadTabCounts()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function onSelectionChange(rows: FinishingListItem[]) {
  selectedRows.value = rows
}

async function openReceiveDialog() {
  const rows = selectedRows.value.filter((r) => r.finishingStatus === 'pending_receive')
  if (rows.length === 0) return
  const row = rows[0]
  receiveDialog.row = row
  receiveDialog.headers = []
  receiveDialog.orderRow = []
  receiveDialog.cutRow = []
  receiveDialog.sewingRow = []
  receiveDialog.tailReceivedQuantities = []
  receiveDialog.visible = true
  receiveDialog.formLoading = true
  try {
    const res = await getFinishingRegisterFormData(row.orderId)
    const data = res.data
    const headers = data?.headers ?? []
    const orderRow = data?.orderRow ?? []
    const cutRow = data?.cutRow ?? []
    const sewingRow = data?.sewingRow ?? []
    receiveDialog.headers = headers
    receiveDialog.orderRow = orderRow
    receiveDialog.cutRow = cutRow
    receiveDialog.sewingRow = sewingRow
    const sizeCount = headers.length > 1 ? headers.length - 1 : 1
    receiveDialog.tailReceivedQuantities = sewingRow
      .slice(0, sizeCount)
      .map((v) => (v != null ? Number(v) : 0))
    while (receiveDialog.tailReceivedQuantities.length < sizeCount) {
      receiveDialog.tailReceivedQuantities.push(0)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载尺寸细数失败'))
    receiveDialog.visible = false
  } finally {
    receiveDialog.formLoading = false
  }
}

async function submitReceive() {
  if (!receiveDialog.row) return
  const total = receiveTailReceivedTotal.value
  if (!total || total < 1) {
    ElMessage.warning('请填写尾部收货数（可按尺码填写）')
    return
  }
  receiveDialog.submitting = true
  try {
    await registerFinishingReceive({
      orderId: receiveDialog.row.orderId,
      tailReceivedQty: total,
      tailReceivedQuantities: receiveDialog.tailReceivedQuantities,
    })
    ElMessage.success('登记收货成功，订单已进入「尾部中」')
    receiveDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '登记收货失败'))
  } finally {
    receiveDialog.submitting = false
  }
}

async function openPackagingCompleteDialog() {
  const rows = selectedRows.value.filter((r) => r.finishingStatus === 'pending_assign')
  if (rows.length === 0) return
  packagingCompleteDialog.visible = true
  packagingCompleteDialog.formLoading = true
  packagingCompleteDialog.items = []
  try {
    for (const row of rows) {
      const res = await getFinishingRegisterFormData(row.orderId)
      const data = res.data
      const headers = data?.headers ?? ['合计']
      const orderRow = data?.orderRow ?? []
      const cutRow = data?.cutRow ?? []
      const sewingRow = data?.sewingRow ?? []
      const tailReceivedRow = data?.tailReceivedRow ?? []
      const sizeCount = headers.length > 1 ? headers.length - 1 : 1
      const item: PackagingCompleteItem = {
        row,
        headers,
        orderRow,
        cutRow,
        sewingRow,
        tailReceivedRow,
        inboundQuantities: Array(sizeCount).fill(0),
        defectQuantities: Array(sizeCount).fill(0),
        remark: '',
      }
      // 默认全部入库：把收货总数放在第一个尺码列，其他列为 0（合计列由表格计算展示）
      packagingSetInboundToReceived(item)
      packagingCompleteDialog.items.push(item)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载尺寸细数失败'))
    packagingCompleteDialog.visible = false
  } finally {
    packagingCompleteDialog.formLoading = false
  }
}

async function submitPackagingComplete() {
  if (packagingCompleteDialog.items.length === 0) return
  for (const item of packagingCompleteDialog.items) {
    const received = item.row.tailReceivedQty ?? 0
    const sumInbound = item.inboundQuantities.reduce((a, b) => a + (Number(b) || 0), 0)
    const defect = defectTotal(item)
    if (sumInbound + defect !== received) {
      ElMessage.warning(`订单 ${item.row.orderNo}：入库数合计(${sumInbound})+次品数(${defect}) 须等于尾部收货数(${received})`)
      return
    }
  }
  packagingCompleteDialog.submitting = true
  try {
    for (const item of packagingCompleteDialog.items) {
      const received = item.row.tailReceivedQty ?? 0
      const sumInbound = item.inboundQuantities.reduce((a, b) => a + (Number(b) || 0), 0)
      const defect = defectTotal(item)
      await registerFinishingPackagingComplete({
        orderId: item.row.orderId,
        tailShippedQty: 0,
        tailInboundQty: sumInbound,
        defectQuantity: defect,
        remark: item.remark?.trim() || undefined,
      })
    }
    ElMessage.success('登记包装完成：已生成待仓处理记录，订单已完成')
    packagingCompleteDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '登记包装完成失败'))
  } finally {
    packagingCompleteDialog.submitting = false
  }
}

onMounted(() => {
  load()
  void loadTabCounts()
})
</script>

<style scoped>
.finishing-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.status-tabs {
  display: flex;
  align-items: center;
  margin-bottom: var(--space-md);
}

.status-tabs-left {
  flex-shrink: 0;
}

.dialog-tip {
  margin: 0 0 var(--space-md);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.finishing-table {
  margin-bottom: var(--space-md);
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.table-thumb {
  width: 48px;
  height: 48px;
  border-radius: var(--radius);
  display: block;
}

.text-muted {
  color: var(--el-text-color-secondary);
}

.register-brief {
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  font-size: var(--font-size-caption, 12px);
}

.register-brief > div + div {
  margin-top: 4px;
}

.register-loading {
  padding: var(--space-md);
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.register-qty-title {
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 13px;
}

.register-qty-table {
  margin-bottom: 8px;
}

.packaging-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
  margin-bottom: 8px;
}

.packaging-block {
  margin-bottom: var(--space-md);
}

.packaging-block:last-child {
  margin-bottom: 0;
}

.packaging-extra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-md);
  margin-top: 8px;
}

.packaging-extra .packaging-form-item {
  margin-bottom: 0;
}

.register-qty-sum {
  margin: 0 0 var(--space-sm);
  font-size: 13px;
  color: var(--el-text-color-regular);
}

.register-form {
  margin-top: var(--space-sm);
}

.qty-trigger {
  cursor: pointer;
  text-decoration: underline dotted;
  text-underline-offset: 2px;
}

.qty-popover {
  font-size: 12px;
}

.qty-popover-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.qty-popover-table {
  width: 100%;
  border-collapse: collapse;
}

.qty-popover-table .qty-label {
  padding: 2px 4px;
  color: var(--color-text-muted, #909399);
  white-space: nowrap;
  text-align: center;
}

.qty-popover-table .qty-value {
  padding: 2px 4px;
  text-align: center;
  white-space: nowrap;
}

.qty-header {
  padding: 2px 4px;
  font-weight: 500;
  white-space: nowrap;
  text-align: center;
}

.qty-popover-loading,
.qty-popover-empty {
  font-size: 12px;
  color: var(--color-text-muted, #909399);
}
</style>
