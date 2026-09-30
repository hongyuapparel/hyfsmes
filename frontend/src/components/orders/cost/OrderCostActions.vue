<template>
  <div class="cost-action-bar">
    <strong>单件成本 {{ money(total) }} 元</strong>
    <fieldset class="cost-margin-field" :disabled="disabled || saving || confirming" :inert="disabled || saving || confirming">
      <el-tooltip content="建议出厂价 = 单件成本 ÷ (1 − 目标毛利率)，不是成本加价率。">
        <span>目标毛利率</span>
      </el-tooltip>
      <el-input-number v-model="marginPercent" aria-label="目标毛利率百分比" :min="0" :max="99" :step="1" :precision="2" size="small" />
      <span>%</span>
    </fieldset>
    <strong class="cost-suggested-price">建议出厂单价 {{ money(price) }} 元</strong>
    <div class="cost-quote-actions">
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
  total: number; margin: number; price: number
  disabled: boolean; saving: boolean; confirming: boolean; isQuoteQueue: boolean
}>()
const emit = defineEmits<{
  'update:margin': [value: number]; save: []; confirm: [action: 'stay' | 'next' | 'return']
}>()
const money = (value: number) => formatDisplayNumber(Number.isFinite(value) ? value : 0)
const marginPercent = computed({ get: () => props.margin * 100, set: (value: number | undefined) => emit('update:margin', (value ?? 0) / 100) })
</script>

<style scoped>
.cost-action-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-xs) var(--space-sm); }
.cost-margin-field { display: inline-flex; align-items: center; gap: var(--space-xs); border: 0; margin: 0; padding: 0; min-width: 0; }
.cost-suggested-price { color: var(--el-color-primary); }
.cost-quote-actions { display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-left: auto; }
.cost-quote-actions .el-button { margin-left: 0; }
</style>
