<template>
  <div class="page-card finance-income-page">
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
      <el-select
        v-model="filter.bankAccountId"
        placeholder="银行账号"
        clearable
        filterable
        class="filter-bar-item filter-select"
      >
        <el-option
          v-for="opt in optionData.bankAccounts"
          :key="opt.id"
          :label="opt.value"
          :value="opt.id"
        />
      </el-select>
      <div class="filter-bar-actions">
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">清空</el-button>
        <el-button type="primary" @click="openForm(null)">登记收入</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" border stripe class="data-table">
      <el-table-column prop="occurDate" label="日期" width="120" />
      <el-table-column prop="amount" label="金额（元）" width="120" align="right">
        <template #default="{ row }">{{ formatAmount(row.amount) }}</template>
      </el-table-column>
      <el-table-column prop="departmentName" label="部门" min-width="100" show-overflow-tooltip />
      <el-table-column prop="bankAccountName" label="银行账号" min-width="120" show-overflow-tooltip />
      <el-table-column prop="remark" label="备注" min-width="140" show-overflow-tooltip />
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
      :title="formDialog.isEdit ? '编辑收入' : '登记收入'"
      width="480"
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
        <el-form-item label="部门" prop="departmentId">
          <el-select
            v-model="form.departmentId"
            placeholder="选择部门"
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
        <el-form-item label="银行账号" prop="bankAccountId">
          <el-select
            v-model="form.bankAccountId"
            placeholder="选择银行账号"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="opt in optionData.bankAccounts"
              :key="opt.id"
              :label="opt.value"
              :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="选填" clearable />
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
  getIncomeList,
  getIncomeOptions,
  createIncome,
  updateIncome,
  deleteIncome,
  type IncomeRecordItem,
} from '@/api/finance'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const optionData = reactive<{
  departments: { id: number; value: string }[]
  bankAccounts: { id: number; value: string }[]
}>({ departments: [], bankAccounts: [] })

const filter = reactive<{
  dateFrom: string
  dateTo: string
  departmentId: number | null
  bankAccountId: number | null
}>({
  dateFrom: '',
  dateTo: '',
  departmentId: null,
  bankAccountId: null,
})
const list = ref<IncomeRecordItem[]>([])
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
  departmentId: number | null
  bankAccountId: number | null
  remark: string
}>({
  occurDate: '',
  amount: 0,
  departmentId: null,
  bankAccountId: null,
  remark: '',
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
    const res = await getIncomeList({
      dateFrom: filter.dateFrom || undefined,
      dateTo: filter.dateTo || undefined,
      departmentId: filter.departmentId ?? undefined,
      bankAccountId: filter.bankAccountId ?? undefined,
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
  filter.departmentId = null
  filter.bankAccountId = null
  pagination.page = 1
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

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
      await updateIncome(editId.value, {
        occurDate: form.occurDate,
        amount: form.amount,
        departmentId: form.departmentId,
        bankAccountId: form.bankAccountId,
        remark: form.remark,
      })
      ElMessage.success('已保存')
    } else {
      await createIncome({
        occurDate: form.occurDate,
        amount: form.amount,
        departmentId: form.departmentId,
        bankAccountId: form.bankAccountId,
        remark: form.remark,
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

async function onDelete(row: IncomeRecordItem) {
  try {
    await ElMessageBox.confirm('确定删除该条收入记录？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteIncome(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

onMounted(async () => {
  try {
    const res = await getIncomeOptions()
    const data = res.data
    if (data) {
      optionData.departments = data.departments ?? []
      optionData.bankAccounts = data.bankAccounts ?? []
    }
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
