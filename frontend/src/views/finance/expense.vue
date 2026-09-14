<template>
  <div class="page-card finance-page">
    <FinanceFlowFilters :income="false" :filter="filter" :types="options.expenseTypes" :accounts="options.fundAccounts" :departments="options.departments" @search="onSearch" @reset="onReset">
      <template #actions>
        <el-switch v-model="filter.deleted" active-text="回收站" @change="onSearch" />
        <el-button v-if="auth.hasPermission('finance_expense_create')" type="primary" @click="openForm(null)">登记支出</el-button>
      </template>
    </FinanceFlowFilters>

    <div v-if="filter.deleted" class="selection-bar text-muted">已删除记录不参与收支统计，可核实后恢复。</div>
    <div v-if="selected.length" class="selection-bar">
      <span>已选 {{ selected.length }} 条，金额 {{ formatMoneyAligned(selectedAmount) }}</span>
      <el-button v-if="!filter.deleted && auth.hasPermission('finance_expense_delete')" type="danger" plain :loading="deleting" @click="onBatchDelete">批量删除</el-button>
      <el-button :disabled="deleting" @click="tableRef?.clearSelection()">取消选择</el-button>
    </div>

    <el-table ref="tableRef" v-loading="loading || deleting" :data="list" row-key="id" border stripe class="data-table" @selection-change="selected = $event">
      <el-table-column v-if="!filter.deleted && auth.hasPermission('finance_expense_delete')" type="selection" width="48" align="center" />
      <el-table-column prop="occurDate" label="支出日期" width="110">
        <template #default="{ row }"><el-button link type="primary" size="small" class="finance-date" :aria-label="'查看支出详情 ' + row.occurDate" @click="openDetail(row)">{{ row.occurDate }}</el-button></template>
      </el-table-column>
      <el-table-column label="支出金额（元）" width="130" align="right" class-name="col-num-right" label-class-name="col-num-right">
        <template #default="{ row }">
          <span class="expense-amount">{{ formatMoneyAligned(row.amount) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="性质" width="110" show-overflow-tooltip><template #default="{ row }">{{ cashKindLabel(row.cashKind) }}</template></el-table-column>
      <el-table-column prop="expenseTypeName" label="支出类型" width="110" show-overflow-tooltip />
      <el-table-column prop="fundAccountName" label="支出账户" width="110" show-overflow-tooltip />
      <el-table-column label="对象类型" width="90">
        <template #default="{ row }">{{ objectTypeLabel(row.objectType) }}</template>
      </el-table-column>
      <el-table-column prop="payeeName" label="收款方名称" min-width="120" show-overflow-tooltip />
      <el-table-column prop="orderNo" label="关联订单" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.orderNo || '—' }}</template>
      </el-table-column>
      <el-table-column prop="departmentName" label="归属部门" width="110" show-overflow-tooltip><template #default="{ row }">{{ row.departmentName || '待归属' }}</template></el-table-column>
      <el-table-column prop="operator" label="经办人" width="80" show-overflow-tooltip />
      <el-table-column prop="remark" label="备注" min-width="100" show-overflow-tooltip />
      <el-table-column label="附件" width="70" align="center">
        <template #default="{ row }">
          <el-button
            v-if="row.attachments?.length"
            link
            type="primary"
            size="small"
            @click="previewAttachments(row.attachments)"
          >
            查看({{ row.attachments.length }})
          </el-button>
          <span v-else class="text-muted">—</span>
        </template>
      </el-table-column>
      <el-table-column v-if="filter.deleted ? auth.hasPermission('finance_expense_delete') : auth.hasPermission('finance_expense_edit')" label="操作" width="72" align="center" fixed="right">
        <template #default="{ row }">
          <TableRowActions
            :actions="[
              { key: 'edit', label: '编辑', onClick: () => openForm(row), type: 'primary', show: !filter.deleted && auth.hasPermission('finance_expense_edit') },
              { key: 'restore', label: '恢复', onClick: () => restoreRow(row), show: filter.deleted && auth.hasPermission('finance_expense_delete') },
            ]"
          />
        </template>
      </el-table-column>
    </el-table>

    <AppPaginationBar v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" :page-sizes="[20, 50, 100]" :total-quantity="pagination.total" summary-label="筛选记录" unit="条" :total-amount="rawTotalAmount" total-amount-label="筛选合计" @current-change="load" @size-change="onPageSizeChange" />

    <AppDialog top="2vh"
      v-model="dialog.visible"
      :title="dialog.isEdit ? '编辑支出' : '登记支出'"
      width="760"
      destroy-on-close
      @close="formRef?.resetFields()"
    >
      <ExpenseEntryFields ref="formRef" :form="form" :options="options" :uploading="uploading" :show-duplicate-reason="showDuplicateReason" @upload="handleUpload" @remove="removeAttachment" />
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="submitForm">确定</el-button>
      </template>
    </AppDialog>

    <FinanceRecordDrawer v-model:visible="detailVisible" kind="expense" :record="detailRecord" />
    <AppDialog top="2vh" v-model="previewDialog.visible" title="附件预览" width="700">
      <div class="preview-grid">
        <el-image
          v-for="(url, i) in previewDialog.urls"
          :key="i"
          :src="url"
          fit="contain"
          class="preview-img"
          :preview-src-list="previewDialog.urls"
          :initial-index="i"
        />
      </div>
    </AppDialog>
  </div>
