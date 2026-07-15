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

      <ProductionColorSizeBreakdownSection
        :loading="colorBreakdownLoading"
        :error="colorBreakdownError"
        :size-headers="colorBreakdown?.sizeHeaders ?? []"
        :color-rows="colorBreakdown?.planColorRows ?? []"
        :stages="stageDefs"
        :totals="totalItems"
      >
        <template v-if="canAmend" #actions>
          <el-button type="primary" size="small" @click="emit('amend', row!)">
            编辑
          </el-button>
        </template>
      </ProductionColorSizeBreakdownSection>

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
import ProductionColorSizeBreakdownSection, {
  type ColorSizeStageDef,
  type ColorSizeTotalItem,
} from '@/components/production/ProductionColorSizeBreakdownSection.vue'
import BatchTimelineSection from '@/components/production/BatchTimelineSection.vue'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'

const props = defineProps<{
  modelValue: boolean
  row: FinishingListItem | null
  brief: ProductionOrderBriefModel
  logs: Array<{ id: string | number; operatorUsername: string; createdAt: string; summary: string }>
  canAmend?: boolean
  reloadToken?: number
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  closed: []
  amend: [row: FinishingListItem]
}>()

const visible = ref(props.modelValue)
watch(() => props.modelValue, (v) => { visible.value = v })
watch(visible, (v) => emit('update:modelValue', v))

const colorBreakdown = ref<FinishingRegisterFormDataRes | null>(null)
const colorBreakdownLoading = ref(false)
const colorBreakdownError = ref(false)

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

function colorRowOrNull(
  colorIdx: number,
  rows: Array<{ colorName: string; quantities: number[] }> | undefined | null,
): number[] | null {
  if (!Array.isArray(rows) || rows.length === 0) return null
  return rows[colorIdx]?.quantities ?? null
}

const stageDefs = computed<ColorSizeStageDef[]>(() => {
  const data = colorBreakdown.value
  const row = props.row
  if (!data) return []
  return [
    {
      label: '订单数量',
      valuesForColor: (ci) => colorRowOrNull(ci, data.planColorRows),
      total: row?.quantity ?? null,
    },
    {
      label: '裁床数量',
      valuesForColor: (ci) => colorRowOrNull(ci, data.cutColorRows),
      total: row?.cutTotal ?? null,
    },
    {
      label: '车缝数量',
      valuesForColor: (ci) => colorRowOrNull(ci, data.sewingColorRows),
      total: row?.sewingQuantity ?? null,
    },
    {
      label: '尾部收货数',
      valuesForColor: (ci) => colorRowOrNull(ci, data.tailReceivedColorRows),
      total: row?.tailReceivedQty ?? null,
    },
    {
      label: '尾部入库数',
      valuesForColor: (ci) => colorRowOrNull(ci, data.tailInboundColorRows),
      total: row?.tailInboundQty ?? null,
    },
    {
      label: '次品数',
      valuesForColor: (ci) => colorRowOrNull(ci, data.defectColorRows),
      total: row?.defectQuantity ?? null,
    },
  ]
})

const totalItems = computed<ColorSizeTotalItem[]>(() => {
  const row = props.row
  if (!row) return []
  return [
    { label: '订单数量', display: formatDisplayNumber(row.quantity ?? 0) },
    { label: '裁床数量', display: row.cutTotal != null ? formatDisplayNumber(row.cutTotal) : '—' },
    {
      label: '车缝数量',
      display: row.sewingQuantity != null ? formatDisplayNumber(row.sewingQuantity) : '—',
    },
    {
      label: '尾部收货',
      display: row.tailReceivedQty != null ? formatDisplayNumber(row.tailReceivedQty) : '—',
    },
    {
      label: '尾部入库',
      display: row.tailInboundQty != null ? formatDisplayNumber(row.tailInboundQty) : '—',
    },
    {
      label: '次品数',
      display: row.defectQuantity != null ? formatDisplayNumber(row.defectQuantity) : '—',
    },
  ]
})

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
  () => ({
    open: props.modelValue,
    orderId: props.row?.orderId ?? 0,
    token: props.reloadToken ?? 0,
  }),
  ({ open, orderId }) => {
    if (open && orderId > 0) void loadColorBreakdown(orderId)
    else colorBreakdown.value = null
  },
  { immediate: true },
)
</script>

<style scoped>
.finishing-brief-extra {
  margin-top: 4px;
}
</style>
