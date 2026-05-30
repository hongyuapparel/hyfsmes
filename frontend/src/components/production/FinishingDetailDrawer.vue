<template>
  <ProductionDetailDrawerShell
    v-model="visible"
    title="尾部进度概要"
    :size="760"
    :resizable="true"
    @closed="emit('closed')"
  >
    <template v-if="row">
      <ProductionDetailSection>
        <ProductionOrderBriefPanel :brief="brief" />
      </ProductionDetailSection>
      <ProductionDetailSection title="业务扩展信息">
        <el-descriptions :column="2" border size="small" class="finishing-brief-extra">
          <el-descriptions-item label="尾部状态">{{ finishingStatusText }}</el-descriptions-item>
          <el-descriptions-item label="包装备注">
            {{ (row.remark ?? '').trim() || '—' }}
          </el-descriptions-item>
        </el-descriptions>
      </ProductionDetailSection>
      <ProductionDetailSection title="颜色×尺码明细">
        <div v-if="colorBreakdownLoading" class="color-bd-empty">加载中…</div>
        <div v-else-if="colorBreakdownError" class="color-bd-empty">明细加载失败</div>
        <template v-else>
          <!-- 跨色总数：来自 finishing 标量真值（用户登记时填的总数，非估算） -->
          <div class="color-bd-totals">
            <span class="color-bd-total-item"><b>订单数量</b> {{ formatDisplayNumber(row.quantity ?? 0) }}</span>
            <span class="color-bd-total-item"><b>裁床数量</b> {{ row.cutTotal != null ? formatDisplayNumber(row.cutTotal) : '—' }}</span>
            <span class="color-bd-total-item"><b>车缝数量</b> {{ row.sewingQuantity != null ? formatDisplayNumber(row.sewingQuantity) : '—' }}</span>
            <span class="color-bd-total-item"><b>尾部收货</b> {{ row.tailReceivedQty != null ? formatDisplayNumber(row.tailReceivedQty) : '—' }}</span>
            <span class="color-bd-total-item"><b>尾部入库</b> {{ row.tailInboundQty != null ? formatDisplayNumber(row.tailInboundQty) : '—' }}</span>
            <span class="color-bd-total-item"><b>次品数</b> {{ row.defectQuantity != null ? formatDisplayNumber(row.defectQuantity) : '—' }}</span>
          </div>
        </template>
        <div v-if="!colorBreakdownLoading && !colorBreakdownError && !hasColorSizeDimension" class="color-bd-empty">本订单无颜色×尺码维度</div>
        <template v-if="!colorBreakdownLoading && !colorBreakdownError && hasColorSizeDimension">
          <div
            v-for="(color, ci) in (colorBreakdown?.planColorRows ?? [])"
            :key="ci"
            class="color-bd-block"
          >
            <div class="color-bd-color-name">{{ color.colorName || '—' }}</div>
            <table class="color-bd-table">
              <thead>
                <tr>
                  <th class="color-bd-th-stage">阶段</th>
                  <th
                    v-for="(h, hi) in (colorBreakdown?.sizeHeaders ?? [])"
                    :key="hi"
                  >{{ h }}</th>
                  <th>合计</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(stage, si) in stagesForColor(ci)"
                  :key="si"
                >
                  <td class="color-bd-stage-label">{{ stage.label }}</td>
                  <template v-if="stage.values">
                    <td
                      v-for="(v, vi) in stage.values"
                      :key="vi"
                      class="color-bd-num"
                    >{{ formatDisplayNumber(v) }}</td>
                    <td class="color-bd-num color-bd-total">
                      <strong>{{ formatDisplayNumber(sumArr(stage.values)) }}</strong>
                    </td>
                  </template>
                  <template v-else>
                    <td
                      :colspan="(colorBreakdown?.sizeHeaders.length ?? 0) + 1"
                      class="color-bd-no-detail"
                    >未留存颜色×尺码明细</td>
                  </template>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </ProductionDetailSection>
      <ProductionDetailSection title="时效与节点">
        <el-descriptions :column="1" border size="small" class="finishing-brief-extra">
          <el-descriptions-item label="到尾部时间">{{ formatDateTime(row.arrivedAt) }}</el-descriptions-item>
          <el-descriptions-item label="完成时间">{{ formatDateTime(row.completedAt) }}</el-descriptions-item>
          <el-descriptions-item label="时效判定">
            <SlaJudgeTag :text="row.timeRating" />
          </el-descriptions-item>
        </el-descriptions>
      </ProductionDetailSection>
      <ProductionDetailSection title="批次记录">
        <BatchTimelineSection :order-id="row.orderId" :active="visible" />
      </ProductionDetailSection>
      <ProductionDetailSection>
        <OperationLogsSection :logs="logs" />
      </ProductionDetailSection>
    </template>
  </ProductionDetailDrawerShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import {
  getFinishingRegisterFormData,
  type FinishingListItem,
  type FinishingRegisterFormDataRes,
} from '@/api/production-finishing'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { ElMessage } from 'element-plus'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import ProductionOrderBriefPanel from '@/components/production/ProductionOrderBriefPanel.vue'
import BatchTimelineSection from '@/components/production/BatchTimelineSection.vue'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'