</template>

<script setup lang="ts">
import FinanceRecordDrawer from './components/FinanceRecordDrawer.vue'
import { cashKindLabel, restoreFinanceRecord } from '@/api/finance-control'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import { useFinanceSelection } from '@/composables/useFinanceSelection'
import FinanceFlowFilters from './components/FinanceFlowFilters.vue'
import { onMounted, onActivated, reactive, ref, watch } from 'vue'
import ExpenseEntryFields from './components/ExpenseEntryFields.vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { appPrompt } from '@/utils/message-box'
import {
  OBJECT_TYPE_OPTIONS,
  createExpense,
  deleteExpense,
  getExpenseList,
  getFinanceDropdownOptions,
  updateExpense,
  type ExpenseRecordItem,
  type FinanceDepartmentOption,
  type FinanceExpenseType,
  type FinanceFundAccount,
} from '@/api/finance'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { uploadFinanceImage } from '@/api/uploads'
import { formatMoneyAligned } from '@/utils/display-number'
import TableRowActions from '@/components/common/TableRowActions.vue'
import { useAuthStore } from '@/stores/auth'


const options = reactive<{
  expenseTypes: FinanceExpenseType[]
  fundAccounts: FinanceFundAccount[]
  departments: FinanceDepartmentOption[]
}>({
  expenseTypes: [],
  fundAccounts: [],
  departments: [],
})

const auth = useAuthStore()
const detailVisible = ref(false)
const detailRecord = ref<ExpenseRecordItem | null>(null)
const showDuplicateReason = ref(false)
const route = useRoute()
type DateRangeValue = [string, string] | null

const filter = reactive({
  occurDateRange: null as DateRangeValue,
  typeId: null as number | null,
  fundAccountId: null as number | null,
  departmentId: null as number | null,
  cashKind: '',
  deleted: false,
  keyword: '',
  orderNo: '',
})
const list = ref<ExpenseRecordItem[]>([])
const loading = ref(false)
const tableRef = ref<{ clearSelection(): void }>()
const { selected, selectedAmount, deleting, removeRecords } = useFinanceSelection()
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const rawTotalAmount = ref(0)
const dialog = reactive({ visible: false, isEdit: false, submitting: false })
const editId = ref<number | null>(null)
const formRef = ref<InstanceType<typeof ExpenseEntryFields>>()
const uploading = ref(false)
const form = reactive({
  cashKind: 'unclassified', bankReference: '', duplicateReason: '', version: 1,
  occurDate: '',
  amount: 0,
  expenseTypeId: null as number | null,
  fundAccountId: null as number | null,
  departmentId: null as number | null,
  objectType: '',
  payeeName: '',
  orderNo: '',
  operator: '',
  remark: '',
  attachments: [] as string[],
})


