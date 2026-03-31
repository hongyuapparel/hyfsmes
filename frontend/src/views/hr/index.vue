<template>
  <div class="page-card page-card--fill hr-page">
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
      <el-date-picker
        v-model="filter.entryDateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        placeholder="入职日期"
        range-separator="—"
        unlink-panels
        size="large"
        class="filter-bar-item"
        :shortcuts="hrDateRangeShortcuts"
        @change="onSearch(true)"
      />
      <el-date-picker
        v-model="filter.leaveDateRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        placeholder="离职日期"
        range-separator="—"
        unlink-panels
        size="large"
        class="filter-bar-item"
        :shortcuts="hrDateRangeShortcuts"
        @change="onSearch(true)"
      />
      <div class="filter-bar-actions">
        <el-button type="primary" size="large" @click="onSearch(true)">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button size="large" @click="onExport">导出</el-button>
        <el-button v-if="selectedIds.length" type="danger" size="large" circle @click="onBatchDelete">
          <el-icon><Delete /></el-icon>
        </el-button>
        <el-button type="primary" size="large" @click="openForm(null)">新建人员</el-button>
      </div>
    </div>

    <div v-if="selectedIds.length" class="table-selection-count">已选 {{ selectedIds.length }} 项</div>

    <div ref="tableShellRef" class="list-page-table-shell">
    <el-table
      v-loading="loading"
      :data="list"
      border
      stripe
      row-key="id"
      class="hr-table"
      :height="tableHeight"
      scrollbar-always-on
      @selection-change="onSelectionChange"
      @row-click="onRowClick"
      @sort-change="onSortChange"
    >
      <el-table-column type="selection" width="48" align="center" />
      <el-table-column label="序号" width="88" align="center" prop="sortOrder" sortable="custom">
        <template #default="{ row }">
          <span>{{ getRowIndex(row.id) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="name" label="姓名" width="100" show-overflow-tooltip sortable="custom" />
      <el-table-column label="性别" width="80" align="center">
        <template #default="{ row }">{{ genderLabel(row.gender) }}</template>
      </el-table-column>
      <el-table-column prop="departmentName" label="部门" width="120" show-overflow-tooltip />
      <el-table-column prop="jobTitleName" label="岗位" width="120" show-overflow-tooltip />
      <el-table-column prop="entryDate" label="入职日期" width="110" align="center" sortable="custom">
        <template #default="{ row }">{{ formatDate(row.entryDate) }}</template>
      </el-table-column>
      <el-table-column prop="education" label="学历" width="100" show-overflow-tooltip />
      <el-table-column prop="dormitory" label="宿舍" width="100" show-overflow-tooltip />
      <el-table-column prop="contactPhone" label="联系电话" width="120" show-overflow-tooltip />
      <el-table-column prop="idCardNo" label="身份证号码" width="180" show-overflow-tooltip />
      <el-table-column prop="nativePlace" label="籍贯" width="120" show-overflow-tooltip />
      <el-table-column prop="homeAddress" label="家庭地址" min-width="180" show-overflow-tooltip />
      <el-table-column prop="emergencyContact" label="紧急联系人" width="110" show-overflow-tooltip />
      <el-table-column prop="emergencyPhone" label="紧急联系电话" width="130" show-overflow-tooltip />
      <el-table-column prop="leaveDate" label="离职日期" width="110" align="center">
        <template #default="{ row }">{{ formatDate(row.leaveDate) }}</template>
      </el-table-column>
      <el-table-column prop="leaveReason" label="离职原因" width="140" show-overflow-tooltip />
      <el-table-column label="状态" width="80" align="center" prop="status" sortable="custom">
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
      <el-table-column label="操作" width="80" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click.stop="openForm(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
    </div>

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

    <el-drawer v-model="formDialog.visible" size="760px" destroy-on-close @close="resetForm">
      <template #header>
        <div class="drawer-header">
          <span>{{ formDialog.isEdit ? '人员详情' : '新建人员' }}</span>
          <el-button
            v-if="formDialog.isEdit && drawerPreview"
            type="primary"
            link
            @click="drawerPreview = false"
          >
            编辑
          </el-button>
        </div>
      </template>

      <el-descriptions v-if="drawerPreview" :column="2" border class="preview-descriptions">
        <el-descriptions-item label="姓名">{{ form.name || '-' }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ genderLabel(form.gender) }}</el-descriptions-item>
        <el-descriptions-item label="部门">{{ getDepartmentLabel(form.departmentId) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="岗位">{{ getJobLabel(form.jobTitleId) || '-' }}</el-descriptions-item>
        <el-descriptions-item label="入职日期">{{ formatDate(form.entryDate) }}</el-descriptions-item>
        <el-descriptions-item label="学历">{{ form.education || '-' }}</el-descriptions-item>
        <el-descriptions-item label="宿舍">{{ form.dormitory || '-' }}</el-descriptions-item>
        <el-descriptions-item label="联系电话">{{ form.contactPhone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="身份证号">{{ form.idCardNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="籍贯">{{ form.nativePlace || '-' }}</el-descriptions-item>
        <el-descriptions-item label="家庭地址">{{ form.homeAddress || '-' }}</el-descriptions-item>
        <el-descriptions-item label="紧急联系人">{{ form.emergencyContact || '-' }}</el-descriptions-item>
        <el-descriptions-item label="紧急电话">{{ form.emergencyPhone || '-' }}</el-descriptions-item>
        <el-descriptions-item label="状态">{{ statusLabel(form.status) }}</el-descriptions-item>
        <el-descriptions-item label="离职日期">{{ form.status === 'left' ? formatDate(form.leaveDate) : '-' }}</el-descriptions-item>
        <el-descriptions-item label="离职原因">{{ form.status === 'left' ? (form.leaveReason || '-') : '-' }}</el-descriptions-item>
        <el-descriptions-item label="关联用户">
          {{ getUserLabel(form.userId) }}
        </el-descriptions-item>
        <el-descriptions-item label="备注">{{ form.remark || '-' }}</el-descriptions-item>
        <el-descriptions-item label="身份证照片">
          <el-image
            v-if="form.photoUrl"
            :src="form.photoUrl"
            fit="cover"
            style="width: 88px; height: 88px; border-radius: 6px"
          />
          <span v-else>-</span>
        </el-descriptions-item>
      </el-descriptions>

      <el-form v-else ref="formRef" :model="form" :rules="formRules" label-width="90px" class="drawer-form-grid">
        <el-form-item label="序号">
          <el-input-number
            v-model="form.sortIndex"
            :min="1"
            :max="pagination.total || 1"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" placeholder="请输入姓名" clearable />
        </el-form-item>
        <el-form-item label="性别" prop="gender">
          <el-radio-group v-model="form.gender">
            <el-radio value="male">男</el-radio>
            <el-radio value="female">女</el-radio>
            <el-radio value="unknown">未知</el-radio>
          </el-radio-group>
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
        <el-form-item label="学历" prop="education">
          <el-input v-model="form.education" placeholder="学历" clearable />
        </el-form-item>
        <el-form-item label="宿舍" prop="dormitory">
          <el-input v-model="form.dormitory" placeholder="宿舍" clearable />
        </el-form-item>
        <el-form-item label="联系电话" prop="contactPhone">
          <el-input v-model="form.contactPhone" placeholder="联系电话" clearable />
        </el-form-item>
        <el-form-item label="身份证号" prop="idCardNo">
          <el-input v-model="form.idCardNo" placeholder="身份证号码" clearable />
        </el-form-item>
        <el-form-item label="籍贯" prop="nativePlace">
          <el-input v-model="form.nativePlace" placeholder="籍贯" clearable />
        </el-form-item>
        <el-form-item label="家庭地址" prop="homeAddress" class="full-row">
          <el-input v-model="form.homeAddress" placeholder="家庭地址" clearable />
        </el-form-item>
        <el-form-item label="紧急联系人" prop="emergencyContact">
          <el-input v-model="form.emergencyContact" placeholder="紧急联系人" clearable />
        </el-form-item>
        <el-form-item label="紧急电话" prop="emergencyPhone">
          <el-input v-model="form.emergencyPhone" placeholder="紧急联系电话" clearable />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio value="active">在职</el-radio>
            <el-radio value="left">离职</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.status === 'left'" label="离职日期" prop="leaveDate">
          <el-date-picker
            v-model="form.leaveDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="选择离职日期"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item v-if="form.status === 'left'" label="离职原因" prop="leaveReason">
          <el-input v-model="form.leaveReason" placeholder="离职原因" clearable />
        </el-form-item>
        <el-form-item label="关联用户" prop="userId" class="full-row">
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
        <el-form-item label="备注" prop="remark" class="full-row">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="备注" clearable />
        </el-form-item>
        <el-form-item label="身份证照片" class="full-row">
          <ImageUploadArea v-model="form.photoUrl" :compact="false" class="employee-photo-upload" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="formDialog.visible = false">{{ drawerPreview ? '关闭' : '取消' }}</el-button>
        <el-button v-if="!drawerPreview" type="primary" :loading="formDialog.submitting" @click="submitForm">确定</el-button>
      </template>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onActivated, computed, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import * as XLSX from 'xlsx'
import {
  getEmployeeList,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  updateEmployeeSortOrder,
  checkEmployeeNameExists,
  type EmployeeItem,
} from '@/api/hr'
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
import ImageUploadArea from '@/components/ImageUploadArea.vue'
import { formatDate } from '@/utils/date-format'
import { rangeShortcuts } from '@/utils/date-shortcuts'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'

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

function genderLabel(g: string) {
  if (g === 'male') return '男'
  if (g === 'female') return '女'
  return '-'
}

const filter = reactive({
  name: '',
  departmentId: null as number | null,
  status: '',
  entryDateRange: [] as string[],
  leaveDateRange: [] as string[],
})
const nameLabelVisible = ref(false)
const hrDateRangeShortcuts = [
  ...rangeShortcuts.filter((x) => ['本月', '本季度', '本年度'].includes(x.text)),
  {
    text: '上年度',
    value: () => {
      const now = new Date()
      const y = now.getFullYear() - 1
      return [new Date(y, 0, 1, 0, 0, 0, 0), new Date(y, 11, 31, 23, 59, 59, 999)] as [Date, Date]
    },
  },
]

const list = ref<EmployeeItem[]>([])
const selectedIds = ref<number[]>([])
const userOptions = ref<HrUserOption[]>([])
const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
const sortState = reactive<{
  sortBy: '' | 'sortOrder' | 'name' | 'entryDate' | 'status'
  sortOrder: '' | 'asc' | 'desc'
}>({
  sortBy: '',
  sortOrder: '',
})

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
const drawerPreview = ref(false)
const editId = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive({
  employeeNo: '',
  name: '',
  gender: 'unknown',
  departmentId: null as number | null,
  jobTitleId: null as number | null,
  entryDate: '',
  contactPhone: '',
  education: '',
  dormitory: '',
  idCardNo: '',
  nativePlace: '',
  homeAddress: '',
  emergencyContact: '',
  emergencyPhone: '',
  leaveDate: '',
  leaveReason: '',
  status: 'active',
  userId: null as number | null,
  remark: '',
  photoUrl: '',
  sortIndex: 1,
})
const formRules: FormRules = {
  name: [
    { required: true, message: '请输入姓名', trigger: 'blur' },
    {
      trigger: 'blur',
      async validator(_rule, value: string, callback) {
        const name = String(value || '').trim()
        if (!name) return callback()
        try {
          const res = await checkEmployeeNameExists(name, editId.value)
          if (res.data?.exists) {
            callback(new Error('该姓名已存在'))
            return
          }
          callback()
        } catch {
          callback()
        }
      },
    },
  ],
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

function getJobLabel(id: number | null): string {
  if (id == null) return ''
  const found = allJobs.value.find((j) => j.id === id)
  return found ? found.label : ''
}

function getUserLabel(id: number | null): string {
  if (id == null) return '-'
  const found = userOptions.value.find((u) => u.id === id)
  if (!found) return '-'
  return found.displayName ? `${found.displayName}（${found.username}）` : found.username
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

watch(
  () => form.status,
  (status) => {
    if (status === 'active') {
      form.leaveDate = ''
      form.leaveReason = ''
    }
  },
)

async function load() {
  loading.value = true
  try {
    const res = await getEmployeeList({
      name: filter.name || undefined,
      departmentId: filter.departmentId || undefined,
      status: filter.status || undefined,
      entryDateStart: filter.entryDateRange?.[0] || undefined,
      entryDateEnd: filter.entryDateRange?.[1] || undefined,
      leaveDateStart: filter.leaveDateRange?.[0] || undefined,
      leaveDateEnd: filter.leaveDateRange?.[1] || undefined,
      sortBy: sortState.sortBy || undefined,
      sortOrder: sortState.sortOrder || undefined,
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    const data = res.data
    if (data) {
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
      selectedIds.value = []
    }
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    loading.value = false
  }
}

function getRowIndex(id: number): number {
  const idx = list.value.findIndex((x) => x.id === id)
  return idx >= 0 ? (pagination.page - 1) * pagination.pageSize + idx + 1 : 1
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
  filter.entryDateRange = []
  filter.leaveDateRange = []
  sortState.sortBy = ''
  sortState.sortOrder = ''
  pagination.page = 1
  load()
}

function onSortChange(payload: { prop: string; order: 'ascending' | 'descending' | null }) {
  const map: Record<string, 'sortOrder' | 'name' | 'entryDate' | 'status'> = {
    sortOrder: 'sortOrder',
    name: 'name',
    entryDate: 'entryDate',
    status: 'status',
  }
  const nextSortBy = map[payload.prop] ?? ''
  if (!nextSortBy || !payload.order) {
    sortState.sortBy = ''
    sortState.sortOrder = ''
  } else {
    sortState.sortBy = nextSortBy
    sortState.sortOrder = payload.order === 'descending' ? 'desc' : 'asc'
  }
  pagination.page = 1
  load()
}

function onPageSizeChange() {
  pagination.page = 1
  load()
}

function fillFormByRow(row: EmployeeItem) {
  form.name = row.name
  form.gender = row.gender || 'unknown'
  form.departmentId = row.departmentId ?? null
  form.jobTitleId = row.jobTitleId ?? null
  form.entryDate = row.entryDate ?? ''
  form.contactPhone = row.contactPhone ?? ''
  form.education = row.education ?? ''
  form.dormitory = row.dormitory ?? ''
  form.idCardNo = row.idCardNo ?? ''
  form.nativePlace = row.nativePlace ?? ''
  form.homeAddress = row.homeAddress ?? ''
  form.emergencyContact = row.emergencyContact ?? ''
  form.emergencyPhone = row.emergencyPhone ?? ''
  form.leaveDate = row.leaveDate ?? ''
  form.leaveReason = row.leaveReason ?? ''
  form.status = row.status === 'left' ? 'left' : 'active'
  form.userId = row.userId ?? null
  form.remark = row.remark ?? ''
  form.photoUrl = row.photoUrl ?? ''
  form.sortIndex = getRowIndex(row.id)
}

function openForm(row: EmployeeItem | null) {
  formDialog.isEdit = !!row
  drawerPreview.value = false
  editId.value = row ? row.id : null
  if (row) {
    fillFormByRow(row)
  } else {
    form.name = ''
    form.gender = 'unknown'
    form.departmentId = null
    form.jobTitleId = null
    form.entryDate = ''
    form.contactPhone = ''
    form.education = ''
    form.dormitory = ''
    form.idCardNo = ''
    form.nativePlace = ''
    form.homeAddress = ''
    form.emergencyContact = ''
    form.emergencyPhone = ''
    form.leaveDate = ''
    form.leaveReason = ''
    form.status = 'active'
    form.userId = null
    form.remark = ''
    form.photoUrl = ''
    form.sortIndex = pagination.total + 1
  }
  formDialog.visible = true
}

function openPreview(row: EmployeeItem) {
  formDialog.isEdit = true
  drawerPreview.value = true
  editId.value = row.id
  fillFormByRow(row)
  formDialog.visible = true
}

function onRowClick(row: EmployeeItem, column: { type?: string }, event: Event) {
  if (column?.type === 'selection') return
  const target = event.target as HTMLElement | null
  if (!target) return
  if (target.closest('.el-button, .el-checkbox')) return
  openPreview(row)
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
        name: form.name,
        gender: form.gender,
        departmentId: form.departmentId,
        jobTitleId: form.jobTitleId,
        entryDate: form.entryDate || undefined,
        contactPhone: form.contactPhone,
        education: form.education,
        dormitory: form.dormitory,
        idCardNo: form.idCardNo,
        nativePlace: form.nativePlace,
        homeAddress: form.homeAddress,
        emergencyContact: form.emergencyContact,
        emergencyPhone: form.emergencyPhone,
        leaveDate: form.leaveDate || undefined,
        leaveReason: form.leaveReason,
        status: form.status,
        userId: form.userId,
        remark: form.remark,
        photoUrl: form.photoUrl,
      })
      await updateEmployeeSortOrder(editId.value, form.sortIndex)
      ElMessage.success('保存成功')
    } else {
      const created = await createEmployee({
        name: form.name,
        gender: form.gender,
        departmentId: form.departmentId,
        jobTitleId: form.jobTitleId,
        entryDate: form.entryDate || undefined,
        contactPhone: form.contactPhone,
        education: form.education,
        dormitory: form.dormitory,
        idCardNo: form.idCardNo,
        nativePlace: form.nativePlace,
        homeAddress: form.homeAddress,
        emergencyContact: form.emergencyContact,
        emergencyPhone: form.emergencyPhone,
        leaveDate: form.leaveDate || undefined,
        leaveReason: form.leaveReason,
        status: form.status,
        userId: form.userId,
        remark: form.remark,
        photoUrl: form.photoUrl,
      })
      if (created?.data?.id) {
        await updateEmployeeSortOrder(created.data.id, form.sortIndex)
      }
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

function onSelectionChange(rows: EmployeeItem[]) {
  selectedIds.value = rows.map((r) => r.id)
}

async function onBatchDelete() {
  if (!selectedIds.value.length) return
  try {
    await ElMessageBox.confirm(`确定删除已选 ${selectedIds.value.length} 条人员档案？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
    for (const id of selectedIds.value) {
      await deleteEmployee(id)
    }
    ElMessage.success('批量删除成功')
    load()
  } catch (e: unknown) {
    if (e !== 'cancel' && !isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

async function onExport() {
  try {
    const res = await getEmployeeList({
      name: filter.name || undefined,
      departmentId: filter.departmentId || undefined,
      status: filter.status || undefined,
      entryDateStart: filter.entryDateRange?.[0] || undefined,
      entryDateEnd: filter.entryDateRange?.[1] || undefined,
      leaveDateStart: filter.leaveDateRange?.[0] || undefined,
      leaveDateEnd: filter.leaveDateRange?.[1] || undefined,
      page: 1,
      pageSize: 5000,
    })
    const rows = res.data?.list ?? []
    const lines = rows.map((r, idx) => ({
      序号: idx + 1,
      姓名: r.name || '',
      性别: genderLabel(r.gender),
      部门: r.departmentName || '',
      岗位: r.jobTitleName || '',
      入职日期: formatDate(r.entryDate),
      学历: r.education || '',
      宿舍: r.dormitory || '',
      联系电话: r.contactPhone || '',
      身份证号码: r.idCardNo || '',
      籍贯: r.nativePlace || '',
      家庭地址: r.homeAddress || '',
      紧急联系人: r.emergencyContact || '',
      紧急联系电话: r.emergencyPhone || '',
      离职日期: formatDate(r.leaveDate),
      离职原因: r.leaveReason || '',
      备注: r.remark || '',
    }))
    const ws = XLSX.utils.json_to_sheet(lines)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '人事管理')
    XLSX.writeFile(wb, `人事管理导出_${new Date().toISOString().slice(0, 10)}.xlsx`)
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
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
  min-height: 0;
}

.hr-table {
  flex: 1;
  min-height: 0;
}

.table-selection-count {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 8px 0;
}

.form-tip {
  font-size: var(--font-size-caption);
  color: var(--color-text-muted);
  margin-top: 4px;
}

.drawer-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.preview-descriptions {
  margin-bottom: 8px;
}

.drawer-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 12px;
}

:deep(.drawer-form-grid .el-form-item) {
  margin-bottom: 14px;
}

:deep(.drawer-form-grid .el-form-item.full-row) {
  grid-column: 1 / -1;
}

.employee-photo-upload {
  width: 100%;
  min-height: 140px;
}
</style>
