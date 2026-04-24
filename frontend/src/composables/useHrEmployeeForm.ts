import { ref, reactive, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import type { Ref } from 'vue'
import {
  createEmployee,
  updateEmployee,
  updateEmployeeSortOrder,
  checkEmployeeNameExists,
  type EmployeeItem,
  type HrUserOption,
} from '@/api/hr'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import type { JobOption } from '@/composables/useHrEmployeeList'

interface FormOptions {
  allJobs: Ref<JobOption[]>
  userOptions: Ref<HrUserOption[]>
  paginationTotal: Ref<number>
  getRowIndex: (id: number) => number
  onSaved: () => void
}

export function useHrEmployeeForm(options: FormOptions) {
  const { allJobs, userOptions, paginationTotal, getRowIndex, onSaved } = options

  const formDialog = reactive<{ visible: boolean; submitting: boolean; isEdit: boolean }>({
    visible: false,
    submitting: false,
    isEdit: false,
  })
  const drawerPreview = ref(false)
  const editId = ref<number | null>(null)
  const formRef = ref<FormInstance>()

  const form = reactive({
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

  const jobOptionsForForm = computed(() =>
    allJobs.value.filter((j) => j.parentId === form.departmentId),
  )

  watch(
    () => form.departmentId,
    () => { form.jobTitleId = null },
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

  function getJobLabel(id: number | null): string {
    if (id == null) return ''
    return allJobs.value.find((j) => j.id === id)?.label ?? ''
  }

  function getUserLabel(id: number | null): string {
    if (id == null) return '-'
    const found = userOptions.value.find((u) => u.id === id)
    if (!found) return '-'
    return found.displayName ? `${found.displayName}（${found.username}）` : found.username
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

  function resetInitForm() {
    Object.assign(form, {
      name: '', gender: 'unknown', departmentId: null, jobTitleId: null,
      entryDate: '', contactPhone: '', education: '', dormitory: '',
      idCardNo: '', nativePlace: '', homeAddress: '',
      emergencyContact: '', emergencyPhone: '',
      leaveDate: '', leaveReason: '', status: 'active',
      userId: null, remark: '', photoUrl: '',
      sortIndex: paginationTotal.value + 1,
    })
  }

  function openForm(row: EmployeeItem | null) {
    formDialog.isEdit = !!row
    drawerPreview.value = false
    editId.value = row ? row.id : null
    if (row) {
      fillFormByRow(row)
    } else {
      resetInitForm()
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

  function resetForm() {
    formRef.value?.clearValidate()
  }

  function buildPayload() {
    return {
      name: form.name, gender: form.gender,
      departmentId: form.departmentId, jobTitleId: form.jobTitleId,
      entryDate: form.entryDate || undefined,
      contactPhone: form.contactPhone, education: form.education,
      dormitory: form.dormitory, idCardNo: form.idCardNo,
      nativePlace: form.nativePlace, homeAddress: form.homeAddress,
      emergencyContact: form.emergencyContact, emergencyPhone: form.emergencyPhone,
      leaveDate: form.leaveDate || undefined, leaveReason: form.leaveReason,
      status: form.status, userId: form.userId, remark: form.remark, photoUrl: form.photoUrl,
    }
  }

  async function submitForm() {
    await formRef.value?.validate().catch(() => {})
    formDialog.submitting = true
    try {
      if (formDialog.isEdit && editId.value != null) {
        await updateEmployee(editId.value, buildPayload())
        await updateEmployeeSortOrder(editId.value, form.sortIndex)
        ElMessage.success('保存成功')
      } else {
        const created = await createEmployee(buildPayload())
        if (created?.data?.id) await updateEmployeeSortOrder(created.data.id, form.sortIndex)
        ElMessage.success('新建成功')
      }
      formDialog.visible = false
      onSaved()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    } finally {
      formDialog.submitting = false
    }
  }

  return {
    formDialog,
    drawerPreview,
    editId,
    formRef,
    form,
    formRules,
    jobOptionsForForm,
    getJobLabel,
    getUserLabel,
    openForm,
    openPreview,
    resetForm,
    submitForm,
  }
}
