<template>
  <div class="page-card finishing-page">
    <!-- Tab：全部 / 等待发货 / 已发货 / 已入库 -->
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
          v-if="hasSelection && canRegisterSelection"
          type="primary"
          size="large"
          @click="openRegisterDialog"
        >
          登记包装完成
        </el-button>
        <el-button
          v-if="hasSelection && canShipSelection"
          type="success"
          size="large"
          :loading="shipping"
          @click="onShip"
        >
          {{ shipButtonLabel }}
        </el-button>
        <el-button
          v-if="hasSelection && canInboundSelection"
          type="warning"
          size="large"
          :loading="inbounding"
          @click="onInbound"
        >
          入库
        </el-button>
      </div>
    </div>

    <!-- 待尾部订单列表 -->
    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      class="finishing-table"
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
      <el-table-column label="尾部出货数" width="100" align="right">
        <template #default="{ row }">
          <el-popover
            placement="top-start"
            trigger="hover"
            :width="Math.max(320, (sizeBreakdownCache[row.orderId]?.headers?.length ?? 1) * 72)"
            :show-arrow="true"
            @show="onShowQtyPopover(row)"
          >
            <template #reference>
              <span class="qty-trigger">{{ row.tailShippedQty != null ? row.tailShippedQty : '-' }}</span>
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
        <template #default="{ row }">{{ row.tailInboundQty != null ? row.tailInboundQty : '-' }}</template>
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
        :page-sizes="[20, 40, 60]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="onPageSizeChange"
      />
    </div>

    <!-- 登记包装完成弹窗：尺寸细数（订单/裁床/车缝只读，尾部收货可填）、次品数 -->
    <el-dialog
      v-model="registerDialog.visible"
      title="登记包装完成"
      width="720"
      destroy-on-close
      @close="resetRegisterForm"
    >
      <template v-if="registerDialog.row">
        <div class="register-brief">
          <div>订单号：{{ registerDialog.row.orderNo }}</div>
          <div>SKU：{{ registerDialog.row.skuCode }}</div>
        </div>
        <div v-if="registerFormLoading" class="register-loading">加载尺寸细数...</div>
        <template v-else-if="registerForm.headers?.length">
          <div class="register-qty-title">尺寸细数</div>
          <el-table :data="registerSizeTableRows" border size="small" class="register-qty-table" style="width: 100%">
            <el-table-column prop="label" label="" width="90" align="right" />
            <el-table-column
              v-for="(h, idx) in registerForm.headers"
              :key="idx"
              :label="h"
              min-width="100"
              align="center"
            >
              <template #default="{ row }">
                <template v-if="row.key === 'order' || row.key === 'cut' || row.key === 'sewing'">
                  {{ row.values[idx] != null ? row.values[idx] : '-' }}
                </template>
                <template v-else-if="row.key === 'tail' && idx === registerForm.headers.length - 1 && registerForm.headers.length > 1">
                  {{ registerTailReceivedTotal }}
                </template>
                <template v-else>
                  <el-input-number
                    v-model="registerForm.tailReceivedQuantities[idx]"
                    :min="0"
                    :max="registerForm.sewingRow[idx] != null ? Number(registerForm.sewingRow[idx]) : undefined"
                    :precision="0"
                    controls-position="right"
                    size="small"
                    style="width: 100%"
                  />
                </template>
              </template>
            </el-table-column>
          </el-table>
          <p class="register-qty-sum">尾部收货数合计：{{ registerTailReceivedTotal }}</p>
        </template>
        <el-form
          ref="registerFormRef"
          :model="registerForm"
          :rules="registerRules"
          label-width="100px"
          class="register-form"
        >
          <el-form-item label="次品数" prop="defectQuantity">
            <el-input-number
              v-model="registerForm.defectQuantity"
              :min="0"
              :precision="0"
              controls-position="right"
              style="width: 160px"
            />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="registerDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="registerDialog.submitting" @click="submitRegister">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 发货弹窗：填写本次出货数（可小于尾部收货数，支持多次发货） -->
    <el-dialog
      v-model="shipDialog.visible"
      title="发货"
      width="560"
      destroy-on-close
      @close="shipDialog.rows = []; shipDialog.quantities = []"
    >
      <p class="dialog-tip">出货数 + 入库数 + 次品数 = 尾部收货数 时可完成订单。请填写本次出货数。</p>
      <el-table :data="shipDialog.rows" border size="small" max-height="320">
        <el-table-column prop="orderNo" label="订单号" width="100" />
        <el-table-column prop="skuCode" label="SKU" width="100" />
        <el-table-column label="可发货数" width="90" align="right">
          <template #default="{ row, $index }">{{ shipDialogMaxQty(row) }}</template>
        </el-table-column>
        <el-table-column label="本次出货数" min-width="140">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="shipDialog.quantities[$index]"
              :min="1"
              :max="shipDialogMaxQty(row)"
              :precision="0"
              controls-position="right"
              size="small"
              style="width: 120px"
            />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="shipDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="shipping" @click="submitShipDialog">确定发货</el-button>
      </template>
    </el-dialog>

    <!-- 入库弹窗：填写本次入库数（支持部分入库，满足 出货+入库+次品=尾部收货数 时订单完成） -->
    <el-dialog
      v-model="inboundDialog.visible"
      title="入库"
      width="560"
      destroy-on-close
      @close="inboundDialog.rows = []; inboundDialog.quantities = []"
    >
      <p class="dialog-tip">出货数 + 入库数 + 次品数 = 尾部收货数 时订单将完成。请填写本次入库数。</p>
      <el-table :data="inboundDialog.rows" border size="small" max-height="320">
        <el-table-column prop="orderNo" label="订单号" width="100" />
        <el-table-column prop="skuCode" label="SKU" width="100" />
        <el-table-column label="可入库数" width="90" align="right">
          <template #default="{ row }">{{ inboundDialogMaxQty(row) }}</template>
        </el-table-column>
        <el-table-column label="本次入库数" min-width="140">
          <template #default="{ row, $index }">
            <el-input-number
              v-model="inboundDialog.quantities[$index]"
              :min="1"
              :max="inboundDialogMaxQty(row)"
              :precision="0"
              controls-position="right"
              size="small"
              style="width: 120px"
            />
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="inboundDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="inbounding" @click="submitInboundDialog">确定入库</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  getFinishingItems,
  getFinishingRegisterFormData,
  registerFinishingPackaging,
  shipFinishingOrder,
  inboundFinishingOrder,
  exportFinishingItems,
  type FinishingListItem,
  type FinishingListQuery,
} from '@/api/production-finishing'
import { getOrderSizeBreakdown, type OrderSizeBreakdownRes } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const FINISHING_TABS = [
  { label: '全部', value: 'all' },
  { label: '等待发货', value: 'pending_ship' },
  { label: '已发货', value: 'shipped' },
  { label: '已入库', value: 'inbound' },
] as const

