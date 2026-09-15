<template>
  <div class="page-card finance-page">
    <FinanceFlowFilters :income="true" :filter="filter" :types="options.incomeTypes" :accounts="options.fundAccounts" :departments="options.departments" @search="onSearch" @reset="onReset">
      <template #actions>
        <el-switch v-model="filter.deleted" active-text="回收站" @change="onSearch" />
        <el-button v-if="auth.hasPermission('finance_income_create')" type="primary" @click="openForm(null)">登记收入</el-button>
      </template>
    </FinanceFlowFilters>

    <div v-if="filter.deleted" class="selection-bar text-muted">已删除记录不参与收支统计，可核实后恢复。</div>
    <div v-if="selected.length" class="selection-bar">
      <span>已选 {{ selected.length }} 条，金额 {{ formatMoneyAligned(selectedAmount) }}</span>
      <el-button v-if="!filter.deleted && auth.hasPermission('finance_income_delete')" type="danger" plain :loading="deleting" @click="onBatchDelete">批量删除</el-button>
      <el-button :disabled="deleting" @click="tableRef?.clearSelection()">取消选择</el-button>
    </div>

    <el-table ref="tableRef" v-loading="loading || deleting" :data="list" row-key="id" border stripe class="data-table" @selection-change="selected = $event">
      <el-table-column v-if="!filter.deleted && auth.hasPermission('finance_income_delete')" type="selection" width="48" align="center" />
      <el-table-column prop="occurDate" label="收款日期" width="110">
        <template #default="{ row }"><el-button link type="primary" size="small" class="finance-date" :aria-label="'查看收入详情 ' + row.occurDate" @click="openDetail(row)">{{ row.occurDate }}</el-button></template>
      </el-table-column>
      <el-table-column label="收入金额（元）" width="130" align="right" class-name="col-num-right" label-class-name="col-num-right">
        <template #default="{ row }">
          <span class="income-amount">{{ formatMoneyAligned(row.amount) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="性质" width="110" show-overflow-tooltip><template #default="{ row }">{{ cashKindLabel(row.cashKind) }}</template></el-table-column>
      <el-table-column prop="incomeTypeName" label="收入类型" width="120" show-overflow-tooltip />
      <el-table-column prop="fundAccountName" label="收款账户" width="120" show-overflow-tooltip />
      <el-table-column prop="sourceName" label="付款方" min-width="140" show-overflow-tooltip />
      <el-table-column prop="departmentName" label="归属部门" width="110" show-overflow-tooltip>
        <template #default="{ row }">{{ row.departmentName || '待归属' }}</template>
      </el-table-column>
      <el-table-column prop="operator" label="经办人" width="100" show-overflow-tooltip />
      <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
      <el-table-column label="附件" width="80" align="center">
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
      <el-table-column v-if="filter.deleted ? auth.hasPermission('finance_income_delete') : auth.hasPermission('finance_income_edit')" label="操作" width="72" align="center" fixed="right">
        <template #default="{ row }">
          <TableRowActions
            :actions="[
              { key: 'edit', label: '编辑', onClick: () => openForm(row), type: 'primary', show: !filter.deleted && auth.hasPermission('finance_income_edit') },
              { key: 'restore', label: '恢复', onClick: () => restoreRow(row), show: filter.deleted && auth.hasPermission('finance_income_delete') },
            ]"
          />
        </template>
      </el-table-column>
    </el-table>

    <AppPaginationBar v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" :page-sizes="[20, 50, 100]" :total-quantity="pagination.total" summary-label="筛选记录" unit="条" :total-amount="rawTotalAmount" total-amount-label="筛选合计" @current-change="load" @size-change="onPageSizeChange" />

    <AppDialog top="2vh"
      v-model="dialog.visible"
      :title="dialog.isEdit ? '编辑收入' : '登记收入'"
      width="760"
      destroy-on-close
      @close="formRef?.resetFields()"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="90px" class="finance-entry-form">
        <el-form-item label="收款日期" prop="occurDate">
          <el-date-picker
            v-model="form.occurDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="收入金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="2" :controls="false" style="width: 100%" />
        </el-form-item>
        <el-form-item label="收入类型" prop="incomeTypeId">
          <el-select v-model="form.incomeTypeId" placeholder="选择收入类型" clearable filterable style="width: 100%">
            <el-option v-for="t in options.incomeTypes" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款账户" prop="fundAccountId">
          <el-select v-model="form.fundAccountId" placeholder="选择收款账户" clearable filterable style="width: 100%">
            <el-option v-for="a in options.fundAccounts" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="付款方"><el-input v-model="form.sourceName" placeholder="客户、平台或其他付款方" clearable /></el-form-item>
        <el-form-item label="归属部门">
          <el-select v-model="form.departmentId" placeholder="选择受益部门，暂不明确可留空" clearable filterable style="width: 100%">
            <el-option v-for="d in options.departments" :key="d.id" :label="d.value" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="经办人">
          <el-input v-model="form.operator" placeholder="选填" clearable />
        </el-form-item>
        <FinanceRecordMeta :form="form" :show-duplicate-reason="showDuplicateReason" />
        <el-form-item label="备注" class="entry-wide">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" clearable />
        </el-form-item>
        <el-form-item label="附件凭证" class="entry-wide">
          <FinanceVoucherPicker :attachments="form.attachments" :uploading="uploading" @upload="handleUpload" @remove="removeAttachment" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="submitForm">确定</el-button>
      </template>
    </AppDialog>

    <FinanceRecordDrawer v-model:visible="detailVisible" kind="income" :record="detailRecord" />
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
import FinanceRecordMeta from './components/FinanceRecordMeta.vue'
import FinanceRecordDrawer from './components/FinanceRecordDrawer.vue'
import { cashKindLabel, restoreFinanceRecord } from '@/api/finance-control'
import AppPaginationBar from '@/components/AppPaginationBar.vue'
import { useFinanceSelection } from '@/composables/useFinanceSelection'
import FinanceFlowFilters from './components/FinanceFlowFilters.vue'
import FinanceVoucherPicker from './components/FinanceVoucherPicker.vue'
import { onMounted, onActivated, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { appPrompt } from '@/utils/message-box'
import {
  createIncome,
  deleteIncome,
  getFinanceDropdownOptions,
  getIncomeList,
  updateIncome,
  type FinanceDepartmentOption,
  type FinanceFundAccount,
  type FinanceIncomeType,
  type IncomeRecordItem,
} from '@/api/finance'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { uploadFinanceImage } from '@/api/uploads'
import { formatMoneyAligned } from '@/utils/display-number'
import TableRowActions from '@/components/common/TableRowActions.vue'
import { useAuthStore } from '@/stores/auth'


const options = reactive<{
  incomeTypes: FinanceIncomeType[]
  fundAccounts: FinanceFundAccount[]
  departments: FinanceDepartmentOption[]
}>({
  incomeTypes: [],
  fundAccounts: [],
  departments: [],
})

const auth = useAuthStore()
const detailVisible = ref(false)
const detailRecord = ref<IncomeRecordItem | null>(null)
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
const list = ref<IncomeRecordItem[]>([])
const loading = ref(false)
const tableRef = ref<{ clearSelection(): void }>()
const { selected, selectedAmount, deleting, removeRecords } = useFinanceSelection()
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const rawTotalAmount = ref(0)
const dialog = reactive({ visible: false, isEdit: false, submitting: false })
const editId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const uploading = ref(false)
const form = reactive({
  cashKind: 'unclassified', bankReference: '', duplicateReason: '', version: 1,
  occurDate: '',
  amount: 0,
  incomeTypeId: null as number | null,
  fundAccountId: null as number | null,
  departmentId: null as number | null,
  sourceName: '',
  orderNo: '',
  operator: '',
  remark: '',
  attachments: [] as string[],
})

const rules: FormRules = {
  fundAccountId: [{ required: true, message: '请选择收款账户', trigger: 'change' }],
  occurDate: [{ required: true, message: '请选择收款日期', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  incomeTypeId: [{ required: true, message: '请选择收入类型', trigger: 'change' }],
}

const previewDialog = reactive({ visible: false, urls: [] as string[] })

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
    const res = await getIncomeList({
      cashKind: filter.cashKind || undefined, deleted: filter.deleted,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      incomeTypeId: filter.typeId ?? undefined,
      fundAccountId: filter.fundAccountId ?? undefined,
      departmentId: filter.departmentId ?? undefined,
      sourceNameKeyword: filter.keyword || undefined,
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

function openForm(row: IncomeRecordItem | null) {
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
    form.incomeTypeId = row.incomeTypeId
    form.fundAccountId = row.fundAccountId
    form.departmentId = row.departmentId ?? null
    form.sourceName = row.sourceName ?? ''
    form.orderNo = row.orderNo ?? ''
    form.operator = row.operator ?? ''
    form.remark = row.remark ?? ''
    form.attachments = [...(row.attachments ?? [])]
  } else {
    form.occurDate = new Date().toLocaleDateString('sv-SE')
    form.amount = 0
    form.incomeTypeId = null
    form.fundAccountId = null
    form.departmentId = null
    form.sourceName = ''
    form.orderNo = ''
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
      incomeTypeId: form.incomeTypeId,
      fundAccountId: form.fundAccountId,
      departmentId: form.departmentId,
      sourceName: form.sourceName,
      orderNo: form.orderNo,
      operator: form.operator,
      remark: form.remark,
      attachments: form.attachments.length ? form.attachments : null,
    }
    if (dialog.isEdit && editId.value != null) {
      await updateIncome(editId.value, payload)
      ElMessage.success('已保存')
    } else {
      await createIncome(payload)
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

function openDetail(row: IncomeRecordItem) {
  detailRecord.value = row
  detailVisible.value = true
}
async function restoreRow(row: IncomeRecordItem) {
  try {
    const { value } = await appPrompt('核实后填写恢复原因，恢复后该笔重新计入收支。', '恢复记录', { inputValidator: value => !!value?.trim() || '请填写原因' })
    await restoreFinanceRecord('income', row.id, row.version, value); await load(); ElMessage.success('已恢复')
  } catch (e) { if (e !== 'cancel' && e !== 'close') ElMessage.error(getErrorMessage(e)) }
}
async function onBatchDelete() {
  const rows = list.value.filter(row => selected.value.some(item => item.id === row.id))
  if (!rows.length || deleting.value) return
  try {
    const { value } = await appPrompt('将删除选中的 ' + rows.length + ' 条收入，不再参与统计，可从回收站恢复。请填写原因。', '批量删除', { inputValidator: value => !!value?.trim() || '请填写原因' })
    const result = await removeRecords(rows.map(row=>row.id), id => deleteIncome(id, rows.find(row=>row.id===id)!.version, value))
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
watch(() => route.query, () => { if (route.path === '/finance/income') { applyPeriodQuery(); onSearch() } })
let mounted=false
onActivated(()=>{if(mounted)load()})
onMounted(async () => {
  applyPeriodQuery()
  await auth.fetchUser()
  try {
    const res = await getFinanceDropdownOptions()
    if (res.data) {
      options.incomeTypes = res.data.incomeTypes ?? []
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
.finance-entry-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: var(--space-md); }
.entry-wide { grid-column: 1 / -1; }
@media (max-width: 650px) { .finance-entry-form { grid-template-columns: minmax(0, 1fr); } }
.finance-page { background: var(--color-card); padding: var(--space-md); border-radius: var(--radius-xl); border: 1px solid var(--color-border); }
.income-amount { color: var(--el-text-color-primary); font-weight: 600; }
.text-muted { color: var(--color-text-muted); }
.data-table { margin-bottom: var(--space-md); }
.preview-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.preview-img { width: 180px; height: 180px; border-radius: 6px; border: 1px solid var(--color-border); cursor: zoom-in; }
</style>
