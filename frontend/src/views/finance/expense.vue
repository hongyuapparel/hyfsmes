<template>
  <div class="page-card finance-expense-page">
    <div class="filter-bar">
      <el-date-picker
        v-model="filter.dateFrom"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="开始日期"
        clearable
        class="filter-bar-item"
      />
      <el-date-picker
        v-model="filter.dateTo"
        type="date"
        value-format="YYYY-MM-DD"
        placeholder="结束日期"
        clearable
        class="filter-bar-item"
      />
      <el-select
        v-model="filter.expenseTypeId"
        placeholder="支出类型"
        clearable
        filterable
        class="filter-bar-item filter-select"
      >
        <el-option
          v-for="opt in optionData.expenseTypes"
          :key="opt.id"
          :label="opt.value"
          :value="opt.id"
        />
      </el-select>
      <el-select
        v-model="filter.departmentId"
        placeholder="部门"
        clearable
        filterable
        class="filter-bar-item filter-select"
      >
        <el-option
          v-for="opt in optionData.departments"
          :key="opt.id"
          :label="opt.value"
          :value="opt.id"
        />
      </el-select>
      <div class="filter-bar-actions">
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">清空</el-button>
        <el-button type="primary" @click="openForm(null)">登记支出</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" border stripe class="data-table">
      <el-table-column prop="occurDate" label="日期" width="120" />
      <el-table-column prop="amount" label="金额（元）" width="120" align="right">
        <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
      </el-table-column>
      <el-table-column prop="expenseTypeName" label="支出类型" width="100" show-overflow-tooltip />
      <el-table-column prop="departmentName" label="部门" width="100" show-overflow-tooltip />
      <el-table-column prop="orderNo" label="关联订单" width="110" show-overflow-tooltip />
      <el-table-column prop="supplierName" label="关联供应商" min-width="100" show-overflow-tooltip />
      <el-table-column prop="detail" label="明细" min-width="160" show-overflow-tooltip />
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
        :page-sizes="[20, 40, 60]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="onPageSizeChange"
      />
    </div>

    <el-dialog
      v-model="formDialog.visible"
      :title="formDialog.isEdit ? '编辑支出' : '登记支出'"
      width="560"
      destroy-on-close
      @close="formRef?.resetFields()"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="发生日期" prop="occurDate">
          <el-date-picker
            v-model="form.occurDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="金额（元）" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="2" style="width: 100%" />
        </el-form-item>
        <el-form-item label="支出类型" prop="expenseTypeId">
          <el-select
            v-model="form.expenseTypeId"
            placeholder="选择支出类型"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="opt in optionData.expenseTypes"
              :key="opt.id"
              :label="opt.value"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="部门" prop="departmentId">
          <el-select
            v-model="form.departmentId"
            placeholder="选填"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="opt in optionData.departments"
              :key="opt.id"
              :label="opt.value"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="关联订单" prop="orderId">
          <el-input-number
            v-model="form.orderId"
            :min="1"
            placeholder="选填，订单 ID"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="关联供应商" prop="supplierId">
          <el-select
            v-model="form.supplierId"
            placeholder="选填，能匹配系统供应商时选择"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="s in supplierOptions"
              :key="s.id"
              :label="s.name"
              :value="s.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="明细" prop="detail">
          <el-input
            v-model="form.detail"
            type="textarea"
            :rows="3"
            placeholder="匹配不上的支出在此写清楚用途、说明"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="formDialog.submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  getExpenseList,
  getExpenseOptions,
  createExpense,
  updateExpense,
  deleteExpense,
  type ExpenseRecordItem,
} from '@/api/finance'
import { getSupplierList } from '@/api/suppliers'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const optionData = reactive<{
  expenseTypes: { id: number; value: string }[]
  departments: { id: number; value: string }[]
}>({ expenseTypes: [], departments: [] })
const supplierOptions = ref<{ id: number; name: string }[]>([])

const filter = reactive<{
  dateFrom: string
  dateTo: string
  expenseTypeId: number | null
  departmentId: number | null
}>({
  dateFrom: '',
  dateTo: '',
  expenseTypeId: null,
  departmentId: null,
})
const list = ref<ExpenseRecordItem[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

const formDialog = reactive<{ visible: boolean; submitting: boolean; isEdit: boolean }>({
  visible: false,
  submitting: false,
  isEdit: false,
})
const editId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive<{
  occurDate: string
  amount: number
  expenseTypeId: number | null
  departmentId: number | null
  orderId: number | null
  supplierId: number | null
  detail: string
}>({
  occurDate: '',
  amount: 0,
  expenseTypeId: null,
  departmentId: null,
  orderId: null,
  supplierId: null,
  detail: '',
})
const formRules: FormRules = {
  occurDate: [{ required: true, message: '请选择发生日期', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
}

function formatAmount(v: string | number): string {
  if (v === '' || v == null) return '-'
  const n = Number(v)
  if (Number.isNaN(n)) return '-'
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function load() {
  loading.value = true
  try {
    const res = await getExpenseList({
      dateFrom: filter.dateFrom || undefined,
      dateTo: filter.dateTo || undefined,
      expenseTypeId: filter.expenseTypeId ?? undefined,
      departmentId: filter.departmentId ?? undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
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

function onSearch() {
  pagination.page = 1
  load()
}

function onReset() {
  filter.dateFrom = ''
  filter.dateTo = ''
  filter.expenseTypeId = null
  filter.departmentId = null
  pagination.page = 1
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

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
      await updateExpense(editId.value, {
        occurDate: form.occurDate,
        amount: form.amount,
        expenseTypeId: form.expenseTypeId,
        departmentId: form.departmentId,
        orderId: form.orderId != null && form.orderId > 0 ? form.orderId : undefined,
        supplierId: form.supplierId ?? undefined,
        detail: form.detail,
      })
      ElMessage.success('已保存')
    } else {
      await createExpense({
        occurDate: form.occurDate,
        amount: form.amount,
        expenseTypeId: form.expenseTypeId,
        departmentId: form.departmentId,
        orderId: form.orderId != null && form.orderId > 0 ? form.orderId : undefined,
        supplierId: form.supplierId ?? undefined,
        detail: form.detail,
      })
      ElMessage.success('已登记')
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
    await ElMessageBox.confirm('确定删除该条支出记录？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteExpense(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

onMounted(async () => {
  try {
    const [optRes, supRes] = await Promise.all([
      getExpenseOptions(),
      getSupplierList({ page: 1, pageSize: 500 }),
    ])
    const optData = optRes.data
    if (optData) {
      optionData.expenseTypes = optData.expenseTypes ?? []
      optionData.departments = optData.departments ?? []
    }
    const supData = supRes.data
    if (supData?.list) {
      supplierOptions.value = supData.list.map((s) => ({ id: s.id, name: s.name }))
    }
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
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
  padding: var(--space-sm);
  background-color: var(--color-bg-subtle, #f5f6f8);
  border-radius: var(--radius-lg);
}

.filter-bar-item {
  width: 160px;
}

.filter-select {
  min-width: 120px;
}

.filter-bar-actions {
  margin-left: auto;
  display: flex;
  gap: var(--space-sm);
}

.data-table {
  margin-bottom: var(--space-md);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
}
</style>