type FinishingTabConfig = (typeof FINISHING_TABS)[number]

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeInputStyle = { color: ACTIVE_FILTER_COLOR }

function getFilterInputStyle(v: unknown) {
  return v ? activeInputStyle : undefined
}
function getOrderNoFilterStyle(orderNo: unknown, showLabel: boolean) {
  if (!orderNo || !showLabel) return undefined
  const text = `订单号：${String(orderNo)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}
function getSkuCodeFilterStyle(skuCode: unknown, showLabel: boolean) {
  if (!skuCode || !showLabel) return undefined
  const text = `SKU：${String(skuCode)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}

const filter = reactive({ orderNo: '', skuCode: '' })
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)

const currentTab = ref<string>('all')
const tabCounts = ref<Record<string, number>>({})
const tabTotal = ref(0)
const list = ref<FinishingListItem[]>([])
const loading = ref(false)
const shipping = ref(false)
const inbounding = ref(false)
const exporting = ref(false)
const sizeBreakdownCache = ref<Record<number, OrderSizeBreakdownRes>>({})
const sizePopoverLoadingId = ref<number | null>(null)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<FinishingListItem[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)
const canRegisterSelection = computed(() =>
  selectedRows.value.some((r) => r.finishingStatus === 'pending_ship' && r.tailReceivedQty == null),
)
/** 可发货：等待发货且已登记收货数，或已发货但仍有可发货数（追加发货） */
const canShipSelection = computed(() => {
  if (selectedRows.value.length === 0) return false
  return selectedRows.value.every((r) => {
    if (r.finishingStatus === 'pending_ship') return r.tailReceivedQty != null && r.tailReceivedQty >= 0
    if (r.finishingStatus === 'shipped') return shipDialogMaxQty(r) > 0
    return false
  })
})
const shipButtonLabel = computed(() =>
  selectedRows.value.some((r) => r.finishingStatus === 'pending_ship') ? '发货' : '追加发货',
)
const canInboundSelection = computed(() =>
  selectedRows.value.every((r) => r.finishingStatus === 'shipped') && selectedRows.value.length > 0,
)

