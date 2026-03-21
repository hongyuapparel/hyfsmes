<template>
  <div class="page-card">
    <div class="toolbar">
      <el-button type="primary" @click="openCreate">新增用户</el-button>
    </div>
    <el-table :data="list" border stripe>
      <el-table-column prop="id" label="ID" width="70" />
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
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
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
        </template>
      </el-table-column>
    </el-table>

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
import { ref, onMounted } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { getUsers, createUser, updateUser, resetUserPassword, type UserItem } from '@/api/users'
import { getRoles, type RoleItem } from '@/api/roles'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { formatDateTime as formatDate } from '@/utils/date-format'

const list = ref<UserItem[]>([])
const roles = ref<RoleItem[]>([])
const dialogVisible = ref(false)
const pwdDialogVisible = ref(false)
const isEdit = ref(false)
const editId = ref(0)
const formRef = ref<FormInstance>()
const submitLoading = ref(false)
const pwdLoading = ref(false)

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
  const [u, r] = await Promise.all([getUsers(), getRoles()])
  list.value = u.data ?? []
  roles.value = r.data ?? []
  if (roles.value.length && !form.value.roleId) form.value.roleId = roles.value[0].id
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
</script>

<style scoped>
.page-card {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
}
.toolbar {
  margin-bottom: 16px;
}
</style>
