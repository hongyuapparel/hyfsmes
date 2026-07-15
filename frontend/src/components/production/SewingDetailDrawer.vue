<template>
  <ProductionDetailDrawerShell
    v-model="visible"
    title="车缝外发概要"
    :size="760"
    :resizable="true"
    @closed="emit('closed')"
  >
    <template v-if="drawer.row">
      <ProductionDetailSection>
        <ProductionOrderBriefPanel :brief="briefFromRow(drawer.row)" />
      </ProductionDetailSection>
      <ProductionDetailSection title="分单与时效">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="加工供应商">
            {{ (drawer.row.factoryName ?? '').trim() || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="车缝加工费(元)">
            {{
              drawer.row.sewingFee != null && String(drawer.row.sewingFee).trim() !== ''
                ? formatDisplayNumber(drawer.row.sewingFee)
                : '—'
            }}
          </el-descriptions-item>
          <el-descriptions-item label="分单时间">
            {{ formatDateTime(drawer.row.distributedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="加工供应商交期">
            {{ formatDate(drawer.row.factoryDueDate) }}
          </el-descriptions-item>
          <el-descriptions-item label="到车缝时间">
            {{ formatDateTime(drawer.row.arrivedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="完成时间">
            {{ formatDateTime(drawer.row.completedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="时效判定">
            <SlaJudgeTag :text="drawer.row.timeRating" />
          </el-descriptions-item>
        </el-descriptions>
      </ProductionDetailSection>

      <ProductionColorSizeBreakdownSection
        :loading="breakdownLoading"
        :error="breakdownError"
        :size-headers="sizeHeaders"
        :color-rows="planColorRows"
        :stages="stageDefs"
        :totals="totalItems"
      >
        <template v-if="canEdit" #actions>
          <el-button type="primary" size="small" @click="emit('edit', drawer.row!)">
            编辑
          </el-button>
        </template>
      </ProductionColorSizeBreakdownSection>
      <ProductionDetailSection>
        <OperationLogsSection :logs="logs" />
      </ProductionDetailSection>
    </template>
  </ProductionDetailDrawerShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getCompleteFormData,
  type CompleteFormDataRes,
  type SewingListItem,
} from '@/api/production-sewing'
import { toLogSectionItems } from '@/api/operation-logs'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { formatDate, formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import ProductionOrderBriefPanel from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionColorSizeBreakdownSection, {
  type ColorSizeStageDef,
  type ColorSizeTotalItem,
} from '@/components/production/ProductionColorSizeBreakdownSection.vue'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'

interface DrawerState {
  visible: boolean
  row: SewingListItem | null
}

const props = defineProps<{
  drawer: DrawerState
  logs: ReturnType<typeof toLogSectionItems>
  briefFromRow: (row: SewingListItem) => ProductionOrderBriefModel
  canEdit?: boolean
  /** 编辑保存后递增，触发明细重载 */
  reloadToken?: number
}>()

const emit = defineEmits<{
  (e: 'update:drawer', val: DrawerState): void
  (e: 'closed'): void
  (e: 'edit', row: SewingListItem): void
}>()

const visible = computed({
  get: () => props.drawer.visible,
  set: (v) => emit('update:drawer', { ...props.drawer, visible: v }),
})

const formData = ref<CompleteFormDataRes | null>(null)
const breakdownLoading = ref(false)
const breakdownError = ref(false)

const sizeHeaders = computed(() => {
  const data = formData.value
  if (!data) return []
  if (Array.isArray(data.sizeHeaders) && data.sizeHeaders.length) return data.sizeHeaders
  const headers = data.headers ?? []
  if (headers.length && headers[headers.length - 1] === '合计') return headers.slice(0, -1)
  return headers
})

const planColorRows = computed(() => formData.value?.orderColorRows ?? [])
const cutColorRows = computed(() => formData.value?.cutColorRows ?? [])
const sewingColorRows = computed(() => formData.value?.sewingQuantitiesByColor ?? [])

function colorRowOrNull(
  colorIdx: number,
  rows: Array<{ colorName: string; quantities: number[] }> | undefined | null,
): number[] | null {
  if (!Array.isArray(rows) || rows.length === 0) return null
  return rows[colorIdx]?.quantities ?? null
}

const stageDefs = computed<ColorSizeStageDef[]>(() => {
  const row = props.drawer.row
  return [
    {
      label: '订单数量',
      valuesForColor: (ci) => colorRowOrNull(ci, planColorRows.value),
      total: row?.quantity ?? null,
    },
    {
      label: '裁床数量',
      valuesForColor: (ci) => colorRowOrNull(ci, cutColorRows.value),
      total: row?.cutTotal ?? null,
    },
    {
      label: '车缝数量',
      valuesForColor: (ci) => colorRowOrNull(ci, sewingColorRows.value),
      total: row?.sewingQuantity ?? null,
    },
  ]
})

const totalItems = computed<ColorSizeTotalItem[]>(() => {
  const row = props.drawer.row
  if (!row) return []
  const defect = formData.value?.defectQuantity
  return [
    { label: '订单数量', display: formatDisplayNumber(row.quantity ?? 0) },
    { label: '裁床数量', display: row.cutTotal != null ? formatDisplayNumber(row.cutTotal) : '—' },
    {
      label: '车缝数量',
      display: row.sewingQuantity != null ? formatDisplayNumber(row.sewingQuantity) : '—',
    },
    {
      label: '次品数',
      display: defect != null ? formatDisplayNumber(defect) : '—',
    },
  ]
})

async function loadBreakdown(orderId: number) {
  breakdownLoading.value = true
  breakdownError.value = false
  try {
    const res = await getCompleteFormData(orderId)
    formData.value = res.data ?? null
  } catch (e: unknown) {
    breakdownError.value = true
    formData.value = null
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '颜色×尺码明细加载失败'))
  } finally {
    breakdownLoading.value = false
  }
}

watch(
  () => ({
    open: props.drawer.visible,
    orderId: props.drawer.row?.orderId ?? 0,
    token: props.reloadToken ?? 0,
  }),
  ({ open, orderId }) => {
    if (open && orderId > 0) void loadBreakdown(orderId)
    else formData.value = null
  },
  { immediate: true },
)
</script>

