<template>
 <section class="statistics"><h2>工作数据</h2><p class="muted">按所选日期统计，点击数字所在条目查看订单明细。</p>
  <el-collapse>
   <el-collapse-item v-for="group in groups" :key="group.title" :name="group.title">
    <template #title><span class="stat-title">{{ group.title }}</span><strong v-if="historical && group.title.startsWith('当前')">未保存历史快照</strong><strong v-else>{{ count(group).orders }} 单<span v-if="group.title.includes('采购')"> · {{ count(group).items }} 项物料</span><span v-if="count(group).quantity!==null"> · {{ count(group).quantity }} 件</span><span v-if="count(group).unlinked"> · {{ count(group).unlinked }} 条未关联订单</span></strong></template>
    <p class="muted">{{ group.note }}</p>
    <el-table v-if="group.rows.length" :data="group.rows" :max-height="320"><el-table-column label="订单 / 款式" min-width="190"><template #default="{row}">{{ row.orderNo || '未关联订单' }} · {{ row.sku }}</template></el-table-column><el-table-column prop="title" label="事项" min-width="150" /><el-table-column prop="quantity" label="数量" width="90" /><el-table-column prop="time" label="记录时间" min-width="150" /></el-table><p v-else class="muted">暂无记录</p>
   </el-collapse-item>
  </el-collapse>
 </section>
</template>
<script setup lang="ts">
import type {AutomaticRow} from '@/api/work-reports'
import {reportCount} from '@/composables/workReportPresentation'
defineProps<{groups:{title:string;note:string;rows:AutomaticRow[]}[];historical:boolean}>()
const count=(group:{title:string;rows:AutomaticRow[]})=>reportCount(group.rows,group.title)
</script>
<style scoped>
.statistics {margin-top:var(--space-lg)}
h2 {font-size:var(--font-size-subtitle)}
.muted {color:var(--color-text-muted);font-size:var(--font-size-caption)}
.stat-title {margin-right:var(--space-lg)}
</style>
