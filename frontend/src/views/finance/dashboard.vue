<template>
  <div class="dashboard-page">
    <!-- 本月统计卡片 -->
    <div class="stat-cards">
      <div class="stat-card income">
        <div class="stat-label">本月总收入</div>
        <div class="stat-value income-color">¥{{ fmtAmt(summary?.currentMonth.totalIncome) }}</div>
      </div>
      <div class="stat-card expense">
        <div class="stat-label">本月总支出</div>
        <div class="stat-value expense-color">¥{{ fmtAmt(summary?.currentMonth.totalExpense) }}</div>
      </div>
      <div class="stat-card order-expense">
        <div class="stat-label">本月订单相关支出</div>
        <div class="stat-value expense-color">¥{{ fmtAmt(summary?.currentMonth.orderExpense) }}</div>
      </div>
      <div class="stat-card company-expense">
        <div class="stat-label">本月公司费用</div>
        <div class="stat-value neutral-color">¥{{ fmtAmt(summary?.currentMonth.companyExpense) }}</div>
      </div>
      <div class="stat-card profit">
        <div class="stat-label">本月订单毛利</div>
        <div class="stat-value" :class="profitColor">¥{{ fmtAmt(summary?.currentMonth.orderProfit) }}</div>
        <div class="stat-hint">（关联订单收入 - 关联订单支出）</div>
      </div>
    </div>

    <!-- 账户余额 -->
    <div v-if="summary?.accountBalances?.length" class="section">
      <div class="section-title">各账户余额</div>
      <div class="account-balance-row">
        <div v-for="ab in summary.accountBalances" :key="ab.fundAccountId" class="account-card">
          <div class="account-name">{{ ab.fundAccountName }}</div>
          <div class="account-balance" :class="Number(ab.balance) >= 0 ? 'income-color' : 'expense-color'">
            ¥{{ fmtAmt(ab.balance) }}
          </div>
        </div>
      </div>
    </div>

    <div class="content-grid">
      <!-- 最近收入流水 -->
      <div class="section half">
        <div class="section-title">最近收入流水</div>
        <el-table :data="summary?.recentIncome ?? []" size="small" class="mini-table">
          <el-table-column prop="occurDate" label="日期" width="100" />
          <el-table-column prop="incomeTypeName" label="类型" width="90" show-overflow-tooltip />
          <el-table-column prop="sourceName" label="来源方" min-width="80" show-overflow-tooltip />
          <el-table-column label="金额" width="100" align="right">
            <template #default="{ row }">
              <span class="income-color">{{ fmtAmt(row.amount) }}</span>
            </template>
          </el-table-column>
        </el-table>
        <div class="section-more">
          <router-link to="/finance/income" class="more-link">查看全部收入 →</router-link>
        </div>
      </div>

      <!-- 最近支出流水 -->
      <div class="section half">
        <div class="section-title">最近支出流水</div>
        <el-table :data="summary?.recentExpense ?? []" size="small" class="mini-table">
          <el-table-column prop="occurDate" label="日期" width="100" />
          <el-table-column prop="expenseTypeName" label="类型" width="90" show-overflow-tooltip />
          <el-table-column prop="payeeName" label="收款方" min-width="80" show-overflow-tooltip />
          <el-table-column label="金额" width="100" align="right">
            <template #default="{ row }">
              <span class="expense-color">{{ fmtAmt(row.amount) }}</span>
            </template>
          </el-table-column>
        </el-table>
        <div class="section-more">
          <router-link to="/finance/expense" class="more-link">查看全部支出 →</router-link>
        </div>
      </div>

      <!-- 支出分类TOP5 -->
      <div class="section half">
        <div class="section-title">本月支出分类 TOP5</div>
        <div v-if="!summary?.expenseTypeTop5?.length" class="empty-tip">暂无数据</div>
        <div v-else class="top5-list">
          <div v-for="(item, i) in summary.expenseTypeTop5" :key="i" class="top5-row">
            <span class="top5-rank">{{ i + 1 }}</span>
            <span class="top5-name">{{ item.expenseTypeName }}</span>
            <div class="top5-bar-wrap">
              <div class="top5-bar" :style="{ width: barWidth(item.totalAmount, maxExpenseType) + '%' }" />
            </div>
            <span class="top5-amount expense-color">¥{{ fmtAmt(item.totalAmount) }}</span>
          </div>
        </div>
      </div>

      <!-- 部门支出TOP5 -->
      <div class="section half">
        <div class="section-title">本月部门支出 TOP5</div>
        <div v-if="!summary?.departmentExpenseTop5?.length" class="empty-tip">暂无数据（需在支出流水中填写部门）</div>
        <div v-else class="top5-list">
          <div v-for="(item, i) in summary.departmentExpenseTop5" :key="i" class="top5-row">
            <span class="top5-rank">{{ i + 1 }}</span>
            <span class="top5-name">{{ item.departmentName }}</span>
            <div class="top5-bar-wrap">
              <div class="top5-bar" :style="{ width: barWidth(item.totalAmount, maxDeptExpense) + '%' }" />
            </div>
            <span class="top5-amount expense-color">¥{{ fmtAmt(item.totalAmount) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getDashboardSummary, type DashboardSummary } from '@/api/finance'
import { getErrorMessage } from '@/api/request'
import { formatDisplayNumber } from '@/utils/display-number'

const summary = ref<DashboardSummary | null>(null)
const loading = ref(false)

function fmtAmt(v: string | number | undefined | null) {
  if (v == null) return formatDisplayNumber(0)
  const n = Number(v)
  return Number.isNaN(n) ? formatDisplayNumber(0) : formatDisplayNumber(n)
}

const profitColor = computed(() => {
  const v = Number(summary.value?.currentMonth.orderProfit ?? 0)
  return v > 0 ? 'income-color' : v < 0 ? 'expense-color' : 'neutral-color'
})

const maxExpenseType = computed(() => {
  const list = summary.value?.expenseTypeTop5 ?? []
  return list.length ? Math.max(...list.map((i) => Number(i.totalAmount))) : 0
})

const maxDeptExpense = computed(() => {
  const list = summary.value?.departmentExpenseTop5 ?? []
  return list.length ? Math.max(...list.map((i) => Number(i.totalAmount))) : 0
})

function barWidth(amount: string, max: number) {
  if (!max) return 0
  return Math.round((Number(amount) / max) * 100)
}

async function load() {
  loading.value = true
  try {
    const res = await getDashboardSummary()
    summary.value = res.data ?? null
  } catch (e: unknown) {
    ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.dashboard-page { padding: var(--space-md); }

/* 统计卡片 */
.stat-cards { display: flex; flex-wrap: wrap; gap: var(--space-md); margin-bottom: var(--space-lg); }
.stat-card { flex: 1 1 180px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--space-md) var(--space-lg); min-width: 160px; }
.stat-label { font-size: 13px; color: var(--color-text-muted); margin-bottom: 6px; }
.stat-value { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
.stat-hint { font-size: 11px; color: var(--color-text-muted); margin-top: 4px; }

/* 账户余额 */
.account-balance-row { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
.account-card { background: var(--color-bg-subtle, #f5f6f8); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 10px 16px; min-width: 130px; }
.account-name { font-size: 12px; color: var(--color-text-muted); }
.account-balance { font-size: 16px; font-weight: 600; margin-top: 2px; }

/* 内容区网格 */
.content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }
@media (max-width: 900px) { .content-grid { grid-template-columns: 1fr; } }

.section { background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--space-md); }
.section-title { font-size: 14px; font-weight: 600; color: var(--color-text-primary); margin-bottom: var(--space-sm); }
.section-more { margin-top: var(--space-sm); text-align: right; }
.more-link { font-size: 12px; color: var(--color-primary); text-decoration: none; }
.more-link:hover { text-decoration: underline; }
.mini-table { font-size: 13px; }

/* TOP5 */
.empty-tip { font-size: 13px; color: var(--color-text-muted); padding: var(--space-md) 0; text-align: center; }
.top5-list { display: flex; flex-direction: column; gap: 10px; }
.top5-row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.top5-rank { width: 20px; height: 20px; border-radius: 50%; background: #e2e8f0; color: #64748b; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; }
.top5-name { width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.top5-bar-wrap { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
.top5-bar { height: 100%; background: #f97316; border-radius: 4px; transition: width .3s; }
.top5-amount { width: 90px; text-align: right; flex-shrink: 0; font-weight: 600; }

/* 颜色 */
.income-color { color: #16a34a; }
.expense-color { color: #dc2626; }
.neutral-color { color: var(--color-text-primary); }
</style>
