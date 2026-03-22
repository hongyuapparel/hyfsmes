<template>
  <div class="page-card finance-page">
    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-date-picker v-model="filter.dateFrom" type="date" value-format="YYYY-MM-DD" placeholder="开始日期" clearable class="filter-item" />
      <el-date-picker v-model="filter.dateTo" type="date" value-format="YYYY-MM-DD" placeholder="结束日期" clearable class="filter-item" />
      <el-select v-model="filter.incomeTypeId" placeholder="收入类型" clearable filterable class="filter-item filter-select">
        <el-option v-for="t in options.incomeTypes" :key="t.id" :label="t.name" :value="t.id" />
      </el-select>
      <el-select v-model="filter.fundAccountId" placeholder="收款账户" clearable filterable class="filter-item filter-select">
        <el-option v-for="a in options.fundAccounts" :key="a.id" :label="a.name" :value="a.id" />
      </el-select>
      <el-input v-model="filter.sourceNameKeyword" placeholder="来源方/客户关键词" clearable class="filter-item" style="width:160px" />
      <el-input v-model="filter.orderNo" placeholder="订单号" clearable class="filter-item" style="width:140px" />
      <div class="filter-actions">
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">清空</el-button>
        <el-button type="primary" @click="openForm(null)">登记收入</el-button>
      </div>
    </div>

    <!-- 汇总行 -->
    <div v-if="summary.totalAmount" class="summary-bar">
      当前筛选共 <b>{{ pagination.total }}</b> 条，合计收入：<b class="amount-highlight">¥{{ summary.totalAmount }}</b>
    </div>

    <el-table v-loading="loading" :data="list" border stripe class="data-table">
      <el-table-column prop="occurDate" label="收款日期" width="110" />
      <el-table-column label="收入金额（元）" width="130" align="right">
        <template #default="{ row }">
          <span class="income-amount">{{ fmtAmt(row.amount) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="incomeTypeName" label="收入类型" width="110" show-overflow-tooltip />
      <el-table-column prop="fundAccountName" label="收款账户" width="120" show-overflow-tooltip />
      <el-table-column prop="sourceName" label="来源方/客户" min-width="120" show-overflow-tooltip />
      <el-table-column prop="orderNo" label="关联订单" width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.orderNo || '—' }}</template>
      </el-table-column>
      <el-table-column prop="operator" label="经办人" width="90" show-overflow-tooltip />
      <el-table-column prop="remark" label="备注" min-width="120" show-overflow-tooltip />
      <el-table-column label="附件" width="70" align="center">
        <template #default="{ row }">
          <el-button v-if="row.attachments?.length" link type="primary" size="small" @click="previewAttachments(row.attachments)">
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
      <el-pagination v-model:current-page="pagination.page" v-model:page-size="pagination.pageSize"
        :total="pagination.total" :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next"
        @current-change="load" @size-change="onPageSizeChange" />
    </div>

    <!-- 登记/编辑弹窗 -->
    <el-dialog v-model="dialog.visible" :title="dialog.isEdit ? '编辑收入' : '登记收入'"
      width="560" destroy-on-close @close="formRef?.resetFields()">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="收款日期" prop="occurDate">
          <el-date-picker v-model="form.occurDate" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" />
        </el-form-item>
        <el-form-item label="收入金额" prop="amount">
          <el-input-number v-model="form.amount" :min="0" :precision="2" style="width:100%" />
        </el-form-item>
        <el-form-item label="收入类型" prop="incomeTypeId">
          <el-select v-model="form.incomeTypeId" placeholder="选择收入类型" clearable filterable style="width:100%">
            <el-option v-for="t in options.incomeTypes" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="收款账户">
          <el-select v-model="form.fundAccountId" placeholder="选择收款账户" clearable filterable style="width:100%">
            <el-option v-for="a in options.fundAccounts" :key="a.id" :label="a.name" :value="a.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="来源方/客户">
          <el-input v-model="form.sourceName" placeholder="如：客户名称、平台名称" clearable />
        </el-form-item>
        <el-form-item label="关联订单号">
          <el-input v-model="form.orderNo" placeholder="选填，可输入系统外订单号" clearable />
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
                <el-image :src="url" fit="cover" class="attachment-thumb" :preview-src-list="form.attachments" :initial-index="idx" />
                <el-button link type="danger" size="small" class="attachment-del" @click="removeAttachment(idx)">删除</el-button>
              </div>
            </div>
            <el-upload :show-file-list="false" :before-upload="(f: File) => handleUpload(f)" accept="image/*" :disabled="uploading">
              <el-button size="small" :loading="uploading">{{ uploading ? '上传中…' : '上传图片' }}</el-button>
            </el-upload>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="dialog.submitting" @click="submitForm">确定</el-button>
      </template>
    </el-dialog>

    <!-- 附件预览弹窗 -->
    <el-dialog v-model="previewDialog.visible" title="附件预览" width="700">
      <div class="preview-grid">
        <el-image v-for="(url, i) in previewDialog.urls" :key="i" :src="url" fit="contain"
          class="preview-img" :preview-src-list="previewDialog.urls" :initial-index="i" />
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import {
  getIncomeList, createIncome, updateIncome, deleteIncome,
  getFinanceDropdownOptions,
  type IncomeRecordItem, type FinanceFundAccount, type FinanceIncomeType,
} from '@/api/finance'
import { uploadFinanceImage } from '@/api/uploads'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const options = reactive<{ incomeTypes: FinanceIncomeType[]; fundAccounts: FinanceFundAccount[] }>({
  incomeTypes: [],
  fundAccounts: [],
})

