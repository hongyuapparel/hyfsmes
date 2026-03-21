<template>
  <div class="page-card finance-expense-page">
    <div class="filter-bar">
      <el-date-picker v-model="filter.dateFrom" type="date" value-format="YYYY-MM-DD" :placeholder="'\u5f00\u59cb\u65e5\u671f'" clearable class="filter-bar-item" @change="onSearch" />
      <el-date-picker v-model="filter.dateTo" type="date" value-format="YYYY-MM-DD" :placeholder="'\u7ed3\u675f\u65e5\u671f'" clearable class="filter-bar-item" @change="onSearch" />
      <el-select v-model="filter.expenseTypeId" :placeholder="'\u652f\u51fa\u7c7b\u578b'" clearable filterable class="filter-bar-item filter-select" @change="onSearch">
        <el-option v-for="opt in optionData.expenseTypes" :key="opt.id" :label="opt.value" :value="opt.id" />
      </el-select>
      <el-select v-model="filter.departmentId" :placeholder="'\u90e8\u95e8'" clearable filterable class="filter-bar-item filter-select" @change="onSearch">
        <el-option v-for="opt in optionData.departments" :key="opt.id" :label="opt.value" :value="opt.id" />
      </el-select>
      <div class="filter-bar-actions">
        <el-button type="primary" @click="onSearch">{{ '\u641c\u7d22' }}</el-button>
        <el-button @click="onReset">{{ '\u6e05\u7a7a' }}</el-button>
        <el-button type="primary" @click="openForm(null)">{{ '\u767b\u8bb0\u652f\u51fa' }}</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" border stripe class="data-table">
      <el-table-column prop="occurDate" :label="'\u65e5\u671f'" width="120" />
      <el-table-column prop="amount" :label="'\u91d1\u989d\uff08\u5143\uff09'" width="120" align="right">
        <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
      </el-table-column>
      <el-table-column prop="expenseTypeName" :label="'\u652f\u51fa\u7c7b\u578b'" width="100" show-overflow-tooltip />
      <el-table-column prop="departmentName" :label="'\u90e8\u95e8'" width="100" show-overflow-tooltip />
      <el-table-column prop="orderNo" :label="'\u5173\u8054\u8ba2\u5355'" width="110" show-overflow-tooltip />
      <el-table-column prop="supplierName" :label="'\u5173\u8054\u4f9b\u5e94\u5546'" min-width="100" show-overflow-tooltip />
      <el-table-column prop="detail" :label="'\u660e\u7ec6'" min-width="160" show-overflow-tooltip />
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

    <el-dialog v-model="formDialog.visible" :title="formDialog.isEdit ? '\u7f16\u8f91\u652f\u51fa' : '\u767b\u8bb0\u652f\u51fa'" width="560" destroy-on-close @close="formRef?.resetFields()">
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item :label="'\u53d1\u751f\u65e5\u671f'" prop="occurDate"><el-date-picker v-model="form.occurDate" type="date" value-format="YYYY-MM-DD" :placeholder="'\u9009\u62e9\u65e5\u671f'" style="width:100%" /></el-form-item>
        <el-form-item :label="'\u91d1\u989d\uff08\u5143\uff09'" prop="amount"><el-input-number v-model="form.amount" :min="0" :precision="2" style="width:100%" /></el-form-item>
        <el-form-item :label="'\u652f\u51fa\u7c7b\u578b'" prop="expenseTypeId">
          <el-select v-model="form.expenseTypeId" :placeholder="'\u9009\u62e9\u652f\u51fa\u7c7b\u578b'" clearable filterable style="width:100%">
            <el-option v-for="opt in optionData.expenseTypes" :key="opt.id" :label="opt.value" :value="opt.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="'\u90e8\u95e8'" prop="departmentId">
          <el-select v-model="form.departmentId" :placeholder="'\u9009\u62e9\u90e8\u95e8'" clearable filterable style="width:100%">
            <el-option v-for="opt in optionData.departments" :key="opt.id" :label="opt.value" :value="opt.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="'\u5173\u8054\u8ba2\u5355'" prop="orderId"><el-input-number v-model="form.orderId" :min="1" :placeholder="'\u53ef\u9009\uff0c\u586b\u5199\u8ba2\u5355 ID'" controls-position="right" style="width:100%" /></el-form-item>
        <el-form-item :label="'\u5173\u8054\u4f9b\u5e94\u5546'" prop="supplierId">
          <el-select v-model="form.supplierId" :placeholder="'\u53ef\u9009\uff0c\u82e5\u652f\u51fa\u5339\u914d\u4f9b\u5e94\u5546\u8bf7\u586b\u5199'" clearable filterable style="width:100%">
            <el-option v-for="s in supplierOptions" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item :label="'\u660e\u7ec6'" prop="detail"><el-input v-model="form.detail" type="textarea" :rows="3" :placeholder="'\u8bf7\u5c3d\u91cf\u5199\u6e05\u695a\u7528\u9014\uff0c\u4fbf\u4e8e\u540e\u7eed\u7edf\u8ba1\u5206\u6790'" clearable /></el-form-item>
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
import { getExpenseList, getExpenseOptions, createExpense, updateExpense, deleteExpense, type ExpenseRecordItem } from '@/api/finance'
import { getSupplierList } from '@/api/suppliers'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const optionData = reactive<{ expenseTypes: { id: number; value: string }[]; departments: { id: number; value: string }[] }>({ expenseTypes: [], departments: [] })
const supplierOptions = ref<{ id: number; name: string }[]>([])
const filter = reactive({ dateFrom: '', dateTo: '', expenseTypeId: null as number | null, departmentId: null as number | null })
const list = ref<ExpenseRecordItem[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const formDialog = reactive({ visible: false, submitting: false, isEdit: false })
const editId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({ occurDate: '', amount: 0, expenseTypeId: null as number | null, departmentId: null as number | null, orderId: null as number | null, supplierId: null as number | null, detail: '' })
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
    const res = await getExpenseList({ dateFrom: filter.dateFrom || undefined, dateTo: filter.dateTo || undefined, expenseTypeId: filter.expenseTypeId ?? undefined, departmentId: filter.departmentId ?? undefined, page: pagination.page, pageSize: pagination.pageSize })
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
function onReset() { filter.dateFrom = ''; filter.dateTo = ''; filter.expenseTypeId = null; filter.departmentId = null; pagination.page = 1; load() }
function onPageSizeChange() { pagination.page = 1; load() }

function openForm(row: ExpenseRecordItem | null) {
  formDialog.isEdit = !!row
  editId.value = row ? row.id : null
  if (row) {
    form.occurDate = row.occurDate
    form.amount = Number(row.amount)
    form.expenseTypeId = row.expenseTypeId
    form.departmentId = row.departmentId
    form.orderId = row.orderId
    form.supplierId = row.supplierId
    form.detail = row.detail ?? ''
  } else {
    form.occurDate = ''
    form.amount = 0
    form.expenseTypeId = null
    form.departmentId = null
    form.orderId = null
    form.supplierId = null
    form.detail = ''
  }
  formDialog.visible = true
}

async function submitForm() {
  await formRef.value?.validate().catch(() => {})
  formDialog.submitting = true
  try {
    if (formDialog.isEdit && editId.value != null) {
      await updateExpense(editId.value, { occurDate: form.occurDate, amount: form.amount, expenseTypeId: form.expenseTypeId, departmentId: form.departmentId, orderId: form.orderId != null && form.orderId > 0 ? form.orderId : undefined, supplierId: form.supplierId ?? undefined, detail: form.detail })
      ElMessage.success('\u5df2\u4fdd\u5b58')
    } else {
      await createExpense({ occurDate: form.occurDate, amount: form.amount, expenseTypeId: form.expenseTypeId, departmentId: form.departmentId, orderId: form.orderId != null && form.orderId > 0 ? form.orderId : undefined, supplierId: form.supplierId ?? undefined, detail: form.detail })
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

async function onDelete(row: ExpenseRecordItem) {
  try {
    await ElMessageBox.confirm('\u786e\u5b9a\u5220\u9664\u8be5\u6761\u652f\u51fa\u8bb0\u5f55\uff1f', '\u63d0\u793a', { confirmButtonText: '\u786e\u5b9a', cancelButtonText: '\u53d6\u6d88', type: 'warning' })
    await deleteExpense(row.id)
    ElMessage.success('\u5df2\u5220\u9664')
    load()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

onMounted(async () => {
  try {
    const [optRes, supRes] = await Promise.all([getExpenseOptions(), getSupplierList({ page: 1, pageSize: 500 })])
    const optData = optRes.data
    if (optData) { optionData.expenseTypes = optData.expenseTypes ?? []; optionData.departments = optData.departments ?? [] }
    const supData = supRes.data
    if (supData?.list) supplierOptions.value = supData.list.map((s) => ({ id: s.id, name: s.name }))
  } catch {
    optionData.expenseTypes = []
    optionData.departments = []
    supplierOptions.value = []
  }
  await load()
})
</script>

<style scoped>
.finance-expense-page {
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
