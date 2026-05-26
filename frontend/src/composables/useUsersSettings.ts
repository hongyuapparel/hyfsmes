/**
 * 用户设置页统一入口 composable。
 * 组合 useUsersListManager（列表/搜索/状态切换）和 useUsersFormManager（新增/编辑/重置密码）。
 */
import { useUsersListManager } from '@/composables/useUsersListManager'
import { useUsersFormManager } from '@/composables/useUsersFormManager'

export type { TableRef } from '@/composables/useUsersListManager'

export function useUsersSettings() {
  const listManager = useUsersListManager()
  const formManager = useUsersFormManager(listManager)

  return {
    // list state
    list: listManager.list,
    roles: listManager.roles,
    filter: listManager.filter,
    keywordLabelVisible: listManager.keywordLabelVisible,
    // list helpers
    onHeaderDragEnd: listManager.onHeaderDragEnd,
    getRowIndex: listManager.getRowIndex,
    getRoleNames: listManager.getRoleNames,
    // list actions
    load: listManager.load,
    onSearch: listManager.onSearch,
    onReset: listManager.onReset,
    toggleStatus: listManager.toggleStatus,
    // form state
    dialogVisible: formManager.dialogVisible,
    isEdit: formManager.isEdit,
    formRef: formManager.formRef,
    submitLoading: formManager.submitLoading,
    form: formManager.form,
    rules: formManager.rules,
    pwdDialogVisible: formManager.pwdDialogVisible,
    pwdLoading: formManager.pwdLoading,
    pwdForm: formManager.pwdForm,
    pwdRules: formManager.pwdRules,
    // form actions
    openCreate: formManager.openCreate,
    openEdit: formManager.openEdit,
    resetForm: formManager.resetForm,
    submitUser: formManager.submitUser,
    openResetPwd: formManager.openResetPwd,
    submitResetPwd: formManager.submitResetPwd,
  }
}
