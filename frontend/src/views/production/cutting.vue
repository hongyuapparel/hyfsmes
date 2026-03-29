<template>
  <div class="page-card page-card--fill cutting-page">
    <!-- Tab：全部 / 等待裁床 / 裁床完成 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button
            v-for="tab in CUTTING_TABS"
            :key="tab.value"
            :value="tab.value"
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
          裁床登记
        </el-button>
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <!-- 待裁床订单列表 -->
    <div ref="tableShellRef" class="list-page-table-shell">
    <el-table
      ref="cuttingTableRef"
      v-loading="loading"
      :data="list"
      border
      stripe
      class="cutting-table"
      :height="tableHeight"
      @header-dragend="onHeaderDragEnd"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column prop="orderNo" label="订单号" min-width="100" />
      <el-table-column prop="skuCode" label="SKU" min-width="100" />
      <el-table-column label="图片" width="72" align="center">
        <template #default="{ row }">
          <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" variant="compact" />
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="customerName" label="客户" min-width="90" show-overflow-tooltip />
      <el-table-column prop="merchandiser" label="跟单" width="80" show-overflow-tooltip />
      <el-table-column label="客户交期" width="110" align="center">
        <template #default="{ row }">{{ formatDate(row.customerDueDate) }}</template>
      </el-table-column>
      <el-table-column prop="arrivedAt" label="到裁床时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.arrivedAt) }}</template>
      </el-table-column>
      <el-table-column prop="completedAt" label="完成时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.completedAt) }}</template>
      </el-table-column>
      <el-table-column label="时效判定" width="96" align="center">
        <template #default="{ row }">
          <SlaJudgeTag :text="row.timeRating" />
        </template>
      </el-table-column>
      <el-table-column label="订单数量" width="96" align="right">
        <template #default="{ row }">
          <el-popover
            placement="top-start"
            trigger="hover"
            :width="Math.max(320, (sizeBreakdownCache[row.orderId]?.headers?.length ?? 1) * 72)"
            :show-arrow="true"
            @show="onShowQtyPopover(row)"
          >
            <template #reference>
              <span class="qty-trigger">{{ formatDisplayNumber(row.quantity) }}</span>
            </template>
            <div class="qty-popover">
              <div class="qty-popover-title">数量追踪</div>
              <div v-if="sizePopoverLoadingId === row.orderId" class="qty-popover-loading">加载中...</div>
              <div v-else>
                <table v-if="sizeBreakdownCache[row.orderId]?.rows?.length" class="qty-popover-table">
                  <thead>
                    <tr>
                      <th class="qty-header">尺码</th>
                      <th
                        v-for="(h, hIdx) in sizeBreakdownCache[row.orderId].headers"
                        :key="hIdx"
                        class="qty-header"
                      >
                        {{ h }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="r in sizeBreakdownCache[row.orderId].rows"
                      :key="r.label"
                    >
                      <td class="qty-label">{{ r.label }}</td>
                      <td
                        v-for="(v, vIdx) in r.values"
                        :key="vIdx"
                        class="qty-value"
                      >
                        {{ v != null ? formatDisplayNumber(v) : '-' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="qty-popover-empty">暂无尺码明细</div>
              </div>
            </div>
          </el-popover>
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
              <span class="qty-trigger">{{
                row.actualCutTotal != null ? formatDisplayNumber(row.actualCutTotal) : '-'
              }}</span>
            </template>
            <div class="qty-popover">
              <div class="qty-popover-title">数量追踪</div>
              <div v-if="sizePopoverLoadingId === row.orderId" class="qty-popover-loading">加载中...</div>
              <div v-else>
                <table v-if="sizeBreakdownCache[row.orderId]?.rows?.length" class="qty-popover-table">
                  <thead>
                    <tr>
                      <th class="qty-header">尺码</th>
                      <th
                        v-for="(h, hIdx) in sizeBreakdownCache[row.orderId].headers"
                        :key="hIdx"
                        class="qty-header"
                      >
                        {{ h }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="r in sizeBreakdownCache[row.orderId].rows"
                      :key="r.label"
                    >
                      <td class="qty-label">{{ r.label }}</td>
                      <td
                        v-for="(v, vIdx) in r.values"
                        :key="vIdx"
                        class="qty-value"
                      >
                        {{ v != null ? formatDisplayNumber(v) : '-' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="qty-popover-empty">暂无尺码明细</div>
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column
        v-if="currentTab !== 'pending'"
        prop="cuttingUnitPrice"
        label="裁剪单价(元/件)"
        width="120"
        align="right"
      >
        <template #default="{ row }">
          {{
            row.cuttingUnitPrice != null && String(row.cuttingUnitPrice).trim() !== ''
              ? formatDisplayNumber(row.cuttingUnitPrice)
              : '-'
          }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="currentTab !== 'pending'"
        prop="cuttingCost"
        label="裁剪总成本(元)"
        width="120"
        align="right"
      >
        <template #default="{ row }">
          {{
            row.cuttingCost != null && String(row.cuttingCost).trim() !== ''
              ? formatDisplayNumber(row.cuttingCost)
              : '-'
          }}
        </template>
      </el-table-column>
      <el-table-column
        v-if="currentTab !== 'pending'"
        prop="actualFabricMeters"
        label="本次净耗合计(米)"
        width="130"
        align="right"
      >
        <template #default="{ row }">
          {{
            row.actualFabricMeters != null && String(row.actualFabricMeters).trim() !== ''
              ? formatDisplayNumber(row.actualFabricMeters)
              : '-'
          }}
        </template>
      </el-table-column>
      <el-table-column label="操作" width="120" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="openCuttingBriefDrawer(row)">概要</el-button>
          <el-button
            v-if="row.cuttingStatus === 'completed'"
            link
            type="primary"
            @click.stop="openCompletedDetailDrawer(row)"
          >
            用量详情
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    </div>

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

    <!-- 裁床登记弹窗 -->
    <el-dialog
      v-model="registerDialog.visible"
      title="裁床登记"
      class="cutting-register-dialog"
      width="1020px"
      align-center
      destroy-on-close
      @close="resetRegisterForm"
    >
      <template v-if="registerDialog.row">
        <CuttingBasicInfoBar :order-brief="registerForm.orderBrief" />
        <p class="register-hint">
          按颜色、尺码填写<strong>实际裁剪件数</strong>（与订单 B 区一致）；下方登记布料领用与裁剪单价。
        </p>
        <CuttingQuantityMatrix
          v-model="registerForm.actualCutRows"
          :headers="registerForm.colorSizeHeaders"
          :matrix-max-height="320"
        />
        <el-divider content-position="left">物料用量明细</el-divider>
        <CuttingMaterialUsageTable
          v-model="registerForm.materialUsageRows"
          :grand-pieces="actualCutGrandTotal"
        />
        <el-form :model="registerForm" label-width="132px" class="cut-cost-form">
          <el-form-item label="裁剪部门">
            <el-select
              v-model="registerForm.cuttingDepartment"
              placeholder="请选择"
              filterable
              clearable
              style="width: 240px"
              @change="onCuttingDepartmentChange"
            >
              <el-option :label="SELF_DEPARTMENT_LABEL" :value="SELF_DEPARTMENT_LABEL" />
              <el-option
                v-for="opt in cuttingDepartmentOptions"
                :key="opt"
                :label="opt"
                :value="opt"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="isSelfCutting" label="裁剪人">
            <el-select
              v-model="registerForm.cutterName"
              placeholder="请选择裁剪人"
              filterable
              clearable
              style="width: 240px"
            >
              <el-option
                v-for="opt in cutterOptions"
                :key="opt"
                :label="opt"
                :value="opt"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="isSelfCutting" label="本次净耗合计(米)">
            <span class="cut-readonly-num">{{ formatFabricGrand(fabricNetGrandTotal) }}</span>
            <span class="cut-readonly-hint">由上方物料明细自动汇总（领用 − 退回）</span>
          </el-form-item>
          <el-form-item label="裁剪单价（元/件）">
            <el-input-number
              v-model="cuttingUnitPriceNum"
              :min="0"
              :precision="2"
              :controls="false"
              placeholder="元/件"
              style="width: 200px"
            />
          </el-form-item>
          <el-form-item label="裁剪总成本（元）">
            <span class="cut-readonly-num">{{ formatDisplayNumber(cuttingTotalCostDisplay) }}</span>
            <span class="cut-readonly-hint">裁剪单价 × 实际裁剪数量合计</span>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="registerDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="registerDialog.submitting" @click="submitRegister">
          完成
        </el-button>
      </template>
    </el-dialog>

    <!-- 裁床完成：登记用量详情抽屉 -->
    <el-drawer
      v-model="detailDrawer.visible"
      title="裁床登记详情"
      direction="rtl"
      :size="940"
      destroy-on-close
      class="cutting-detail-drawer"
      @closed="onDetailDrawerClosed"
    >
      <div v-loading="detailDrawer.loading" class="cutting-detail-drawer__body">
        <template v-if="detailPayload">
          <CuttingBasicInfoBar :order-brief="detailPayload.orderBrief" show-extended />
          <p class="register-hint">以下为该订单裁床完成时登记的裁剪数量与物料用量（只读）。</p>
          <CuttingQuantityMatrix
            :model-value="detailPayload.actualCutRows"
            :headers="detailPayload.colorSizeHeaders"
            :matrix-max-height="360"
            readonly
          />
          <el-divider content-position="left">物料用量明细</el-divider>
          <CuttingMaterialUsageTable
            :model-value="detailPayload.materialUsageRows"
            :grand-pieces="detailGrandPieces"
            :table-max-height="420"
            readonly
          />
          <div class="cut-detail-meta">
            <div class="cut-detail-meta__row">
              <span class="cut-detail-meta__label">到裁床时间</span>
              <span>{{ formatDateTime(detailPayload.arrivedAt) }}</span>
            </div>
            <div class="cut-detail-meta__row">
              <span class="cut-detail-meta__label">完成时间</span>
              <span>{{ formatDateTime(detailPayload.completedAt) }}</span>
            </div>
            <div class="cut-detail-meta__row">
              <span class="cut-detail-meta__label">裁剪部门</span>
              <span>{{ displayDash(detailPayload.cuttingDepartment) }}</span>
            </div>
            <div class="cut-detail-meta__row">
              <span class="cut-detail-meta__label">裁剪人</span>
              <span>{{ displayDash(detailPayload.cutterName) }}</span>
            </div>
            <div class="cut-detail-meta__row">
              <span class="cut-detail-meta__label">本次净耗合计(米)</span>
              <span>{{ fabricMetersDisplay(detailPayload.actualFabricMeters) }}</span>
            </div>
            <div class="cut-detail-meta__row">
              <span class="cut-detail-meta__label">裁剪单价(元/件)</span>
              <span>{{ moneyDisplay(detailPayload.cuttingUnitPrice) }}</span>
            </div>
            <div class="cut-detail-meta__row">
              <span class="cut-detail-meta__label">裁剪总成本(元)</span>
              <span>{{ moneyDisplay(detailPayload.cuttingTotalCost ?? detailPayload.cuttingCost) }}</span>
            </div>
          </div>
        </template>
      </div>
    </el-drawer>

    <el-drawer
      v-model="briefDrawer.visible"
      title="订单概要"
      direction="rtl"
      size="400px"
      destroy-on-close
      @closed="briefDrawer.row = null"
    >
      <ProductionOrderBriefPanel v-if="briefDrawer.row" :brief="cuttingBriefFromRow(briefDrawer.row)" />
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getCuttingItems,
  getCuttingRegisterForm,
  getCuttingQuantityBreakdown,
  getCuttingCompletedDetail,
  completeCutting,
  exportCuttingItems,
  type CuttingListItem,
  type CuttingListQuery,
  type ColorSizeRow,
  type CuttingQuantityBreakdownRes,
  type CuttingMaterialUsagePayloadRow,
  type CuttingRegisterOrderBrief,
  type CuttingCompletedDetailRes,
} from '@/api/production-cutting'
import CuttingBasicInfoBar from '@/components/production-cutting/CuttingBasicInfoBar.vue'
import CuttingQuantityMatrix from '@/components/production-cutting/CuttingQuantityMatrix.vue'
import CuttingMaterialUsageTable from '@/components/production-cutting/CuttingMaterialUsageTable.vue'
import { CUTTING_ABNORMAL_REASONS } from '@/constants/cutting-register'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getSupplierList, type SupplierItem } from '@/api/suppliers'
import { getEmployeeList, type EmployeeItem } from '@/api/hr'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDate, formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import ProductionOrderBriefPanel, {
  type ProductionOrderBriefModel,
} from '@/components/production/ProductionOrderBriefPanel.vue'

const CUTTING_TABS = [
  { label: '全部', value: 'all' },
  { label: '等待裁床', value: 'pending' },
  { label: '裁床完成', value: 'completed' },
] as const

type CuttingTabConfig = (typeof CUTTING_TABS)[number]

const filter = reactive({ orderNo: '', skuCode: '' })
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)

const currentTab = ref<string>('all')
const tabCounts = ref<Record<string, number>>({})
const tabTotal = ref(0)
const list = ref<CuttingListItem[]>([])
const cuttingTableRef = ref()
const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef, { tableRef: cuttingTableRef })
const loading = ref(false)
const sizeBreakdownCache = ref<Record<number, CuttingQuantityBreakdownRes>>({})
const sizePopoverLoadingId = ref<number | null>(null)
const exporting = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<CuttingListItem[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)
const canRegisterSelection = computed(() =>
  selectedRows.value.length > 0 && selectedRows.value.some((r) => r.cuttingStatus !== 'completed'),
)
const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('production-cutting-main')

function getTabLabel(tab: CuttingTabConfig): string {
  const counts = tabCounts.value
  const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
  return `${tab.label}(${count})`
}

const registerDialog = reactive<{
  visible: boolean
  submitting: boolean
  row: CuttingListItem | null
}>({ visible: false, submitting: false, row: null })
const defaultOrderBrief = (): CuttingRegisterOrderBrief => ({
  orderNo: '',
  skuCode: '',
  quantity: 0,
  customerName: '',
  orderDate: null,
})

const registerForm = reactive<{
  orderBrief: CuttingRegisterOrderBrief
  colorSizeHeaders: string[]
  actualCutRows: { colorName: string; quantities: number[]; remark?: string }[]
  materialUsageRows: CuttingMaterialUsagePayloadRow[]
  cuttingDepartment: string
  cutterName: string
}>({
  orderBrief: defaultOrderBrief(),
  colorSizeHeaders: [],
  actualCutRows: [],
  materialUsageRows: [],
  cuttingDepartment: '',
  cutterName: '',
})

const detailDrawer = reactive({ visible: false, loading: false })
const detailPayload = ref<CuttingCompletedDetailRes | null>(null)

const briefDrawer = reactive<{ visible: boolean; row: CuttingListItem | null }>({
  visible: false,
  row: null,
})

function openCuttingBriefDrawer(row: CuttingListItem) {
  briefDrawer.row = row
  briefDrawer.visible = true
}

function cuttingBriefFromRow(row: CuttingListItem): ProductionOrderBriefModel {
  return {
    orderNo: row.orderNo,
    skuCode: row.skuCode,
    imageUrl: row.imageUrl,
    customerName: row.customerName,
    merchandiser: row.merchandiser,
    customerDueDate: row.customerDueDate,
    orderQuantity: row.quantity,
  }
}

const detailGrandPieces = computed(() => {
  const rows = detailPayload.value?.actualCutRows ?? []
  return rows.reduce(
    (sum, r) =>
      sum +
      (Array.isArray(r.quantities) ? r.quantities.reduce((a, q) => a + (Number(q) || 0), 0) : 0),
    0,
  )
})

function onDetailDrawerClosed() {
  detailPayload.value = null
}

function displayDash(v: string | null | undefined) {
  const s = (v ?? '').trim()
  return s || '—'
}

function moneyDisplay(v: string | null | undefined) {
  if (v == null || String(v).trim() === '') return '—'
  return formatDisplayNumber(v)
}

function fabricMetersDisplay(v: string | null | undefined) {
  if (v == null || String(v).trim() === '') return '—'
  return formatDisplayNumber(v)
}

async function openCompletedDetailDrawer(row: CuttingListItem) {
  if (row.cuttingStatus !== 'completed') return
  detailDrawer.visible = true
  detailDrawer.loading = true
  detailPayload.value = null
  try {
    const res = await getCuttingCompletedDetail(row.orderId)
    detailPayload.value = res.data ?? null
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载详情失败'))
    detailDrawer.visible = false
  } finally {
    detailDrawer.loading = false
  }
}

const SELF_DEPARTMENT_LABEL = '本厂'
const cuttingDepartmentOptions = ref<string[]>([])
const isSelfCutting = computed(() => (registerForm.cuttingDepartment ?? '').trim() === SELF_DEPARTMENT_LABEL)
const cutterOptions = ref<string[]>([])

function actualCutRowTotal(row: { quantities: number[] }): number {
  const qs = Array.isArray(row?.quantities) ? row.quantities : []
  return qs.reduce((sum, v) => sum + (Number(v) || 0), 0)
}

const actualCutGrandTotal = computed(() =>
  (registerForm.actualCutRows ?? []).reduce((sum, r) => sum + actualCutRowTotal(r as any), 0),
)

const registerFormCuttingUnitPrice = ref('')

const cuttingUnitPriceNum = computed({
  get() {
    const t = registerFormCuttingUnitPrice.value.trim()
    if (t === '') return undefined
    const n = Number(t)
    return Number.isFinite(n) ? n : undefined
  },
  set(v: number | undefined) {
    registerFormCuttingUnitPrice.value = v == null || !Number.isFinite(v) ? '' : String(v)
  },
})

const cuttingTotalCostDisplay = computed(() => {
  const u = Number(registerFormCuttingUnitPrice.value.trim())
  const g = actualCutGrandTotal.value
  if (!Number.isFinite(u) || u < 0) return 0
  if (!Number.isFinite(g) || g <= 0) return 0
  return Math.round(u * g * 100) / 100
})

function fabricNetForRow(r: CuttingMaterialUsagePayloadRow): number {
  const a = Number(r.issuedMeters)
  const b = Number(r.returnedMeters)
  const x = (Number.isFinite(a) ? a : 0) - (Number.isFinite(b) ? b : 0)
  return x > 0 ? x : 0
}

const fabricNetGrandTotal = computed(() =>
  (registerForm.materialUsageRows ?? []).reduce((s, r) => s + fabricNetForRow(r), 0),
)

function formatFabricGrand(v: number) {
  if (!Number.isFinite(v)) return '—'
  return formatDisplayNumber(v)
}

function buildQuery(): CuttingListQuery {
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
    CUTTING_TABS.map(async (tab) => {
      try {
        const res = await getCuttingItems({ ...base, tab: tab.value })
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
    const res = await getCuttingItems(buildQuery())
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      restoreColumnWidths(cuttingTableRef.value)
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
    const res = await exportCuttingItems(rest)
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `裁床管理_${new Date().toISOString().slice(0, 10)}.csv`
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

async function onShowQtyPopover(row: CuttingListItem) {
  const id = row.orderId
  if (sizeBreakdownCache.value[id] || sizePopoverLoadingId.value === id) return
  sizePopoverLoadingId.value = id
  try {
    const res = await getCuttingQuantityBreakdown(id)
    sizeBreakdownCache.value[id] = res.data ?? { headers: [], rows: [] }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '尺码明细加载失败'))
  } finally {
    if (sizePopoverLoadingId.value === id) sizePopoverLoadingId.value = null
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

function onSelectionChange(rows: CuttingListItem[]) {
  selectedRows.value = rows
}

async function openRegisterDialog() {
  const pending = selectedRows.value.filter((r) => r.cuttingStatus !== 'completed')
  if (pending.length === 0) return
  const row = pending[0]
  registerDialog.row = row
  registerDialog.visible = true
  try {
    const res = await getCuttingRegisterForm(row.orderId)
    const data = res.data
    if (!data) {
      registerDialog.visible = false
      return
    }
    registerForm.orderBrief = { ...data.orderBrief }
    registerForm.colorSizeHeaders = data.colorSizeHeaders ?? []
    const rows = data.colorSizeRows ?? []
    registerForm.actualCutRows = rows.map((r: ColorSizeRow) => ({
      colorName: r.colorName ?? '',
      quantities: Array.isArray(r.quantities) ? [...r.quantities] : [],
      remark: r.remark ?? '',
    }))
    if (registerForm.actualCutRows.length === 0) {
      registerForm.actualCutRows = [{ colorName: '', quantities: [], remark: '' }]
    }
    const len = registerForm.colorSizeHeaders.length
    registerForm.actualCutRows.forEach((r) => {
      while (r.quantities.length < len) r.quantities.push(0)
    })
    registerForm.materialUsageRows = JSON.parse(JSON.stringify(data.materialUsageRows ?? []))
    registerFormCuttingUnitPrice.value = ''
    registerForm.cuttingDepartment = SELF_DEPARTMENT_LABEL
    registerForm.cutterName = ''
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    registerDialog.visible = false
  }
}

function resetRegisterForm() {
  registerDialog.row = null
  registerForm.orderBrief = defaultOrderBrief()
  registerForm.colorSizeHeaders = []
  registerForm.actualCutRows = []
  registerForm.materialUsageRows = []
  registerFormCuttingUnitPrice.value = ''
  registerForm.cuttingDepartment = ''
  registerForm.cutterName = ''
}

const abnormalReasonSet = new Set<string>(CUTTING_ABNORMAL_REASONS as unknown as string[])

function validateMaterialUsageClient(): string | null {
  for (const r of registerForm.materialUsageRows) {
    const issued = Number(r.issuedMeters)
    const returned = Number(r.returnedMeters)
    const abnormal = Number(r.abnormalLossMeters)
    if (!Number.isFinite(issued) || issued < 0) return `「${r.materialName}」本次领用米数须为非负数`
    if (!Number.isFinite(returned) || returned < 0) return `「${r.materialName}」退回米数须为非负数`
    if (!Number.isFinite(abnormal) || abnormal < 0) return `「${r.materialName}」异常损耗须为非负数`
    if (returned > issued) return `「${r.materialName}」退回不能大于领用`
    const net = issued - returned
    if (abnormal > net + 1e-9) return `「${r.materialName}」异常损耗不能大于实际净耗`
    if (abnormal > 0) {
      const reason = (r.abnormalReason ?? '').trim()
      if (!reason || !abnormalReasonSet.has(reason)) return `「${r.materialName}」有异常损耗时请填写异常原因`
      if (reason === '其他' && !(r.remark ?? '').trim()) return `「${r.materialName}」原因为「其他」时请填写备注`
    }
  }
  return null
}

async function submitRegister() {
  if (!registerDialog.row) return
  const dep = (registerForm.cuttingDepartment ?? '').trim()
  if (!dep) {
    ElMessage.warning('请选择裁剪部门')
    return
  }
  if (dep === SELF_DEPARTMENT_LABEL && !(registerForm.cutterName ?? '').trim()) {
    ElMessage.warning('本厂裁床请填写裁剪人')
    return
  }
  const unitTrim = registerFormCuttingUnitPrice.value.trim()
  const unitNum = unitTrim === '' ? 0 : Number(unitTrim)
  if (!Number.isFinite(unitNum) || unitNum < 0) {
    ElMessage.warning('裁剪单价须为非负数')
    return
  }
  const matErr = validateMaterialUsageClient()
  if (matErr) {
    ElMessage.warning(matErr)
    return
  }
  registerDialog.submitting = true
  try {
    const actualCutRows = registerForm.actualCutRows.map((r) => ({
      colorName: r.colorName,
      quantities: r.quantities,
      remark: r.remark,
    }))
    const g = actualCutGrandTotal.value
    const totalCost = Math.round(unitNum * g * 100) / 100
    const materialUsage: CuttingMaterialUsagePayloadRow[] = registerForm.materialUsageRows.map((r) => ({
      rowKey: r.rowKey,
      materialTypeId: r.materialTypeId,
      categoryLabel: r.categoryLabel,
      materialName: r.materialName,
      colorSpec: r.colorSpec,
      expectedUsagePerPiece: r.expectedUsagePerPiece,
      issuedMeters: Number(r.issuedMeters) || 0,
      returnedMeters: Number(r.returnedMeters) || 0,
      abnormalLossMeters: Number(r.abnormalLossMeters) || 0,
      abnormalReason: r.abnormalReason,
      remark: r.remark ?? '',
    }))
    await completeCutting({
      orderId: registerDialog.row.orderId,
      actualCutRows,
      cuttingDepartment: dep,
      cutterName: dep === SELF_DEPARTMENT_LABEL ? (registerForm.cutterName ?? '').trim() : null,
      cuttingUnitPrice: unitTrim === '' ? '0' : unitTrim,
      cuttingTotalCost: totalCost.toFixed(2),
      materialUsage,
    })
    ElMessage.success('裁床登记完成，订单已进入待车缝')
    registerDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '操作失败'))
  } finally {
    registerDialog.submitting = false
  }
}

async function loadCuttingDepartments() {
  try {
    const res = await getSupplierList({ type: '生产加工厂', page: 1, pageSize: 200 })
    const list: SupplierItem[] = res.data?.list ?? []
    const names = list.map((s) => (s.name ?? '').trim()).filter((v) => !!v)
    // 去重 + 排序，且避免和“本厂”重复展示
    const uniq = Array.from(new Set(names)).filter((n) => n !== SELF_DEPARTMENT_LABEL)
    cuttingDepartmentOptions.value = uniq
  } catch {
    cuttingDepartmentOptions.value = []
  }
}

async function loadCutterOptions() {
  try {
    const res = await getEmployeeList({ status: 'active', page: 1, pageSize: 500 })
    const list: EmployeeItem[] = res.data?.list ?? []
    const names = list
      .filter((e) => {
        const dept = (e.departmentName ?? '').trim()
        const job = (e.jobTitleName ?? '').trim()
        const status = (e.status ?? '').toLowerCase()
        return dept === '裁床' && job === '电剪' && status === 'active'
      })
      .map((e) => (e.name ?? '').trim())
      .filter((v) => !!v)
    const uniq = Array.from(new Set(names))
    cutterOptions.value = uniq.length ? uniq : ['电剪刀']
  } catch {
    cutterOptions.value = ['电剪刀']
  }
}

function onCuttingDepartmentChange() {
  const dep = (registerForm.cuttingDepartment ?? '').trim()
  if (dep !== SELF_DEPARTMENT_LABEL) {
    registerForm.cutterName = ''
  }
}

onMounted(() => {
  load()
  void loadTabCounts()
  void loadCuttingDepartments()
  void loadCutterOptions()
})
</script>

<style scoped>
.cutting-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.status-tabs {
  display: flex;
  align-items: center;
  margin-bottom: var(--space-md);
}

.status-tabs-left {
  flex-shrink: 0;
}

.cutting-table {
  flex: 1;
  min-height: 0;
}

.table-selection-count {
  margin: 8px 0;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.register-hint {
  margin-bottom: var(--space-sm);
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption, 12px);
}

.cut-grid {
  margin-bottom: var(--space-md);
}

.cut-cost-form {
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

.cut-readonly-num {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  margin-right: 8px;
}

.cut-readonly-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.cutting-detail-drawer__body {
  min-height: 120px;
}

.cut-detail-meta {
  margin-top: var(--space-md);
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  border: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.cut-detail-meta__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}

.cut-detail-meta__label {
  color: var(--el-text-color-secondary);
  min-width: 9em;
  flex-shrink: 0;
}
</style>

<style>
/* 对话框 teleport 到 body，非 scoped */
.cutting-register-dialog.el-dialog {
  max-width: min(1020px, 96vw);
}
</style>
