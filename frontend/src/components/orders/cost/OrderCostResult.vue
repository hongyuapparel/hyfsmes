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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDisplayNumber } from '@/utils/display-number'

const props = defineProps<{
  materialTotal: number; processTotal: number; productionTotal: number; total: number
  salePrice?: string; issues: string[]
}>()
const money = (value: number) => formatDisplayNumber(Number.isFinite(value) ? value : 0)
const subtotals = computed(() => [
  { label: '物料成本', value: props.materialTotal }, { label: '工艺项目成本', value: props.processTotal }, { label: '生产工序成本', value: props.productionTotal },
])
const saleMargin = computed(() => {
  const sale = Number(props.salePrice)
  if (!Number.isFinite(sale) || sale <= 0) return '-'
  return `${money(sale - props.total)} 元 / ${money((sale - props.total) / sale * 100)}%`
})
</script>
