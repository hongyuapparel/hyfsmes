<template>
  <div class="page-card page-card--fill">
    <div class="filter-bar">
      <div class="filter-left">
        <el-input
          v-model="filter.keyword"
          placeholder="按显示名/登录账号搜索"
          clearable
          size="large"
          class="filter-bar-item"
          :style="getKeywordFilterStyle(filter.keyword, keywordLabelVisible)"
          :input-style="getFilterInputStyle(filter.keyword)"
          @keyup.enter="onSearch"
          @clear="onSearch"
        />
        <el-select
          v-model="filter.role"
          placeholder="角色"
          clearable
          filterable
          size="large"
          class="filter-bar-item"
          :style="getFilterSelectAutoWidthStyle(filter.role)"
          @change="onSearch"
          @clear="onSearch"
        >
          <template #label="{ label }">
            <span v-if="filter.role">角色：{{ label }}</span>
            <span v-else>{{ label }}</span>
          </template>
          <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.code" />
        </el-select>
      </div>
      <div class="filter-actions">
        <el-button type="primary" size="large" @click="onSearch">搜索</el-button>
        <el-button size="large" @click="onReset">清空</el-button>
        <el-button type="primary" size="large" @click="openCreate">新增用户</el-button>
      </div>
    </div>
    <div ref="tableShellRef" class="list-page-table-shell">
    <el-table ref="tableRef" :data="list" border stripe row-key="id" :height="tableHeight">
      <el-table-column prop="id" label="ID" width="88">
        <template #default="{ row }">
          <span class="id-cell">
            <span class="option-drag-handle" title="拖拽调整顺序">≡</span>
            <span>{{ row.id }}</span>
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="username" label="登录账号" width="140" />
      <el-table-column prop="displayName" label="显示名" width="120" />
      <el-table-column label="角色" width="120">
        <template #default="{ row }">{{ row.role?.name ?? '-' }}</template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'" size="small">
            {{ row.status === 'active' ? '启用' : '禁用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="lastLoginAt" label="最后登录" width="160">
        <template #default="{ row }">{{ row.lastLoginAt ? formatDate(row.lastLoginAt) : '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" min-width="170">
        <template #default="{ row }">
          <div class="op-cell">
            <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
            <el-button link type="primary" size="small" @click="openResetPwd(row)">重置密码</el-button>
            <el-button
              link
              :type="row.status === 'active' ? 'warning' : 'success'"
              size="small"
              @click="toggleStatus(row)"
            >
              {{ row.status === 'active' ? '禁用' : '启用' }}
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑用户' : '新增用户'" width="400" @close="resetForm">
      <el-form ref="formRef" :model="form" :rules="rules" label-width="80">
        <el-form-item label="登录账号" prop="username">
          <el-input v-model="form.username" placeholder="登录账号（建议手机号）" />
        </el-form-item>
        <el-form-item v-if="!isEdit" label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="初始密码" show-password />
        </el-form-item>
        <el-form-item label="显示名" prop="displayName">
          <el-input v-model="form.displayName" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="角色" prop="roleId">
          <el-select v-model="form.roleId" placeholder="选择角色" filterable style="width: 100%">
            <el-option v-for="r in roles" :key="r.id" :label="r.name" :value="r.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitLoading" @click="submitUser">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="pwdDialogVisible" title="重置密码" width="360" @close="pwdForm.password = ''">
      <el-form :model="pwdForm" :rules="pwdRules" label-width="80">
        <el-form-item label="新密码" prop="password">
          <el-input v-model="pwdForm.password" type="password" placeholder="请输入新密码" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="pwdDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="pwdLoading" @click="submitResetPwd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, onBeforeUnmount } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import Sortable from 'sortablejs'
import { getUsers, searchUsers, createUser, updateUser, resetUserPassword, type UserItem } from '@/api/users'
import { getRoles, type RoleItem } from '@/api/roles'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { formatDateTime as formatDate } from '@/utils/date-format'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'

const list = ref<UserItem[]>([])
const roles = ref<RoleItem[]>([])
const dialogVisible = ref(false)
const pwdDialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const formRef = ref<FormInstance>()
const submitLoading = ref(false)
const pwdLoading = ref(false)
const tableRef = ref<{ $el?: HTMLElement }>()
const tableShellRef = ref<HTMLElement | null>(null)
const { tableHeight } = useFlexShellTableHeight(tableShellRef)
let rowSortable: Sortable | null = null

const filter = ref<{ keyword: string; role: string }>({ keyword: '', role: '' })
const keywordLabelVisible = ref(false)

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const FILTER_AUTO_MIN_WIDTH = 200
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeInputStyle = { color: ACTIVE_FILTER_COLOR }
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }

function getFilterInputStyle(v: unknown) {
  return v ? activeInputStyle : undefined
}

function getFilterSelectAutoWidthStyle(v: unknown) {
  if (!v) return undefined
  const text = String(v)
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return {
    ...activeSelectStyle,
    width: `${width}px`,
    flex: `0 0 ${width}px`,
  }
}