/** 可发货数 = 尾部收货数 - 已出货 - 已入库 - 次品 */
function shipDialogMaxQty(row: FinishingListItem): number {
  const received = row.tailReceivedQty ?? 0
  const shipped = row.tailShippedQty ?? 0
  const inbound = row.tailInboundQty ?? 0
  const defect = row.defectQuantity ?? 0
  return Math.max(0, received - shipped - inbound - defect)
}

/** 可入库数 = 尾部收货数 - 已出货 - 已入库 - 次品 */
function inboundDialogMaxQty(row: FinishingListItem): number {
  return shipDialogMaxQty(row)
}

const shipDialog = reactive<{
  visible: boolean
  rows: FinishingListItem[]
  quantities: number[]
}>({ visible: false, rows: [], quantities: [] })

const inboundDialog = reactive<{
  visible: boolean
  rows: FinishingListItem[]
  quantities: number[]
}>({ visible: false, rows: [], quantities: [] })

function getTabLabel(tab: FinishingTabConfig): string {
  const counts = tabCounts.value
  const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
  return `${tab.label}(${count})`
}

const registerDialog = reactive<{
  visible: boolean
  submitting: boolean
  row: FinishingListItem | null
}>({ visible: false, submitting: false, row: null })
const registerFormLoading = ref(false)
const registerFormRef = ref<FormInstance>()
const registerForm = reactive<{
  headers: string[]
  orderRow: (number | null)[]
  cutRow: (number | null)[]
  sewingRow: (number | null)[]
  tailReceivedQuantities: number[]
  defectQuantity: number
}>({
  headers: [],
  orderRow: [],
  cutRow: [],
  sewingRow: [],
  tailReceivedQuantities: [],
  defectQuantity: 0,
})
const registerSizeTableRows = computed(() => {
  const h = registerForm.headers
  if (!h.length) return []
  return [
    { key: 'order', label: '订单数量', values: registerForm.orderRow },
    { key: 'cut', label: '裁床数量', values: registerForm.cutRow },
    { key: 'sewing', label: '车缝数量', values: registerForm.sewingRow },
    { key: 'tail', label: '尾部收货数', values: registerForm.tailReceivedQuantities },
  ]
})
const registerTailReceivedTotal = computed(() =>
  registerForm.tailReceivedQuantities.reduce((a, b) => a + (Number(b) || 0), 0),
)
const registerRules: FormRules = {
  defectQuantity: [],
}

function formatDateTime(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleString('zh-CN')
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

async function openRegisterDialog() {
  const canReg = selectedRows.value.filter(
    (r) => r.finishingStatus === 'pending_ship' && r.tailReceivedQty == null,
  )
  if (canReg.length === 0) return
  const row = canReg[0]
  registerDialog.row = row
  registerForm.headers = []
  registerForm.orderRow = []
  registerForm.cutRow = []
  registerForm.sewingRow = []
  registerForm.tailReceivedQuantities = []
  registerForm.defectQuantity = 0
  registerDialog.visible = true
  registerFormLoading.value = true
  try {
    const res = await getFinishingRegisterFormData(row.orderId)
    const data = res.data
    const headers = data?.headers ?? []
    const orderRow = data?.orderRow ?? []
    const cutRow = data?.cutRow ?? []
    const sewingRow = data?.sewingRow ?? []
    registerForm.headers = headers
    registerForm.orderRow = orderRow
    registerForm.cutRow = cutRow
    registerForm.sewingRow = sewingRow
    const sizeCount = headers.length > 1 ? headers.length - 1 : 1
    registerForm.tailReceivedQuantities = sewingRow
      .slice(0, sizeCount)
      .map((v) => (v != null ? Number(v) : 0))
    while (registerForm.tailReceivedQuantities.length < sizeCount) {
      registerForm.tailReceivedQuantities.push(0)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载尺寸细数失败'))
    registerDialog.visible = false
  } finally {
    registerFormLoading.value = false
  }
}

function resetRegisterForm() {
  registerDialog.row = null
  registerForm.headers = []
  registerForm.orderRow = []
  registerForm.cutRow = []
  registerForm.sewingRow = []
  registerForm.tailReceivedQuantities = []
  registerForm.defectQuantity = 0
  registerFormRef.value?.clearValidate()
}

async function submitRegister() {
  if (!registerDialog.row) return
  const total = registerTailReceivedTotal.value
  if (total <= 0) {
    ElMessage.warning('请填写尾部收货数')
    return
  }
  await registerFormRef.value?.validate().catch(() => {})
  registerDialog.submitting = true
  try {
    await registerFinishingPackaging({
      orderId: registerDialog.row.orderId,
      tailReceivedQty: total,
      defectQuantity: registerForm.defectQuantity,
    })
    ElMessage.success('登记成功')
    registerDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '操作失败'))
  } finally {
    registerDialog.submitting = false
  }
}

