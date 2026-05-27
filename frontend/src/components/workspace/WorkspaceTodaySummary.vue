<template>
  <div class="today-summary">
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value">{{ summary?.stats.todayOpsCount ?? '—' }}</div>
        <div class="stat-label">今日已操作</div>
      </div>
      <div class="stat-card urgent">
        <div class="stat-value">{{ summary?.stats.urgentCount ?? '—' }}</div>
        <div class="stat-label">紧急待办</div>
      </div>
      <div class="stat-card warn">
        <div class="stat-value">{{ summary?.stats.dueSoonCount ?? '—' }}</div>
        <div class="stat-label">7天内到期</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ summary?.stats.myOrdersCount ?? '—' }}</div>
        <div class="stat-label">我跟的单</div>
      </div>
    </div>

    <div v-if="summary?.opGroups.length" class="ops-section">
      <div class="ops-header" @click="expanded = !expanded">
        <span class="ops-title">今日系统操作记录（自动生成，只读）</span>
        <el-icon :class="expanded ? 'icon-up' : 'icon-down'"><ArrowDown /></el-icon>
      </div>
      <div v-if="expanded" class="ops-list">
        <div v-for="g in summary.opGroups" :key="g.action" class="op-row">
          <el-tag size="small" type="success" class="op-label">{{ g.label }}</el-tag>
          <span class="op-count">{{ g.count }} 单</span>
          <span class="op-nos">{{ g.orderNos.slice(0, 6).join('  ') }}{{ g.orderNos.length > 6 ? ` …共 ${g.orderNos.length} 单` : '' }}</span>
        </div>
      </div>
      <div v-else class="ops-collapsed">
        共 {{ summary.stats.todayOpsCount }} 单操作记录
      </div>
    </div>
    <div v-else-if="!loading" class="ops-empty">今日暂无系统操作记录</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import type { WorkspaceSummary } from '@/api/workspace'

defineProps<{ summary: WorkspaceSummary | null; loading: boolean }>()
const expanded = ref(true)
</script>

<style scoped>
.today-summary { display: flex; flex-direction: column; gap: 12px; margin-bottom: 16px; }
.stats-row { display: flex; gap: 12px; }
.stat-card {
  flex: 1;
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  text-align: center;
}
.stat-card.urgent .stat-value { color: var(--el-color-danger); }
.stat-card.warn .stat-value { color: var(--el-color-warning); }
.stat-value { font-size: 24px; font-weight: 700; line-height: 1.2; color: var(--color-text-primary); }
.stat-label { font-size: var(--font-size-caption); color: var(--color-text-secondary); margin-top: 4px; }
.ops-section {
  background: var(--color-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 12px 16px;
}
.ops-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  user-select: none;
}
.ops-title { font-size: var(--font-size-body); color: var(--color-text-secondary); }
.icon-up { transform: rotate(180deg); transition: transform 0.2s; }
.icon-down { transition: transform 0.2s; }
.ops-list { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.op-row { display: flex; align-items: center; gap: 8px; }
.op-label { min-width: 64px; }
.op-count { font-size: var(--font-size-body); color: var(--color-text-primary); font-weight: 500; min-width: 36px; }
.op-nos { font-size: var(--font-size-caption); color: var(--color-text-secondary); flex: 1; }
.ops-collapsed { margin-top: 6px; font-size: var(--font-size-caption); color: var(--color-text-secondary); }
.ops-empty { font-size: var(--font-size-caption); color: var(--color-text-secondary); padding: 8px 0; }
</style>
