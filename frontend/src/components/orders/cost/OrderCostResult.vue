<template>
  <el-card class="block-card result-card" shadow="never">
    <template #header><span class="block-title">单件成本与报价核对</span></template>
    <div class="result-rows">
      <div v-for="item in subtotals" :key="item.label" class="result-row">
        <span>{{ item.label }}</span><span>{{ money(item.value) }} 元 / 件</span>
      </div>
      <div class="result-row total-cost"><span>单件总成本</span><span>{{ money(total) }} 元</span></div>
      <div class="result-row"><span>当前销售单价</span><span>{{ salePrice ? money(Number(salePrice)) + ' 元' : '-' }}</span></div>
      <div class="result-row"><span>按当前销售价计算的单件毛利 / 毛利率</span><span>{{ saleMargin }}</span></div>
    </div>
    <el-alert v-if="issues.length" title="报价前请核对以下项目（零成本项目可核对后继续确认）" type="warning" :closable="false" show-icon>
      <ul><li v-for="(issue, index) in issues" :key="index">{{ issue }}</li></ul>
    </el-alert>
  </el-card>
  <div class="cost-action-bar">
    <strong>单件成本 {{ money(total) }} 元</strong>
    <fieldset class="cost-margin-field" :disabled="disabled || saving || confirming" :inert="disabled || saving || confirming">
      <el-tooltip content="建议出厂价 = 单件成本 ÷ (1 − 目标毛利率)，不是成本加价率。">
        <span>目标毛利率</span>
      </el-tooltip>
      <el-input-number v-model="marginPercent" aria-label="目标毛利率百分比" :min="0" :max="99" :step="1" :precision="2" size="small" />
      <span>%</span>
    </fieldset>
    <strong>建议出厂单价 {{ money(price) }} 元</strong>
    <div class="result-actions">
      <el-button :disabled="saving || confirming" @click="$emit('back')">返回列表</el-button>
      <el-button :loading="saving" :disabled="disabled || confirming" @click="$emit('save')">保存草稿</el-button>
      <template v-if="isQuoteQueue">
        <el-button :loading="confirming" :disabled="disabled || saving" @click="$emit('confirm', 'return')">确认并返回列表</el-button>
        <el-button type="primary" :loading="confirming" :disabled="disabled || saving" @click="$emit('confirm', 'next')">确认并处理下一条</el-button>
      </template>
      <el-button v-else type="primary" :loading="confirming" :disabled="disabled || saving" @click="$emit('confirm', 'stay')">确认报价</el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDisplayNumber } from '@/utils/display-number'

const props = defineProps<{
  materialTotal: number; processTotal: number; productionTotal: number; total: number
  margin: number; price: number; salePrice?: string; issues: string[]
  disabled: boolean; saving: boolean; confirming: boolean; isQuoteQueue: boolean
}>()
const emit = defineEmits<{
  'update:margin': [value: number]; save: []; confirm: [action: 'stay' | 'next' | 'return']; back: []
}>()
const money = (value: number) => formatDisplayNumber(Number.isFinite(value) ? value : 0)
const marginPercent = computed({ get: () => props.margin * 100, set: (value: number | undefined) => emit('update:margin', (value ?? 0) / 100) })
const subtotals = computed(() => [
  { label: '物料成本', value: props.materialTotal }, { label: '工艺项目成本', value: props.processTotal }, { label: '生产工序成本', value: props.productionTotal },
])
const saleMargin = computed(() => {
  const sale = Number(props.salePrice)
  if (!Number.isFinite(sale) || sale <= 0) return '-'
  return `${money(sale - props.total)} 元 / ${money((sale - props.total) / sale * 100)}%`
})
</script>

<style scoped>
.cost-action-bar { position: sticky; bottom: 0; z-index: 10; display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-md); padding: var(--space-md); background: var(--el-bg-color); border-top: 1px solid var(--el-border-color); box-shadow: var(--el-box-shadow-light); }
.cost-margin-field { display: inline-flex; align-items: center; gap: var(--space-xs); border: 0; margin: 0; padding: 0; min-width: 0; }
.result-actions { margin-left: auto; flex-wrap: wrap; }
</style>
