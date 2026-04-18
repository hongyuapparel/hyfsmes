<template>
  <div class="page-card page-card--fill purchase-page">
    <!-- Tab：全部 / 等待采购 / 采购完成 -->
    <div class="status-tabs">
      <div class="status-tabs-left">
        <el-radio-group v-model="currentTab" size="large" @change="onTabChange">
          <el-radio-button
            v-for="tab in PURCHASE_TABS"
            :key="tab.value"
            :value="tab.value"
          >
            {{ getTabLabel(tab) }}
          </el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <!-- 筛选区：与订单列表同一设计（下单时间、订单号、SKU、供应商、订单类型） -->
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
      <el-input
        v-model="filter.supplier"
        placeholder="供应商"
        clearable
        size="large"
        class="filter-bar-item"
        :input-style="getFilterInputStyle(filter.supplier)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      />
      <el-tree-select
        v-model="filter.orderTypeId"
        :data="orderTypeTreeSelectData"
        placeholder="订单类型"
        filterable
        clearable
        default-expand-all
        :render-after-expand="false"
        node-key="value"
        :props="{ label: 'label', value: 'value', children: 'children', disabled: 'disabled' }"
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.orderTypeId && `订单类型：${findOrderTypeLabelById(filter.orderTypeId)}`,
          )
        "
        @change="onSearch"
      >
        <template #prefix>
          <span
            v-if="filter.orderTypeId"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            订单类型：
          </span>
        </template>
      </el-tree-select>
      <el-date-picker
        v-model="orderDateRange"
        type="daterange"
        range-separator=""
        start-placeholder="下单时间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        size="large"
        class="filter-bar-item"
        :style="getFilterRangeStyle(orderDateRange)"
        @change="onSearch"
      />
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button
          v-if="hasSelection"
          type="primary"
          size="large"
          @click="onBatchHandle"
        >
          {{ currentTab === 'picking' ? '领料' : '登记实际采购' }}
        </el-button>
      </div>
    </div>

    <div v-if="hasSelection" class="table-selection-count">已选 {{ selectedRows.length }} 项</div>

    <!-- 物料列表表格 -->
    <div ref="tableShellRef" class="list-page-table-shell">
    <el-table
      ref="purchaseTableRef"
      v-loading="loading"
      :data="list"
      border
      stripe
      class="purchase-table"
      :height="tableHeight"
      :row-style="compactRowStyle"
      :cell-style="compactCellStyle"
      :header-cell-style="compactHeaderCellStyle"
      @header-dragend="onHeaderDragEnd"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column prop="orderNo" label="订单号" min-width="100" />
      <el-table-column prop="skuCode" label="SKU" min-width="100" />
      <el-table-column label="图片" :min-width="compactImageColumnMinWidth" align="center">
        <template #default="{ row }">
          <AppImageThumb
            v-if="row.imageUrl"
            :raw-url="row.imageUrl"
            :width="compactImageSize"
            :height="compactImageSize"
          />
          <span v-else class="text-muted">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="customerName" label="客户" min-width="90" show-overflow-tooltip />
      <el-table-column prop="merchandiser" label="跟单" width="80" show-overflow-tooltip />
      <el-table-column label="客户交期" width="110" align="center">
        <template #default="{ row }">{{ formatDate(row.customerDueDate) }}</template>
      </el-table-column>
      <el-table-column label="订单件数" width="88" align="right">
        <template #default="{ row }">{{ formatDisplayNumber(row.orderQuantity) }}</template>
      </el-table-column>
      <el-table-column prop="pendingPurchaseAt" label="到采购时间" width="155" align="center">
        <template #default="{ row }">
          {{ formatDateTime(row.pendingPurchaseAt) }}
        </template>
      </el-table-column>
      <el-table-column prop="purchaseCompletedAt" label="完成时间" width="155" align="center">
        <template #default="{ row }">
          {{ formatDateTime(row.processRoute === 'picking' ? row.pickCompletedAt : row.purchaseCompletedAt) }}
        </template>
      </el-table-column>
      <el-table-column label="时效判定" width="96" align="center">
        <template #default="{ row }">
          <SlaJudgeTag :text="row.timeRating" />
        </template>
      </el-table-column>
      <el-table-column prop="purchaseStatus" :label="materialProgressColumnLabel" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="displayStatus(row) === 'completed' ? 'success' : 'warning'" size="small">
            {{ displayStatusLabel(row) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="概要" width="64" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="openPurchaseBriefDrawer(row)">查看</el-button>
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

    <ProductionDetailDrawerShell
      v-model="purchaseBriefDrawer.visible"
      title="订单与物料概要"
      @closed="purchaseBriefDrawer.row = null"
    >
      <template v-if="purchaseBriefDrawer.row">
        <ProductionDetailSection>
          <ProductionOrderBriefPanel :brief="purchaseBriefFromRow(purchaseBriefDrawer.row)" />
        </ProductionDetailSection>
        <ProductionDetailSection title="本行物料">
          <el-descriptions :column="2" border size="small" class="purchase-brief-material">
            <el-descriptions-item label="物料序号">
              {{ purchaseBriefDrawer.row.materialIndex + 1 }}
            </el-descriptions-item>
            <el-descriptions-item label="处理路线">
              {{ purchaseBriefDrawer.row.processRoute === 'picking' ? '领料' : '采购' }}
            </el-descriptions-item>
            <el-descriptions-item label="订单类型">
              {{ orderTypeDisplay(purchaseBriefDrawer.row) || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="物料类型">
              {{ (purchaseBriefDrawer.row.materialType ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="物料名称">
              {{ (purchaseBriefDrawer.row.materialName ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="颜色">
              {{ (purchaseBriefDrawer.row.color ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="供应商">
              {{ (purchaseBriefDrawer.row.supplierName ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="物料来源">
              {{ (purchaseBriefDrawer.row.materialSource ?? '').trim() || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="计划用量">
              {{
                purchaseBriefDrawer.row.planQuantity != null
                  ? formatDisplayNumber(purchaseBriefDrawer.row.planQuantity)
                  : '—'
              }}
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="采购登记信息">
          <el-descriptions :column="2" border size="small" class="purchase-brief-material">
            <el-descriptions-item label="实际采购数量">
              {{
                purchaseBriefDrawer.row.actualPurchaseQuantity != null
                  ? formatDisplayNumber(purchaseBriefDrawer.row.actualPurchaseQuantity)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="单价(元)">
              {{
                purchaseBriefDrawer.row.purchaseUnitPrice != null && purchaseBriefDrawer.row.purchaseUnitPrice !== ''
                  ? formatDisplayNumber(purchaseBriefDrawer.row.purchaseUnitPrice)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="其他费用(元)">
              {{
                purchaseBriefDrawer.row.purchaseOtherCost != null && purchaseBriefDrawer.row.purchaseOtherCost !== ''
                  ? formatDisplayNumber(purchaseBriefDrawer.row.purchaseOtherCost)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="采购总金额(元)">
              {{
                purchaseBriefDrawer.row.purchaseAmount != null && purchaseBriefDrawer.row.purchaseAmount !== ''
                  ? formatDisplayNumber(purchaseBriefDrawer.row.purchaseAmount)
                  : '—'
              }}
            </el-descriptions-item>
            <el-descriptions-item label="采购凭证">
              <AppImageThumb
                v-if="purchaseBriefDrawer.row.purchaseImageUrl"
                :raw-url="purchaseBriefDrawer.row.purchaseImageUrl"
                variant="compact"
              />
              <span v-else>—</span>
            </el-descriptions-item>
            <el-descriptions-item label="采购备注">
              {{ (purchaseBriefDrawer.row.purchaseRemark ?? '').trim() || '—' }}
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
        <ProductionDetailSection title="时效与节点">
          <el-descriptions :column="2" border size="small" class="purchase-brief-material">
            <el-descriptions-item label="到采购时间">
              {{ formatDateTime(purchaseBriefDrawer.row.pendingPurchaseAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="完成时间">
              {{
                formatDateTime(
                  purchaseBriefDrawer.row.processRoute === 'picking'
                    ? purchaseBriefDrawer.row.pickCompletedAt
                    : purchaseBriefDrawer.row.purchaseCompletedAt,
                )
              }}
            </el-descriptions-item>
            <el-descriptions-item label="时效判定">
              <SlaJudgeTag :text="purchaseBriefDrawer.row.timeRating" />
            </el-descriptions-item>
          </el-descriptions>
        </ProductionDetailSection>
      </template>
    </ProductionDetailDrawerShell>

    <!-- 登记实际采购弹窗 -->
    <el-dialog
      v-model="registerDialog.visible"
      title="登记实际采购"
      width="560"
      destroy-on-close
      @close="resetRegisterForm"
    >
      <template v-if="registerDialog.row">
        <div class="register-brief">
          <div>订单号：{{ registerDialog.row.orderNo }}</div>
          <div>物料：{{ registerDialog.row.materialName }}</div>
          <div>供应商：{{ registerDialog.row.supplierName }}</div>
        </div>
        <el-form
          ref="registerFormRef"
          :model="registerForm"
          :rules="registerRules"
          label-width="110px"
          class="register-form"
        >
          <el-form-item label="实际采购数量" prop="actualPurchaseQuantity">
            <el-input-number
              v-model="registerForm.actualPurchaseQuantity"
              :min="0"
              :precision="0"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="单价">
            <el-input
              v-model="registerForm.unitPrice"
              placeholder="元 / 单位"
              clearable
            >
              <template #prepend>￥</template>
            </el-input>
          </el-form-item>
          <el-form-item label="其他费用">
            <el-input
              v-model="registerForm.otherCost"
              placeholder="如运费、杂费，元"
              clearable
            >
              <template #prepend>￥</template>
            </el-input>
          </el-form-item>
          <el-form-item label="采购总金额">
            <el-input
              v-model="registerForm.purchaseAmount"
              placeholder="自动计算"
              disabled
            >
              <template #prepend>￥</template>
            </el-input>
          </el-form-item>
          <el-form-item label="采购凭证">
            <ImageUploadArea v-model="registerForm.imageUrl" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input
              v-model="registerForm.remark"
              type="textarea"
              :rows="3"
              maxlength="200"
              show-word-limit
              placeholder="本次采购的补充说明"
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

    <el-dialog
      v-model="pickDialog.visible"
      title="领料"
      width="620"
      destroy-on-close
      @close="resetPickForm"
    >
      <template v-if="pickDialog.row">
        <div class="register-brief pick-brief-grid">
          <div><span class="pick-brief-label">订单号：</span>{{ pickDialog.row.orderNo }}</div>
          <div><span class="pick-brief-label">SKU：</span>{{ pickDialog.row.skuCode }}</div>
          <div><span class="pick-brief-label">物料：</span>{{ pickDialog.row.materialName }}</div>
          <div><span class="pick-brief-label">物料类型：</span>{{ displayMaterialType(pickDialog.row) }}</div>
          <div><span class="pick-brief-label">物料来源：</span>{{ pickDialog.row.materialSource || '-' }}</div>
          <div><span class="pick-brief-label">颜色：</span>{{ pickDialog.row.color || '-' }}</div>
          <div>
            <span class="pick-brief-label">计划用量：</span>{{ pickDialog.row.planQuantity != null ? formatDisplayNumber(pickDialog.row.planQuantity) : '-' }} 米
          </div>
          <div v-if="pickDialog.total > 1"><span class="pick-brief-label">当前处理：</span>{{ pickDialog.index + 1 }} / {{ pickDialog.total }}</div>
        </div>
        <el-alert
          v-if="pickDialog.row.materialSource === '客供面料'"
          type="warning"
          :closable="false"
          title="请联系对应业务员或跟单领取客供面料"
          style="margin-bottom: 12px"
        />
        <el-form ref="pickFormRef" :model="pickForm" :rules="pickRules" label-width="120px">
          <el-form-item label="库存来源类型">
            <el-select v-model="pickForm.inventorySourceType" clearable placeholder="可选（不选则仅备注处理）" @change="onPickSourceTypeChange">
              <el-option label="面料库存" value="fabric" />
              <el-option label="辅料库存" value="accessory" />
              <el-option label="成衣库存" value="finished" />
            </el-select>
          </el-form-item>
          <el-form-item label="具体库存">
            <el-select v-model="pickForm.inventoryId" clearable filterable placeholder="先选择库存来源类型" :disabled="!pickForm.inventorySourceType">
              <el-option v-for="opt in pickInventoryOptions" :key="opt.id" :label="opt.label" :value="opt.id">
                <div class="pick-stock-option">
                  <AppImageThumb
                    v-if="opt.imageUrl"
                    :raw-url="opt.imageUrl"
                    :width="28"
                    :height="28"
                  />
                  <span v-else class="pick-stock-thumb-empty">-</span>
                  <span class="pick-stock-option-label">{{ opt.label }}</span>
                </div>
              </el-option>
            </el-select>
          </el-form-item>
          <el-form-item label="调取数量" prop="quantity">
            <div class="pick-qty-row">
              <el-input-number v-model="pickForm.quantity" :min="0" :precision="2" :controls="false" style="width: 100%" />
              <span class="pick-qty-unit">米</span>
            </div>
          </el-form-item>
          <el-form-item label="备注" prop="remark">
            <el-input v-model="pickForm.remark" type="textarea" :rows="3" maxlength="300" show-word-limit />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="pickDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="pickDialog.submitting" @click="submitPick">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { getPurchaseItems, registerPick, registerPurchase, type PurchaseItemRow, type PurchaseListQuery } from '@/api/production-purchase'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getDictTree } from '@/api/dicts'
import type { SystemOptionTreeNode } from '@/api/system-options'
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import { getAccessoriesList, getFabricList, getFinishedStockList } from '@/api/inventory'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getOrderNoFilterStyle,
  getSkuCodeFilterStyle,
  getFilterRangeStyle,
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
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useCompactTableStyle } from '@/composables/useCompactTableStyle'

const PURCHASE_TABS = [
  { label: '全部', value: 'all' },
  { label: '等待采购', value: 'pending' },
  { label: '待领料', value: 'picking' },
  { label: '采购完成', value: 'completed' },
] as const

type PurchaseTabConfig = (typeof PURCHASE_TABS)[number]

const orderTypeTree = ref<SystemOptionTreeNode[]>([])
function toOrderTypeTreeSelect(
  nodes: SystemOptionTreeNode[],
): { label: string; value: number; children?: unknown[]; disabled?: boolean }[] {
  return nodes.map((n) => {
    const children = n.children?.length ? toOrderTypeTreeSelect(n.children) : []
    const hasChildren = children.length > 0
    return {
      label: n.value,
      value: n.id,
      children: hasChildren ? children : undefined,
      disabled: hasChildren,
    }
  })
}
const orderTypeTreeSelectData = computed(() => toOrderTypeTreeSelect(orderTypeTree.value))

function findOrderTypeLabelById(id: number | null | undefined): string {
  if (!id) return ''
  const stack: SystemOptionTreeNode[] = [...orderTypeTree.value]
  while (stack.length) {
    const node = stack.pop()!
    if (node.id === id) return node.value
    if (node.children?.length) stack.push(...node.children)
  }
  return ''
}

const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR as string }
function getFilterSelectAutoWidthStyle(v: unknown) {
  if (!v) return undefined
  const text = String(v)
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { ...activeSelectStyle, width: `${width}px`, flex: `0 0 ${width}px` }
}

const filter = reactive({
  orderNo: '',
  skuCode: '',
  supplier: '',
  orderTypeId: null as number | null,
})
const orderDateRange = ref<[string, string] | null>(null)
const orderNoLabelVisible = ref(false)
const skuCodeLabelVisible = ref(false)

const currentTab = ref<string>('all')
const materialProgressColumnLabel = computed(() =>
  currentTab.value === 'picking' ? '领料状态' : '采购状态',
)
const tabCounts = ref<Record<string, number>>({})
const tabTotal = ref(0)
const list = ref<PurchaseItemRow[]>([])
const purchaseTableRef = ref()
const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)
const {
  compactHeaderCellStyle,
  compactCellStyle,
  compactRowStyle,
  compactImageSize,
  compactImageColumnMinWidth,
} = useCompactTableStyle()
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const selectedRows = ref<PurchaseItemRow[]>([])
const hasSelection = computed(() => selectedRows.value.length > 0)
const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('production-purchase-main')

function getTabLabel(tab: PurchaseTabConfig): string {
  const counts = tabCounts.value
  const count = tab.value === 'all' ? tabTotal.value : counts[tab.value] ?? 0
  return `${tab.label}(${count})`
}

const registerDialog = reactive<{
  visible: boolean
  submitting: boolean
  row: PurchaseItemRow | null
}>({ visible: false, submitting: false, row: null })
const registerFormRef = ref<FormInstance>()
const registerForm = reactive({
  actualPurchaseQuantity: 0,
  unitPrice: '',
  otherCost: '',
  purchaseAmount: '',
  remark: '',
  imageUrl: '',
})
const registerRules: FormRules = {
  actualPurchaseQuantity: [{ required: true, message: '请输入实际采购数量', trigger: 'blur' }],
}

type PickInventorySourceType = 'fabric' | 'accessory' | 'finished'
const pickDialog = reactive<{ visible: boolean; submitting: boolean; row: PurchaseItemRow | null; index: number; total: number }>({
  visible: false,
  submitting: false,
  row: null,
  index: 0,
  total: 0,
})
const pickFormRef = ref<FormInstance>()
const pickForm = reactive<{
  inventorySourceType: PickInventorySourceType | null
  inventoryId: number | null
  quantity: number | null
  remark: string
}>({
  inventorySourceType: null,
  inventoryId: null,
  quantity: null,
  remark: '',
})
const pickInventoryOptions = ref<Array<{ id: number; label: string; availableQuantity: number; imageUrl: string }>>([])
const pickRules: FormRules = {
  quantity: [
    {
      validator: (_rule, value, callback) => {
        const hasStock = !!(pickForm.inventorySourceType && pickForm.inventoryId)
        if (!hasStock) return callback()
        const qty = Number(value ?? 0)
        if (!Number.isFinite(qty) || qty <= 0) return callback(new Error('选择库存后，调取数量必须大于 0'))
        const selected = pickInventoryOptions.value.find((x) => x.id === pickForm.inventoryId)
        if (selected && qty > selected.availableQuantity) return callback(new Error('调取数量不能大于可用库存'))
        callback()
      },
      trigger: 'blur',
    },
  ],
  remark: [
    {
      validator: (_rule, value, callback) => {
        const hasStock = !!(pickForm.inventorySourceType && pickForm.inventoryId && Number(pickForm.quantity) > 0)
        if (hasStock) return callback()
        if (String(value ?? '').trim()) return callback()
        callback(new Error('未选择库存时请至少填写备注说明'))
      },
      trigger: 'blur',
    },
  ],
}

watch(
  () => [registerForm.actualPurchaseQuantity, registerForm.unitPrice, registerForm.otherCost] as const,
  ([qty, unit, other]) => {
    const q = Number(qty) || 0
    const parseNumber = (v: string) => {
      const cleaned = (v ?? '').replace(/[^\d.-]/g, '')
      const n = Number(cleaned)
      return Number.isNaN(n) ? 0 : n
    }
    const u = parseNumber(unit)
    const o = parseNumber(other)
    const total = q * u + o
    registerForm.purchaseAmount = Number.isFinite(total) ? formatDisplayNumber(total) : formatDisplayNumber(0)
  },
  { immediate: true },
)

function buildQuery(): PurchaseListQuery {
  const q: PurchaseListQuery = {
    tab: currentTab.value,
    orderNo: normalizeTextFilter(filter.orderNo),
    skuCode: normalizeTextFilter(filter.skuCode),
    supplier: normalizeTextFilter(filter.supplier),
    orderTypeId: filter.orderTypeId ?? undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  }
  if (orderDateRange.value && orderDateRange.value.length === 2) {
    q.orderDateStart = orderDateRange.value[0]
    q.orderDateEnd = orderDateRange.value[1]
  }
  return q
}

async function loadTabCounts() {
  const base = buildQuery()
  base.page = 1
  base.pageSize = 1
  const counts: Record<string, number> = {}
  await Promise.all(
    PURCHASE_TABS.map(async (tab) => {
      try {
        const res = await getPurchaseItems({ ...base, tab: tab.value })
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
    const res = await getPurchaseItems(buildQuery())
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      restoreColumnWidths(purchaseTableRef.value)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
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
  filter.supplier = ''
  filter.orderTypeId = null
  orderDateRange.value = null
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

function onSelectionChange(rows: PurchaseItemRow[]) {
  selectedRows.value = rows
}

function displayStatus(row: PurchaseItemRow): 'pending' | 'completed' {
  if (row.processRoute === 'picking') {
    return row.pickStatus === 'completed' ? 'completed' : 'pending'
  }
  return row.purchaseStatus === 'completed' ? 'completed' : 'pending'
}

function displayStatusLabel(row: PurchaseItemRow): string {
  if (row.processRoute === 'picking') return displayStatus(row) === 'completed' ? '领料完成' : '待领料'
  return displayStatus(row) === 'completed' ? '采购完成' : '等待采购'
}

function openRegisterDialog() {
  if (selectedRows.value.length === 0) return
  const row = selectedRows.value[0]
  registerDialog.row = row
  registerForm.actualPurchaseQuantity = row.actualPurchaseQuantity ?? row.planQuantity ?? 0
  registerForm.unitPrice = row.purchaseUnitPrice ?? ''
  registerForm.otherCost = row.purchaseOtherCost ?? ''
  registerForm.purchaseAmount = row.purchaseAmount ?? ''
  registerForm.remark = row.purchaseRemark ?? ''
  registerForm.imageUrl = row.purchaseImageUrl ?? ''
  registerDialog.visible = true
}

function onBatchHandle() {
  if (!hasSelection.value) return
  if (currentTab.value === 'picking') {
    openPickDialog()
    return
  }
  openRegisterDialog()
}

async function onPickSourceTypeChange(val: PickInventorySourceType | null) {
  pickForm.inventoryId = null
  pickInventoryOptions.value = []
  if (!val) return
  try {
    if (val === 'fabric') {
      const res = await getFabricList({ page: 1, pageSize: 200 })
      pickInventoryOptions.value = (res.data?.list ?? []).map((item) => ({
        id: item.id,
        label: `${item.name}（可用:${item.quantity}${item.unit ?? ''}）`,
        availableQuantity: Number(item.quantity) || 0,
        imageUrl: item.imageUrl ?? '',
      }))
      return
    }
    if (val === 'accessory') {
      const res = await getAccessoriesList({ page: 1, pageSize: 200 })
      pickInventoryOptions.value = (res.data?.list ?? []).map((item) => ({
        id: item.id,
        label: `${item.name}（可用:${item.quantity}${item.unit ?? ''}）`,
        availableQuantity: Number(item.quantity) || 0,
        imageUrl: item.imageUrl ?? '',
      }))
      return
    }
    const res = await getFinishedStockList({ tab: 'stored', page: 1, pageSize: 200 })
    pickInventoryOptions.value = (res.data?.list ?? []).map((item) => ({
      id: item.id,
      label: `${item.skuCode}（可用:${item.quantity}）`,
      availableQuantity: Number(item.quantity) || 0,
      imageUrl: item.imageUrl ?? '',
    }))
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '库存列表加载失败'))
  }
}

function openPickDialog() {
  const row = selectedRows.value[0]
  if (!row) return
  pickDialog.row = row
  pickDialog.index = 0
  pickDialog.total = selectedRows.value.length
  pickDialog.visible = true
}

function resetPickForm() {
  pickDialog.row = null
  pickDialog.index = 0
  pickDialog.total = 0
  pickForm.inventorySourceType = null
  pickForm.inventoryId = null
  pickForm.quantity = null
  pickForm.remark = ''
  pickInventoryOptions.value = []
  pickFormRef.value?.clearValidate()
}

async function submitPick() {
  if (!pickDialog.row) return
  const rows = selectedRows.value.slice()
  if (!rows.length) return
  pickDialog.submitting = true
  try {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      pickDialog.row = row
      pickDialog.index = i
      pickDialog.total = rows.length
      await pickFormRef.value?.validate()
      await registerPick({
        orderId: row.orderId,
        materialIndex: row.materialIndex,
        inventorySourceType: pickForm.inventorySourceType,
        inventoryId: pickForm.inventoryId,
        quantity: pickForm.quantity,
        remark: pickForm.remark.trim() || null,
      })
    }
    ElMessage.success('领料处理成功')
    pickDialog.visible = false
    await load()
    void loadTabCounts()
    selectedRows.value = []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '领料处理失败'))
  } finally {
    pickDialog.submitting = false
  }
}

function resetRegisterForm() {
  registerDialog.row = null
  registerForm.actualPurchaseQuantity = 0
  registerForm.purchaseAmount = ''
  registerForm.unitPrice = ''
  registerForm.otherCost = ''
  registerForm.remark = ''
  registerForm.imageUrl = ''
  registerFormRef.value?.clearValidate()
}

async function submitRegister() {
  if (!registerDialog.row) return
  await registerFormRef.value?.validate().catch(() => {})
  registerDialog.submitting = true
  try {
    await registerPurchase({
      orderId: registerDialog.row.orderId,
      materialIndex: registerDialog.row.materialIndex,
      actualPurchaseQuantity: registerForm.actualPurchaseQuantity,
      unitPrice: registerForm.unitPrice.trim() || '0',
      otherCost: registerForm.otherCost.trim() || '0',
      remark: registerForm.remark.trim(),
      imageUrl: registerForm.imageUrl.trim(),
    })
    ElMessage.success('登记成功')
    registerDialog.visible = false
    await load()
    void loadTabCounts()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '登记失败'))
  } finally {
    registerDialog.submitting = false
  }
}

async function loadOptions() {
  try {
    const res = await getDictTree('order_types')
    orderTypeTree.value = Array.isArray(res.data) ? res.data : []
  } catch {
    orderTypeTree.value = []
  }
}

function orderTypeDisplay(row: PurchaseItemRow): string {
  if (typeof row.orderTypeId === 'number') {
    const label = findOrderTypeLabelById(row.orderTypeId)
    if (label && label.trim()) return label.trim()
  }
  return ''
}

const purchaseBriefDrawer = reactive<{ visible: boolean; row: PurchaseItemRow | null }>({
  visible: false,
  row: null,
})

function openPurchaseBriefDrawer(row: PurchaseItemRow) {
  purchaseBriefDrawer.row = row
  purchaseBriefDrawer.visible = true
}

function purchaseBriefFromRow(row: PurchaseItemRow): ProductionOrderBriefModel {
  return {
    orderNo: row.orderNo,
    skuCode: row.skuCode,
    imageUrl: row.imageUrl,
    customerName: row.customerName,
    merchandiser: row.merchandiser,
    customerDueDate: row.customerDueDate,
    orderQuantity: row.orderQuantity,
    orderDate: row.orderDate,
    orderTypeLabel: orderTypeDisplay(row),
  }
}

function displayMaterialType(row: PurchaseItemRow): string {
  return (row.materialType ?? '').trim() || '-'
}

onMounted(() => {
  loadOptions()
  load()
  void loadTabCounts()
})
</script>

<style scoped>
.purchase-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
  min-height: 0;
}

.status-tabs {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.status-tabs-left {
  flex-shrink: 0;
}

.purchase-table {
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
  color: var(--el-text-color-regular);
}

.register-brief > div + div {
  margin-top: 4px;
}

.pick-brief-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 16px;
}

.pick-brief-grid > div + div {
  margin-top: 0;
}

.pick-brief-label {
  color: var(--el-text-color-secondary);
}

.pick-stock-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pick-stock-thumb {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px solid var(--el-border-color-lighter);
  flex: 0 0 auto;
}

.pick-stock-thumb-empty {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 1px dashed var(--el-border-color-lighter);
  color: var(--el-text-color-placeholder);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
}

.pick-stock-option-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pick-qty-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.pick-qty-unit {
  color: var(--el-text-color-secondary);
  flex: 0 0 auto;
}

.register-form {
  margin-top: var(--space-sm);
}

.register-form :deep(.el-form-item__label) {
  white-space: normal;
  line-height: 1.3;
}
</style>
