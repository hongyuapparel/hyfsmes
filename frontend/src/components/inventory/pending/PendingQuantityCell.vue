<template>
  <div class="quantity-cell">
    <el-popover placement="top" trigger="click" :width="520">
      <template #reference>
        <el-button link type="primary" :aria-label="`查看 ${row.skuCode} 数量明细`">
          {{ formatDisplayNumber(row.quantity) }}
        </el-button>
      </template>
      <div class="quantity-title">{{ shipped ? '本次发货明细' : '本批待处理明细' }}</div>
      <div v-if="detail.headers.length && detail.rows.length" class="quantity-detail">
        <table>
          <thead><tr><th>颜色</th><th v-for="(header, i) in detail.headers" :key="i">{{ header }}</th><th>合计</th></tr></thead>
          <tbody>
            <tr v-for="(item, i) in detail.rows" :key="i">
              <td>{{ item.colorName || '未记录颜色' }}</td>
              <td v-for="(value, j) in item.values" :key="j">{{ formatDisplayNumber(value) }}</td>
              <td>{{ formatDisplayNumber(getInboundPreviewRowTotal(item.values)) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="quantity-note">
        {{ row.detailStatus === 'not_applicable' ? '此记录无尺码维度，仅记录总数。' : shipped ? '此记录无可展示的尺码明细，无法确认是否原本不分尺码；不按订单计划推算。' : '本批颜色尺码明细未留存，不按订单计划推算。' }}
      </div>
      <div v-if="!shipped && row.detailStatus === 'missing'" class="quantity-note">请先在尾部纠错中按实际数据补录，再办理入库或发货。</div>
    </el-popover>
    <el-tag v-if="!shipped && row.sourceType === 'defect'" type="danger" size="small">次品</el-tag>
    <el-tag v-if="!shipped && row.detailStatus === 'missing'" type="warning" size="small">明细待补</el-tag>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PendingListItem } from '@/api/inventory'
import { buildInboundPreviewItem, getInboundPreviewRowTotal } from '@/composables/inventoryPendingDialogHelpers'
import { formatDisplayNumber } from '@/utils/display-number'

const props = defineProps<{ row: PendingListItem; shipped: boolean }>()
const detail = computed(() => buildInboundPreviewItem(props.row))
</script>

<style scoped>
.quantity-cell { display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap; gap: 4px; }
.quantity-title { font-weight: 600; margin-bottom: 8px; color: var(--el-text-color-primary); }
.quantity-detail { overflow: auto; max-height: 280px; }
.quantity-detail table { border-collapse: collapse; width: 100%; font-size: var(--font-size-caption); }
.quantity-detail th, .quantity-detail td { border: 1px solid var(--el-border-color-lighter); padding: 6px 8px; text-align: center; white-space: nowrap; }
.quantity-detail th { background: var(--el-fill-color-light); }
.quantity-note { margin-top: 8px; color: var(--el-text-color-secondary); font-size: var(--font-size-caption); }
</style>
