import { ref, watch, type Ref } from 'vue'
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus'
import Sortable from 'sortablejs'
import {
  getRoles,
  suggestRoleCode,
  createRole,
  updateRole,
  moveRole,
  deleteRole,
  type RoleItem,
} from '@/api/roles'
import { getErrorMessage, isErrorHandled } from '@/api/request'

interface UseRolesManagementOptions {
  selectedRoleId: Ref<number | null>
  onAfterLoad?: () => Promise<void> | void
}

export function useRolesManagement(options: UseRolesManagementOptions) {
  const { selectedRoleId, onAfterLoad } = options

  const list = ref<RoleItem[]>([])
  const roleTableRef = ref()
  const roleSortSupported = ref(true)
  let roleSortable: Sortable | null = null

  const dialogVisible = ref(false)
  const isEdit = ref(false)
  const editId = ref(0)
  const formRef = ref<FormInstance>()
  const submitLoading = ref(false)
  const form = ref({ code: '', name: '' })
  const rules: FormRules = {
    code: [{ required: true, message: '请输入编码', trigger: 'blur' }],
    name: [{ required: true, message: '请输入名称', trigger: 'blur' }],
  }

  /** 新增时根据名称自动带出编码（与系统菜单/业务一致），防抖 300ms */
  let suggestCodeTimer: ReturnType<typeof setTimeout> | null = null
  watch(
    () => [form.value.name, dialogVisible.value, isEdit.value] as const,
    ([name, visible, edit]) => {
      if (!visible || edit) return
      const n = (name as string)?.trim()
      if (!n) return
      if (suggestCodeTimer) clearTimeout(suggestCodeTimer)
      suggestCodeTimer = setTimeout(async () => {
        suggestCodeTimer = null
        try {
          const res = await suggestRoleCode(n)
          const code = res.data?.code
          if (code != null && !isEdit.value && dialogVisible.value) form.value.code = code
        } catch {
          // 忽略建议接口失败，用户可手动填编码
        }
      }, 300)
    },
  )

  async function loadRoles() {
    const res = await getRoles()
    list.value = res.data ?? []
    if (!list.value.length) {
      selectedRoleId.value = null
    } else if (!selectedRoleId.value || !list.value.some((item) => item.id === selectedRoleId.value)) {
      selectedRoleId.value = list.value[0].id
    }
    await onAfterLoad?.()
  }

  function initRoleDragSort() {
    const tableEl = (roleTableRef.value as { $el?: HTMLElement } | undefined)?.$el as HTMLElement | undefined
    if (!tableEl) return
    const tbody = tableEl.querySelector('.el-table__body-wrapper tbody') as HTMLElement | null
    if (!tbody) return
    if (roleSortable) {
      roleSortable.destroy()
      roleSortable = null
    }
    roleSortable = Sortable.create(tbody, {
      handle: '.role-drag-handle',
      animation: 150,
      ghostClass: 'role-drag-ghost',
      onEnd(evt) {
        if (!roleSortSupported.value) {
          void loadRoles()
          return
        }
        if (evt.oldIndex == null || evt.newIndex == null || evt.oldIndex === evt.newIndex) return
        const next = list.value.slice()
        const [moved] = next.splice(evt.oldIndex, 1)
        if (!moved) return
        next.splice(evt.newIndex, 0, moved)
        list.value = next
        void persistRoleOrder(moved.id, evt.oldIndex, evt.newIndex)
      },
    })
  }

  async function persistRoleOrder(roleId: number, oldIndex: number, newIndex: number) {
    try {
      // 兼容后端未提供批量重排接口的情况：按拖拽位移次数调用 move
      const direction = newIndex > oldIndex ? 'down' : 'up'
      const steps = Math.abs(newIndex - oldIndex)
      for (let i = 0; i < steps; i++) {
        await moveRole(roleId, direction)
      }
      await loadRoles()
      ElMessage.success('排序已更新')
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        roleSortSupported.value = false
        await loadRoles()
        return
      }
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '排序失败'))
      await loadRoles()
    }
  }

  function openCreate() {
    isEdit.value = false
    editId.value = 0
    form.value = { code: '', name: '' }
    dialogVisible.value = true
  }

  function openEdit(row: RoleItem) {
    isEdit.value = true
    editId.value = row.id
    form.value = { code: row.code, name: row.name }
    dialogVisible.value = true
  }

  function resetForm() {
    formRef.value?.resetFields()
  }

  async function submitRole() {
    await formRef.value?.validate()
    submitLoading.value = true
    try {
      if (isEdit.value) {
        await updateRole(editId.value, { code: form.value.code, name: form.value.name })
        ElMessage.success('保存成功')
      } else {
        await createRole(form.value)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      await loadRoles()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      submitLoading.value = false
    }
  }

  async function removeRole(row: RoleItem) {
    await ElMessageBox.confirm(`确定删除角色「${row.name}」？`, '提示', { type: 'warning' }).catch(() => {})
    try {
      await deleteRole(row.id)
      ElMessage.success('已删除')
      await loadRoles()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e, '删除失败'))
    }
  }

  function destroyRoleDragSort() {
    if (!roleSortable) return
    roleSortable.destroy()
    roleSortable = null
  }

  return {
    list,
    roleTableRef,
    roleSortSupported,
    dialogVisible,
    isEdit,
    formRef,
    submitLoading,
    form,
    rules,
    loadRoles,
    initRoleDragSort,
    destroyRoleDragSort,
    openCreate,
    openEdit,
    resetForm,
    submitRole,
    removeRole,
  }
}
