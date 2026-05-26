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
      <ProductionDetailSection title="业务扩展信息">
        <el-descriptions :column="1" border size="small" class="sewing-brief-extra">
          <el-descriptions-item label="加工供应商">
            {{ (drawer.row.factoryName ?? '').trim() || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="分单时间">
            {{ formatDateTime(drawer.row.distributedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="加工供应商交期">
            {{ formatDate(drawer.row.factoryDueDate) }}
          </el-descriptions-item>
          <el-descriptions-item label="车缝加工费(元)">
            {{
              drawer.row.sewingFee != null && String(drawer.row.sewingFee).trim() !== ''
                ? formatDisplayNumber(drawer.row.sewingFee)
                : '—'
            }}
          </el-descriptions-item>
        </el-descriptions>
      </ProductionDetailSection>
      <ProductionDetailSection title="时效与节点">
        <el-descriptions :column="1" border size="small" class="sewing-brief-extra">
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
      <ProductionDetailSection>
        <OperationLogsSection :logs="logs" />
      </ProductionDetailSection>
    </template>
  </ProductionDetailDrawerShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SewingListItem } from '@/api/production-sewing'
import { toLogSectionItems } from '@/api/operation-logs'
import { formatDate, formatDateTime } from '@/utils/date-format'
import { formatDisplayNumber } from '@/utils/display-number'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import ProductionOrderBriefPanel from '@/components/production/ProductionOrderBriefPanel.vue'
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
}>()

const emit = defineEmits<{
  (e: 'update:drawer', val: DrawerState): void
  (e: 'closed'): void
}>()

const visible = computed({
  get: () => props.drawer.visible,
  set: (v) => emit('update:drawer', { ...props.drawer, visible: v }),
})
</script>

<style scoped>
.sewing-brief-extra {
  margin-top: 12px;
}
</style>