function onShip() {
  const toShip = selectedRows.value.filter((r) => {
    if (r.finishingStatus === 'pending_ship') return r.tailReceivedQty != null
    if (r.finishingStatus === 'shipped') return shipDialogMaxQty(r) > 0
    return false
  })
  if (toShip.length === 0) return
  shipDialog.rows = toShip
  shipDialog.quantities = toShip.map((r) => shipDialogMaxQty(r))
  shipDialog.visible = true
}

async function submitShipDialog() {
  if (shipDialog.rows.length === 0) return
  const invalid = shipDialog.rows.some((row, i) => {
    const q = shipDialog.quantities[i] ?? 0
    return q < 1 || q > shipDialogMaxQty(row)
  })
  if (invalid) {
    ElMessage.warning('请填写有效的本次出货数（1～可发货数）')
    return
  }
  shipping.value = true
  try {
    for (let i = 0; i < shipDialog.rows.length; i++) {
      await shipFinishingOrder(shipDialog.rows[i].orderId, shipDialog.quantities[i] ?? 0)
    }
    ElMessage.success(`已发货 ${shipDialog.rows.length} 条`)
    shipDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '发货失败'))
  } finally {
    shipping.value = false
  }
}

function onInbound() {
  const toInbound = selectedRows.value.filter((r) => r.finishingStatus === 'shipped')
  if (toInbound.length === 0) return
  inboundDialog.rows = toInbound
  inboundDialog.quantities = toInbound.map((r) => inboundDialogMaxQty(r))
  inboundDialog.visible = true
}

async function submitInboundDialog() {
  if (inboundDialog.rows.length === 0) return
  const invalid = inboundDialog.rows.some((row, i) => {
    const q = inboundDialog.quantities[i] ?? 0
    return q < 1 || q > inboundDialogMaxQty(row)
  })
  if (invalid) {
    ElMessage.warning('请填写有效的本次入库数（1～可入库数）')
    return
  }
  inbounding.value = true
  try {
    for (let i = 0; i < inboundDialog.rows.length; i++) {
      await inboundFinishingOrder(inboundDialog.rows[i].orderId, inboundDialog.quantities[i] ?? 0)
    }
    ElMessage.success('入库操作已提交；当出货+入库+次品=尾部收货数时订单将自动完成')
    inboundDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '入库失败'))
  } finally {
    inbounding.value = false
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

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-sm);
  padding: var(--space-sm);
  margin-bottom: var(--space-md);
  border-radius: var(--radius-lg);
  background-color: var(--color-bg-subtle, #f5f6f8);
}

.filter-bar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
}

.finishing-table {
  margin-bottom: var(--space-md);
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

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
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
}

.qty-popover-table .qty-value {
  padding: 2px 4px;
  text-align: right;
  white-space: nowrap;
}

.qty-header {
  padding: 2px 4px;
  font-weight: 500;
  white-space: nowrap;
}

.qty-popover-loading,
.qty-popover-empty {
  font-size: 12px;
  color: var(--color-text-muted, #909399);
}
</style>
