<template>
  <div v-loading="loading" class="dashboard-page">
    <div class="filter-bar">
      <div class="preset-group">
        <el-button
          v-for="item in rangePresetOptions"
          :key="item.value"
          :type="filter.preset === item.value ? 'primary' : 'default'"
          @click="selectPreset(item.value)"
        >
          {{ item.label }}
        </el-button>
      </div>
      <el-date-picker
        v-model="filter.occurDateRange"
        type="daterange"
        range-separator=""
        start-placeholder="统计区间"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        class="filter-range"
        :class="{ 'range-single': !hasDateRangeValue(filter.occurDateRange) }"
        :style="getFilterRangeStyle(filter.occurDateRange)"
        @change="onRangeChange"
        @clear="onRangeClear"
      />
    </div>

    <div v-if="summaryPeriod" class="summary-bar">
      统计区间：<b>{{ summaryPeriod.dateFrom }}</b> 至 <b>{{ summaryPeriod.dateTo }}</b>
    </div>

    <div class="stat-cards">
      <div class="stat-card income">
        <div class="stat-label">{{ titlePrefix }}总收入</div>
        <div class="stat-value income-color">￥{{ fmtAmt(periodSummaryData.totalIncome) }}</div>
      </div>
      <div class="stat-card expense">
        <div class="stat-label">{{ titlePrefix }}总支出</div>
        <div class="stat-value expense-color">￥{{ fmtAmt(periodSummaryData.totalExpense) }}</div>
      </div>
      <div class="stat-card order-expense">
        <div class="stat-label">{{ titlePrefix }}订单相关支出</div>
        <div class="stat-value expense-color">￥{{ fmtAmt(periodSummaryData.orderExpense) }}</div>
      </div>
      <div class="stat-card company-expense">
        <div class="stat-label">{{ titlePrefix }}公司费用</div>
        <div class="stat-value neutral-color">￥{{ fmtAmt(periodSummaryData.companyExpense) }}</div>
      </div>
    </div>

    <div v-if="summary?.accountBalances?.length" class="section">
      <div class="section-title">当前各账户余额</div>
      <div class="account-balance-row">
        <div v-for="ab in summary.accountBalances" :key="ab.fundAccountId" class="account-card">
          <div class="account-name">{{ ab.fundAccountName }}</div>
          <div class="account-balance" :class="Number(ab.balance) >= 0 ? 'income-color' : 'expense-color'">
            ￥{{ fmtAmt(ab.balance) }}
          </div>
        </div>
      </div>
    </div>

    <div class="content-grid">
      <div class="section half">
        <div class="section-title">{{ titlePrefix }}收入流水</div>
        <el-table :data="summary?.recentIncome ?? []" size="small" class="mini-table">
          <el-table-column prop="occurDate" label="日期" width="100" />
          <el-table-column prop="incomeTypeName" label="类型" width="110" show-overflow-tooltip />
          <el-table-column label="部门" min-width="90" show-overflow-tooltip>
            <template #default="{ row }">{{ row.departmentName || '—' }}</template>
          </el-table-column>
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

      <div class="section half">
        <div class="section-title">{{ titlePrefix }}支出流水</div>
        <el-table :data="summary?.recentExpense ?? []" size="small" class="mini-table">
          <el-table-column prop="occurDate" label="日期" width="100" />
          <el-table-column prop="expenseTypeName" label="类型" width="110" show-overflow-tooltip />
          <el-table-column prop="payeeName" label="收款方" min-width="90" show-overflow-tooltip />
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

      <div class="section half">
        <div class="section-title">{{ titlePrefix }}支出分类 TOP5</div>
        <div v-if="!summary?.expenseTypeTop5?.length" class="empty-tip">暂无数据</div>
        <div v-else class="top5-list">
          <div v-for="(item, i) in summary.expenseTypeTop5" :key="i" class="top5-row">
            <span class="top5-rank">{{ i + 1 }}</span>
            <span class="top5-name">{{ item.expenseTypeName }}</span>
            <div class="top5-bar-wrap">
              <div class="top5-bar" :style="{ width: `${barWidth(item.totalAmount, maxExpenseType)}%` }" />
            </div>
            <span class="top5-amount expense-color">￥{{ fmtAmt(item.totalAmount) }}</span>
          </div>
        </div>
      </div>

      <div class="section half">
        <div class="section-title">{{ titlePrefix }}部门支出 TOP5</div>
        <div v-if="!summary?.departmentExpenseTop5?.length" class="empty-tip">暂无数据（需在支出流水中填写部门）</div>
        <div v-else class="top5-list">
          <div v-for="(item, i) in summary.departmentExpenseTop5" :key="i" class="top5-row">
            <span class="top5-rank">{{ i + 1 }}</span>
            <span class="top5-name">{{ item.departmentName }}</span>
            <div class="top5-bar-wrap">
              <div class="top5-bar" :style="{ width: `${barWidth(item.totalAmount, maxDeptExpense)}%` }" />
            </div>
            <span class="top5-amount expense-color">￥{{ fmtAmt(item.totalAmount) }}</span>
          </div>
        </div>
      </div>

      <div class="section full">
        <div class="section-title">{{ titlePrefix }}部门利润率</div>
        <div class="section-desc">按部门收入与支出统计，利润率 = (收入 - 支出) / 收入</div>
        <div v-if="!summary?.departmentProfitability?.length" class="empty-tip">
          暂无数据（需在收入流水、支出流水中填写部门）
        </div>
        <el-table v-else :data="summary?.departmentProfitability ?? []" size="small" class="mini-table">
          <el-table-column label="部门" min-width="120" show-overflow-tooltip>
            <template #default="{ row }">{{ row?.departmentName || '—' }}</template>
          </el-table-column>
          <el-table-column label="收入" min-width="120" align="right">
            <template #default="{ row }">
              <span class="income-color">￥{{ fmtAmt(row?.totalIncome ?? 0) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="支出" min-width="120" align="right">
            <template #default="{ row }">
              <span class="expense-color">￥{{ fmtAmt(row?.totalExpense ?? 0) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="利润" min-width="120" align="right">
            <template #default="{ row }">
              <span :class="profitClass(row?.profit ?? 0)">￥{{ fmtAmt(row?.profit ?? 0) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="利润率" min-width="110" align="right">
            <template #default="{ row }">{{ profitRateLabel(row?.profitRate) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getDashboardSummary, type DashboardSummary } from '@/api/finance'
import { getErrorMessage } from '@/api/request'
import { getFilterRangeStyle } from '@/composables/useFilterBarHelpers'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { formatDisplayNumber } from '@/utils/display-number'

const summary = ref<DashboardSummary | null>(null)
const loading = ref(false)

type DashboardRangePreset = 'currentMonth' | 'lastMonth' | 'currentQuarter' | 'currentYear' | 'custom'
type DateRangeValue = [string, string] | null

const rangePresetOptions: Array<{ value: Exclude<DashboardRangePreset, 'custom'>; label: string }> = [
  { value: 'currentMonth', label: '本月' },
  { value: 'lastMonth', label: '上月' },
  { value: 'currentQuarter', label: '本季度' },
  { value: 'currentYear', label: '本年' },
]

const presetLabelMap: Record<DashboardRangePreset, string> = {
  currentMonth: '本月',
  lastMonth: '上月',
  currentQuarter: '本季度',
  currentYear: '本年',
  custom: '所选区间',
}

const emptyPeriodSummary = {
  totalIncome: '0.00',
  totalExpense: '0.00',
  orderExpense: '0.00',
  companyExpense: '0.00',
  orderProfit: '0.00',
}

const filter = reactive({
  preset: 'currentMonth' as DashboardRangePreset,
  occurDateRange: getPresetRange('currentMonth') as DateRangeValue,
})

function fmtAmt(v: string | number | undefined | null) {
  if (v == null) return formatDisplayNumber(0)
  const n = Number(v)
  return Number.isNaN(n) ? formatDisplayNumber(0) : formatDisplayNumber(n)
}

function profitClass(v: string | number | undefined | null) {
  const value = Number(v ?? 0)
  if (value > 0) return 'income-color'
  if (value < 0) return 'expense-color'
  return 'neutral-color'
}

function profitRateLabel(v: string | undefined) {
  return v ? `${v}%` : '—'
}

const titlePrefix = computed(() => presetLabelMap[filter.preset] ?? '所选区间')
const periodSummaryData = computed(() => summary.value?.periodSummary ?? summary.value?.currentMonth ?? emptyPeriodSummary)
const summaryPeriod = computed(() => {
  if (summary.value?.period) return summary.value.period
  if (hasDateRangeValue(filter.occurDateRange)) {
    return { dateFrom: filter.occurDateRange[0], dateTo: filter.occurDateRange[1] }
  }
  return null
})

const maxExpenseType = computed(() => {
  const list = summary.value?.expenseTypeTop5 ?? []
  return list.length ? Math.max(...list.map((item) => Number(item.totalAmount))) : 0
})

const maxDeptExpense = computed(() => {
  const list = summary.value?.departmentExpenseTop5 ?? []
  return list.length ? Math.max(...list.map((item) => Number(item.totalAmount))) : 0
})

function barWidth(amount: string, max: number) {
  if (!max) return 0
  return Math.round((Number(amount) / max) * 100)
}

function formatDateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getPresetRange(preset: Exclude<DashboardRangePreset, 'custom'>): [string, string] {
  const now = new Date()
  let start: Date
  let end: Date
  if (preset === 'lastMonth') {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    end = new Date(now.getFullYear(), now.getMonth(), 0)
  } else if (preset === 'currentQuarter') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3
    start = new Date(now.getFullYear(), quarterStartMonth, 1)
    end = new Date(now.getFullYear(), quarterStartMonth + 3, 0)
  } else if (preset === 'currentYear') {
    start = new Date(now.getFullYear(), 0, 1)
    end = new Date(now.getFullYear(), 12, 0)
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1)
    end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  }
  return [formatDateValue(start), formatDateValue(end)]
}

function hasDateRangeValue(v: DateRangeValue | undefined) {
  return Array.isArray(v) && v.length === 2
}

function resolvePreset(range: [string, string]): DashboardRangePreset {
  const matched = rangePresetOptions.find((item) => {
    const [start, end] = getPresetRange(item.value)
    return start === range[0] && end === range[1]
  })
  return matched?.value ?? 'custom'
}

function selectPreset(preset: Exclude<DashboardRangePreset, 'custom'>) {
  filter.preset = preset
  filter.occurDateRange = getPresetRange(preset)
  load()
}

function onRangeChange(value: DateRangeValue) {
  if (!hasDateRangeValue(value)) return
  filter.occurDateRange = value
  filter.preset = resolvePreset(value)
  load()
}

function onRangeClear() {
  selectPreset('currentMonth')
}

async function load() {
  loading.value = true
  try {
    const [dateFrom, dateTo] = hasDateRangeValue(filter.occurDateRange)
      ? filter.occurDateRange
      : getPresetRange('currentMonth')
    const res = await getDashboardSummary({ dateFrom, dateTo })
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
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm); padding: var(--space-sm); background: var(--color-bg-subtle, #f5f6f8); border-radius: var(--radius-lg); }
.preset-group { display: flex; flex-wrap: wrap; gap: var(--space-xs, 8px); }
.filter-range { min-width: 170px; margin-left: auto; }
.summary-bar { padding: 6px 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 13px; color: #475569; margin-bottom: var(--space-md); }
.range-single.el-date-editor--daterange :deep(.el-range-separator) { display: none; }
.range-single.el-date-editor--daterange :deep(.el-range-input:last-child) { display: none; }
.range-single.el-date-editor--daterange :deep(.el-range-input:first-child) { width: 100%; }
.range-single.el-date-editor--daterange :deep(.el-range__close-icon) { margin-left: 0; }

.stat-cards { display: flex; flex-wrap: wrap; gap: var(--space-md); margin-bottom: var(--space-lg); }
.stat-card { flex: 1 1 180px; background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--space-md) var(--space-lg); min-width: 160px; }
.stat-label { font-size: var(--font-size-body); color: var(--color-text-muted); margin-bottom: 6px; }
.stat-value { font-size: var(--font-size-title); font-weight: 700; }

.account-balance-row { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
.account-card { background: var(--color-bg-subtle, #f5f6f8); border: 1px solid var(--color-border); border-radius: var(--radius-lg); padding: 10px 16px; min-width: 130px; }
.account-name { font-size: var(--font-size-caption); color: var(--color-text-muted); }
.account-balance { font-size: var(--font-size-subtitle); font-weight: 600; margin-top: 2px; }

.content-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }
.section { background: var(--color-card); border: 1px solid var(--color-border); border-radius: var(--radius-xl); padding: var(--space-md); }
.full { grid-column: 1 / -1; }
.section-title { font-size: var(--font-size-body); font-weight: 600; color: var(--color-text-primary); margin-bottom: var(--space-sm); }
.section-desc { font-size: var(--font-size-caption); color: var(--color-text-muted); margin-bottom: var(--space-sm); }
.section-more { margin-top: var(--space-sm); text-align: right; }
.more-link { font-size: var(--font-size-caption); color: var(--color-primary); text-decoration: none; }
.more-link:hover { text-decoration: underline; }
.mini-table { font-size: var(--font-size-body); }

.empty-tip { font-size: var(--font-size-body); color: var(--color-text-muted); padding: var(--space-md) 0; text-align: center; }
.top5-list { display: flex; flex-direction: column; gap: 10px; }
.top5-row { display: flex; align-items: center; gap: 8px; font-size: var(--font-size-body); }
.top5-rank { width: 20px; height: 20px; border-radius: 50%; background: #e2e8f0; color: #64748b; display: flex; align-items: center; justify-content: center; font-size: var(--font-size-caption); font-weight: 600; flex-shrink: 0; }
.top5-name { width: 90px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
.top5-bar-wrap { flex: 1; height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
.top5-bar { height: 100%; background: #f97316; border-radius: 4px; transition: width 0.3s; }
.top5-amount { width: 90px; text-align: right; flex-shrink: 0; font-weight: 600; }

.income-color { color: #16a34a; }
.expense-color { color: #dc2626; }
.neutral-color { color: var(--color-text-primary); }

@media (max-width: 900px) {
  .content-grid { grid-template-columns: 1fr; }
  .filter-range { margin-left: 0; width: 100%; }
  .full { grid-column: auto; }
}
</style>