const previewDialog = reactive({ visible: false, urls: [] as string[] })

function objectTypeLabel(v: string) {
  return OBJECT_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? (v || '—')
}

function hasDateRangeValue(v: DateRangeValue | undefined) {
  return Array.isArray(v) && v.length === 2
}

let loadGeneration=0
async function load() {
  const generation=++loadGeneration
  tableRef.value?.clearSelection()
  selected.value = []
  loading.value = true
  try {
    const [dateFrom, dateTo] = hasDateRangeValue(filter.occurDateRange) ? filter.occurDateRange : []
    const res = await getExpenseList({
      cashKind: filter.cashKind || undefined, deleted: filter.deleted,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      expenseTypeId: filter.typeId ?? undefined,
      fundAccountId: filter.fundAccountId ?? undefined,
      departmentId: filter.departmentId ?? undefined,
      payeeKeyword: filter.keyword || undefined,
      orderNo: filter.orderNo || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    if (generation!==loadGeneration) return
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      const lastPage = Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
      if (pagination.page > lastPage) { pagination.page = lastPage; await load(); return }
      rawTotalAmount.value = Number(data.totalAmount ?? 0)
    }
  } catch (e: unknown) {
    if (getErrorMessage(e).includes('疑似重复')) showDuplicateReason.value = true
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    if (generation===loadGeneration) loading.value = false
  }
}

function onSearch() {
  pagination.page = 1
  load()
}


function onReset() {
  filter.cashKind = ''
  filter.deleted = false
  filter.occurDateRange = null
  filter.typeId = null
  filter.fundAccountId = null
  filter.departmentId = null
  filter.keyword = ''
  filter.orderNo = ''
  pagination.page = 1
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function openForm(row: ExpenseRecordItem | null) {
  showDuplicateReason.value = false
  form.duplicateReason = ''
  form.cashKind = row?.cashKind || 'unclassified'
  form.bankReference = row?.bankReference || ''
  form.version = row?.version || 1
  dialog.isEdit = !!row
  editId.value = row?.id ?? null
  if (row) {
    form.occurDate = row.occurDate
    form.amount = Number(row.amount)
    form.expenseTypeId = row.expenseTypeId
    form.fundAccountId = row.fundAccountId
    form.objectType = row.objectType ?? ''
    form.payeeName = row.payeeName ?? ''
    form.orderNo = row.orderNo ?? ''
    form.departmentId = row.departmentId ?? null
    form.operator = row.operator ?? ''
    form.remark = row.remark ?? ''
    form.attachments = [...(row.attachments ?? [])]
  } else {
    form.occurDate = new Date().toLocaleDateString('sv-SE')
    form.amount = 0
    form.expenseTypeId = null
    form.fundAccountId = null
    form.objectType = ''
    form.payeeName = ''
    form.orderNo = ''
    form.departmentId = null
    form.operator = useAuthStore().user?.displayName || useAuthStore().user?.username || ''
    form.remark = ''
    form.attachments = []
  }
  dialog.visible = true
}

async function handleUpload(file: File) {
  uploading.value = true
  try {
    const url = await uploadFinanceImage(file)
    form.attachments.push(url)
  } catch (e: unknown) {
    ElMessage.error(getErrorMessage(e))
  } finally {
    uploading.value = false
  }
  return false
}

function removeAttachment(idx: number) {
  form.attachments.splice(idx, 1)
}

function previewAttachments(urls: string[]) {
  previewDialog.urls = urls
  previewDialog.visible = true
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  dialog.submitting = true
  try {
    const payload = {
      cashKind: form.cashKind, bankReference: form.bankReference, duplicateReason: form.duplicateReason, version: form.version,
      occurDate: form.occurDate,
      amount: form.amount,
      expenseTypeId: form.expenseTypeId,
      fundAccountId: form.fundAccountId,
      objectType: form.objectType,
      payeeName: form.payeeName,
      orderNo: form.orderNo,
      departmentId: form.departmentId,
      operator: form.operator,
      remark: form.remark,
      attachments: form.attachments.length ? form.attachments : null,
    }
    if (dialog.isEdit && editId.value != null) {
      await updateExpense(editId.value, payload)
      ElMessage.success('已保存')
    } else {
      await createExpense(payload)
      ElMessage.success('已登记')
    }
    dialog.visible = false
    load()
  } catch (e: unknown) {
    if (getErrorMessage(e).includes('疑似重复')) showDuplicateReason.value = true
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    dialog.submitting = false
  }
}

function openDetail(row: ExpenseRecordItem) {
  detailRecord.value = row
  detailVisible.value = true
}
async function restoreRow(row: ExpenseRecordItem) {
  try {
    const { value } = await appPrompt('核实后填写恢复原因，恢复后该笔重新计入收支。', '恢复记录', { inputValidator: value => !!value?.trim() || '请填写原因' })
    await restoreFinanceRecord('expense', row.id, row.version, value); await load(); ElMessage.success('已恢复')
  } catch (e) { if (e !== 'cancel' && e !== 'close') ElMessage.error(getErrorMessage(e)) }
}
async function onBatchDelete() {
  const rows = list.value.filter(row => selected.value.some(item => item.id === row.id))
  if (!rows.length || deleting.value) return
  try {
    const { value } = await appPrompt('将删除选中的 ' + rows.length + ' 条支出，不再参与统计，可从回收站恢复。请填写原因。', '批量删除', { inputValidator: value => !!value?.trim() || '请填写原因' })
    const result = await removeRecords(rows.map(row=>row.id), id => deleteExpense(id, rows.find(row=>row.id===id)!.version, value))
    if (!result) return
    if (result.failedIds.length) ElMessage.error('已删除 ' + result.deletedCount + ' 条；失败记录编号：' + result.failedIds.join('、'))
    else ElMessage.success('已删除 ' + result.deletedCount + ' 条，可从回收站恢复')
    await load()
  } catch (e) { if (e !== 'cancel' && e !== 'close') ElMessage.error(getErrorMessage(e)) }
}

function applyPeriodQuery() {
  const { dateFrom, dateTo, departmentId, cashKind } = route.query
  filter.departmentId = typeof departmentId === 'string' && /^\d+$/.test(departmentId) ? Number(departmentId) : null
  filter.cashKind = typeof cashKind === 'string' ? cashKind : ''
  filter.deleted = false
  filter.occurDateRange = typeof dateFrom === 'string' && typeof dateTo === 'string' ? [dateFrom, dateTo] : null
}
watch(() => route.query, () => { if (route.path === '/finance/expense') { applyPeriodQuery(); onSearch() } })
let mounted=false
onActivated(()=>{if(mounted)load()})
onMounted(async () => {
  applyPeriodQuery()
  await auth.fetchUser()
  try {
    const res = await getFinanceDropdownOptions()
    if (res.data) {
      options.expenseTypes = res.data.expenseTypes ?? []
      options.fundAccounts = res.data.fundAccounts ?? []
      options.departments = res.data.departments ?? []
    }
  } catch {
    // ignore dropdown loading failure
  }
  await load()
  mounted=true
})
</script>

<style scoped>
.finance-date { font-size: var(--font-size-caption); font-weight: 400; }
.selection-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm); font-size: var(--font-size-body); }

.finance-page { background: var(--color-card); padding: var(--space-md); border-radius: var(--radius-xl); border: 1px solid var(--color-border); }
.expense-amount { color: var(--el-text-color-primary); font-weight: 600; }
.text-muted { color: var(--color-text-muted); }
.data-table { margin-bottom: var(--space-md); }
.preview-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.preview-img { width: 180px; height: 180px; border-radius: 6px; border: 1px solid var(--color-border); cursor: zoom-in; }
</style>
