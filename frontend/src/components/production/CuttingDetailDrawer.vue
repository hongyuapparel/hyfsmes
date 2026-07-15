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
        <ProductionDetailSection>
          <ProductionOrderBriefPanel
            :brief="detailOrderBrief"
          />
        </ProductionDetailSection>

        <template v-if="detailPayload">
          <ProductionDetailSection title="裁剪数量与物料">
            <template v-if="canEdit" #actions>
              <el-button type="primary" size="small" @click="emit('edit')">
                编辑
              </el-button>
            </template>
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
          </ProductionDetailSection>

          <ProductionDetailSection title="时效与成本">
            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="到裁床时间">
                {{ formatDateTime(detailPayload.arrivedAt) }}
              </el-descriptions-item>
              <el-descriptions-item label="完成时间">
                {{ formatDateTime(detailPayload.completedAt) }}
              </el-descriptions-item>
              <el-descriptions-item label="裁剪部门">
                {{ displayDash(detailPayload.cuttingDepartment) }}
              </el-descriptions-item>
              <el-descriptions-item label="裁剪人">
                {{ displayDash(detailPayload.cutterName) }}
              </el-descriptions-item>
              <el-descriptions-item label="本次净耗合计(米)">
                {{ fabricMetersDisplay(detailPayload.actualFabricMeters) }}
              </el-descriptions-item>
              <el-descriptions-item label="裁剪单价(元/件)">
                {{ moneyDisplay(detailPayload.cuttingUnitPrice) }}
              </el-descriptions-item>
              <el-descriptions-item label="裁剪总成本(元)">
                {{ moneyDisplay(detailPayload.cuttingTotalCost ?? detailPayload.cuttingCost) }}
              </el-descriptions-item>
            </el-descriptions>
          </ProductionDetailSection>
        </template>

        <ProductionDetailSection v-else title="时效与节点">
          <el-descriptions :column="2" border size="small">
            <el-descriptions-item label="裁床状态">
              {{ drawer.row.cuttingStatus === 'completed' ? '裁床完成' : '等待裁床' }}
            </el-descriptions-item>
            <el-descriptions-item label="时效判定">
              <SlaJudgeTag :text="drawer.row.timeRating" />
            </el-descriptions-item>
            <el-descriptions-item label="到裁床时间">
              {{ formatDateTime(drawer.row.arrivedAt) }}
            </el-descriptions-item>
            <el-descriptions-item label="完成时间">
              {{ formatDateTime(drawer.row.completedAt) }}
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

/** 用列表行补齐图片/跟单等；下单日期优先取详情接口 */
const detailOrderBrief = computed<ProductionOrderBriefModel | null>(() => {
  const row = props.drawer.row
  if (!row) return null
  const base = props.briefFromRow(row)
  const fromDetail = props.detailPayload?.orderBrief
  if (!fromDetail) return base
  return {
    ...base,
    orderNo: fromDetail.orderNo || base.orderNo,
    skuCode: fromDetail.skuCode || base.skuCode,
    orderQuantity: fromDetail.quantity ?? base.orderQuantity,
    customerName: fromDetail.customerName || base.customerName,
    orderDate: fromDetail.orderDate ?? base.orderDate,
  }
})
</script>

<style scoped>
.cutting-detail-drawer__body {
  min-height: 120px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.register-hint {
  margin: 0 0 var(--space-sm);
  color: var(--el-text-color-secondary);
  font-size: var(--font-size-caption);
}

.register-hint--warn {
  color: var(--el-color-warning);
}
</style>