const filter = reactive({
  dateFrom: '', dateTo: '',
  incomeTypeId: null as number | null,
  fundAccountId: null as number | null,
  sourceNameKeyword: '',
  orderNo: '',
})
const list = ref<IncomeRecordItem[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const rawTotalAmount = ref(0)
const summary = computed(() => ({
  totalAmount: rawTotalAmount.value > 0 ? rawTotalAmount.value.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '',
}))

const dialog = reactive({ visible: false, isEdit: false, submitting: false })
const editId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const uploading = ref(false)
const form = reactive({
  occurDate: '', amount: 0,
  incomeTypeId: null as number | null,
  fundAccountId: null as number | null,
  sourceName: '', orderNo: '', operator: '', remark: '',
  attachments: [] as string[],
})
const rules: FormRules = {
  occurDate: [{ required: true, message: '请选择收款日期', trigger: 'change' }],
  amount: [{ required: true, message: '请输入金额', trigger: 'blur' }],
  incomeTypeId: [{ required: true, message: '请选择收入类型', trigger: 'change' }],
}

const previewDialog = reactive({ visible: false, urls: [] as string[] })

function fmtAmt(v: string | number) {
  const n = Number(v)
  return Number.isNaN(n) ? '-' : n.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function load() {
  loading.value = true
  try {
    const res = await getIncomeList({
      dateFrom: filter.dateFrom || undefined,
      dateTo: filter.dateTo || undefined,
      incomeTypeId: filter.incomeTypeId ?? undefined,
      fundAccountId: filter.fundAccountId ?? undefined,
      sourceNameKeyword: filter.sourceNameKeyword || undefined,
      orderNo: filter.orderNo || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      rawTotalAmount.value = list.value.reduce((s, r) => s + parseFloat(r.amount || '0'), 0)
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function onSearch() { pagination.page = 1; load() }
function onReset() {
  filter.dateFrom = ''; filter.dateTo = ''
  filter.incomeTypeId = null; filter.fundAccountId = null
  filter.sourceNameKeyword = ''; filter.orderNo = ''
  pagination.page = 1; load()
}
function onPageSizeChange() { pagination.page = 1; load() }

function openForm(row: IncomeRecordItem | null) {
  dialog.isEdit = !!row
  editId.value = row?.id ?? null
  if (row) {
    form.occurDate = row.occurDate; form.amount = Number(row.amount)
    form.incomeTypeId = row.incomeTypeId; form.fundAccountId = row.fundAccountId
    form.sourceName = row.sourceName ?? ''; form.orderNo = row.orderNo ?? ''
    form.operator = row.operator ?? ''; form.remark = row.remark ?? ''
    form.attachments = [...(row.attachments ?? [])]
  } else {
    form.occurDate = ''; form.amount = 0
    form.incomeTypeId = null; form.fundAccountId = null
    form.sourceName = ''; form.orderNo = ''; form.operator = ''; form.remark = ''
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

function removeAttachment(idx: number) { form.attachments.splice(idx, 1) }

function previewAttachments(urls: string[]) {
  previewDialog.urls = urls; previewDialog.visible = true
}

async function submitForm() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  dialog.submitting = true
  try {
    const payload = {
      occurDate: form.occurDate,
      amount: form.amount,
      incomeTypeId: form.incomeTypeId,
      fundAccountId: form.fundAccountId,
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
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    dialog.submitting = false
  }
}

async function onDelete(row: IncomeRecordItem) {
  try {
    await ElMessageBox.confirm('确定删除该条收入记录？', '提示', { type: 'warning' })
    await deleteIncome(row.id)
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
      options.incomeTypes = res.data.incomeTypes ?? []
      options.fundAccounts = res.data.fundAccounts ?? []
    }
  } catch { /* 选项加载失败不阻塞页面 */ }
  await load()
})
</script>

<style scoped>
.finance-page { background: var(--color-card); padding: var(--space-md); border-radius: var(--radius-xl); border: 1px solid var(--color-border); }
.filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm); padding: var(--space-sm); background: var(--color-bg-subtle, #f5f6f8); border-radius: var(--radius-lg); }
.filter-item { width: 150px; }
.filter-select { min-width: 120px; }
.filter-actions { margin-left: auto; display: flex; gap: var(--space-sm); }
.summary-bar { padding: 6px 12px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 6px; font-size: 13px; color: #0369a1; margin-bottom: var(--space-sm); }
.amount-highlight { color: #16a34a; font-size: 15px; }
.income-amount { color: #16a34a; font-weight: 600; }
.text-muted { color: var(--color-text-muted); }
.data-table { margin-bottom: var(--space-md); }
.pagination-wrap { display: flex; justify-content: flex-end; }
.attachment-area { display: flex; flex-direction: column; gap: 8px; }
.attachment-list { display: flex; flex-wrap: wrap; gap: 8px; }
.attachment-item { position: relative; }
.attachment-thumb { width: 72px; height: 72px; border-radius: 4px; border: 1px solid var(--color-border); cursor: zoom-in; }
.attachment-del { position: absolute; top: 2px; right: 2px; padding: 0 4px; background: rgba(0,0,0,.45); color: #fff; border-radius: 2px; }
.preview-grid { display: flex; flex-wrap: wrap; gap: 12px; }
.preview-img { width: 180px; height: 180px; border-radius: 6px; border: 1px solid var(--color-border); cursor: zoom-in; }
</style>
