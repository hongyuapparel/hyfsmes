<template>
  <div class="dashboard-page" v-loading="loading">
    <div class="heading"><h2>财务看板</h2><div class="actions"><el-button @click="run(controls.open)">资金核对与内部转账</el-button><el-button @click="load">刷新</el-button></div></div>
    <div class="filter-bar">
      <el-button @click="preset('month')">本月</el-button><el-button @click="preset('lastMonth')">上月</el-button><el-button @click="preset('quarter')">本季度</el-button><el-button @click="preset('year')">本年</el-button>
      <el-date-picker v-model="filter.range" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" :shortcuts="rangeShortcuts" :style="getFilterRangeStyle(filter.range)" unlink-panels @change="load" />
      <el-select v-model="filter.cashKind" placeholder="全部收支性质" clearable style="width:190px" @change="load"><el-option v-for="item in CASH_KIND_OPTIONS" :key="item.value" :label="item.label" :value="item.value" /></el-select>
    </div>
    <el-alert v-if="error" :title="error" type="error" :closable="false" />
    <template v-if="data">
      <div class="period">{{ data.period.dateFrom }} 至 {{ data.period.dateTo }} · {{ filter.cashKind ? cashKindLabel(filter.cashKind) : '全部对外收付' }} · 按实际收付日期，单位：人民币元</div>
      <el-alert :type="warnings.length ? 'warning' : 'info'" :closable="false" :title="warnings.length ? '数据尚未核对完整，请勿据此判断部门盈亏' : '已覆盖所选期间的账户核对；收支结余仍不等同于利润'">
        <ul v-if="warnings.length" class="warnings"><li v-for="warning in warnings" :key="warning">{{ warning }}</li></ul>
        <span>所选期间最后一笔收付：{{ data.quality.latest || '暂无记录' }}。该日期不代表已完成对账。</span>
      </el-alert>
      <div class="stat-cards">
        <div class="stat-card"><div>今日账面资金</div><strong>{{ financeAmount(data.currentBookBalance) }}</strong><small>含已设置期初与内部转账；不代表实时银行余额</small></div>
        <div class="stat-card"><div>本期收款</div><router-link :to="flowLink('income')"><strong>{{ financeAmount(data.periodSummary.totalIncome) }}</strong></router-link><small>点击查看同口径收入流水</small></div>
        <div class="stat-card"><div>本期支出净额</div><router-link :to="flowLink('expense')"><strong>{{ financeAmount(data.periodSummary.totalExpense) }}</strong></router-link><small>含退款及扣款冲减；点击查看支出流水</small></div>
        <div class="stat-card"><div>本期收支结余</div><strong>{{ financeAmount(data.periodSummary.netCashFlow) }}</strong><small>收款减付款；内部转账不计入</small></div>
      </div>
      <section class="section">
        <div class="section-heading"><h3>部门投入与回收</h3><span>公共费用分摊前 · 点击金额查明细</span></div>
        <el-table :data="data.departments" border stripe show-summary :summary-method="departmentSummary">
          <el-table-column prop="departmentName" label="归属部门" min-width="155" show-overflow-tooltip />
          <el-table-column prop="totalIncome" label="收款" min-width="150" align="right"><template #default="{row}"><router-link :to="flowLink('income',row.departmentId)">{{ financeAmount(row.totalIncome) }}</router-link></template></el-table-column>
          <el-table-column prop="totalExpense" label="支出净额" min-width="150" align="right"><template #default="{row}"><router-link :to="flowLink('expense',row.departmentId)">{{ financeAmount(row.totalExpense) }}</router-link></template></el-table-column>
          <el-table-column prop="netCashFlow" label="收支结余" min-width="150" align="right"><template #default="{row}">{{ financeAmount(row.netCashFlow) }}</template></el-table-column>
        </el-table>
        <p class="note">工厂为业务采购、生产的对外付款只登记一次，归入受益业务；工厂自身管理费用单列。部门名称失效的历史记录保留编号，便于核实归属。</p>
      </section>
      <section class="section">
        <div class="section-heading"><h3>月度收支变化</h3><span>首尾月份可能不足整月；空白月份显示 0，仅代表未登记</span></div>
        <el-table :data="data.trend" border stripe>
          <el-table-column prop="month" label="月份" min-width="120" />
          <el-table-column label="收款" min-width="150" align="right"><template #default="{row}">{{ financeAmount(row.totalIncome) }}</template></el-table-column>
          <el-table-column label="支出净额" min-width="150" align="right"><template #default="{row}">{{ financeAmount(row.totalExpense) }}</template></el-table-column>
          <el-table-column label="收支结余" min-width="150" align="right"><template #default="{row}">{{ financeAmount(row.netCashFlow) }}</template></el-table-column>
        </el-table>
        <el-collapse><el-collapse-item title="查看前一等长期间对照（非同比、非利润增长率）" name="comparison">
          <p class="note">对照期间：{{ data.previous.period.dateFrom }} 至 {{ data.previous.period.dateTo }}。两个期间均需完整对账后才有比较意义。</p>
          <el-table :data="comparisonRows" border><el-table-column prop="name" label="指标" min-width="100" /><el-table-column label="本期" min-width="150" align="right"><template #default="{row}">{{ financeAmount(row.current) }}</template></el-table-column><el-table-column label="前期" min-width="150" align="right"><template #default="{row}">{{ financeAmount(row.previous) }}</template></el-table-column><el-table-column label="增减额" min-width="150" align="right"><template #default="{row}">{{ financeAmount(row.delta) }}</template></el-table-column></el-table>
        </el-collapse-item></el-collapse>
      </section>
      <section class="section">
        <div class="section-heading"><h3>收支性质核对</h3><span>此表始终展示所选期间全部性质，避免漏看待分类金额</span></div>
        <el-table :data="data.nature" border stripe><el-table-column label="性质" min-width="170"><template #default="{row}">{{ cashKindLabel(row.cashKind) }}</template></el-table-column><el-table-column label="收款" min-width="150" align="right"><template #default="{row}"><router-link :to="flowLink('income',undefined,row.cashKind)">{{ financeAmount(row.totalIncome) }}</router-link></template></el-table-column><el-table-column label="付款" min-width="150" align="right"><template #default="{row}"><router-link :to="flowLink('expense',undefined,row.cashKind)">{{ financeAmount(row.totalExpense) }}</router-link></template></el-table-column></el-table>
      </section>
      <el-collapse class="section"><el-collapse-item title="尚未纳入的经营信息与使用边界" name="pending">
        <p>公共费用分摊：比例尚未确认，不自动分摊。能直接归属的费用先归属业务，剩余公共费用再分摊，不能重复增加公司支出。</p>
        <p>库存占用、待收及待付款：尚未接入可核对数据。采购已经计入付款，不能再将库存金额扣一次。季度集中备货可能使收支结余下降，不能据此认定亏损或停掉业务。</p>
        <p>历史内部转账：系统不会按往来方名称自动猜测。若以前分别记过收款和付款，需核实并删除原两笔，再用内部转账登记一次。</p>
      </el-collapse-item></el-collapse>
    </template>
    <FinanceControls ref="controlPanel" :visible="controls.visible.value" :busy="controls.loading.value" :accounts="controls.accounts.value" :transfers="controls.transfers.value" :transfer-query="controls.transferQuery" :transfer-total="controls.transferTotal.value" :transfer-loading="controls.transferLoading.value" @query="patch=>run(()=>controls.loadTransfers(patch))" :can-manage="auth.hasPermission('finance_accounts_manage')" :can-transfer="auth.hasPermission('finance_transfer_create')" :can-void="auth.hasPermission('finance_transfer_void')" @close="controls.visible.value=$event" @history="(kind,id)=>run(()=>controls.history(kind,id))" @save="saveControl" />
    <AppDialog top="2vh" v-model="controls.audit.visible" title="财务操作记录" width="760"><FinanceAuditTable :logs="controls.audit.logs" /></AppDialog>
  </div>