function getKeywordFilterStyle(value: unknown, showLabel: boolean) {
  if (!value || !showLabel) return undefined
  const text = `关键字：${String(value)}`
  const estimated = text.length * FILTER_CHAR_PX + 60
  const width = Math.min(FILTER_AUTO_MAX_WIDTH, Math.max(FILTER_AUTO_MIN_WIDTH, estimated))
  return { width: `${width}px`, flex: `0 0 ${width}px` }
}

const form = ref({ username: '', password: '', displayName: '', roleId: 0 })
const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  roleId: [{ required: true, message: '请选择角色', trigger: 'change' }],
}
const pwdForm = ref({ password: '' })
const pwdRules: FormRules = {
  password: [{ required: true, message: '请输入新密码', trigger: 'blur' }],
}

async function load() {
  const [r] = await Promise.all([getRoles()])
  roles.value = r.data ?? []
  if (roles.value.length && !form.value.roleId) form.value.roleId = roles.value[0].id
  await onSearch()
  await nextTick()
  initRowDrag()
}

async function onSearch() {
  try {
    if (filter.value.keyword && String(filter.value.keyword).trim()) {
      keywordLabelVisible.value = true
    }
    const kw = filter.value.keyword?.trim()
    const role = filter.value.role?.trim()
    const res = await searchUsers({
      keyword: kw || undefined,
      role: role || undefined,
    })
    list.value = res.data ?? []
  } catch (e: unknown) {
    list.value = []
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

async function onReset() {
  filter.value = { keyword: '', role: '' }
  keywordLabelVisible.value = false
  await onSearch()
}

function initRowDrag() {
  const tableEl = tableRef.value?.$el
  if (!tableEl) return
  const tbody = tableEl.querySelector('.el-table__body-wrapper tbody') as HTMLElement | null
  if (!tbody) return
  if (rowSortable) {
    rowSortable.destroy()
    rowSortable = null
  }
  rowSortable = Sortable.create(tbody, {
    handle: '.option-drag-handle',
    animation: 150,
    ghostClass: 'option-drag-ghost',
    onEnd(evt) {
      if (evt.oldIndex == null || evt.newIndex == null) return
      if (evt.oldIndex === evt.newIndex) return
      const rows = list.value.slice()
      const [moved] = rows.splice(evt.oldIndex, 1)
      if (!moved) return
      rows.splice(evt.newIndex, 0, moved)
      list.value = rows
    },
  })
}

function openCreate() {
  isEdit.value = false
  editId.value = 0
  form.value = { username: '', password: '', displayName: '', roleId: roles.value[0]?.id ?? 0 }
  dialogVisible.value = true
}

function openEdit(row: UserItem) {
  isEdit.value = true
  editId.value = row.id
  form.value = {
    username: row.username,
    password: '',
    displayName: row.displayName,
    roleId: row.roleId,
  }
  dialogVisible.value = true
}

function resetForm() {
  formRef.value?.resetFields()
}

async function submitUser() {
  await formRef.value?.validate()
  submitLoading.value = true
  try {
    if (isEdit.value) {
      await updateUser(editId.value, {
        username: form.value.username,
        display_name: form.value.displayName,
        role_id: form.value.roleId,
      })
      ElMessage.success('保存成功')
    } else {
      await createUser({
        username: form.value.username,
        password: form.value.password,
        display_name: form.value.displayName,
        role_id: form.value.roleId,
      })
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    submitLoading.value = false
  }
}

function openResetPwd(row: UserItem) {
  editId.value = row.id
  pwdForm.value = { password: '' }
  pwdDialogVisible.value = true
}

async function submitResetPwd() {
  if (!pwdForm.value.password) {
    ElMessage.warning('请输入新密码')
    return
  }
  pwdLoading.value = true
  try {
    await resetUserPassword(editId.value, pwdForm.value.password)
    ElMessage.success('密码已重置')
    pwdDialogVisible.value = false
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  } finally {
    pwdLoading.value = false
  }
}

async function toggleStatus(row: UserItem) {
  const newStatus = row.status === 'active' ? 'disabled' : 'active'
  try {
    await updateUser(row.id, { status: newStatus })
    ElMessage.success('已更新')
    load()
  } catch (e: unknown) {
    if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
  }
}

onMounted(load)
onBeforeUnmount(() => {
  if (rowSortable) {
    rowSortable.destroy()
    rowSortable = null
  }
})
</script>

<style scoped>
.page-card {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  min-height: 0;
}
.filter-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.filter-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.filter-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
}
.filter-bar-item {
  width: 200px;
}
.id-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.option-drag-handle {
  display: inline-block;
  width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  cursor: grab;
  user-select: none;
  color: var(--el-text-color-secondary);
  font-size: 12px;
}
.option-drag-handle:active {
  cursor: grabbing;
}
.option-drag-ghost {
  opacity: 0.6;
}
.op-cell {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
</style>
