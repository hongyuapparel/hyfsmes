<template>
  <div class="page-card order-cost-page">
    <div class="page-header">
      <div class="left">
        <el-button link type="primary" @click="goBack">返回列表</el-button>
        <span class="title">订单成本</span>
        <span v-if="order" class="sub-title">{{ order.orderNo }} · {{ order.skuCode }}</span>
      </div>
      <div class="header-actions">
        <el-button :loading="savingDraft" :disabled="!canSubmitCost || confirmingQuote" @click="saveDraft">
          保存草稿
        </el-button>
        <el-button
          type="primary"
          :loading="confirmingQuote"
          :disabled="!canSubmitCost || savingDraft"
          @click="confirmQuote"
        >
          确认报价
        </el-button>
      </div>
    </div>

    <!-- 订单摘要 -->
    <el-card class="block-card summary-card" shadow="never">
      <div class="order-summary">
        <span><strong>客户：</strong>{{ order?.customerName ?? '-' }}</span>
        <span><strong>数量：</strong>{{ order?.quantity ?? 0 }}</span>
        <span><strong>当前销售价：</strong>{{ order?.salePrice ?? '-' }} 元</span>
        <span class="cost-notice">{{ costNotice }}</span>
      </div>
    </el-card>

    <!-- 物料成本 -->
    <el-card class="block-card table-card" shadow="never">
      <template #header>
        <div class="block-header">
          <span class="block-title">物料成本</span>
          <el-button link type="primary" size="small" @click="addMaterialRow">新增</el-button>
        </div>
      </template>
      <el-table :data="materialRows" border size="small" class="cost-table">
        <el-table-column label="物料类型" min-width="90">
          <template #default="{ row }">
            <el-select
              v-model="row.materialTypeId"
              placeholder="选择物料类型"
              filterable
              clearable
              size="small"
            >
              <el-option
                v-for="opt in materialTypeOptions"
                :key="opt.id"
                :label="opt.label"
                :value="opt.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="供应商" min-width="100">
          <template #default="{ row }">
            <el-select
              v-model="row.supplierName"
              placeholder="选择或输入供应商"
              filterable
              allow-create
              default-first-option
              :remote-method="searchSuppliers"
              remote
              :loading="supplierLoading"
              size="small"
            >
              <el-option
                v-for="s in supplierOptions"
                :key="s.id"
                :label="s.name"
                :value="s.name"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="物料名称" min-width="140">
          <template #default="{ row }">
            <el-input v-model="row.materialName" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="颜色" min-width="100">
          <template #default="{ row }">
            <el-input v-model="row.color" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="幅宽(cm)" width="100" align="right">
          <template #default="{ row }">
            <el-input v-model="row.fabricWidth" size="small" placeholder="如 183cm" />
          </template>
        </el-table-column>
        <el-table-column label="单件用量" width="82" align="right">
          <template #default="{ row }">
            <el-input-number
              v-model="row.usagePerPiece"
              :min="0"
              :controls="false"
              size="small"
            />
          </template>
        </el-table-column>
        <el-table-column label="损耗%" width="72" align="right">
          <template #default="{ row }">
            <el-input-number
              v-model="row.lossPercent"
              :min="0"
              :controls="false"
              size="small"
            />
          </template>
        </el-table-column>
        <el-table-column label="单价(元)" width="90" align="right">
          <template #default="{ row }">
            <el-input-number
              v-model="row.unitPrice"
              :min="0"
              :precision="2"
              :controls="false"
              size="small"
              class="price-input"
            />
          </template>
        </el-table-column>
        <el-table-column label="金额(元)" width="90" align="right">
          <template #default="{ row }">
            {{ formatMoney(materialAmount(row)) }}
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.remark" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="56" fixed="right" align="center">
          <template #default="{ $index }">
            <el-button link type="danger" size="small" @click="removeMaterialRow($index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="subtotal">物料小计：<strong>{{ formatMoney(materialTotal) }}</strong> 元</div>
    </el-card>

    <!-- 工艺项目成本 -->
    <el-card class="block-card table-card" shadow="never">
      <template #header>
        <div class="block-header">
          <span class="block-title">工艺项目成本</span>
          <el-button link type="primary" size="small" @click="addProcessItemRow">新增</el-button>
        </div>
      </template>
      <el-table :data="processItemRows" border size="small" class="cost-table">
        <el-table-column label="工艺项目" min-width="120">
          <template #default="{ row }">
            <el-tree-select
              v-model="row.processName"
              placeholder="选择工艺项目"
              filterable
              clearable
              check-strictly
              :data="processOptions"
              :props="{ label: 'label', value: 'value', children: 'children' }"
              size="small"
              style="width: 100%"
            />
          </template>
        </el-table-column>
        <el-table-column label="供应商" min-width="100">
          <template #default="{ row }">
            <el-select
              v-model="row.supplierName"
              placeholder="选择供应商"
              filterable
              clearable
              :remote-method="searchSuppliers"
              remote
              :loading="supplierLoading"
              size="small"
            >
              <el-option
                v-for="s in supplierOptions"
                :key="s.id"
                :label="s.name"
                :value="s.name"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="部位" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.part" placeholder="如：前幅 / 后幅 / 袖子" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="工艺说明 / 备注" min-width="160">
          <template #default="{ row }">
            <el-input v-model="row.remark" placeholder="说明 / 备注" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="单价(元)" width="90" align="right">
          <template #default="{ row }">
            <el-input-number
              v-model="row.unitPrice"
              :min="0"
              :precision="2"
              :controls="false"
              size="small"
              class="price-input"
            />
          </template>
        </el-table-column>
        <el-table-column label="数量" width="80" align="right">
          <template #default="{ row }">
            <el-input-number
              v-model="row.quantity"
              :min="0"
              :controls="false"
              size="small"
            />
          </template>
        </el-table-column>
        <el-table-column label="金额(元)" width="90" align="right">
          <template #default="{ row }">
            {{ formatMoney(processItemAmount(row)) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="56" fixed="right" align="center">
          <template #default="{ $index }">
            <el-button link type="danger" size="small" @click="removeProcessItemRow($index)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="subtotal">工艺项目小计：<strong>{{ formatMoney(processItemTotal) }}</strong> 元</div>
    </el-card>

    <!-- 生产工序成本（部门/工种合并单元格，部门顺序：裁床→车缝→尾部） -->
    <el-card class="block-card table-card" shadow="never">
      <template #header>
        <div class="block-header">
          <span class="block-title">生产工序成本</span>
          <div class="block-header-actions">
            <el-button link type="primary" size="small" @click="openImportTemplateDialog">导入模板</el-button>
            <el-button link type="primary" size="small" @click="addProductionRow">新增</el-button>
          </div>
        </div>
      </template>
      <el-table
        :data="productionRowsSorted"
        border
        size="small"
        class="cost-table"
        :span-method="productionSpanMethod"
      >
        <el-table-column label="部门" min-width="100">
          <template #default="{ row }">
            <el-select
              v-model="row.department"
              placeholder="选择部门"
              filterable
              allow-create
              default-first-option
              size="small"
            >
              <el-option
                v-for="d in departmentOptions"
                :key="d"
                :label="d"
                :value="d"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="工种" min-width="100">
          <template #default="{ row }">
            <el-select
              v-model="row.jobType"
              placeholder="选择工种"
              filterable
              allow-create
              default-first-option
              size="small"
            >
              <el-option
                v-for="j in jobTypeOptions"
                :key="j"
                :label="getJobTypeLabel(j)"
                :value="j"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="工序" min-width="140">
          <template #default="{ row }">
            <el-select
              v-model="row.processId"
              placeholder="选择工序"
              filterable
              clearable
              size="small"
              @change="onProductionProcessChange(row)"
            >
              <el-option
                v-for="p in productionProcesses"
                :key="p.id"
                :label="formatProductionProcessLabel(p)"
                :value="p.id"
              />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="单价(元)" width="90" align="right">
          <template #default="{ row }">
            <el-input-number
              v-model="row.unitPrice"
              :min="0"
              :precision="2"
              :controls="false"
              size="small"
              class="price-input"
            />
          </template>
        </el-table-column>
        <el-table-column label="小计(元)" width="90" align="right">
          <template #default="{ row }">
            {{ formatMoney(productionAmount(row)) }}
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="120">
          <template #default="{ row }">
            <el-input v-model="row.remark" size="small" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="56" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="danger" size="small" @click="removeProductionRow(row)">
              <el-icon><Delete /></el-icon>
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="!productionProcesses.length" class="empty-hint">
        暂无配置工序，请在系统设置中维护生产工序部门/工种/工序及单价。
      </p>
      <div class="subtotal">生产工序小计：<strong>{{ formatMoney(productionProcessTotal) }}</strong> 元</div>
      <el-dialog
        v-model="importTemplateDialog.visible"
        title="导入工序模板"
        width="400px"
        @close="importTemplateDialog.templateId = null"
      >
        <p class="import-template-hint">选择服装类型模板，将其中工序一键填入下方表格，再按款式做个别增减。</p>
        <el-select
          v-model="importTemplateDialog.templateId"
          placeholder="选择模板"
          filterable
          clearable
          style="width: 100%"
        >
          <el-option
            v-for="t in importTemplateOptions"
            :key="t.id"
            :label="t.name"
            :value="t.id"
          />
        </el-select>
        <template #footer>
          <el-button @click="importTemplateDialog.visible = false">取消</el-button>
          <el-button type="primary" :disabled="!importTemplateDialog.templateId" @click="applyImportTemplate">
            确定导入
          </el-button>
        </template>
      </el-dialog>
    </el-card>

    <!-- 汇总与出厂价 -->
    <el-card class="block-card result-card" shadow="never">
      <template #header>
        <div class="block-header">
          <span class="block-title">成本汇总与出厂价</span>
        </div>
      </template>
      <div class="result-rows">
        <div class="result-row">
          <span>物料小计</span>
          <span>{{ formatMoney(materialTotal) }} 元</span>
        </div>
        <div class="result-row">
          <span>工艺项目小计</span>
          <span>{{ formatMoney(processItemTotal) }} 元</span>
        </div>
        <div class="result-row">
          <span>生产工序小计</span>
          <span>{{ formatMoney(productionProcessTotal) }} 元</span>
        </div>
        <div class="result-row total-cost">
          <span>总成本</span>
          <span>{{ formatMoney(totalCost) }} 元</span>
        </div>
        <div class="result-row profit-row">
          <span>利润率（小数，如 0.1 表示 10%）</span>
          <el-input-number
            v-model="profitMargin"
            :min="0"
            :max="0.99"
            :step="0.01"
            :precision="2"
            size="small"
            class="profit-input"
          />
        </div>
        <div class="result-row ex-factory">
          <span>计算得出出厂价</span>
          <span class="ex-factory-value">{{ formatMoney(computedExFactoryPrice) }} 元</span>
        </div>
      </div>
      <div class="result-actions">
        <el-button @click="goBack">取消</el-button>
        <el-button :loading="savingDraft" :disabled="!canSubmitCost || confirmingQuote" @click="saveDraft">
          保存草稿
        </el-button>
        <el-button
          type="primary"
          :loading="confirmingQuote"
          :disabled="!canSubmitCost || savingDraft"
          @click="confirmQuote"
        >
          确认报价
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { confirmOrderCost, getOrderDetail, getOrderCost, saveOrderCost, type OrderDetail } from '@/api/orders'
import { getProductionProcesses, type ProductionProcessItem } from '@/api/production-processes'
import { getProcessQuoteTemplates, getProcessQuoteTemplateItems } from '@/api/process-quote-templates'
import request, { getErrorMessage, isErrorHandled } from '@/api/request'
import { getDictItems } from '@/api/dicts'
import {
  getSupplierBusinessScopeTreeOptions,
  type SupplierBusinessScopeTreeNode,
} from '@/api/suppliers'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const orderId = computed(() => {
  const v = route.params.id
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
})

const order = ref<OrderDetail | null>(null)
const materialRows = ref<MaterialRow[]>([])
const processItemRows = ref<ProcessItemRow[]>([])
const productionProcesses = ref<ProductionProcessItem[]>([])
const productionRows = ref<ProductionRow[]>([])
const profitMargin = ref(0.1)
const savingDraft = ref(false)
const confirmingQuote = ref(false)
const quoteConfirmedAt = ref('')
const quoteConfirmedBy = ref('')
const quoteNeedsReconfirm = ref(false)
const loadedSnapshotHash = ref('')

const materialTypeOptions = ref<{ id: number; label: string }[]>([])
const supplierOptions = ref<{ id: number; name: string }[]>([])
const supplierLoading = ref(false)
interface ProcessOptionNode {
  label: string
  value: string
  children?: ProcessOptionNode[]
}

const processOptions = ref<ProcessOptionNode[]>([])

const importTemplateDialog = ref<{ visible: boolean; templateId: number | null }>({ visible: false, templateId: null })
const importTemplateOptions = ref<{ id: number; name: string }[]>([])

interface MaterialRow {
  materialTypeId?: number | null
  materialType?: string
  supplierName?: string
  materialName?: string
  color?: string
  fabricWidth?: string
  usagePerPiece?: number | null
  lossPercent?: number | null
  orderPieces?: number | null
  purchaseQuantity?: number | null
  cuttingQuantity?: number | null
  remark?: string
  unitPrice: number
}

interface ProcessItemRow {
  processName?: string
  supplierName?: string
  part?: string
  remark?: string
  unitPrice: number
  quantity: number
}

interface ProductionRow {
  processId?: number | null
  department?: string
  jobType?: string
  processName?: string
  remark?: string
  unitPrice: number
}

function materialAmount(row: MaterialRow): number {
  const usage = Number(row.usagePerPiece) || 0
  const lossPercent = Number(row.lossPercent) || 0
  const price = Number(row.unitPrice) || 0
  const lossRate = lossPercent / 100
  return usage * (1 + lossRate) * price
}

function processItemAmount(row: ProcessItemRow): number {
  const qty = Number(row.quantity) || 0
  const price = Number(row.unitPrice) || 0
  return qty * price
}

const materialTotal = computed(() =>
  materialRows.value.reduce((sum, row) => sum + materialAmount(row), 0)
)
const processItemTotal = computed(() =>
  processItemRows.value.reduce((sum, row) => sum + processItemAmount(row), 0)
)
const productionProcessTotal = computed(() =>
  productionRows.value.reduce((sum, row) => sum + productionAmount(row), 0)
)
const totalCost = computed(() => materialTotal.value + processItemTotal.value + productionProcessTotal.value)
const computedExFactoryPrice = computed(() => {
  const cost = totalCost.value
  const margin = Number(profitMargin.value) || 0
  if (margin >= 1) return cost
  return cost / (1 - margin)
})

function formatMoney(n: number): string {
  return Number.isNaN(n) ? '0.00' : n.toFixed(2)
}

function normalizeProfitMargin(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || n < 0) return 0.1
  // 历史默认值兼容：旧数据中的 0.15 视为默认，统一迁移到 0.1
  if (Math.abs(n - 0.15) < 1e-9) return 0.1
  return n
}

const canSubmitCost = computed(() => authStore.hasPermission('orders_cost_submit'))

function formatTimeLabel(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString()
}

function buildSnapshotPayload() {
  return {
    materialRows: materialRows.value.map((row) => ({
      materialTypeId: row.materialTypeId ?? null,
      supplierName: row.supplierName ?? '',
      materialName: row.materialName ?? '',
      color: row.color ?? '',
      fabricWidth: row.fabricWidth ?? '',
      usagePerPiece: row.usagePerPiece ?? null,
      lossPercent: row.lossPercent ?? null,
      orderPieces: row.orderPieces ?? null,
      purchaseQuantity: row.purchaseQuantity ?? null,
      cuttingQuantity: row.cuttingQuantity ?? null,
      remark: row.remark ?? '',
      unitPrice: row.unitPrice,
    })),
    processItemRows: processItemRows.value.map((row) => ({
      processName: row.processName ?? '',
      supplierName: row.supplierName ?? '',
      part: row.part ?? '',
      remark: row.remark ?? '',
      unitPrice: row.unitPrice,
      quantity: row.quantity ?? 0,
    })),
    productionRows: productionRows.value.map((row) => ({
      processId: row.processId ?? null,
      department: row.department ?? '',
      jobType: row.jobType ?? '',
      processName: row.processName ?? '',
      unitPrice: row.unitPrice,
      remark: row.remark ?? '',
    })),
    profitMargin: profitMargin.value,
  }
}

const currentSnapshotHash = computed(() => JSON.stringify(buildSnapshotPayload()))
const hasLocalDraftChanges = computed(
  () => !!loadedSnapshotHash.value && currentSnapshotHash.value !== loadedSnapshotHash.value,
)

const costNotice = computed(() => {
  if (!canSubmitCost.value) {
    return '你没有“订单成本可提交”权限：可在页面试算，但不能保存草稿或确认报价。'
  }
  if (quoteConfirmedAt.value && hasLocalDraftChanges.value) {
    return '当前成本已被修改但尚未确认报价，订单卡片仍显示上次已确认出厂价。'
  }
  if (quoteNeedsReconfirm.value) {
    return '当前为草稿版本，尚未确认报价，不会同步到订单卡片。'
  }
  if (quoteConfirmedAt.value) {
    const by = quoteConfirmedBy.value || '未知用户'
    const at = formatTimeLabel(quoteConfirmedAt.value)
    return `最近一次确认报价：${by}${at ? `（${at}）` : ''}`
  }
  return '当前尚未确认报价，订单卡片将继续显示上次已确认价格。'
})

/** 部门固定显示顺序（生产工序成本表格合并与排序用） */
const DEPARTMENT_ORDER = ['裁床', '车缝', '尾部']

const departmentOptions = computed(() =>
  Array.from(new Set(productionProcesses.value.map((p) => p.department).filter((v) => !!v)))
)

const jobTypeOptions = computed(() =>
  Array.from(new Set(productionProcesses.value.map((p) => p.jobType).filter((v) => !!v)))
)

/** 生产工序行按部门(裁床→车缝→尾部)、工种、工序排序，用于表格展示与合并 */
const productionRowsSorted = computed(() => {
  const rows = [...productionRows.value]
  const orderMap = new Map(DEPARTMENT_ORDER.map((d, i) => [d, i]))
  const depIndex = (d: string) => orderMap.get(d ?? '') ?? DEPARTMENT_ORDER.length
  return rows.sort((a, b) => {
    const da = depIndex(a.department)
    const db = depIndex(b.department)
    if (da !== db) return da - db
    const jta = (a.jobType ?? '').toString()
    const jtb = (b.jobType ?? '').toString()
    if (jta !== jtb) return jta.localeCompare(jtb)
    const pna = (a.processName ?? '').toString()
    const pnb = (b.processName ?? '').toString()
    return pna.localeCompare(pnb)
  })
})

/** 生产工序表格合并：部门列、工种列连续相同则合并 */
function productionSpanMethod({
  row,
  columnIndex,
  rowIndex,
}: {
  row: ProductionRow
  columnIndex: number
  rowIndex: number
}): { rowspan: number; colspan: number } {
  const sorted = productionRowsSorted.value
  if (columnIndex === 0) {
    const dept = (row.department ?? '').toString()
    if (rowIndex > 0 && (sorted[rowIndex - 1]?.department ?? '').toString() === dept) {
      return { rowspan: 0, colspan: 0 }
    }
    let count = 0
    for (let i = rowIndex; i < sorted.length; i++) {
      if ((sorted[i].department ?? '').toString() === dept) count++
      else break
    }
    return { rowspan: count, colspan: 1 }
  }
  if (columnIndex === 1) {
    const dept = (row.department ?? '').toString()
    const job = (row.jobType ?? '').toString()
    if (rowIndex > 0) {
      const prev = sorted[rowIndex - 1]
      if ((prev?.department ?? '').toString() === dept && (prev?.jobType ?? '').toString() === job) {
        return { rowspan: 0, colspan: 0 }
      }
    }
    let count = 0
    for (let i = rowIndex; i < sorted.length; i++) {
      const r = sorted[i]
      if ((r.department ?? '').toString() === dept && (r.jobType ?? '').toString() === job) count++
      else break
    }
    return { rowspan: count, colspan: 1 }
  }
  return { rowspan: 1, colspan: 1 }
}

function productionAmount(row: ProductionRow): number {
  const price = Number(row.unitPrice) || 0
  return price
}

function getJobTypeLabel(v: string): string {
  if (!v) return ''
  const parts = v.split('>').map((s) => s.trim()).filter(Boolean)
  return parts.length ? parts[parts.length - 1] : v
}

async function loadMaterialTypes() {
  try {
    const res = await getDictItems('material_types')
    const list = res.data ?? []
    materialTypeOptions.value = list.map((item: any) => ({
      id: item.id,
      label: item.value,
    }))
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('物料类型加载失败', getErrorMessage(e))
  }
}

function syncMaterialTypeIdsFromLabel() {
  if (!materialTypeOptions.value.length || !materialRows.value.length) return
  const map = new Map<string, number>()
  materialTypeOptions.value.forEach((opt) => {
    if (opt.label) map.set(String(opt.label), opt.id)
  })
  materialRows.value.forEach((row) => {
    if ((row.materialTypeId == null || Number.isNaN(row.materialTypeId as any)) && row.materialType) {
      const id = map.get(String(row.materialType))
      if (id) {
        row.materialTypeId = id
      }
    }
  })
}

async function searchSuppliers(keyword: string) {
  supplierLoading.value = true
  try {
    const res = await request.get('/suppliers', {
      params: { keyword: keyword || undefined, pageSize: 20 },
      skipGlobalErrorHandler: true,
    })
    const data = res.data as { list?: { id: number; name: string }[] }
    supplierOptions.value = data.list ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('供应商下拉加载失败', getErrorMessage(e))
  } finally {
    supplierLoading.value = false
  }
}

async function loadProcessOptions() {
  try {
    const res = await getSupplierBusinessScopeTreeOptions('工艺供应商')
    const toTreeSelect = (
      nodes: SupplierBusinessScopeTreeNode[],
      parentPath = '',
    ): ProcessOptionNode[] =>
      nodes.map((n) => {
        const path = parentPath ? `${parentPath} / ${n.value}` : n.value
        return {
          label: n.value,
          value: path,
          children: n.children?.length ? toTreeSelect(n.children, path) : undefined,
        }
      })
    processOptions.value = toTreeSelect(res.data ?? [])
  } catch (e: unknown) {
    if (!isErrorHandled(e)) console.warn('工艺项目选项加载失败', getErrorMessage(e))
  }
}

function addMaterialRow() {
  materialRows.value.push({
    materialType: '',
    supplierName: '',
    materialName: '',
    usagePerPiece: null,
    lossPercent: null,
    orderPieces: null,
    purchaseQuantity: null,
    cuttingQuantity: null,
    remark: '',
    unitPrice: 0,
  })
}

function removeMaterialRow(index: number) {
  materialRows.value.splice(index, 1)
}

/** 工艺项目成本数量：与订单件数无关，默认 1，由跟单按工艺自行填写 */
const DEFAULT_PROCESS_ITEM_QTY = 1

function addProcessItemRow() {
  processItemRows.value.push({
    processName: '',
    supplierName: '',
    part: '',
    remark: '',
    unitPrice: 0,
    quantity: DEFAULT_PROCESS_ITEM_QTY,
  })
}

function removeProcessItemRow(index: number) {
  processItemRows.value.splice(index, 1)
}

function syncFromOrder(d: OrderDetail) {
  const mats = (d.materials ?? []).map((m: any) => ({
    materialTypeId: m.materialTypeId ?? null,
    materialType: m.materialType ?? '',
    supplierName: m.supplierName ?? '',
    materialName: m.materialName ?? '',
    color: m.color ?? '',
    fabricWidth: m.fabricWidth ?? '',
    usagePerPiece: m.usagePerPiece ?? null,
    lossPercent: m.lossPercent ?? null,
    orderPieces: m.orderPieces ?? null,
    purchaseQuantity: m.purchaseQuantity ?? null,
    cuttingQuantity: m.cuttingQuantity ?? null,
    remark: m.remark ?? '',
    unitPrice: 0,
  })) as MaterialRow[]
  materialRows.value = mats.length ? mats : [{ unitPrice: 0 } as MaterialRow]

  const procs = (d.processItems ?? []).map((p) => ({
    ...p,
    unitPrice: 0,
    quantity: DEFAULT_PROCESS_ITEM_QTY,
  })) as ProcessItemRow[]
  processItemRows.value = procs.length ? procs : [{ unitPrice: 0, quantity: DEFAULT_PROCESS_ITEM_QTY } as ProcessItemRow]
}

async function loadOrder() {
  if (!orderId.value) return
  try {
    const res = await getOrderDetail(orderId.value)
    order.value = res.data
    if (order.value) syncFromOrder(order.value)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载订单失败'))
  }
}

async function loadCostSnapshot() {
  if (!orderId.value) return
  try {
    const res = await getOrderCost(orderId.value)
    const data = res.data
    if (data?.snapshot && typeof data.snapshot === 'object') {
      const s = data.snapshot
      if (Array.isArray(s.materialRows) && s.materialRows.length) materialRows.value = s.materialRows as MaterialRow[]
      if (Array.isArray(s.processItemRows) && s.processItemRows.length) processItemRows.value = s.processItemRows as ProcessItemRow[]
      if (Array.isArray(s.productionRows) && s.productionRows.length) productionRows.value = s.productionRows as ProductionRow[]
      if (s.profitMargin !== undefined) profitMargin.value = normalizeProfitMargin(s.profitMargin)
      quoteConfirmedAt.value = typeof s.quoteConfirmedAt === 'string' ? s.quoteConfirmedAt : ''
      quoteConfirmedBy.value = typeof s.quoteConfirmedBy === 'string' ? s.quoteConfirmedBy : ''
      quoteNeedsReconfirm.value = Boolean(s.quoteNeedsReconfirm)
    }
    loadedSnapshotHash.value = currentSnapshotHash.value
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载成本快照失败'))
  }
}

async function loadProcesses() {
  try {
    const res = await getProductionProcesses()
    productionProcesses.value = res.data ?? []
    if (!productionRows.value.length) {
      const first = productionProcesses.value[0]
      productionRows.value.push({
        processId: first?.id ?? null,
        department: first?.department ?? '',
        jobType: first?.jobType ?? '',
        processName: first?.name ?? '',
        remark: '',
        unitPrice: first ? Number(first.unitPrice) || 0 : 0,
      })
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载生产工序失败'))
  }
}

function addProductionRow() {
  productionRows.value.push({
    processId: null,
    department: '',
    jobType: '',
    processName: '',
    remark: '',
    unitPrice: 0,
  })
}

function removeProductionRow(row: ProductionRow) {
  productionRows.value = productionRows.value.filter((r) => r !== row)
}

function syncProductionIdsFromName() {
  if (!productionProcesses.value.length || !productionRows.value.length) return
  const map = new Map<string, ProductionProcessItem>()
  productionProcesses.value.forEach((p) => {
    if (p.name) map.set(p.name, p)
  })
  productionRows.value.forEach((row) => {
    if ((row.processId == null || Number.isNaN(row.processId as any)) && row.processName) {
      const found = map.get(row.processName)
      if (found) {
        row.processId = found.id
        row.department = found.department || row.department
        row.jobType = found.jobType || row.jobType
        row.unitPrice = Number(found.unitPrice) || row.unitPrice
      }
    }
  })
}

function formatProductionProcessLabel(p: ProductionProcessItem): string {
  // 下拉里只展示当前工序名称，部门/工种在表格前两列单独展示即可
  return p.name
}

function onProductionProcessChange(row: ProductionRow) {
  if (!row.processId) return
  const found = productionProcesses.value.find((p) => p.id === row.processId)
  if (!found) return
  row.department = found.department || row.department
  row.jobType = found.jobType || row.jobType
  row.unitPrice = Number(found.unitPrice) || 0
  row.processName = found.name
}

async function saveDraft() {
  if (!orderId.value || !order.value) return
  if (!canSubmitCost.value) {
    ElMessage.warning('你没有“订单成本可提交”权限，当前仅可试算')
    return
  }
  savingDraft.value = true
  try {
    await saveOrderCost(orderId.value, {
      snapshot: buildSnapshotPayload(),
    })
    quoteNeedsReconfirm.value = true
    loadedSnapshotHash.value = currentSnapshotHash.value
    ElMessage.success('草稿已保存（未同步订单卡片出厂价）')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '保存失败'))
  } finally {
    savingDraft.value = false
  }
}

