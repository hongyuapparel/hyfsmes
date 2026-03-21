<template>
  <div class="page-card finance-income-page">
    <div class="filter-bar">
      <el-date-picker v-model="filter.dateFrom" type="date" value-format="YYYY-MM-DD" :placeholder="'\u5f00\u59cb\u65e5\u671f'" clearable class="filter-bar-item" @change="onSearch" />
      <el-date-picker v-model="filter.dateTo" type="date" value-format="YYYY-MM-DD" :placeholder="'\u7ed3\u675f\u65e5\u671f'" clearable class="filter-bar-item" @change="onSearch" />
      <el-select v-model="filter.departmentId" :placeholder="'\u90e8\u95e8'" clearable filterable class="filter-bar-item filter-select" @change="onSearch">
        <el-option v-for="opt in optionData.departments" :key="opt.id" :label="opt.value" :value="opt.id" />
      </el-select>
      <el-select v-model="filter.bankAccountId" :placeholder="'\u94f6\u884c\u8d26\u53f7'" clearable filterable class="filter-bar-item filter-select" @change="onSearch">
        <el-option v-for="opt in optionData.bankAccounts" :key="opt.id" :label="opt.value" :value="opt.id" />
      </el-select>
      <div class="filter-bar-actions">
        <el-button type="primary" @click="onSearch">{{ '\u641c\u7d22' }}</el-button>
        <el-button @click="onReset">{{ '\u6e05\u7a7a' }}</el-button>
        <el-button type="primary" @click="openForm(null)">{{ '\u767b\u8bb0\u6536\u5165' }}</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" border stripe class="data-table">
      <el-table-column prop="occurDate" :label="'\u65e5\u671f'" width="120" />
      <el-table-column prop="amount" :label="'\u91d1\u989d\uff08\u5143\uff09'" width="120" align="right">
        <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
      </el-table-column>
      <el-table-column prop="departmentName" :label="'\u90e8\u95e8'" min-width="100" show-overflow-tooltip />
      <el-table-column prop="bankAccountName" :label="'\u94f6\u884c\u8d26\u53f7'" min-width="120" show-overflow-tooltip />
      <el-table-column prop="remark" :label="'\u5907\u6ce8'" min-width="140" show-overflow-tooltip />
      <el-table-column :label="'\u64cd\u4f5c'" width="120" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openForm(row)">{{ '\u7f16\u8f91' }}</el-button>
          <el-button link type="danger" size="small" @click="onDelete(row)">{{ '\u5220\u9664' }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap">
      <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize" :total="pagination.total" :page-sizes="[20,40,60]" layout="total, sizes, prev, pager, next" @current-change="load" @size-change="onPageSizeChange" />
    </div>

    <el-dialog v-model="formDialog.visible" :title="formDialog.isEdit ? '\u7f16\u8f91\u6536\u5165' : '\u767b\u8bb0\u6536\u5165'" width="480" destroy-on-close @close="formRef?.resetFields()">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item :label="'\u53d1\u751f\u65e5\u671f'" prop="occurDate"><el-date-picker v-model="form.occurDate" type="date" value-format="YYYY-MM-DD" :placeholder="'\u9009\u62e9\u65e5\u671f'" style="width:100%" /></el-form-item>
        <el-form-item :label="'\u91d1\u989d\uff08\u5143\uff09'" prop="amount"><el-input-number v-model="form.amount" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item :label="'\u90e8\u95e8'" prop="departmentId">
          <el-select v-model="form.departmentId" :placeholder="'\u9009\u62e9\u90e8\u95e8'" clearable filterable style="width:100%">
            <el-option v-for="opt in optionData.departments" :key="opt.id" :label="opt.value" :value="opt.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="'\u94f6\u884c\u8d26\u53f7'" prop="bankAccountId">
          <el-select v-model="form.bankAccountId" :placeholder="'\u9009\u62e9\u94f6\u884c\u8d26\u53f7'" clearable filterable style="width:100%">
            <el-option v-for="opt in optionData.bankAccounts" :key="opt.id" :label="opt.value" :value="opt.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="'\u5907\u6ce8'" prop="remark"><el-input v-model="form.remark" type="textarea" :rows="2" :placeholder="'\u9009\u586b'" clearable /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialog.visible = false">{{ '\u53d6\u6d88' }}</el-button>
        <el-button type="primary" :loading="formDialog.submitting" @click="submitForm">{{ '\u786e\u5b9a' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { getIncomeList, getIncomeOptions, createIncome, updateIncome, deleteIncome, type IncomeRecordItem } from '@/api/finance'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const optionData = reactive<{ departments: { id: number; value: string }[]; bankAccounts: { id: number; value: string }[] }>({ departments: [], bankAccounts: [] })
const filter = reactive({ dateFrom: '', dateTo: '', departmentId: null as number | null, bankAccountId: null as number | null })
const list = ref<IncomeRecordItem[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const formDialog = reactive({ visible: false, submitting: false, isEdit: false })
const editId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({ occurDate: '', amount: 0, departmentId: null as number | null, bankAccountId: null as number | null, remark: '' })
const formRules: FormRules = {
  occurDate: [{ required: true, message: '\u8bf7\u9009\u62e9\u53d1\u751f\u65e5\u671f', trigger: 'change' }],
  amount: [{ required: true, message: '\u8bf7\u8f93\u5165\u91d1\u989d', trigger: 'blur' }],
}

function formatAmount(v: string | number): string {
  const n = Number(v)
  return Number.isNaN(n) ? '-' : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function load() {
  loading.value = true
  try {
    const res = await getIncomeList({ dateFrom: filter.dateFrom || undefined, dateTo: filter.dateTo || undefined, departmentId: filter.departmentId ?? undefined, bankAccountId: filter.bankAccountId ?? undefined, page: pagination.page, pageSize: pagination.pageSize })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function onSearch() { pagination.page = 1; load() }
function onReset() { filter.dateFrom = ''; filter.dateTo = ''; filter.departmentId = null; filter.bankAccountId = null; pagination.page = 1; load() }
function onPageSizeChange() { pagination.page = 1; load() }

function openForm(row: IncomeRecordItem | null) {
  formDialog.isEdit = !!row
  editId.value = row ? row.id : null
  if (row) {
    form.occurDate = row.occurDate
    form.amount = Number(row.amount)
    form.departmentId = row.departmentId
    form.bankAccountId = row.bankAccountId
    form.remark = row.remark ?? ''
  } else {
    form.occurDate = ''
    form.amount = 0
    form.departmentId = null
    form.bankAccountId = null
    form.remark = ''
  }
  formDialog.visible = true
}

async function submitForm() {
  await formRef.value?.validate().catch(() => {})
  formDialog.submitting = true
  try {
    if (formDialog.isEdit && editId.value != null) {
      await updateIncome(editId.value, { occurDate: form.occurDate, amount: form.amount, departmentId: form.departmentId, bankAccountId: form.bankAccountId, remark: form.remark })
      ElMessage.success('\u5df2\u4fdd\u5b58')
    } else {
      await createIncome({ occurDate: form.occurDate, amount: form.amount, departmentId: form.departmentId, bankAccountId: form.bankAccountId, remark: form.remark })
      ElMessage.success('\u5df2\u767b\u8bb0')
    }
    formDialog.visible = false
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    formDialog.submitting = false
  }
}

async function onDelete(row: IncomeRecordItem) {
  try {
    await ElMessageBox.confirm('\u786e\u5b9a\u5220\u9664\u8be5\u6761\u6536\u5165\u8bb0\u5f55\uff1f', '\u63d0\u793a', { confirmButtonText: '\u786e\u5b9a', cancelButtonText: '\u53d6\u6d88', type: 'warning' })
    await deleteIncome(row.id)
    ElMessage.success('\u5df2\u5220\u9664')
    load()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

onMounted(async () => {
  try {
    const res = await getIncomeOptions()
    const data = res.data
    if (data) { optionData.departments = data.departments ?? []; optionData.bankAccounts = data.bankAccounts ?? [] }
  } catch {
    optionData.departments = []
    optionData.bankAccounts = []
  }
  await load()
})
</script>

<style scoped>
.finance-income-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-sm);
  padding: var(--space-sm);
  margin-bottom: var(--space-md);
  border-radius: var(--radius-lg);
  background-color: var(--color-bg-subtle, #f5f6f8);
}

.filter-bar-item {
  width: 160px;
}

.filter-select {
  min-width: 120px;
}

.filter-bar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
}

.data-table {
  margin-bottom: var(--space-md);
}
</style>
