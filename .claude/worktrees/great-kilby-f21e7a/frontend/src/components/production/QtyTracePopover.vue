<template>
  <el-popover
    placement="top-start"
    trigger="hover"
    :width="width"
    :show-arrow="true"
    @show="emit('show')"
  >
    <template #reference>
      <slot name="reference" />
    </template>
    <div class="qty-popover">
      <div class="qty-popover-title">数量追踪</div>
      <div v-if="loadingId === orderId" class="qty-popover-loading">加载中...</div>
      <div v-else>
        <template v-if="blocks.length">
          <div
            v-for="(block, bIdx) in blocks"
            :key="`${orderId}-bc-${bIdx}`"
            class="qty-popover-block"
          >
            <div class="qty-popover-subtitle">{{ block.colorName }}</div>
            <table class="qty-popover-table">
              <thead>
                <tr>
                  <th class="qty-header">尺码</th>
                  <th
                    v-for="(h, hIdx) in headers"
                    :key="`${h}-${hIdx}`"
                    class="qty-header"
                  >
                    {{ h }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="br in block.rows" :key="br.label">
                  <td class="qty-label">{{ br.label }}</td>
                  <td
                    v-for="(v, vIdx) in br.values"
                    :key="vIdx"
                    class="qty-value"
                  >
                    {{ v != null ? formatDisplayNumber(v) : '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
        <div v-else class="qty-popover-empty">暂无尺码明细</div>
      </div>
    </div>
  </el-popover>
</template>

<script setup lang="ts">
import { formatDisplayNumber } from '@/utils/display-number'

interface QtyPopoverRow {
  label: string
  values: Array<number | null>
}

interface QtyPopoverBlock {
  colorName: string
  rows: QtyPopoverRow[]
}

defineProps<{
  orderId: number
  width: number
  loadingId: number | null
  headers: string[]
  blocks: QtyPopoverBlock[]
}>()

const emit = defineEmits<{
  (e: 'show'): void
}>()
</script>

<style scoped>
.qty-popover {
  font-size: 12px;
}

.qty-popover-title {
  font-weight: 600;
  margin-bottom: 6px;
}

.qty-popover-subtitle {
  font-weight: 600;
  margin-bottom: 6px;
}

.qty-popover-block:not(:first-child) {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed var(--color-border);
}

.qty-popover-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.qty-popover-table .qty-label {
  padding: 2px 4px;
  color: var(--color-text-muted, #909399);
  white-space: nowrap;
  text-align: left;
}

.qty-popover-table .qty-value {
  padding: 2px 4px;
  text-align: center;
  white-space: nowrap;
}

.qty-header {
  padding: 2px 4px;
  font-weight: 500;
  white-space: nowrap;
  text-align: center;
}

.qty-popover-loading,
.qty-popover-empty {
  font-size: 12px;
  color: var(--color-text-muted, #909399);
}
</style>
