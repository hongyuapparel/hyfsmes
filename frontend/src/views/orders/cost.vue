<template>
  <div class="page-card order-cost-page">
    <div class="page-header">
      <div class="left">
        <el-button link type="primary" @click="goBack">返回列表</el-button>
        <span class="title">订单成本</span>
        <span v-if="order" class="sub-title">{{ order.orderNo }} · {{ order.skuCode }}</span>
      </div>
    </div>

    <!-- 订单摘要 -->
    <el-card class="block-card summary-card" shadow="never">
      <div class="order-summary">
        <span><strong>客户：</strong>{{ order?.customerName ?? '-' }}</span>
        <span><strong>数量：</strong>{{ order?.quantity ?? 0 }}</span>
        <span><strong>当前销售价：</strong>{{ order?.salePrice ?? '-' }} 元</span>
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
        <el-table-column label="物料类型" prop="materialType" min-width="90" show-overflow-tooltip />
        <el-table-column label="供应商" prop="supplierName" min-width="100" show-overflow-tooltip />
        <el-table-column label="物料名称/颜色" prop="materialName" min-width="120" show-overflow-tooltip />
        <el-table-column label="单件用量" prop="usagePerPiece" width="82" align="right" />
        <el-table-column label="损耗%" prop="lossPercent" width="72" align="right" />
        <el-table-column label="采购总量" prop="purchaseQuantity" width="82" align="right" />
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
        <el-table-column label="备注" prop="remark" min-width="80" show-overflow-tooltip />
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
        <el-table-column label="工艺项目" prop="processName" min-width="120" show-overflow-tooltip />
        <el-table-column label="供应商" prop="supplierName" min-width="100" show-overflow-tooltip />
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
            {{ formatMoney(processItemAmount(row)) }}
          </template>
        </el-table-column>
        <el-table-column label="备注" prop="remark" min-width="100" show-overflow-tooltip />
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

    <!-- 生产工序成本 -->
    <el-card class="block-card table-card" shadow="never">
      <template #header>
        <div class="block-header">
          <span class="block-title">生产工序成本</span>
        </div>
      </template>
      <div class="process-checkbox-wrap">
        <el-checkbox-group v-model="selectedProcessIds">
          <div class="process-grid">
            <el-checkbox
              v-for="p in productionProcesses"
              :key="p.id"
              :label="p.id"
              class="process-checkbox"
            >
              <template v-if="p.department || p.jobType">
                {{ [p.department, p.jobType].filter(Boolean).join(' · ') }} · {{ p.name }}（{{ p.unitPrice }} 元）
              </template>
              <template v-else>
                {{ p.name }}（{{ p.unitPrice }} 元）
              </template>
            </el-checkbox>
          </div>
        </el-checkbox-group>
        <p v-if="!productionProcesses.length" class="empty-hint">暂无配置工序，请在系统设置中维护生产工序及单价。</p>
      </div>
      <div class="subtotal">生产工序小计：<strong>{{ formatMoney(productionProcessTotal) }}</strong> 元</div>
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
          <span>利润率（小数，如 0.15 表示 15%）</span>
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
        <el-button @click="goBack">仅查看</el-button>
        <el-button type="primary" :loading="applying" @click="applyToOrder">应用到订单</el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { getOrderDetail, updateOrderDraft, type OrderDetail } from '@/api/orders'
import { getProductionProcesses, type ProductionProcessItem } from '@/api/production-processes'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const route = useRoute()
const router = useRouter()

const orderId = computed(() => {
  const v = route.params.id
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
})

const order = ref<OrderDetail | null>(null)
const materialRows = ref<MaterialRow[]>([])
const processItemRows = ref<ProcessItemRow[]>([])
const productionProcesses = ref<ProductionProcessItem[]>([])
const selectedProcessIds = ref<number[]>([])
const profitMargin = ref(0.15)
const applying = ref(false)

interface MaterialRow {
  materialType?: string
  supplierName?: string
  materialName?: string
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
  remark?: string
  unitPrice: number
}

function materialAmount(row: MaterialRow): number {
  const qty = Number(row.purchaseQuantity) || 0
  const price = Number(row.unitPrice) || 0
  return qty * price
}

function processItemAmount(row: ProcessItemRow): number {
  const qty = order.value?.quantity ?? 0
  const price = Number(row.unitPrice) || 0
  return qty * price
}

const materialTotal = computed(() =>
  materialRows.value.reduce((sum, row) => sum + materialAmount(row), 0)
)
const processItemTotal = computed(() =>
  processItemRows.value.reduce((sum, row) => sum + processItemAmount(row), 0)
)
const productionProcessTotal = computed(() => {
  const list = productionProcesses.value
  return selectedProcessIds.value.reduce((sum, id) => {
    const p = list.find((x) => x.id === id)
    return sum + (p ? Number(p.unitPrice) || 0 : 0)
  }, 0)
})
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

function addProcessItemRow() {
  processItemRows.value.push({
    processName: '',
    supplierName: '',
    remark: '',
    unitPrice: 0,
  })
}

function removeProcessItemRow(index: number) {
  processItemRows.value.splice(index, 1)
}

function syncFromOrder(d: OrderDetail) {
  const mats = (d.materials ?? []).map((m) => ({
    ...m,
    unitPrice: 0,
  })) as MaterialRow[]
  materialRows.value = mats.length ? mats : [{ unitPrice: 0 } as MaterialRow]

  const procs = (d.processItems ?? []).map((p) => ({
    ...p,
    unitPrice: 0,
  })) as ProcessItemRow[]
  processItemRows.value = procs.length ? procs : [{ unitPrice: 0 } as ProcessItemRow]
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

async function loadProcesses() {
  try {
    const res = await getProductionProcesses()
    productionProcesses.value = res.data ?? []
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '加载生产工序失败'))
  }
}

async function applyToOrder() {
  if (!orderId.value || !order.value) return
  const price = computedExFactoryPrice.value
  if (price <= 0) {
    ElMessage.warning('请先填写成本并计算得出有效出厂价')
    return
  }
  applying.value = true
  try {
    await updateOrderDraft(orderId.value, { exFactoryPrice: price.toFixed(2) })
    if (order.value) order.value.exFactoryPrice = price.toFixed(2)
    ElMessage.success('已将该出厂价写回订单')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '应用失败'))
  } finally {
    applying.value = false
  }
}

function goBack() {
  router.push('/orders/list')
}

onMounted(() => {
  loadOrder()
  loadProcesses()
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

.block-title {
  font-weight: 600;
}

.summary-card .order-summary {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-lg);
  font-size: var(--font-size-body);
}

.cost-table {
  font-size: var(--font-size-caption);
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