</template>
<script setup lang="ts">
import { computed, onMounted, onActivated, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CASH_KIND_OPTIONS, cashKindLabel } from '@/api/finance-control'
import { getErrorMessage } from '@/api/request'
import { useFinanceDashboard, financeAmount } from '@/composables/useFinanceDashboard'
import { useFinanceControls } from '@/composables/useFinanceControls'
import { useAuthStore } from '@/stores/auth'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { getFilterRangeStyle } from '@/composables/useFilterBarHelpers'
import FinanceControls from './components/FinanceControls.vue'
import FinanceAuditTable from './components/FinanceAuditTable.vue'
const { data, loading, error, filter, load, preset, warnings, flowLink } = useFinanceDashboard()
const controls = useFinanceControls(); const auth=useAuthStore(); const controlPanel=ref<InstanceType<typeof FinanceControls>>()
const comparisonRows=computed(()=>data.value ? ([['totalIncome','收款'],['totalExpense','付款'],['netCashFlow','结余']] as const).map(([key,name])=>({name,current:data.value!.periodSummary[key],previous:data.value!.previous[key],delta:(Math.round(Number(data.value!.periodSummary[key])*100)-Math.round(Number(data.value!.previous[key])*100))/100})) : [])
function departmentSummary(){return ['合计',financeAmount(data.value?.periodSummary.totalIncome),financeAmount(data.value?.periodSummary.totalExpense),financeAmount(data.value?.periodSummary.netCashFlow)]}
async function run(action:()=>Promise<unknown>){try{await action()}catch(e){ElMessage.error(getErrorMessage(e))}}
async function saveControl(id:number,mode:string,body:{date:string;amount:number;reason:string;fromId:number|null;toId:number|null;reference:string}){
  await run(async()=>{
    if(mode==='transfer')await controls.transfer({...body,remark:body.reason})
    else if(mode==='void')await controls.cancelTransfer(id,body.reason)
    else await controls.saveAccount(id,mode,body)
    controlPanel.value?.closeEditor();ElMessage.success('已保存并更新');await load()
  })
}
let mounted=false
onMounted(async()=>{await auth.fetchUser();await load();mounted=true})
onActivated(()=>{if(mounted)load()})
</script>
<style scoped>
.dashboard-page{padding:var(--space-md);min-width:0}
.heading,.actions,.section-heading{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:var(--space-sm)}
.heading{margin-bottom:var(--space-md)}
h2,h3{margin:0;font-size:var(--font-size-body)}
.period,.note,.section-heading span{font-size:var(--font-size-caption);color:var(--color-text-muted);line-height:1.7}
.period{margin:var(--space-sm) 0}.warnings{margin:var(--space-xs) 0;padding-left:var(--space-md)}
.stat-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--space-md);margin:var(--space-md) 0}
.stat-card,.section{border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-md);background:var(--color-card);min-width:0}
.stat-card{display:flex;flex-direction:column;gap:var(--space-sm);font-size:var(--font-size-body)}
.stat-card strong{font-size:var(--font-size-title);font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--el-text-color-primary)}
.stat-card small{font-size:var(--font-size-caption);color:var(--color-text-muted);line-height:1.6}
.section{margin-bottom:var(--space-md)}.section-heading{margin-bottom:var(--space-sm)}
a{color:var(--color-primary);text-decoration:none}.note{margin-bottom:0}
@media(max-width:600px){.dashboard-page{padding:var(--space-sm)}.stat-cards{grid-template-columns:minmax(0,1fr)}}
</style>