async function confirmQuote() {
  if (!orderId.value || !order.value) return
  if (!canSubmitCost.value) {
    ElMessage.warning('你没有“订单成本可提交”权限，当前仅可试算')
    return
  }
  const price = computedExFactoryPrice.value
  if (price <= 0) {
    ElMessage.warning('请先填写成本并计算得出有效出厂价')
    return
  }
  confirmingQuote.value = true
  try {
    await confirmOrderCost(orderId.value, {
      snapshot: buildSnapshotPayload(),
    })
    if (order.value) order.value.exFactoryPrice = price.toFixed(2)
    quoteNeedsReconfirm.value = false
    quoteConfirmedBy.value = authStore.user?.displayName || authStore.user?.username || ''
    quoteConfirmedAt.value = new Date().toISOString()
    loadedSnapshotHash.value = currentSnapshotHash.value
    ElMessage.success('已确认报价并同步订单卡片出厂价')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '确认报价失败'))
  } finally {
    confirmingQuote.value = false
  }
}

function goBack() {
  router.push('/orders/list')
}

async function openImportTemplateDialog() {
  importTemplateDialog.value = { visible: true, templateId: null }
  try {
    const res = await getProcessQuoteTemplates()
    importTemplateOptions.value = (res.data ?? []).map((t) => ({ id: t.id, name: t.name }))
  } catch {
    importTemplateOptions.value = []
  }
}

