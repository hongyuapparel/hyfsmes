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
        <el-descriptions :column="1" border size="small" class="finishing-brief-extra">
          <el-descriptions-item label="尾部状态">{{ row.finishingStatus }}</el-descriptions-item>
          <el-descriptions-item label="裁床数量">
            {{ row.cutTotal != null ? formatDisplayNumber(row.cutTotal) : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="车缝数量">
            {{ row.sewingQuantity != null ? formatDisplayNumber(row.sewingQuantity) : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="尾部收货">
            {{ row.tailReceivedQty != null ? formatDisplayNumber(row.tailReceivedQty) : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="尾部入库">
            {{ row.tailInboundQty != null ? formatDisplayNumber(row.tailInboundQty) : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="次品数">
            {{ row.defectQuantity != null ? formatDisplayNumber(row.defectQuantity) : '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="包装备注">
            {{ (row.remark ?? '').trim() || '—' }}
          </el-descriptions-item>
        </el-descriptions>
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
import { ref, watch } from 'vue'
import { formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import type { FinishingListItem } from '@/api/production-finishing'
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
</script>
