<template>
  <el-empty v-if="!logs.length" description="暂无操作记录；启用留痕前的操作无法补溯" :image-size="60" />
  <el-timeline v-else>
    <el-timeline-item v-for="log in logs" :key="log.id" :timestamp="new Date(log.created_at).toLocaleString('zh-CN')">
      <b>{{ actions[log.action] || log.action }} · {{ log.actor_name }}</b>
      <p v-if="log.reason">说明：{{ log.reason }}</p>
      <div v-for="change in changes(log)" :key="change" class="change">{{ change }}</div>
    </el-timeline-item>
  </el-timeline>
</template>
<script setup lang="ts">
import { cashKindLabel, type FinanceAudit } from '@/api/finance-control'
defineProps<{ logs: FinanceAudit[] }>()
const actions: Record<string, string> = { create:'登记',update:'修改',delete:'删除',restore:'恢复',opening:'设置期初',reconcile:'核对并锁定',reopen:'撤销对账',void:'作废转账' }
const fields: Record<string,string> = {occur_date:'收付日期',amount:'金额',fund_account_id:'资金账户编号',department_id:'归属部门编号',cash_kind:'收支性质',bank_reference:'银行流水号',source_name:'付款方',payee_name:'收款方',order_no:'订单号',operator:'经办人',remark:'备注',attachments:'附件',income_type_id:'收入类型编号',expense_type_id:'支出类型编号',object_type:'对象类型',deleted_at:'删除时间',opening_date:'期初日期',opening_balance:'期初余额',reconciled_through:'核对至',reconciled_balance:'银行核对余额',date:'日期',fromId:'转出账户编号',toId:'转入账户编号',reference:'银行流水号'}
function changes(log: FinanceAudit) {
  const before = log.before_data || {}; const after = log.after_data || {}
  if (log.action === 'void') {
    const labels: Record<string,string> = {occur_date:'日期',from_account_id:'转出账户编号',to_account_id:'转入账户编号',amount:'金额',bank_reference:'银行流水号',remark:'备注'}
    return ['状态：已作废', ...Object.entries(labels).filter(([key]) => key in before).map(([key,label]) => `${label}：${display(before[key])}`)]
  }
  return Object.entries(fields).filter(([key]) => (key in before || key in after) && display(before[key]) !== display(after[key])).map(([key,label]) => `${label}：${fieldDisplay(key, before[key])} → ${fieldDisplay(key, after[key])}`)
}
function fieldDisplay(key: string, value: unknown) { return key === 'cash_kind' && typeof value === 'string' && value ? cashKindLabel(value) : display(value) }
function display(value: unknown) { return value == null || value === '' ? '未填写' : typeof value === 'object' ? JSON.stringify(value) : String(value) }
</script>
<style scoped>
.change { overflow-wrap: anywhere; color: var(--color-text-muted); font-size: var(--font-size-caption); line-height: 1.8; }
</style>