async function applyImportTemplate() {
  const templateId = importTemplateDialog.value.templateId
  if (templateId == null) return
  try {
    const res = await getProcessQuoteTemplateItems(templateId)
    const items = res.data ?? []
    const rows: ProductionRow[] = items.map((item) => ({
      processId: item.processId,
      department: item.department ?? '',
      jobType: item.jobType ?? '',
      processName: item.processName ?? '',
      remark: '',
      unitPrice: Number(item.unitPrice) || 0,
    }))
    productionRows.value.push(...rows)
    importTemplateDialog.value.visible = false
    ElMessage.success(`已导入 ${rows.length} 条工序，可按款式微调`)
  } catch (e: unknown) {
    ElMessage.error((e as { message?: string })?.message ?? '导入失败')
  }
}

onMounted(async () => {
  await loadOrder()
  await loadCostSnapshot()
  await loadProcesses()
  syncProductionIdsFromName()
  await loadMaterialTypes()
  // 物料类型：旧订单/快照里可能只有 materialType 字符串，这里在字典和明细都加载完后做一次自动映射
  syncMaterialTypeIdsFromLabel()
  loadProcessOptions()
  searchSuppliers('')
})
</script>

<style scoped>
.order-cost-page {
  padding: var(--space-md);
  font-size: var(--font-size-body);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.page-header .title {
  font-size: var(--font-size-title);
  font-weight: 600;
}

.page-header .sub-title {
  font-size: var(--font-size-body);
  color: var(--el-text-color-secondary);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.block-card {
  margin-bottom: var(--space-md);
}

.block-card :deep(.el-card__header) {
  padding: var(--space-sm) var(--space-md);
  font-size: var(--font-size-subtitle);
}

.block-card :deep(.el-card__body) {
  padding: var(--space-sm) var(--space-md);
}

.block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.block-header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.block-title {
  font-weight: 600;
}

.import-template-hint {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
  margin: 0 0 var(--space-sm);
  line-height: 1.5;
}

.summary-card .order-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  font-size: var(--font-size-body);
}

.summary-card .cost-notice {
  font-size: var(--font-size-small);
  color: var(--el-color-warning);
  margin-left: auto;
}

.cost-table {
  font-size: var(--font-size-caption);
}

.cost-table :deep(.el-table__header-wrapper th),
.cost-table :deep(.el-table__header-wrapper th .cell),
.cost-table :deep(.el-table__body-wrapper td),
.cost-table :deep(.el-table__body-wrapper td .cell) {
  font-size: inherit;
}

.cost-table :deep(.el-input__inner),
.cost-table :deep(.el-input__wrapper),
.cost-table :deep(.el-select__wrapper),
.cost-table :deep(.el-select__selected-item),
.cost-table :deep(.el-select__placeholder),
.cost-table :deep(.el-input-number .el-input__inner) {
  font-size: inherit;
}

.cost-table :deep(.el-input-number) {
  width: 100%;
}

.cost-table :deep(.el-input-number .el-input__inner) {
  text-align: right;
}

.price-input {
  width: 88px;
}

.subtotal {
  margin-top: var(--space-sm);
  text-align: right;
  font-size: var(--font-size-body);
}

.process-checkbox-wrap {
  min-height: 40px;
}

.process-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-sm);
}

.process-checkbox {
  margin-right: 0;
  font-size: var(--font-size-caption);
}

.empty-hint {
  font-size: var(--font-size-caption);
  color: var(--el-text-color-secondary);
  margin: 0;
}

.result-rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.result-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--font-size-body);
}

.result-row.total-cost {
  font-weight: 600;
  padding-top: var(--space-xs);
  border-top: 1px solid var(--el-border-color-lighter);
}

.result-row.profit-row {
  align-items: center;
  gap: var(--space-sm);
}

.profit-input {
  width: 120px;
}

.result-row.ex-factory .ex-factory-value {
  font-size: var(--font-size-subtitle);
  font-weight: 600;
  color: var(--el-color-primary);
}

.result-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-sm);
}
</style>
