<template>
  <div class="page-card page-card--fill sewing-page">
    <!-- Tab：全部 / 等待车缝 / 车缝完成 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button
            v-for="tab in SEWING_TABS"
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
          v-if="hasSelection && canAssignSelection"
          type="primary"
          size="large"
          @click="openAssignDialog"
        >
          分单
        </el-button>
        <el-button
          v-if="hasSelection && canAssignCompletedSelection"
          type="primary"
          size="large"
          @click="openAssignDialog"
        >
          补录分单
        </el-button>
        <el-button
          v-if="hasSelection && canRegisterSelection"
          type="primary"
          size="large"
          @click="openRegisterDialog"
        >
          登记车缝完成
        </el-button>
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <!-- 待车缝订单列表 -->
    <div ref="tableShellRef" class="list-page-table-shell">
    <el-table
      ref="sewingTableRef"
      v-loading="loading"
      :data="list"
      border
      stripe
      class="sewing-table"
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
      <el-table-column prop="arrivedAt" label="到车缝时间" width="110" align="center">
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
      <el-table-column prop="factoryName" label="加工供应商" min-width="100" show-overflow-tooltip />
      <el-table-column label="分单时间" width="110" align="center">
        <template #default="{ row }">{{ formatDateTime(row.distributedAt) }}</template>
      </el-table-column>
      <el-table-column label="加工供应商交期" width="110" align="center">
        <template #default="{ row }">{{ formatDate(row.factoryDueDate) }}</template>
      </el-table-column>
      <el-table-column label="加工费(元)" width="100" align="right">
        <template #default="{ row }">
          {{ row.sewingFee != null && String(row.sewingFee).trim() !== '' ? formatDisplayNumber(row.sewingFee) : '-' }}
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
                      <th v-for="(h, hIdx) in sizeBreakdownCache[row.orderId].headers" :key="hIdx" class="qty-header">{{ h }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in sizeBreakdownCache[row.orderId].rows" :key="r.label">
                      <td class="qty-label">{{ r.label }}</td>
                      <td v-for="(v, vIdx) in r.values" :key="vIdx" class="qty-value">{{ v != null ? formatDisplayNumber(v) : '-' }}</td>
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
              <span class="qty-trigger">{{ row.cutTotal != null ? formatDisplayNumber(row.cutTotal) : '-' }}</span>
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
                      <td v-for="(v, vIdx) in r.values" :key="vIdx" class="qty-value">{{ v != null ? formatDisplayNumber(v) : '-' }}</td>
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
              <span class="qty-trigger">{{
                row.sewingQuantity != null ? formatDisplayNumber(row.sewingQuantity) : '-'
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
                      <th v-for="(h, hIdx) in sizeBreakdownCache[row.orderId].headers" :key="hIdx" class="qty-header">{{ h }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="r in sizeBreakdownCache[row.orderId].rows" :key="r.label">
                      <td class="qty-label">{{ r.label }}</td>
                      <td v-for="(v, vIdx) in r.values" :key="vIdx" class="qty-value">{{ v != null ? formatDisplayNumber(v) : '-' }}</td>
                    </tr>
                  </tbody>
                </table>
                <div v-else class="qty-popover-empty">暂无尺码明细</div>
              </div>
            </div>
          </el-popover>
        </template>
      </el-table-column>
      <el-table-column label="概要" width="64" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="openSewingBriefDrawer(row)">查看</el-button>
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

    <!-- 分单弹窗：分单时间、交期、加工供应商、车缝加工费 -->
    <el-dialog
      v-model="assignDialog.visible"
      title="分单"
      width="460"
      destroy-on-close
      @close="resetAssignForm"
    >
      <el-form
        ref="assignFormRef"
        :model="assignForm"
        :rules="assignRules"
        label-width="100px"
        class="assign-form"
      >
        <el-form-item label="分单时间" prop="distributedAt">
          <el-date-picker
            v-model="assignForm.distributedAt"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            placeholder="选择分单时间"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="交期" prop="factoryDueDate">
          <el-date-picker
            v-model="assignForm.factoryDueDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="加工供应商需交货给我们的日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="加工供应商" prop="factoryName">
          <el-select
            v-model="assignForm.factoryName"
            placeholder="请选择加工供应商"
            filterable
            clearable
            style="width: 100%"
          >
            <el-option
              v-for="s in factorySuppliers"
              :key="s.id"
              :label="s.name"
              :value="s.name"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="车缝加工费" prop="sewingFee">
          <el-input
            v-model="assignForm.sewingFee"
            placeholder="0"
            clearable
            style="width: 100%"
          >
            <template #prefix>
              <span class="currency-prefix">¥</span>
            </template>
          </el-input>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="assignDialog.submitting" @click="submitAssign">
          确定
        </el-button>
      </template>
    </el-dialog>

    <!-- 登记车缝完成弹窗：尺寸细数（订单/裁床只读，车缝可填）、次品、说明 -->
    <el-dialog
      v-model="registerDialog.visible"
      title="登记车缝完成"
      width="720"
      destroy-on-close
      @close="resetRegisterForm"
    >
      <template v-if="registerDialog.row">
        <div class="register-brief">
          <div>订单号：{{ registerDialog.row.orderNo }}</div>
          <div>SKU：{{ registerDialog.row.skuCode }}</div>
        </div>
        <div v-if="registerFormCompleteLoading" class="register-loading">加载尺寸细数...</div>
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
                <template v-if="row.key === 'order' || row.key === 'cut'">
                  {{ row.values[idx] != null ? formatDisplayNumber(row.values[idx]) : '-' }}
                </template>
                <template v-else-if="row.key === 'sewing' && idx === registerForm.headers.length - 1 && registerForm.headers.length > 1">
                  {{ formatDisplayNumber(registerSewingTotal) }}
                </template>
                <template v-else>
                  <el-input-number
                    v-model="registerForm.sewingQuantities[idx]"
                    :min="0"
                    :max="registerForm.cutRow[idx] != null ? Number(registerForm.cutRow[idx]) : undefined"
                    :precision="0"
                    controls-position="right"
                    size="small"
                    style="width: 100%"
                  />
                </template>
              </template>
            </el-table-column>
          </el-table>
          <p class="register-qty-sum">车缝数量合计：{{ formatDisplayNumber(registerSewingTotal) }}</p>
        </template>
        <el-form
          ref="registerFormRef"
          :model="registerForm"
          :rules="registerRules"
          label-width="100px"
          class="register-form"
        >
          <el-form-item label="次品数量" prop="defectQuantity">
            <el-input-number
              v-model="registerForm.defectQuantity"
              :min="0"
              :precision="0"
              controls-position="right"
              style="width: 160px"
            />
          </el-form-item>
          <el-form-item label="次品说明" prop="defectReason">
            <el-input
              v-model="registerForm.defectReason"
              type="textarea"
              :rows="3"
              placeholder="填写次品原因或说明"
              maxlength="500"
              show-word-limit
            />
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

    <ProductionDetailDrawerShell
      v-model="sewingBriefDrawer.visible"
      title="车缝外发概要"
      size="460px"
      @closed="sewingBriefDrawer.row = null"
    >
      <template v-if="sewingBriefDrawer.row">
        <ProductionDetailSection>
          <ProductionOrderBriefPanel :brief="sewingBriefFromRow(sewingBriefDrawer.row)" />
        </ProductionDetailSection>
        <ProductionDetailSection title="业务扩展信息">
          <el-descriptions :column="1" border size="small" class="sewing-brief-extra">
            <el-descriptions-item label="加工供应商">
              {{ (sewingBriefDrawer.row.factoryName ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="分单时间">
              {{ formatDateTime(sewingBriefDrawer.row.distributedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="加工供应商交期">
              {{ formatDate(sewingBriefDrawer.row.factoryDueDate) }}
            </el-descriptions-item>
            <el-descriptions-item label="车缝加工费(元)">
              {{
                sewingBriefDrawer.row.sewingFee != null && String(sewingBriefDrawer.row.sewingFee).trim() !== ''
                  ? formatDisplayNumber(sewingBriefDrawer.row.sewingFee)
                  : '—'
              }}
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="时效与节点">
          <el-descriptions :column="1" border size="small" class="sewing-brief-extra">
            <el-descriptions-item label="到车缝时间">
              {{ formatDateTime(sewingBriefDrawer.row.arrivedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="完成时间">
              {{ formatDateTime(sewingBriefDrawer.row.completedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="时效判定">
              <SlaJudgeTag :text="sewingBriefDrawer.row.timeRating" />
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
      </template>
    </ProductionDetailDrawerShell>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  getSewingItems,
  assignSewing,
  getCompleteFormData,
  completeSewing,
  exportSewingItems,
  type SewingListItem,
  type SewingListQuery,
} from '@/api/production-sewing'
import { getSupplierList, type SupplierItem } from '@/api/suppliers'
import { getOrderSizeBreakdown, type OrderSizeBreakdownRes } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
  normalizeTextFilter,
} from '@/composables/useFilterBarHelpers'
import { formatDate, formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import ProductionOrderBriefPanel, {
  type ProductionOrderBriefModel,
} from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'

const SEWING_TABS = [
  { label: '全部', value: 'all' },
  { label: '等待车缝', value: 'pending' },
  { label: '车缝完成', value: 'completed' },
] as const

type SewingTabConfig = (typeof SEWING_TABS)[number]

const filter = reactive({ orderNo: '', skuCode: '' })
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)

const currentTab = ref<string>('all')
const tabCounts = ref<Record<string, number>>({})
const tabTotal = ref(0)
const list = ref<SewingListItem[]>([])
const sewingBriefDrawer = reactive<{ visible: boolean; row: SewingListItem | null }>({
  visible: false,
  row: null,
})

function openSewingBriefDrawer(row: SewingListItem) {
  sewingBriefDrawer.row = row
  sewingBriefDrawer.visible = true
}

function sewingBriefFromRow(row: SewingListItem): ProductionOrderBriefModel {
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

const sewingTableRef = ref()
const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)
const loading = ref(false)
const exporting = ref(false)
const sizeBreakdownCache = ref<Record<number, OrderSizeBreakdownRes>>({})
const sizePopoverLoadingId = ref<number | null>(null)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<SewingListItem[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)
const canAssignSelection = computed(() =>
  selectedRows.value.length > 0 && selectedRows.value.some((r) => r.sewingStatus !== 'completed'),
)
const canAssignCompletedSelection = computed(() =>
  selectedRows.value.length > 0 && selectedRows.value.some((r) => r.sewingStatus === 'completed'),
)
const canRegisterSelection = computed(() =>
  selectedRows.value.length > 0 && selectedRows.value.some((r) => r.sewingStatus !== 'completed'),
)
const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('production-sewing-main')

const factorySuppliers = ref<SupplierItem[]>([])
const assignDialog = reactive<{ visible: boolean; submitting: boolean }>({ visible: false, submitting: false })
const assignFormRef = ref<FormInstance>()
const assignForm = reactive({
  distributedAt: '',
  factoryDueDate: '',
  factoryName: '',
  sewingFee: '',
})
const assignRules: FormRules = {
  factoryName: [{ required: true, message: '请选择加工供应商', trigger: 'change' }],
}

function getTabLabel(tab: SewingTabConfig): string {
  const counts = tabCounts.value
  const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
  return `${tab.label}(${count})`
}

const registerDialog = reactive<{
  visible: boolean
  submitting: boolean
  row: SewingListItem | null
}>({ visible: false, submitting: false, row: null })
const registerFormCompleteLoading = ref(false)
const registerFormRef = ref<FormInstance>()
const registerForm = reactive<{
  headers: string[]
  orderRow: (number | null)[]
  cutRow: (number | null)[]
  sewingQuantities: number[]
  defectQuantity: number
  defectReason: string
}>({
  headers: [],
  orderRow: [],
  cutRow: [],
  sewingQuantities: [],
  defectQuantity: 0,
  defectReason: '',
})
const registerSizeTableRows = computed(() => {
  const h = registerForm.headers
  if (!h.length) return []
  return [
    { key: 'order', label: '订单数量', values: registerForm.orderRow },
    { key: 'cut', label: '裁床数量', values: registerForm.cutRow },
    { key: 'sewing', label: '车缝数量', values: registerForm.sewingQuantities },
  ]
})
const registerSewingTotal = computed(() =>
  registerForm.sewingQuantities.reduce((a, b) => a + (Number(b) || 0), 0),
)
const registerRules: FormRules = {
  defectQuantity: [],
  defectReason: [],
}

function nowDatetimeStr(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${y}-${m}-${day} ${h}:${min}:${s}`
}

async function loadFactorySuppliers() {
  try {
    const res = await getSupplierList({ type: '加工供应商', pageSize: 500 })
    factorySuppliers.value = res.data?.list ?? []
  } catch {
    factorySuppliers.value = []
  }
}

async function onShowQtyPopover(row: SewingListItem) {
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

function openAssignDialog() {
  if (selectedRows.value.length === 0) return
  assignForm.distributedAt = nowDatetimeStr()
  assignForm.factoryDueDate = ''
  assignForm.factoryName = selectedRows.value[0]?.factoryName ?? ''
  assignForm.sewingFee = ''
  assignDialog.visible = true
}

function resetAssignForm() {
  assignFormRef.value?.clearValidate()
}

async function submitAssign() {
  await assignFormRef.value?.validate().catch(() => {})
  if (selectedRows.value.length === 0) return
  assignDialog.submitting = true
  try {
    for (const row of selectedRows.value) {
      await assignSewing({
        orderId: row.orderId,
        distributedAt: assignForm.distributedAt || nowDatetimeStr(),
        factoryDueDate: assignForm.factoryDueDate || '',
        factoryName: assignForm.factoryName,
        sewingFee: assignForm.sewingFee?.trim() || '0',
      })
    }
    ElMessage.success('分单成功')
    assignDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '分单失败'))
  } finally {
    assignDialog.submitting = false
  }
}

function buildQuery(): SewingListQuery {
  return {
    tab: currentTab.value,
    orderNo: normalizeTextFilter(filter.orderNo),
    skuCode: normalizeTextFilter(filter.skuCode),
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
    SEWING_TABS.map(async (tab) => {
      try {
        const res = await getSewingItems({ ...base, tab: tab.value })
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
    const res = await getSewingItems(buildQuery())
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      restoreColumnWidths(sewingTableRef.value)
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
    const res = await exportSewingItems(rest)
    const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `车缝管理_${new Date().toISOString().slice(0, 10)}.csv`
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

function onSelectionChange(rows: SewingListItem[]) {
  selectedRows.value = rows
}

async function openRegisterDialog() {
  const pending = selectedRows.value.filter((r) => r.sewingStatus !== 'completed')
  if (pending.length === 0) return
  const row = pending[0]
  registerDialog.row = row
  registerForm.headers = []
  registerForm.orderRow = []
  registerForm.cutRow = []
  registerForm.sewingQuantities = []
  registerForm.defectQuantity = 0
  registerForm.defectReason = ''
  registerDialog.visible = true
  registerFormCompleteLoading.value = true
  try {
    const res = await getCompleteFormData(row.orderId)
    const data = res.data
    const headers = data?.headers ?? []
    const orderRow = data?.orderRow ?? []
    const cutRow = data?.cutRow ?? []
    registerForm.headers = headers
    registerForm.orderRow = orderRow
    registerForm.cutRow = cutRow
    const len = headers.length
    // 车缝数量只存各尺码，合计列自动计算不参与编辑（合计 = 各码数之和）
    const sizeCount = len > 1 ? len - 1 : 1
    const cutSizeValues = cutRow.slice(0, sizeCount)
    const hasAnyCutValue = cutSizeValues.some((v) => v != null && !Number.isNaN(Number(v)))
    const defaultSource = hasAnyCutValue ? cutRow : orderRow
    registerForm.sewingQuantities = defaultSource
      .slice(0, sizeCount)
      .map((v) => (v != null ? Number(v) : 0))
    while (registerForm.sewingQuantities.length < sizeCount) {
      registerForm.sewingQuantities.push(0)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载尺寸细数失败'))
    registerDialog.visible = false
  } finally {
    registerFormCompleteLoading.value = false
  }
}

function resetRegisterForm() {
  registerDialog.row = null
  registerForm.headers = []
  registerForm.orderRow = []
  registerForm.cutRow = []
  registerForm.sewingQuantities = []
  registerForm.defectQuantity = 0
  registerForm.defectReason = ''
  registerFormRef.value?.clearValidate()
}

async function submitRegister() {
  if (!registerDialog.row) return
  const total = registerSewingTotal.value
  if (total <= 0) {
    ElMessage.warning('请填写车缝数量')
    return
  }
  await registerFormRef.value?.validate().catch(() => {})
  registerDialog.submitting = true
  try {
    await completeSewing({
      orderId: registerDialog.row.orderId,
      sewingQuantity: total,
      defectQuantity: registerForm.defectQuantity,
      defectReason: registerForm.defectReason.trim(),
      sewingQuantities: registerForm.headers.length ? registerForm.sewingQuantities : undefined,
    })
    ElMessage.success('车缝登记完成，订单已进入待尾部')
    registerDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '操作失败'))
  } finally {
    registerDialog.submitting = false
  }
}

onMounted(() => {
  loadFactorySuppliers()
  load()
  void loadTabCounts()
})
</script>

<style scoped>
.sewing-page {
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

.sewing-table {
  flex: 1;
  min-height: 0;
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

.currency-prefix {
  color: var(--el-text-color-regular);
}

.sewing-brief-extra {
  margin-top: 12px;
}
</style>
