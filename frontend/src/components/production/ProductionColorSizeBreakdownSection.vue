<template>
  <ProductionDetailSection title="颜色×尺码明细">
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>

    <div v-if="loading" class="color-bd-empty">加载中…</div>
    <div v-else-if="error" class="color-bd-empty">明细加载失败</div>
    <template v-else>
      <div v-if="totals.length" class="color-bd-totals">
        <span v-for="(item, i) in totals" :key="i" class="color-bd-total-item">
          <b>{{ item.label }}</b>
          {{ item.display }}
        </span>
      </div>
      <div v-if="!hasDimension" class="color-bd-empty">本订单无颜色×尺码维度</div>
      <template v-else>
        <div
          v-for="(color, ci) in colorRows"
          :key="ci"
          class="color-bd-block"
        >
          <div class="color-bd-color-name">{{ color.colorName || '—' }}</div>
          <table class="color-bd-table">
            <thead>
              <tr>
                <th class="color-bd-th-stage">阶段</th>
                <th v-for="(h, hi) in sizeHeaders" :key="hi">{{ h }}</th>
                <th>合计</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(stage, si) in stagesForColor(ci)" :key="si">
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
                <template v-else-if="stage.total === null || Number(stage.total) === 0">
                  <td :colspan="sizeHeaders.length + 1" class="color-bd-not-yet">尚未登记</td>
                </template>
                <template v-else>
                  <td :colspan="sizeHeaders.length + 1" class="color-bd-no-detail">未留存颜色×尺码明细</td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </ProductionDetailSection>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDisplayNumber } from '@/utils/display-number'
import ProductionDetailSection from '@/components/production/ProductionDetailSection.vue'

export interface ColorSizeStageDef {
  label: string
  /** 按颜色索引取 quantities；无明细返回 null */
  valuesForColor: (colorIdx: number) => number[] | null
  /** 跨色合计标量，用于区分「未登记」与「缺明细」 */
  total: number | null
}

export interface ColorSizeTotalItem {
  label: string
  display: string
}

const props = defineProps<{
  loading?: boolean
  error?: boolean
  sizeHeaders: string[]
  colorRows: Array<{ colorName: string }>
  stages: ColorSizeStageDef[]
  totals?: ColorSizeTotalItem[]
}>()

const hasDimension = computed(
  () => (props.sizeHeaders?.length ?? 0) > 0 && (props.colorRows?.length ?? 0) > 0,
)

function stagesForColor(colorIdx: number) {
  return (props.stages ?? []).map((s) => ({
    label: s.label,
    values: s.valuesForColor(colorIdx),
    total: s.total,
  }))
}

function sumArr(values: number[]): number {
  return values.reduce((s, n) => s + (Number(n) || 0), 0)
}
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
.color-bd-not-yet {
  color: var(--el-text-color-placeholder);
  text-align: center;
}
.color-bd-no-detail {
  color: var(--el-text-color-secondary);
  font-style: italic;
  text-align: center;
}
</style>
