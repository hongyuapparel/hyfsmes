<template>
  <el-dialog
    :model-value="modelValue"
    title="出库"
    width="860"
    destroy-on-close
    @update:model-value="onDialogVisibleChange"
    @close="resetOutboundForm"
  >
    <el-form
      ref="outboundFormRef"
      :model="outboundForm"
      :rules="outboundRules"
      label-width="80px"
    >
      <el-form-item label="领取人" prop="pickupUserId">
        <el-select
          v-model="outboundForm.pickupUserId"
          placeholder="请选择业务员"
          filterable
          clearable
          style="width: 260px"
        >
          <el-option
            v-for="opt in pickupUserOptions"
            :key="opt.id"
            :label="opt.displayName || opt.username"
            :value="opt.id"
          />
        </el-select>
      </el-form-item>
      <div class="outbound-batch-head">
        <span>客户：{{ stockInfo?.customerName || '-' }}</span>
        <span>订单号：{{ stockInfo?.orderNo || '-' }}</span>
        <span>SKU：{{ stockInfo?.skuCode || '-' }}</span>
        <span>出库总数：{{ outboundGrandTotal }}</span>
      </div>
      <div class="outbound-batch-list">
        <div class="outbound-batch-card">
          <div class="outbound-card-meta">
            <div>颜色：{{ stockInfo?.colorName || '-' }}</div>
            <div>当前库存：{{ stockQuantity }}</div>
          </div>
          <div v-if="outboundSizeList.headers.length" class="outbound-size-wrap">
            <el-table :data="outboundSizeList.rows" border size="small" class="outbound-size-table">
              <el-table-column label="颜色" min-width="100" align="center" header-align="center">
                <template #default="{ row }">
                  {{ row.colorName || '-' }}
                </template>
              </el-table-column>
              <el-table-column label="图片" width="90" align="center" header-align="center">
                <template #default="{ row }">
                  <AppImageThumb v-if="row.imageUrl" :raw-url="row.imageUrl" variant="table" />
                  <span v-else class="text-placeholder">-</span>
                </template>
              </el-table-column>
              <el-table-column
                v-for="(h, hIdx) in outboundSizeList.headers"
                :key="hIdx"
                :label="h"
                min-width="80"
                align="center"
                header-align="center"
              >
                <template #default="{ row }">
                  <el-input-number
                    v-model="row.quantities[hIdx]"
                    :min="0"
                    :precision="0"
                    controls-position="right"
                    size="small"
                    class="outbound-qty-input"
                    style="width: 100%"
                  />
                </template>
              </el-table-column>
            </el-table>
            <div class="outbound-size-footer">该记录合计：{{ outboundGrandTotal }}</div>
          </div>
          <div v-else-if="outboundLoading" class="detail-muted">明细加载中...</div>
          <div v-else class="detail-muted">该记录暂无颜色尺码明细，无法按明细出库。</div>
        </div>
      </div>
    </el-form>
    <template #footer>
      <el-button @click="closeDialog">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="submitOutbound">
        确定出库
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import AppImageThumb from '@/components/AppImageThumb.vue'
import { finishedOutbound, getFinishedPickupUserOptions, type FinishedPickupUserOption } from '@/api/inventory'
import { getOrderColorSizeBreakdown, type OrderColorSizeBreakdownRes } from '@/api/orders'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getSizeHeaderKey, normalizeSizeHeader, sortSizeHeaders } from '@/utils/sizeHeaders'

type OutboundStockInfo = {
  orderId: number | null
  orderNo: string
  skuCode: string
  customerName: string
  quantity: number
  imageUrl: string
  colorName: string
  sizeBreakdown: {
    headers: string[]
    rows: Array<{ colorName?: string; values?: number[] }>
  } | null
  colorImages: Array<{ colorName: string; imageUrl: string }>
}

const props = defineProps<{
  modelValue: boolean
  stockId: number | null
  stockInfo: OutboundStockInfo | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'submitted'): void
}>()

const outboundLoading = ref(false)
const submitting = ref(false)
const outboundFormRef = ref<FormInstance>()
const pickupUserOptions = ref<FinishedPickupUserOption[]>([])
const outboundForm = reactive({
  pickupUserId: null as number | null,
})
const outboundRules: FormRules = {
  pickupUserId: [{ required: true, message: '请选择领取人', trigger: 'change' }],
}
const outboundSizeList = reactive<{
  headers: string[]
  rows: Array<{ colorName: string; imageUrl: string; quantities: number[] }>
}>({
  headers: [],
  rows: [],
})

const stockQuantity = computed(() => Math.max(0, Math.trunc(Number(props.stockInfo?.quantity) || 0)))
const outboundGrandTotal = computed(() =>
  outboundSizeList.rows.reduce(
    (sum, row) => sum + row.quantities.reduce((rowSum, qty) => rowSum + (Number(qty) || 0), 0),
    0,
  ),
)

function normalizeColorName(value: unknown): string {
  return String(value ?? '').trim()
}

