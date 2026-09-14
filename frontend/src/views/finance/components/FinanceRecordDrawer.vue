<template>
  <AppDrawer :model-value="visible" :title="kind === 'income' ? '收入详情' : '支出详情'" :size="680" @update:model-value="emit('update:visible', $event)">
    <el-scrollbar v-if="record" class="record-scroll">
      <el-descriptions :column="isMobile ? 1 : 2" :label-width="100" border size="small">
        <el-descriptions-item label="日期">{{ record.occurDate }}</el-descriptions-item>
        <el-descriptions-item label="金额（元）">{{ formatMoneyAligned(record.amount) }}</el-descriptions-item>
        <el-descriptions-item :label="kind === 'income' ? '付款方' : '收款方'" :span="2">{{ partyName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="资金账户">{{ record.fundAccountName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="归属部门">{{ record.departmentName || '待归属' }}</el-descriptions-item>
        <el-descriptions-item label="收支类型">{{ typeName || '—' }}</el-descriptions-item>
        <el-descriptions-item label="收支性质">{{ cashKindLabel(record.cashKind) }}</el-descriptions-item>
        <el-descriptions-item label="银行流水号" :span="2">{{ record.bankReference || '—' }}</el-descriptions-item>
        <el-descriptions-item label="关联订单">{{ record.orderNo || '—' }}</el-descriptions-item>
        <el-descriptions-item label="经办人">{{ record.operator || '—' }}</el-descriptions-item>
        <el-descriptions-item label="状态" :span="2">{{ record.deletedAt ? '已删除' : '有效' }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2"><span class="record-text">{{ record.remark || '—' }}</span></el-descriptions-item>
        <el-descriptions-item label="附件凭证" :span="2">
          <div v-if="record.attachments?.length" class="record-vouchers">
            <el-image v-for="(url, index) in record.attachments" :key="url" :src="url" :preview-src-list="record.attachments" :initial-index="index" preview-teleported fit="contain" class="record-voucher" />
          </div>
          <span v-else>无附件</span>
        </el-descriptions-item>
      </el-descriptions>
      <h3>操作记录</h3>
      <div v-if="loading" class="record-status">正在加载操作记录…</div>
      <el-result v-else-if="error" icon="warning" title="操作记录加载失败">
        <template #extra><el-button @click="loadHistory">重试</el-button></template>
      </el-result>
      <FinanceAuditTable v-else :logs="logs" />
    </el-scrollbar>
    <template #footer><el-button @click="emit('update:visible', false)">关闭</el-button></template>
  </AppDrawer>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppDrawer from '@/components/AppDrawer.vue'
import { cashKindLabel, getFinanceHistory, type FinanceAudit } from '@/api/finance-control'
import type { IncomeRecordItem, ExpenseRecordItem } from '@/api/finance'
import { formatMoneyAligned } from '@/utils/display-number'
import FinanceAuditTable from './FinanceAuditTable.vue'
import { isMobileViewport as isMobile } from '@/composables/useViewport'

const props = defineProps<{ visible: boolean; kind: 'income' | 'expense'; record: IncomeRecordItem | ExpenseRecordItem | null }>()
const emit = defineEmits<{ 'update:visible': [value: boolean] }>()
const partyName = computed(() => props.record && ('sourceName' in props.record ? props.record.sourceName : props.record.payeeName))
const typeName = computed(() => props.record && ('incomeTypeName' in props.record ? props.record.incomeTypeName : props.record.expenseTypeName))
const logs = ref<FinanceAudit[]>([])
const loading = ref(false)
const error = ref(false)
let generation = 0
async function loadHistory() {
  const current = ++generation
  logs.value = []
  error.value = false
  loading.value = false
  if (!props.visible || !props.record) return
  loading.value = true
  try {
    const result = await getFinanceHistory(props.kind, props.record.id)
    if (current === generation) logs.value = result.data || []
  } catch {
    if (current === generation) error.value = true
  } finally {
    if (current === generation) loading.value = false
  }
}
watch(() => [props.visible, props.kind, props.record?.id], loadHistory, { immediate: true })
</script>

<style scoped>
.record-scroll { flex: 1; min-height: 0; overflow-wrap: anywhere; }
h3 { font-size: var(--font-size-body); margin: var(--space-lg) 0 var(--space-md); }
.record-text { white-space: pre-wrap; }
.record-status { color: var(--color-text-muted); padding: var(--space-md) 0; }
.record-vouchers { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
.record-voucher { width: 100px; height: 100px; }
</style>
