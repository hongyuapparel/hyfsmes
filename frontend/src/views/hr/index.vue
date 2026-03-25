<template>
  <div class="page-card hr-page">
    <div class="filter-bar">
      <el-input
        v-model="filter.name"
        placeholder="姓名"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getTextFilterStyle('姓名：', filter.name, nameLabelVisible)"
        :input-style="getFilterInputStyle(filter.name)"
        @input="debouncedSearch"
        @keyup.enter="onSearch(true)"
      >
        <template #prefix>
          <span
            v-if="filter.name && nameLabelVisible"
            :style="{ color: ACTIVE_FILTER_COLOR }"
          >
            姓名：
          </span>
        </template>
      </el-input>
      <el-tree-select
        v-model="filter.departmentId"
        placeholder="部门"
        clearable
        filterable
        size="large"
        class="filter-bar-item"
        :data="departmentTreeOptions"
        node-key="id"
        check-strictly
        :props="{ label: 'label', value: 'id', children: 'children' }"
        @change="onSearch(true)"
      >
        <template #label>
          {{ filter.departmentId ? `部门：${getDepartmentLabel(filter.departmentId)}` : '部门' }}
        </template>
      </el-tree-select>
      <el-select
        v-model="filter.status"
        placeholder="状态"
        clearable
        size="large"
        class="filter-bar-item"
        :style="getFilterSelectAutoWidthStyle(filter.status ? `状态：${statusLabel(filter.status)}` : '')"
        @change="onSearch"
      >
        <template #label>
          {{ filter.status ? `状态：${statusLabel(filter.status)}` : '状态' }}
        </template>
        <el-option label="在职" value="active" />
        <el-option label="离职" value="left" />
      </el-select>
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button type="primary" size="large" @click="openForm(null)">新建人员</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="list" border stripe class="hr-table">
      <el-table-column prop="employeeNo" label="工号" width="100" show-overflow-tooltip />
      <el-table-column prop="name" label="姓名" width="100" show-overflow-tooltip />
      <el-table-column prop="departmentName" label="部门" width="120" show-overflow-tooltip />
      <el-table-column prop="jobTitleName" label="岗位" width="120" show-overflow-tooltip />
      <el-table-column prop="entryDate" label="入职日期" width="110" align="center">
        <template #default="{ row }">{{ formatDate(row.entryDate) }}</template>
      </el-table-column>
      <el-table-column prop="contactPhone" label="联系电话" width="120" show-overflow-tooltip />
      <el-table-column label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
            {{ statusLabel(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="关联用户" width="110" show-overflow-tooltip>
        <template #default="{ row }">
          {{ row.user ? (row.user.displayName || row.user.username) : '-' }}
        </template>
      </el-table-column>
      <el-table-column prop="remark" label="备注" min-width="100" show-overflow-tooltip />
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
      :title="formDialog.isEdit ? '编辑人员' : '新建人员'"
      width="520"
      destroy-on-close
      @close="resetForm"
    >
      <el-form ref="formRef" :model="form" :rules="formRules" label-width="90px">
        <el-form-item label="工号" prop="employeeNo">
          <el-input v-model="form.employeeNo" placeholder="工号（选填）" clearable />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" clearable />
        </el-form-item>
        <el-form-item label="部门" prop="departmentId">
          <el-tree-select
            v-model="form.departmentId"
            placeholder="选择部门"
            clearable
            filterable
            style="width: 100%"
            :data="departmentTreeOptions"
            node-key="id"
            check-strictly
            :props="{ label: 'label', value: 'id', children: 'children' }"
          >
          </el-tree-select>
        </el-form-item>
        <el-form-item label="岗位" prop="jobTitleId">
          <el-select
            v-model="form.jobTitleId"
            placeholder="先选择部门，再选择岗位"
            clearable
            filterable
            style="width: 100%"
            :disabled="!form.departmentId"
          >
            <el-option
              v-for="j in jobOptionsForForm"
              :key="j.id"
              :label="j.label"
              :value="j.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="入职日期" prop="entryDate">
          <el-date-picker
            v-model="form.entryDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择入职日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="联系电话" prop="contactPhone">
          <el-input v-model="form.contactPhone" placeholder="联系电话" clearable />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio value="active">在职</el-radio>
            <el-radio value="left">离职</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="关联用户" prop="userId">
          <el-select
            v-model="form.userId"
            placeholder="可选：关联系统登录账号"
            clearable
            filterable
            style="width: 100%"
          >
            <el-option
              v-for="u in userOptions"
              :key="u.id"
              :label="u.displayName ? `${u.displayName}（${u.username}）` : u.username"
              :value="u.id"
            />
          </el-select>
          <div class="form-tip">关联后可在业务中对应到该员工的系统账号</div>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注" clearable />
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
import { ref, reactive, onMounted, onActivated, computed, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { getEmployeeList, createEmployee, updateEmployee, deleteEmployee, type EmployeeItem } from '@/api/hr'
import { getHrUserOptions, type HrUserOption } from '@/api/hr'
import {
  getSystemOptionsTree,
  getSystemOptionsList,
  type SystemOptionTreeNode,
  type SystemOptionItem,
} from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import {
  ACTIVE_FILTER_COLOR,
  getFilterInputStyle,
  getTextFilterStyle,
} from '@/composables/useFilterBarHelpers'
import { formatDate } from '@/utils/date-format'

const FILTER_AUTO_MIN_WIDTH = 140
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
function getFilterSelectAutoWidthStyle(labelText: string) {
  if (!labelText) return undefined
  const estimated = labelText.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px`, color: ACTIVE_FILTER_COLOR }
}

function statusLabel(s: string) {
  return s === 'left' ? '离职' : '在职'
}

const filter = reactive({ name: '', departmentId: null as number | null, status: '' })
const nameLabelVisible = ref(false)
const list = ref<EmployeeItem[]>([])
const userOptions = ref<HrUserOption[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })

interface DeptOption {
  id: number
  label: string
}
const flatDepartments = ref<DeptOption[]>([])
interface DeptTreeOption extends DeptOption {
  children?: DeptTreeOption[]
}
const departmentTreeOptions = ref<DeptTreeOption[]>([])

interface JobOption {
  id: number
  label: string
  parentId: number | null
}
const allJobs = ref<JobOption[]>([])

const formDialog = reactive<{ visible: boolean; submitting: boolean; isEdit: boolean }>({
  visible: false,
  submitting: false,
  isEdit: false,
})
const editId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  employeeNo: '',
  name: '',
  departmentId: null as number | null,
  jobTitleId: null as number | null,
  entryDate: '',
  contactPhone: '',
  status: 'active',
  userId: null as number | null,
  remark: '',
})
const formRules: FormRules = {
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
}

async function loadUsers() {
  try {
    const res = await getHrUserOptions()
    userOptions.value = (res.data ?? []) as HrUserOption[]
  } catch {
    userOptions.value = []
  }
}

async function loadDepartments() {
  try {
    const res = await getSystemOptionsTree('org_departments')
    const tree = (res.data ?? []) as SystemOptionTreeNode[]
    const toTreeOptions = (nodes: SystemOptionTreeNode[]): DeptTreeOption[] =>
      nodes.map((n) => ({
        id: n.id,
        label: n.value,
        children: n.children?.length ? toTreeOptions(n.children) : undefined,
      }))
    departmentTreeOptions.value = toTreeOptions(tree)
    const out: DeptOption[] = []
    const visit = (nodes: SystemOptionTreeNode[]) => {
      for (const n of nodes) {
        out.push({ id: n.id, label: n.value })
        if (n.children?.length) visit(n.children)
      }
    }
    visit(tree)
    flatDepartments.value = out
  } catch {
    departmentTreeOptions.value = []
    flatDepartments.value = []
  }
}

function getDepartmentLabel(id: number | null): string {
  if (id == null) return ''
  const found = flatDepartments.value.find((d) => d.id === id)
  return found ? found.label : ''
}

async function loadJobs() {
  try {
    const res = await getSystemOptionsList('org_jobs')
    const list = (res.data ?? []) as SystemOptionItem[]
    allJobs.value = list.map((j) => ({
      id: j.id,
      label: j.value,
      parentId: j.parentId ?? null,
    }))
  } catch {
    allJobs.value = []
  }
}

const jobOptionsForForm = computed(() =>
  allJobs.value.filter((j) => j.parentId === form.departmentId),
)

watch(
  () => form.departmentId,
  () => {
    form.jobTitleId = null
  },
)

async function load() {
  loading.value = true
  try {
    const res = await getEmployeeList({
      name: filter.name || undefined,
      departmentId: filter.departmentId || undefined,
      status: filter.status || undefined,
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
    if (byUser && filter.name && String(filter.name).trim()) {
      nameLabelVisible.value = true
    }
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
  filter.departmentId = null
  filter.status = ''
  pagination.page = 1
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function openForm(row: EmployeeItem | null) {
  formDialog.isEdit = !!row
  editId.value = row ? row.id : null
  if (row) {
    form.employeeNo = row.employeeNo ?? ''
    form.name = row.name
    form.departmentId = row.departmentId ?? null
    form.jobTitleId = row.jobTitleId ?? null
    form.entryDate = row.entryDate ?? ''
    form.contactPhone = row.contactPhone ?? ''
    form.status = row.status === 'left' ? 'left' : 'active'
    form.userId = row.userId ?? null
    form.remark = row.remark ?? ''
  } else {
    form.employeeNo = ''
    form.name = ''
    form.departmentId = null
    form.jobTitleId = null
    form.entryDate = ''
    form.contactPhone = ''
    form.status = 'active'
    form.userId = null
    form.remark = ''
  }
  formDialog.visible = true
}

function resetForm() {
  formRef.value?.clearValidate()
}

async function submitForm() {
  await formRef.value?.validate().catch(() => {})
  formDialog.submitting = true
  try {
    if (formDialog.isEdit && editId.value != null) {
      await updateEmployee(editId.value, {
        employeeNo: form.employeeNo,
        name: form.name,
        departmentId: form.departmentId,
        jobTitleId: form.jobTitleId,
        entryDate: form.entryDate || undefined,
        contactPhone: form.contactPhone,
        status: form.status,
        userId: form.userId,
        remark: form.remark,
      })
      ElMessage.success('保存成功')
    } else {
      await createEmployee({
        employeeNo: form.employeeNo,
        name: form.name,
        departmentId: form.departmentId,
        jobTitleId: form.jobTitleId,
        entryDate: form.entryDate || undefined,
        contactPhone: form.contactPhone,
        status: form.status,
        userId: form.userId,
        remark: form.remark,
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

async function onDelete(row: EmployeeItem) {
  try {
    await ElMessageBox.confirm('确定删除该人员档案？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await deleteEmployee(row.id)
    ElMessage.success('已删除')
    load()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

onMounted(() => {
  loadUsers()
  loadDepartments()
  loadJobs()
  load()
})

onActivated(() => {
  // 当标签重新激活时，同步最新的部门与岗位配置，避免在配置页新增后这里还是旧数据
  loadDepartments()
  loadJobs()
})
</script>

<style scoped>
.hr-page {
  background: var(--color-card);
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  border: 1px solid var(--color-border);
}

.hr-table {
  margin-bottom: var(--space-md);
}

.form-tip {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  margin-top: 4px;
}
</style>
