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
    <el-table ref="tableRef" :data="list" border stripe row-key="id" :height="tableHeight" @header-dragend="onHeaderDragEnd">
      <el-table-column label="序号" width="88" column-key="user-sort-index">
        <template #default="{ row }">
          <span>{{ getRowIndex(row.id) }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="username" label="登录账号" width="140" />
      <el-table-column prop="displayName" label="显示名" width="120" />
      <el-table-column label="角色" min-width="220" column-key="user-roles" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="role-text">{{ getRoleNames(row) }}</span>
        </template>
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
        <el-form-item v-if="isEdit" label="序号">
          <el-input-number v-model="form.sortIndex" :min="1" :max="list.length || 1" controls-position="right" style="width: 100%" />
        </el-form-item>
        <el-form-item label="角色" prop="roleIds">
          <el-select v-model="form.roleIds" placeholder="选择角色" filterable multiple collapse-tags collapse-tags-tooltip style="width: 100%">
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
import { ref, onMounted, nextTick } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { searchUsers, createUser, updateUser, resetUserPassword, type UserItem } from '@/api/users'
import { getRoles, type RoleItem } from '@/api/roles'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { formatDateTime as formatDate } from '@/utils/date-format'
import { useFlexShellTableHeight } from '@/composables/useFlexShellTableHeight'
import { useTableColumnWidthPersist } from '@/composables/useTableColumnWidthPersist'

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
const { onHeaderDragEnd, restoreColumnWidths } = useTableColumnWidthPersist('settings-users-main')

const filter = ref<{ keyword: string; role: string }>({ keyword: '', role: '' })
const keywordLabelVisible = ref(false)

const ACTIVE_FILTER_COLOR = 'var(--el-color-primary)'
const FILTER_AUTO_MIN_WIDTH = 200
const FILTER_AUTO_MAX_WIDTH = 320
const FILTER_CHAR_PX = 14
const activeInputStyle = { color: ACTIVE_FILTER_COLOR }
const activeSelectStyle = { '--el-text-color-regular': ACTIVE_FILTER_COLOR }
const USER_ROW_ORDER_STORAGE_KEY = 'settings-users-row-order-v1'

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

const form = ref({ username: '', password: '', displayName: '', roleIds: [] as number[], sortIndex: 1 })
const rules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  roleIds: [{ required: true, message: '请选择至少一个角色', trigger: 'change' }],
}
const pwdForm = ref({ password: '' })
const pwdRules: FormRules = {
  password: [{ required: true, message: '请输入新密码', trigger: 'blur' }],
}

async function load() {
  const [r] = await Promise.all([getRoles()])
  roles.value = r.data ?? []
  if (roles.value.length && !form.value.roleIds.length) form.value.roleIds = [roles.value[0].id]
  await onSearch()
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
    list.value = applyStoredRowOrder(res.data ?? [])
    await nextTick()
    restoreColumnWidths(tableRef.value as any)
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

function getRowIndex(id: number): number {
  const idx = list.value.findIndex((x) => x.id === id)
  return idx >= 0 ? idx + 1 : 1
}

function applySortIndex(id: number, value: number | string | undefined) {
  const to = Number(value)
  if (!Number.isFinite(to)) return
  const fromIdx = list.value.findIndex((x) => x.id === id)
  if (fromIdx < 0) return
  const targetIdx = Math.max(0, Math.min(list.value.length - 1, Math.floor(to) - 1))
  if (fromIdx === targetIdx) return
  const rows = list.value.slice()
  const [moved] = rows.splice(fromIdx, 1)
  if (!moved) return
  rows.splice(targetIdx, 0, moved)
  list.value = rows
  persistRowOrder(rows)
}

function persistRowOrder(rows: UserItem[]) {
  const ids = rows.map((x) => Number(x.id)).filter((id) => Number.isInteger(id) && id > 0)
  try {
    localStorage.setItem(USER_ROW_ORDER_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // 忽略本地存储异常，不影响页面主流程
  }
}

function readStoredRowOrder(): number[] {
  try {
    const raw = localStorage.getItem(USER_ROW_ORDER_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((x) => Number(x)).filter((id) => Number.isInteger(id) && id > 0)
  } catch {
    return []
  }
}

function applyStoredRowOrder(rows: UserItem[]): UserItem[] {
  if (!rows.length) return rows
  const stored = readStoredRowOrder()
  if (!stored.length) return rows
  const byId = new Map(rows.map((x) => [x.id, x]))
  const ordered: UserItem[] = []
  for (const id of stored) {
    const row = byId.get(id)
    if (row) ordered.push(row)
  }
  for (const row of rows) {
    if (!stored.includes(row.id)) ordered.push(row)
  }
  return ordered
}

function openCreate() {
  isEdit.value = false
  editId.value = 0
  form.value = { username: '', password: '', displayName: '', roleIds: roles.value[0] ? [roles.value[0].id] : [], sortIndex: 1 }
  dialogVisible.value = true
}

function openEdit(row: UserItem) {
  isEdit.value = true
  editId.value = row.id
  form.value = {
    username: row.username,
    password: '',
    displayName: row.displayName,
    sortIndex: getRowIndex(row.id),
    roleIds: row.roleIds?.length
      ? [...row.roleIds]
      : (row.roles?.map((x) => x.id) ?? (row.roleId ? [row.roleId] : [])),
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
        role_id: form.value.roleIds[0],
        role_ids: form.value.roleIds,
      })
      applySortIndex(editId.value, form.value.sortIndex)
      ElMessage.success('保存成功')
    } else {
      await createUser({
        username: form.value.username,
        password: form.value.password,
        display_name: form.value.displayName,
        role_id: form.value.roleIds[0],
        role_ids: form.value.roleIds,
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

function getRoleNames(row: UserItem): string {
  if (row.roleNames?.length) return row.roleNames.join('、')
  if (row.roles?.length) return row.roles.map((x) => x.name).join('、')
  return row.role?.name ?? '-'
}

onMounted(load)
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
.op-cell {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
}
.role-text {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.el-table .el-table__cell) {
  padding-top: 10px;
  padding-bottom: 10px;
}

:deep(.el-table .cell) {
  line-height: 22px;
}
</style>
