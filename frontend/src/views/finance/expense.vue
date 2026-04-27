<template>
  <div class="page-card finance-page">
    <div class="filter-bar">
      <el-date-picker
        v-model="filter.occurDateRange"
        type="daterange"
        range-separator=""
        start-placeholder="支出日期"
        end-placeholder=""
        value-format="YYYY-MM-DD"
        :shortcuts="rangeShortcuts"
        unlink-panels
        clearable
        class="filter-item filter-range"
        :class="{ 'range-single': !hasDateRangeValue(filter.occurDateRange) }"
        :style="getFinanceRangeStyle(filter.occurDateRange)"
        @change="onSearch"
        @clear="onDateRangeClear"
      />
      <el-select
        v-model="filter.expenseTypeId"
        placeholder="支出类型"
        clearable
        filterable
        class="filter-item filter-select"
        @change="onSearch"
      >
        <el-option v-for="t in options.expenseTypes" :key="t.id" :label="t.name" :value="t.id" />
      </el-select>
      <el-select
        v-model="filter.fundAccountId"
        placeholder="支出账户"
        clearable
        filterable
        class="filter-item filter-select"
        @change="onSearch"
      >
        <el-option v-for="a in options.fundAccounts" :key="a.id" :label="a.name" :value="a.id" />
      </el-select>
      <el-input
        v-model="filter.payeeKeyword"
        placeholder="收款方关键词"
        clearable
        class="filter-item"
        style="width: 150px"
        @clear="onSearch"
        @keyup.enter="onSearch"
      />
      <el-input
        v-model="filter.orderNo"
        placeholder="订单号"
        clearable
        class="filter-item"
        style="width: 140px"
        @clear="onSearch"
        @keyup.enter="onSearch"
      />
      <div class="filter-actions">
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">清空</el-button>
        <el-button type="primary" @click="openForm(null)">登记支出</el-button>
      </div>
    </div>

    <div v-if="summary.totalAmount" class="summary-bar">
      当前筛选共 <b>{{ pagination.total }}</b> 条，合计支出：<b class="expense-highlight">￥{{ summary.totalAmount }}</b>
    </div>

    <el-table v-loading="loading" :data="list" border stripe class="data-table">
      <el-table-column prop="occurDate" label="支出日期" width="110" />
      <el-table-column label="支出金额（元）" width="130" align="right">
        <template #default="{ row }">
          <span class="expense-amount">{{ fmtAmt(row.amount) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="expenseTypeName" label="支出类型" width="110" show-overflow-tooltip />
      <el-table-column prop="fundAccountName" label="支出账户" width="110" show-overflow-tooltip />
      <el-table-column label="对象类型" width="90">
        <template #default="{ row }">{{ objectTypeLabel(row.objectType) }}</template>
      </el-table-column>
      <el-table-column prop="payeeName" label="收款方名称" min-width="120" show-overflow-tooltip />
      <el-table-column prop="orderNo" label="关联订单" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.orderNo || '—' }}</template>
      </el-table-column>
      <el-table-column prop="departmentName" label="部门" width="90" show-overflow-tooltip />
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
      <el-table-column label="操作" width="120" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openForm(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="onDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap">
      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="onPageSizeChange"
      />
    </div>

    <el-dialog
      v-model="dialog.visible"
      :title="dialog.isEdit ? '编辑支出' : '登记支出'"
      width="580"
      destroy-on-close
      @close="formRef?.resetFields()"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="支出日期" prop="occurDate">
          <el-date-picker
            v-model="form.occurDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="支出金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="支出类型" prop="expenseTypeId">
          <el-select v-model="form.expenseTypeId" placeholder="选择支出类型" clearable filterable style="width: 100%">
            <el-option v-for="t in options.expenseTypes" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="支出账户">
          <el-select v-model="form.fundAccountId" placeholder="选择支出账户" clearable filterable style="width: 100%">
            <el-option v-for="a in options.fundAccounts" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="对象类型">
          <el-select v-model="form.objectType" placeholder="选择对象类型" clearable style="width: 100%">
            <el-option v-for="o in OBJECT_TYPE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款方名称">
          <el-input v-model="form.payeeName" placeholder="如：供应商、员工、平台名称" clearable />
        </el-form-item>
        <el-form-item label="关联订单号">
          <el-input v-model="form.orderNo" placeholder="选填，可输入系统外订单号" clearable />
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="form.departmentId" placeholder="选填" clearable filterable style="width: 100%">
            <el-option v-for="d in options.departments" :key="d.id" :label="d.value" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="经办人">
          <el-input v-model="form.operator" placeholder="选填" clearable />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" clearable />
        </el-form-item>
        <el-form-item label="附件凭证">
          <div class="attachment-area">
            <div v-if="form.attachments.length" class="attachment-list">
              <div v-for="(url, idx) in form.attachments" :key="idx" class="attachment-item">
                <AppImageThumb
                  :raw-url="url"
                  :width="72"
                  :height="72"
                  :preview-gallery="form.attachments"
                  :preview-gallery-index="idx"
                />
                <el-button link type="danger" size="small" class="attachment-del" @click="removeAttachment(idx)">
                  删除
                </el-button>
              </div>
            </div>
            <el-upload
              :show-file-list="false"
              :before-upload="(f: File) => handleUpload(f)"
              accept="image/*"
              :disabled="uploading"
            >
              <el-button size="small" :loading="uploading">
                {{ uploading ? '上传中...' : '上传图片' }}
              </el-button>
            </el-upload>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="previewDialog.visible" title="附件预览" width="700">
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
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
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
import { getFilterRangeStyle } from '@/composables/useFilterBarHelpers'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { formatDisplayNumber } from '@/utils/display-number'

const options = reactive<{
  expenseTypes: FinanceExpenseType[]
  fundAccounts: FinanceFundAccount[]
  departments: FinanceDepartmentOption[]
}>({
  expenseTypes: [],
  fundAccounts: [],
  departments: [],
})

type DateRangeValue = [string, string] | null

const filter = reactive({
  occurDateRange: null as DateRangeValue,
  expenseTypeId: null as number | null,
  fundAccountId: null as number | null,
  payeeKeyword: '',
  orderNo: '',
})
const list = ref<ExpenseRecordItem[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const rawTotalAmount = ref(0)
const summary = computed(() => ({
  totalAmount: rawTotalAmount.value > 0 ? formatDisplayNumber(rawTotalAmount.value) : '',
}))

const dialog = reactive({ visible: false, isEdit: false, submitting: false })
const editId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const uploading = ref(false)
const form = reactive({
  occurDate: '',
  amount: 0,
  expenseTypeId: null as number | null,
  fundAccountId: null as number | null,
  objectType: '',
  payeeName: '',
  orderNo: '',
  departmentId: null as number | null,
  operator: '',
  remark: '',
  attachments: [] as string[],
})
const rules: FormRules = {
  occurDate: [{ required: true, message: '请选择支出日期', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  expenseTypeId: [{ required: true, message: '请选择支出类型', trigger: 'change' }],
}

const previewDialog = reactive({ visible: false, urls: [] as string[] })

function fmtAmt(v: string | number) {
  const n = Number(v)
  return Number.isNaN(n) ? '-' : formatDisplayNumber(n)
}

function objectTypeLabel(v: string) {
  return OBJECT_TYPE_OPTIONS.find((o) => o.value === v)?.label ?? (v || '—')
}

function hasDateRangeValue(v: DateRangeValue | undefined) {
  return Array.isArray(v) && v.length === 2
}

function getFinanceRangeStyle(v: DateRangeValue | undefined) {
  const hasValue = hasDateRangeValue(v)
  if (hasValue) return getFilterRangeStyle(v)
  return {
    width: '170px',
    flex: '0 0 170px',
  }
}

async function load() {
  loading.value = true
  try {
    const [dateFrom, dateTo] = hasDateRangeValue(filter.occurDateRange) ? filter.occurDateRange : []
    const res = await getExpenseList({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      expenseTypeId: filter.expenseTypeId ?? undefined,
      fundAccountId: filter.fundAccountId ?? undefined,
      payeeKeyword: filter.payeeKeyword || undefined,
      orderNo: filter.orderNo || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      rawTotalAmount.value = list.value.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pagination.page = 1
  load()
}

function onDateRangeClear() {
  filter.occurDateRange = null
  onSearch()
}

function onReset() {
  filter.occurDateRange = null
  filter.expenseTypeId = null
  filter.fundAccountId = null
  filter.payeeKeyword = ''
  filter.orderNo = ''
  pagination.page = 1
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function openForm(row: ExpenseRecordItem | null) {
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
    form.occurDate = ''
    form.amount = 0
    form.expenseTypeId = null
    form.fundAccountId = null
    form.objectType = ''
    form.payeeName = ''
    form.orderNo = ''
    form.departmentId = null
    form.operator = ''
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
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    dialog.submitting = false
  }
}

async function onDelete(row: ExpenseRecordItem) {
  try {
    await ElMessageBox.confirm('确定删除这条支出记录吗？', '提示', { type: 'warning' })
    await deleteExpense(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

onMounted(async () => {
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
})
</script>

<style scoped>
.finance-page { background: var(--color-card); padding: var(--space-md); border-radius: var(--radius-xl); border: 1px solid var(--color-border); }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm); padding: var(--space-sm); background: var(--color-bg-subtle, #f5f6f8); border-radius: var(--radius-lg); }
.filter-item { width: 150px; }
.filter-range { min-width: 140px; }
.filter-select { min-width: 120px; }
.filter-actions { margin-left: auto; display: flex; gap: var(--space-sm); }
.summary-bar { padding: 6px 12px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; font-size: 13px; color: #c2410c; margin-bottom: var(--space-sm); }
.expense-highlight { color: #dc2626; font-size: 15px; }
.expense-amount { color: #dc2626; font-weight: 600; }
.text-muted { color: var(--color-text-muted); }
.data-table { margin-bottom: var(--space-md); }
.pagination-wrap { display: flex; justify-content: flex-end; }
.attachment-area { display: flex; flex-direction: column; gap: 8px; }
.attachment-list { display: flex; flex-wrap: wrap; gap: 8px; }
.attachment-item { position: relative; }
.attachment-del { position: absolute; top: 2px; right: 2px; padding: 0 4px; background: rgba(0, 0, 0, 0.45); color: #fff; border-radius: 2px; }
.preview-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.preview-img { width: 180px; height: 180px; border-radius: 6px; border: 1px solid var(--color-border); cursor: zoom-in; }
.range-single.el-date-editor--daterange :deep(.el-range-separator) { display: none; }
.range-single.el-date-editor--daterange :deep(.el-range-input:last-child) { display: none; }
.range-single.el-date-editor--daterange :deep(.el-range-input:first-child) { width: 100%; }
.range-single.el-date-editor--daterange :deep(.el-range__close-icon) { margin-left: 0; }
</style>