function getColorImage(colorName: string): string {
  const normalized = normalizeColorName(colorName)
  const matched = props.stockInfo?.colorImages?.find(
    (item) => normalizeColorName(item.colorName) === normalized && String(item.imageUrl || '').trim(),
  )
  return String(matched?.imageUrl || props.stockInfo?.imageUrl || '').trim()
}

function toHeaders(headers: string[]): string[] {
  return sortSizeHeaders(headers.map(normalizeSizeHeader).filter(Boolean))
}

function toSnapshotRows(sourceHeaders: string[], headers: string[], rows: Array<{ colorName?: string; values?: number[] }>) {
  const indexMap = new Map(sourceHeaders.map((header, index) => [getSizeHeaderKey(header), index]))
  return rows.map((item) => ({
    colorName: normalizeColorName(item.colorName) || '-',
    imageUrl: getColorImage(item.colorName),
    quantities: headers.map((header) => {
      const index = indexMap.get(getSizeHeaderKey(header))
      return index == null ? 0 : Math.max(0, Math.trunc(Number(item.values?.[index]) || 0))
    }),
  }))
}

async function loadPickupUsers() {
  try {
    const res = await getFinishedPickupUserOptions()
    pickupUserOptions.value = (res.data ?? []) as FinishedPickupUserOption[]
  } catch {
    pickupUserOptions.value = []
  }
}

function resetOutboundForm() {
  outboundForm.pickupUserId = null
  outboundSizeList.headers = []
  outboundSizeList.rows = []
  outboundFormRef.value?.clearValidate()
}

async function initOutboundSizeList() {
  resetOutboundForm()
  if (!props.stockInfo) return
  const snapshot = props.stockInfo.sizeBreakdown
  if (snapshot?.headers?.length && snapshot.rows?.length) {
    const sourceHeaders = snapshot.headers.map(normalizeSizeHeader).filter(Boolean)
    const headers = toHeaders(snapshot.headers)
    outboundSizeList.headers = headers
    outboundSizeList.rows = toSnapshotRows(sourceHeaders, headers, snapshot.rows)
    return
  }
  if (!props.stockInfo.orderId) return
  outboundLoading.value = true
  try {
    const res = await getOrderColorSizeBreakdown(props.stockInfo.orderId)
    const data = (res.data ?? { headers: [], rows: [] }) as OrderColorSizeBreakdownRes
    const headers = toHeaders(Array.isArray(data.headers) ? data.headers : [])
    const rows = Array.isArray(data.rows) ? data.rows : []
    outboundSizeList.headers = headers
    outboundSizeList.rows = rows.map((item) => ({
      colorName: normalizeColorName(item.colorName) || '-',
      imageUrl: getColorImage(item.colorName),
      quantities: headers.map(() => 0),
    }))
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    outboundSizeList.headers = []
    outboundSizeList.rows = []
  } finally {
    outboundLoading.value = false
  }
}

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    void loadPickupUsers()
    void initOutboundSizeList()
  },
)

watch(
  () => props.stockId,
  () => {
    if (!props.modelValue) return
    void initOutboundSizeList()
  },
)

function onDialogVisibleChange(value: boolean) {
  emit('update:modelValue', value)
}

function closeDialog() {
  emit('update:modelValue', false)
}

async function submitOutbound() {
  if (!props.stockId) {
    ElMessage.warning('未选择可出库记录')
    return
  }
  const valid = await outboundFormRef.value?.validate().then(() => true).catch(() => false)
  if (!valid) return
  if (!outboundSizeList.headers.length || !outboundSizeList.rows.length) {
    ElMessage.warning('该记录暂无颜色尺码明细，无法出库')
    return
  }
  if (outboundGrandTotal.value <= 0) {
    ElMessage.warning('请填写出库数量')
    return
  }
  if (outboundGrandTotal.value > stockQuantity.value) {
    ElMessage.warning('出库数量不能大于当前库存')
    return
  }
  submitting.value = true
  try {
    await finishedOutbound({
      items: [
        {
          id: props.stockId,
          quantity: outboundGrandTotal.value,
          sizeBreakdown: {
            headers: outboundSizeList.headers,
            rows: outboundSizeList.rows.map((item) => ({
              colorName: normalizeColorName(item.colorName) || '-',
              quantities: item.quantities.map((qty) => Math.max(0, Math.trunc(Number(qty) || 0))),
            })),
          },
        },
      ],
      pickupUserId: outboundForm.pickupUserId,
    })
    ElMessage.success('出库成功')
    emit('update:modelValue', false)
    emit('submitted')
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.outbound-size-wrap {
  width: 100%;
}

.outbound-size-wrap :deep(.el-table .cell) {
  text-align: center;
}

.outbound-size-wrap :deep(.outbound-qty-input .el-input__inner) {
  text-align: center;
}

.outbound-size-footer {
  margin-top: 8px;
  text-align: right;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.outbound-batch-head {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
  margin-bottom: 12px;
  color: var(--el-text-color-secondary);
}

.outbound-batch-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 55vh;
  overflow: auto;
  padding-right: 4px;
}

.outbound-batch-card {
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-fill-color-blank);
}

.outbound-card-meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px 12px;
  margin-bottom: 10px;
  color: var(--el-text-color-regular);
}
</style>
