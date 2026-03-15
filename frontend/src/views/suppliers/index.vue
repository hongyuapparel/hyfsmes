<template>
  <div class="page-card suppliers-page">
    <div class="filter-bar">
      <el-input
        v-model="filter.name"
        placeholder="供应商名称"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getTextFilterStyle('供应商名称：', filter.name, nameLabelVisible)"
        :input-style="getFilterInputStyle(filter.name)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.name && nameLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            供应商名称：
          </span>
        </template>
      </el-input>
      <el-select
        v-model="filter.supplierTypeId"
        placeholder="供应商类型"
        clearable
        filterable
        size="large"
        class="filter-bar-item"
        :style="
          getFilterSelectAutoWidthStyle(
            filter.supplierTypeId != null
              ? `供应商类型：${findSupplierTypeLabelById(filter.supplierTypeId)}`
              : ''
          )
        "
        @change="onSearch"
      >
        <template #label>
          {{
            filter.supplierTypeId != null
              ? `供应商类型：${findSupplierTypeLabelById(filter.supplierTypeId)}`
              : '供应商类型'
          }}
        </template>
        <el-option
          v-for="opt in supplierTypeOptions"
          :key="opt.id"
          :label="opt.label"
          :value="opt.id"
        />
      </el-select>
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button type="primary" size="large" @click="openForm(null)">新建供应商</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" border stripe class="suppliers-table">
      <el-table-column prop="name" label="供应商名称" min-width="120" show-overflow-tooltip />
      <el-table-column label="供应商类型" width="100" show-overflow-tooltip>
        <template #default="{ row }">
          {{ findSupplierTypeLabelById(row.supplierTypeId) || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="业务范围" min-width="100" show-overflow-tooltip>
        <template #default="{ row }">
          {{ findBusinessScopeLabelById(row.businessScopeId) || '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="cooperationDate" label="合作日期" width="110" align="center">
        <template #default="{ row }">{{ formatDate(row.cooperationDate) }}</template>
      </el-table-column>
      <el-table-column prop="contactPerson" label="联系人" width="90" show-overflow-tooltip />
      <el-table-column prop="contactInfo" label="联系电话" width="120" show-overflow-tooltip />
      <el-table-column prop="factoryAddress" label="工厂地址" min-width="140" show-overflow-tooltip />
      <el-table-column prop="settlementTime" label="结款时间" width="100" show-overflow-tooltip />
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
      :title="formDialog.isEdit ? '编辑供应商' : '新建供应商'"
      width="560"
      destroy-on-close
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
        <el-form-item label="供应商名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入供应商名称" clearable />
        </el-form-item>
      <el-form-item label="供应商类型" prop="supplierTypeId">
          <el-select
          v-model="form.supplierTypeId"
            placeholder="请选择供应商类型"
            clearable
            filterable
            style="width: 100%"
            @change="onFormTypeChange"
          >
            <el-option
              v-for="opt in supplierTypeOptions"
            :key="opt.id"
            :label="opt.label"
            :value="opt.id"
            />
          </el-select>
        </el-form-item>
      <el-form-item label="业务范围" prop="businessScopeId">
          <el-select
          v-model="form.businessScopeId"
            placeholder="先选供应商类型后可选或输入业务范围"
            clearable
            filterable
            style="width: 100%"
          :disabled="!form.supplierTypeId"
          >
            <el-option
              v-for="opt in businessScopeOptions"
            :key="opt.id"
            :label="opt.label"
            :value="opt.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="合作日期" prop="cooperationDate">
          <el-date-picker
            v-model="form.cooperationDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择合作日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="联系人" prop="contactPerson">
          <el-input v-model="form.contactPerson" placeholder="联系人" clearable />
        </el-form-item>
        <el-form-item label="联系电话" prop="contactInfo">
          <el-input v-model="form.contactInfo" placeholder="联系电话" clearable />
        </el-form-item>
        <el-form-item label="工厂地址" prop="factoryAddress">
          <el-input
            v-model="form.factoryAddress"
            placeholder="工厂地址"
            type="textarea"
            :rows="2"
            clearable
          />
        </el-form-item>
        <el-form-item label="结款时间" prop="settlementTime">
          <el-input
            v-model="form.settlementTime"
            placeholder="如月结30天、季结、货到付款"
            clearable
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="formDialog.submitting" @click="submitForm">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { getSupplierList, createSupplier, updateSupplier, deleteSupplier, type SupplierItem } from '@/api/suppliers'
import { getSystemOptionsList, type SystemOptionItem } from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'

const supplierTypeOptions = ref<{ id: number; label: string }[]>([])
const businessScopeOptions = ref<{ id: number; label: string }[]>([])
const allSupplierOptions = ref<SystemOptionItem[]>([])
const businessScopeByTypeId = ref<Record<number, { id: number; label: string }[]>>({})

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14

function getFilterInputStyle(v: unknown) {
  return v ? { color: ACTIVE_FILTER_COLOR } : undefined
}
function getTextFilterStyle(prefix: string, val: unknown, showLabel: boolean) {
  if (!val || !showLabel) return undefined
  const text = prefix + String(val)
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}
function getFilterSelectAutoWidthStyle(labelText: string) {
  if (!labelText) return undefined
  const estimated = labelText.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px`, color: ACTIVE_FILTER_COLOR }
}

const filter = reactive<{ name: string; supplierTypeId: number | null }>({ name: '', supplierTypeId: null })
const nameLabelVisible = ref(false)
const list = ref<SupplierItem[]>([])
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
  name: string
  supplierTypeId: number | null
  businessScopeId: number | null
  cooperationDate: string
  contactPerson: string
  contactInfo: string
  factoryAddress: string
  settlementTime: string
}>({
  name: '',
  supplierTypeId: null,
  businessScopeId: null,
  cooperationDate: '',
  contactPerson: '',
  contactInfo: '',
  factoryAddress: '',
  settlementTime: '',
})
const formRules: FormRules = {
  name: [{ required: true, message: '请输入供应商名称', trigger: 'blur' }],
}

function formatDate(v: string | null | undefined): string {
  if (!v) return '-'
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('zh-CN')
}

async function load() {
  loading.value = true
  try {
    const res = await getSupplierList({
      name: filter.name || undefined,
      supplierTypeId: filter.supplierTypeId ?? undefined,
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

function onSearch(byUser = false) {
  if (byUser && filter.name && String(filter.name).trim()) nameLabelVisible.value = true
  pagination.page = 1
  load()
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function debouncedSearch() {
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    searchTimer = null
    onSearch(false)
  }, 400)
}

function onReset() {
  nameLabelVisible.value = false
  filter.name = ''
  filter.supplierTypeId = null
  pagination.page = 1
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

async function openForm(row: SupplierItem | null) {
  formDialog.isEdit = !!row
  editId.value = row ? row.id : null
  if (row) {
    form.name = row.name
    form.supplierTypeId = row.supplierTypeId ?? null
    form.businessScopeId = row.businessScopeId ?? null
    form.cooperationDate = row.cooperationDate ?? ''
    form.contactPerson = row.contactPerson ?? ''
    form.contactInfo = row.contactInfo ?? ''
    form.factoryAddress = row.factoryAddress ?? ''
    form.settlementTime = row.settlementTime ?? ''
  } else {
    form.name = ''
    form.supplierTypeId = null
    form.businessScopeId = null
    form.cooperationDate = ''
    form.contactPerson = ''
    form.contactInfo = ''
    form.factoryAddress = ''
    form.settlementTime = ''
  }
  formDialog.visible = true
  if (form.type) await onFormTypeChange()
  else businessScopeOptions.value = []
}

function resetForm() {
  formRef.value?.clearValidate()
}

async function submitForm() {
  await formRef.value?.validate().catch(() => {})
  formDialog.submitting = true
  try {
    if (formDialog.isEdit && editId.value != null) {
      await updateSupplier(editId.value, {
        name: form.name,
        supplierTypeId: form.supplierTypeId,
        businessScopeId: form.businessScopeId,
        cooperationDate: form.cooperationDate || undefined,
        contactPerson: form.contactPerson,
        contactInfo: form.contactInfo,
        factoryAddress: form.factoryAddress,
        settlementTime: form.settlementTime,
      })
      ElMessage.success('保存成功')
    } else {
      await createSupplier({
        name: form.name,
        supplierTypeId: form.supplierTypeId,
        businessScopeId: form.businessScopeId,
        cooperationDate: form.cooperationDate || undefined,
        contactPerson: form.contactPerson,
        contactInfo: form.contactInfo,
        factoryAddress: form.factoryAddress,
        settlementTime: form.settlementTime,
      })
      ElMessage.success('新建成功')
    }
    formDialog.visible = false
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    formDialog.submitting = false
  }
}

async function onDelete(row: SupplierItem) {
  try {
    await ElMessageBox.confirm('确定删除该供应商？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteSupplier(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

function findSupplierTypeLabelById(id: number | null | undefined): string {
  if (id == null) return ''
  const item = supplierTypeOptions.value.find((o) => o.id === id)
  return item?.label ?? ''
}

function findBusinessScopeLabelById(id: number | null | undefined): string {
  if (id == null) return ''
  const allScopes: { id: number; label: string }[] = []
  Object.values(businessScopeByTypeId.value).forEach((arr) => allScopes.push(...arr))
  const item = allScopes.find((o) => o.id === id)
  return item?.label ?? ''
}

async function loadSupplierOptions() {
  try {
    const res = await getSystemOptionsList('supplier_types')
    const list = res.data ?? []
    allSupplierOptions.value = list

    const roots = list.filter((o) => o.parentId == null)
    supplierTypeOptions.value = roots.map((r) => ({ id: r.id, label: r.value }))

    const byParent: Record<number, { id: number; label: string }[]> = {}
    for (const opt of list) {
      if (opt.parentId == null) continue
      const pid = opt.parentId
      if (!byParent[pid]) byParent[pid] = []
      byParent[pid].push({ id: opt.id, label: opt.value })
    }
    businessScopeByTypeId.value = byParent
  } catch {
    allSupplierOptions.value = []
    supplierTypeOptions.value = []
    businessScopeByTypeId.value = {}
  }
}

function onFormTypeChange() {
  if (!form.supplierTypeId) {
    businessScopeOptions.value = []
    form.businessScopeId = null
    return
  }
  const arr = businessScopeByTypeId.value[form.supplierTypeId] ?? []
  businessScopeOptions.value = arr
  if (!arr.some((o) => o.id === form.businessScopeId)) {
    form.businessScopeId = null
  }
}

onMounted(async () => {
  await loadSupplierOptions()
  await load()
})
</script>

<style scoped>
.suppliers-page {
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

.filter-bar-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-left: auto;
}

.suppliers-table {
  margin-bottom: var(--space-md);
}

.pagination-wrap {
  display: flex;
  justify-content: flex-end;
}
</style>
