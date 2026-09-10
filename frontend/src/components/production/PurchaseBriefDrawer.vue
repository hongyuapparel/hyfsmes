<script setup lang="ts">
import type { PurchaseItemRow } from '@/api/production-purchase'
import type { toLogSectionItems } from '@/api/operation-logs'
import { displayStatus, displayStatusLabel } from '@/utils/purchase-status'
import { formatDisplayNumber } from '@/utils/display-number'
import { formatMaterialQuantity } from '@/utils/material-quantity-unit'
import OperationLogsSection from '@/components/common/OperationLogsSection.vue'
import SlaJudgeTag from '@/components/sla/SlaJudgeTag.vue'
import ProductionOrderBriefPanel from '@/components/production/ProductionOrderBriefPanel.vue'
import ProductionDetailDrawerShell from '@/components/production/ProductionDetailDrawerShell.vue'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'
import AppImageThumb from '@/components/AppImageThumb.vue'
import { formatDateTime } from '@/utils/date-format'
import type { ProductionOrderBriefModel } from './ProductionOrderBriefPanel.vue'

defineProps<{
  modelValue: boolean
  row: PurchaseItemRow | null
  brief: ProductionOrderBriefModel | null
  orderTypeLabel: string
  logs: ReturnType<typeof toLogSectionItems>
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'closed'): void
}>()
</script>

<template>
  <ProductionDetailDrawerShell
    :model-value="modelValue"
    title="订单与物料概要"
    :size="760"
    :resizable="true"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
  >
    <template v-if="row">
      <ProductionDetailSection>
        <ProductionOrderBriefPanel :brief="brief" :image-width="96" :image-height="128" />
      </ProductionDetailSection>
      <ProductionDetailSection title="本行物料">
        <template #actions>
          <el-tag :type="displayStatus(row) === 'completed' ? 'success' : 'warning'" size="small">
            {{ displayStatusLabel(row) }}
          </el-tag>
        </template>
        <el-descriptions :column="2" :label-width="112" border size="small">
          <el-descriptions-item label="物料序号">
            {{ row.materialIndex + 1 }}
          </el-descriptions-item>
          <el-descriptions-item label="处理路线">
            {{ row.processRoute === 'picking' ? '领料' : '采购' }}
          </el-descriptions-item>
          <el-descriptions-item label="订单类型">
            {{ orderTypeLabel || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="物料类型">
            {{ (row.materialType ?? '').trim() || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="物料名称">
            {{ (row.materialName ?? '').trim() || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="颜色">
            {{ (row.color ?? '').trim() || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="成分">
            {{ (row.composition ?? '').trim() || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="克重">
            {{ (row.weight ?? '').trim() || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="物料图">
            <AppImageThumb
              v-if="row.referenceImageUrl"
              :raw-url="row.referenceImageUrl"
              variant="dialog"
            />
            <span v-else>—</span>
          </el-descriptions-item>
          <el-descriptions-item label="供应商">
            {{ (row.supplierName ?? '').trim() || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="物料来源">
            {{ (row.materialSource ?? '').trim() || '—' }}
          </el-descriptions-item>
          <el-descriptions-item label="计划用量">
            {{ formatMaterialQuantity(row.planQuantity, row) }}
          </el-descriptions-item>
        </el-descriptions>
      </ProductionDetailSection>
      <ProductionDetailSection title="采购登记信息">
        <el-descriptions :column="2" :label-width="112" border size="small">
          <el-descriptions-item label="实际采购数量">
            {{
              row.actualPurchaseQuantity != null
                ? formatDisplayNumber(row.actualPurchaseQuantity)
                : '—'
            }}
          </el-descriptions-item>
          <el-descriptions-item label="单价(元)">
            {{
              row.purchaseUnitPrice != null && row.purchaseUnitPrice !== ''
                ? formatDisplayNumber(row.purchaseUnitPrice)
                : '—'
            }}
          </el-descriptions-item>
          <el-descriptions-item label="其他费用(元)">
            {{
              row.purchaseOtherCost != null && row.purchaseOtherCost !== ''
                ? formatDisplayNumber(row.purchaseOtherCost)
                : '—'
            }}
          </el-descriptions-item>
          <el-descriptions-item label="采购总金额(元)">
            {{
              row.purchaseAmount != null && row.purchaseAmount !== ''
                ? formatDisplayNumber(row.purchaseAmount)
                : '—'
            }}
          </el-descriptions-item>
          <el-descriptions-item label="采购凭证" :span="2">
            <AppImageThumb
              v-if="row.purchaseImageUrl"
              :raw-url="row.purchaseImageUrl"
              variant="dialog"
            />
            <span v-else>—</span>
          </el-descriptions-item>
          <el-descriptions-item label="采购备注" :span="2">
            <span class="purchase-brief-remark">{{ (row.purchaseRemark ?? '').trim() || '—' }}</span>
          </el-descriptions-item>
        </el-descriptions>
      </ProductionDetailSection>
      <ProductionDetailSection title="时效与节点">
        <el-descriptions :column="2" :label-width="112" border size="small">
          <el-descriptions-item label="到采购时间">
            {{ formatDateTime(row.pendingPurchaseAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="完成时间">
            {{
              formatDateTime(
                row.processRoute === 'picking'
                  ? row.pickCompletedAt
                  : row.purchaseCompletedAt,
              )
            }}
          </el-descriptions-item>
          <el-descriptions-item label="时效判定">
            <SlaJudgeTag :text="row.timeRating" />
          </el-descriptions-item>
        </el-descriptions>
      </ProductionDetailSection>
      <OperationLogsSection :logs="logs" />
    </template>
  </ProductionDetailDrawerShell>
</template>

<style scoped>
.purchase-brief-remark {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
</style>
