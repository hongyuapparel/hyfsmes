import { ref, type Ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { createUser, updateUser, resetUserPassword, type UserItem } from '@/api/users'
import { type RoleItem } from '@/api/roles'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import type { TableRef } from '@/composables/useUsersListManager'

export function useUsersFormManager(
  listState: {
    roles: Ref<RoleItem[]>
    list: Ref<UserItem[]>
    load: (tableRef: TableRef) => Promise<void>
    applySortIndex: (id: number, value: number | string | undefined) => void
    getRowIndex: (id: number) => number
  }
) {
  // user form
  const dialogVisible = ref(false)
  const isEdit = ref(false)
  const editId = ref(0)
  const formRef = ref<FormInstance>()
  const submitLoading = ref(false)
  const form = ref({ username: '', password: '', displayName: '', roleIds: [] as number[], sortIndex: 1 })

  const rules: FormRules = {
    username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
    roleIds: [{ required: true, message: '请选择至少一个角色', trigger: 'change' }],
  }

  // password reset form
  const pwdDialogVisible = ref(false)
  const pwdLoading = ref(false)
  const pwdForm = ref({ password: '' })

  const pwdRules: FormRules = {
    password: [{ required: true, message: '请输入新密码', trigger: 'blur' }],
  }

  function openCreate(): void {
    isEdit.value = false
    editId.value = 0
    form.value = {
      username: '',
      password: '',
      displayName: '',
      roleIds: listState.roles.value[0] ? [listState.roles.value[0].id] : [],
      sortIndex: 1,
    }
    dialogVisible.value = true
  }

  function openEdit(row: UserItem): void {
    isEdit.value = true
    editId.value = row.id
    form.value = {
      username: row.username,
      password: '',
      displayName: row.displayName,
      sortIndex: listState.getRowIndex(row.id),
      roleIds: row.roleIds?.length
        ? [...row.roleIds]
        : (row.roles?.map((x) => x.id) ?? (row.roleId ? [row.roleId] : [])),
    }
    dialogVisible.value = true
  }

  function resetForm(): void {
    formRef.value?.resetFields()
  }

  async function submitUser(tableRef: TableRef): Promise<void> {
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
        listState.applySortIndex(editId.value, form.value.sortIndex)
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
      await listState.load(tableRef)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      submitLoading.value = false
    }
  }

  function openResetPwd(row: UserItem): void {
    editId.value = row.id
    pwdForm.value = { password: '' }
    pwdDialogVisible.value = true
  }

  async function submitResetPwd(): Promise<void> {
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

  return {
    dialogVisible,
    isEdit,
    formRef,
    submitLoading,
    form,
    rules,
    pwdDialogVisible,
    pwdLoading,
    pwdForm,
    pwdRules,
    openCreate,
    openEdit,
    resetForm,
    submitUser,
    openResetPwd,
    submitResetPwd,
  }
}