const props = defineProps<{
  modelValue: boolean
  row: FinishingListItem | null
  brief: ProductionOrderBriefModel
  logs: Array<{ id: string | number; operatorUsername: string; createdAt: string; summary: string }>
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  closed: []
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => emit('update:modelValue', v))

// === 颜色×尺码明细 ===
// 真值优先：调 register-form-data，只展示 DB 里 byColor 真值；缺真值的阶段
// 显示"未留存颜色×尺码明细"，不做兜底估算。
const colorBreakdown = ref<FinishingRegisterFormDataRes | null>(null)
const colorBreakdownLoading = ref(false)
const colorBreakdownError = ref(false)

const hasColorSizeDimension = computed(() => {
  const data = colorBreakdown.value
  if (!data) return false
  return (data.sizeHeaders?.length ?? 0) > 0 && (data.planColorRows?.length ?? 0) > 0
})

const FINISHING_STATUS_LABELS: Record<string, string> = {
  pending_receive: '待尾部',
  pending_assign: '尾部中',
  pending_ship: '尾部中',
  shipped: '尾部中',
  inbound: '尾部完成',
}
const finishingStatusText = computed(() => {
  const s = String(props.row?.finishingStatus ?? '').trim()
  if (!s) return '—'
  return FINISHING_STATUS_LABELS[s] ?? s
})

interface StageRow { label: string; values: number[] | null }
function colorRowOrNull(colorIdx: number, rows: Array<{ colorName: string; quantities: number[] }> | undefined | null): number[] | null {
  if (!Array.isArray(rows) || rows.length === 0) return null
  return rows[colorIdx]?.quantities ?? null
}

function stagesForColor(colorIdx: number): StageRow[] {
  const data = colorBreakdown.value
  if (!data) return []
  return [
    { label: '订单数量', values: colorRowOrNull(colorIdx, data.planColorRows) },
    { label: '裁床数量', values: colorRowOrNull(colorIdx, data.cutColorRows) },
    { label: '车缝数量', values: colorRowOrNull(colorIdx, data.sewingColorRows) },
    { label: '尾部收货数', values: colorRowOrNull(colorIdx, data.tailReceivedColorRows) },
    { label: '尾部入库数', values: colorRowOrNull(colorIdx, data.tailInboundColorRows) },
    { label: '次品数', values: colorRowOrNull(colorIdx, data.defectColorRows) },
  ]
}

function sumArr(values: number[]): number {
  return values.reduce((s, n) => s + (Number(n) || 0), 0)
}

async function loadColorBreakdown(orderId: number) {
  colorBreakdownLoading.value = true
  colorBreakdownError.value = false
  try {
    const res = await getFinishingRegisterFormData(orderId)
    colorBreakdown.value = res.data ?? null
  } catch (e: unknown) {
    colorBreakdownError.value = true
    colorBreakdown.value = null
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '颜色×尺码明细加载失败'))
  } finally {
    colorBreakdownLoading.value = false
  }
}

watch(
  () => (props.modelValue && props.row?.orderId) || 0,
  (orderId) => {
    if (orderId > 0) void loadColorBreakdown(orderId)
    else colorBreakdown.value = null
  },
  { immediate: true },
)
</script>

<style scoped>
.color-bd-empty {
  color: var(--el-text-color-secondary);
  padding: 8px 0;
}
.color-bd-totals {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  padding: 6px 10px;
  margin-bottom: 10px;
  background-color: var(--el-fill-color-lighter);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  font-size: var(--font-size-body);
}
.color-bd-total-item b {
  font-weight: 500;
  color: var(--el-text-color-secondary);
  margin-right: 4px;
}
.color-bd-block + .color-bd-block {
  margin-top: 12px;
}
.color-bd-color-name {
  font-weight: 600;
  margin-bottom: 6px;
  color: var(--el-text-color-primary);
}
.color-bd-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-body);
}
.color-bd-table th,
.color-bd-table td {
  border: 1px solid var(--el-border-color-lighter);
  padding: 4px 8px;
  text-align: center;
}
.color-bd-table thead th {
  background-color: var(--el-fill-color-light);
  font-weight: 500;
}
.color-bd-th-stage,
.color-bd-stage-label {
  text-align: left;
  white-space: nowrap;
  min-width: 84px;
}
.color-bd-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.color-bd-total {
  background-color: var(--el-fill-color-lighter);
}
.color-bd-no-detail {
  color: var(--el-text-color-secondary);
  font-style: italic;
  text-align: center;
}
</style>
