<template>
  <ProductionDetailDrawerShell
    v-model="visible"
    title="裁床详情"
    :size="760"
    :resizable="true"
    @closed="emit('closed')"
  >
    <div v-loading="drawer.loading" class="cutting-detail-drawer__body">
      <template v-if="drawer.row">
        <ProductionDetailSection v-if="!detailPayload">
          <ProductionOrderBriefPanel :brief="briefFromRow(drawer.row)" />
        </ProductionDetailSection>
        <template v-if="detailPayload">
          <ProductionDetailSection>
            <div class="cut-detail-toolbar">
              <CuttingBasicInfoBar :order-brief="detailPayload.orderBrief" show-extended />
              <el-button
                v-if="canEdit"
                type="primary"
                size="small"
                @click="emit('edit')"
              >
                编辑
              </el-button>
            </div>
            <p v-if="detailPayload.downstream?.sewingStarted" class="register-hint register-hint--warn">
              下游车缝已登记 {{ detailPayload.downstream.sewingQuantity }} 件，修改裁床数据可能导致数据不一致。
            </p>
            <p class="register-hint">以下为该订单裁床完成时登记的裁剪数量与物料用量（只读）。</p>
            <CuttingQuantityMatrix
              :model-value="detailPayload.actualCutRows"
              :headers="detailPayload.colorSizeHeaders"
              :matrix-max-height="360"
              readonly
            />
            <el-divider content-position="left">物料用量明细</el-divider>
            <CuttingMaterialUsageTable
              :model-value="detailPayload.materialUsageRows"
              :grand-pieces="detailGrandPieces"
              :table-max-height="420"
              readonly
            />
            <div class="cut-detail-meta">
              <div class="cut-detail-meta__row">
                <span class="cut-detail-meta__label">到裁床时间</span>
                <span>{{ formatDateTime(detailPayload.arrivedAt) }}</span>
              </div>
              <div class="cut-detail-meta__row">
                <span class="cut-detail-meta__label">完成时间</span>
                <span>{{ formatDateTime(detailPayload.completedAt) }}</span>
              </div>
              <div class="cut-detail-meta__row">
                <span class="cut-detail-meta__label">裁剪部门</span>
                <span>{{ displayDash(detailPayload.cuttingDepartment) }}</span>
              </div>
              <div class="cut-detail-meta__row">
                <span class="cut-detail-meta__label">裁剪人</span>
                <span>{{ displayDash(detailPayload.cutterName) }}</span>
              </div>
              <div class="cut-detail-meta__row">
                <span class="cut-detail-meta__label">本次净耗合计(米)</span>
                <span>{{ fabricMetersDisplay(detailPayload.actualFabricMeters) }}</span>
              </div>
              <div class="cut-detail-meta__row">
                <span class="cut-detail-meta__label">裁剪单价(元/件)</span>
                <span>{{ moneyDisplay(detailPayload.cuttingUnitPrice) }}</span>
              </div>
              <div class="cut-detail-meta__row">
                <span class="cut-detail-meta__label">裁剪总成本(元)</span>
                <span>{{ moneyDisplay(detailPayload.cuttingTotalCost ?? detailPayload.cuttingCost) }}</span>
              </div>
            </div>
          </ProductionDetailSection>
        </template>
        <ProductionDetailSection v-else title="时效与节点">
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="裁床状态">
              {{ drawer.row.cuttingStatus === 'completed' ? '裁床完成' : '等待裁床' }}
            </el-descriptions-item>
            <el-descriptions-item label="到裁床时间">
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
      </template>
      <ProductionDetailSection v-if="drawer.row">
        <OperationLogsSection :logs="logs" />
      </ProductionDetailSection>
    </div>
  </ProductionDetailDrawerShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CuttingListItem, CuttingCompletedDetailRes } from '@/api/production-cutting'
import { toLogSectionItems } from '@/api/operation-logs'
import { formatDateTime } from '@/utils/date-format'
import type { ProductionOrderBriefModel } from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import ProductionOrderBriefPanel from '@/components/production/ProductionOrderBriefPanel.vue'
import CuttingBasicInfoBar from '@/components/production-cutting/CuttingBasicInfoBar.vue'
import CuttingQuantityMatrix from '@/components/production-cutting/CuttingQuantityMatrix.vue'
import CuttingMaterialUsageTable from '@/components/production-cutting/CuttingMaterialUsageTable.vue'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'

interface DrawerState {
  visible: boolean
  loading: boolean
  row: CuttingListItem | null
}

const props = defineProps<{
  drawer: DrawerState
  detailPayload: CuttingCompletedDetailRes | null
  detailGrandPieces: number
  logs: ReturnType<typeof toLogSectionItems>
  briefFromRow: (row: CuttingListItem) => ProductionOrderBriefModel
  displayDash: (v: string | null | undefined) => string
  moneyDisplay: (v: string | null | undefined) => string
  fabricMetersDisplay: (v: string | null | undefined) => string
  canEdit?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:drawer', val: DrawerState): void
  (e: 'closed'): void
  (e: 'edit'): void
}>()

const visible = computed({
  get: () => props.drawer.visible,
  set: (v) => emit('update:drawer', { ...props.drawer, visible: v }),
})
</script>

<style scoped>
.cutting-detail-drawer__body {
  min-height: 120px;
}

.cut-detail-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--space-sm);
}

.register-hint {
  margin-bottom: var(--space-sm);
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption, 12px);
}

.register-hint--warn {
  color: var(--el-color-warning);
}

.cut-detail-meta {
  margin-top: var(--space-md);
  padding: 12px;
  background: var(--el-fill-color-light);
  border-radius: var(--radius);
  border: 1px solid var(--el-border-color-lighter);
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 13px;
}

.cut-detail-meta__row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}

.cut-detail-meta__label {
  color: var(--el-text-color-secondary);
  min-width: 9em;
  flex-shrink: 0;
}
</style>
