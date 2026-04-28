import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, type FormRules } from 'element-plus'
import { CUSTOMER_FIELDS_SORTED } from '@/fields'
import {
  batchDeleteCustomers,
  createCustomer,
  getCustomers,
  getNextCustomerId,
  getSalespeople,
  updateCustomer,
  type CustomerItem,
} from '@/api/customers'
import { getDictTree } from '@/api/dicts'
import type { SystemOptionTreeNode } from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'

export interface ProductGroupTreeSelectNode {
  label: string
  value: number
  children?: ProductGroupTreeSelectNode[]
  disabled?: boolean
}

function toProductGroupTreeSelect(nodes: SystemOptionTreeNode[]): ProductGroupTreeSelectNode[] {
  return nodes.map((node) => {
    const children = node.children?.length ? toProductGroupTreeSelect(node.children) : []
    const hasChildren = children.length > 0
    return {
      label: node.value,
      value: node.id,
      children: hasChildren ? children : undefined,
      disabled: hasChildren,
    }
  })
}

export function useCustomerPage() {
  const list = ref<CustomerItem[]>([])
  const salespeople = ref<string[]>([])
  const productGroupsTree = ref<SystemOptionTreeNode[]>([])
  const dialogVisible = ref(false)
  const isEdit = ref(false)
  const editId = ref(0)
  const submitLoading = ref(false)
  const selectedIds = ref<number[]>([])
  const companyNameLabelVisible = ref(false)

  const filter = reactive({ companyName: '', salesperson: '' })
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
  const sort = reactive({ sortBy: 'createdAt', sortOrder: 'desc' as 'asc' | 'desc' })

  const CUSTOMER_TABLE_FIELDS = computed(() =>
    CUSTOMER_FIELDS_SORTED.filter((field) => !['cooperationDate', 'contactInfo', 'productGroup'].includes(field.code)),
  )
  const CUSTOMER_FORM_FIELDS = computed(() =>
    CUSTOMER_FIELDS_SORTED.filter((field) => !['cooperationDate', 'createdAt', 'lastOrderReferencedAt'].includes(field.code)),
  )
  const productGroupTreeSelectData = computed(() => toProductGroupTreeSelect(productGroupsTree.value))

  const form = reactive<Record<string, string | number | null>>({
    contactCountryCode: '',
    contactPhone: '',
  })
  const formRules = computed<FormRules>(() => {
    const rules: FormRules = {}
    for (const field of CUSTOMER_FORM_FIELDS.value) {
      if (field.code === 'companyName') {
        rules[field.code] = [{ required: true, message: `请输入${field.label}`, trigger: 'blur' }]
      }
    }
    return rules
  })

  let searchTimer: ReturnType<typeof setTimeout> | null = null

  async function load() {
    try {
      const res = await getCustomers({
        companyName: filter.companyName || undefined,
        salesperson: filter.salesperson || undefined,
        page: pagination.page,
        pageSize: pagination.pageSize,
        sortBy: sort.sortBy,
        sortOrder: sort.sortOrder,
      })
      const data = res.data
      if (!data) return
      list.value = data.list ?? []
      pagination.total = data.total ?? 0
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    }
  }

  async function loadOptions() {
    try {
      const [salesRes, groupTreeRes] = await Promise.all([
        getSalespeople(),
        getDictTree('product_groups'),
      ])
      salespeople.value = salesRes.data ?? []
      productGroupsTree.value = groupTreeRes.data ?? []
    } catch {
      salespeople.value = []
      productGroupsTree.value = []
    }
  }

  function debouncedSearch() {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      searchTimer = null
      onFilterChange(false)
    }, 400)
  }

  function onFilterChange(byUser = false) {
    if (byUser && filter.companyName.trim()) {
      companyNameLabelVisible.value = true
    }
    pagination.page = 1
    void load()
  }

  function resetFilter() {
    companyNameLabelVisible.value = false
    filter.companyName = ''
    filter.salesperson = ''
    pagination.page = 1
    void load()
  }

  function onSelectionChange(rows: CustomerItem[]) {
    selectedIds.value = rows.map((row) => row.id)
  }

  function onSortChange({ prop, order }: { prop?: string; order?: string }) {
    if (prop && order) {
      sort.sortBy = prop
      sort.sortOrder = order === 'ascending' ? 'asc' : 'desc'
    } else {
      sort.sortBy = 'createdAt'
      sort.sortOrder = 'desc'
    }
    void load()
  }

  async function openCreate() {
    isEdit.value = false
    editId.value = 0
    for (const field of CUSTOMER_FORM_FIELDS.value) {
      form[field.code] = field.type === 'date' ? null : ''
    }
    form.contactCountryCode = ''
    form.contactPhone = ''
    try {
      const res = await getNextCustomerId()
      form.customerId = (res.data ?? '').toString() || ''
    } catch {
      form.customerId = ''
    }
    dialogVisible.value = true
  }

  function openEdit(row: CustomerItem) {
    isEdit.value = true
    editId.value = row.id
    for (const field of CUSTOMER_FORM_FIELDS.value) {
      if (field.code === 'productGroup') {
        form.productGroup = row.productGroupId != null ? row.productGroupId : ''
        continue
      }
      const value = row[field.code as keyof CustomerItem]
      form[field.code] = value != null ? String(value) : ''
    }
    const contact = (row.contactInfo ?? '').trim()
    const separator = contact.includes('|') ? '|' : contact.includes(' ') ? ' ' : null
    if (separator) {
      const [countryCode, phone] = contact.split(separator, 2)
      form.contactCountryCode = (countryCode ?? '').trim()
      form.contactPhone = (phone ?? '').trim()
    } else {
      form.contactCountryCode = ''
      form.contactPhone = contact
    }
    dialogVisible.value = true
  }

  async function submit() {
    submitLoading.value = true
    try {
      const payload: Record<string, string | number | null> = {}
      for (const field of CUSTOMER_FORM_FIELDS.value) {
        if (field.code === 'contactInfo') {
          const parts = [form.contactCountryCode, form.contactPhone]
            .map((item) => String(item ?? '').trim())
            .filter(Boolean)
          payload.contactInfo = parts.length ? parts.join(' ') : ''
        } else if (field.code === 'productGroup') {
          const value = form.productGroup
          payload.product_group_id =
            value === '' || value === null ? null : typeof value === 'number' ? value : Number.parseInt(String(value), 10)
        } else {
          const value = form[field.code]
          payload[field.code] = value === '' || value === null ? '' : value
        }
      }

      if (isEdit.value) {
        delete payload.customerId
        await updateCustomer(editId.value, payload)
        ElMessage.success('保存成功')
      } else {
        await createCustomer(payload)
        ElMessage.success('创建成功')
      }
      dialogVisible.value = false
      await load()
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    } finally {
      submitLoading.value = false
    }
  }

  async function batchDelete() {
    if (!selectedIds.value.length) return
    await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 个客户？`, '提示', {
      type: 'warning',
    }).catch(() => {})

    try {
      await batchDeleteCustomers(selectedIds.value)
      ElMessage.success('已删除')
      await load()
    } catch (error: unknown) {
      if (!isErrorHandled(error)) ElMessage.error(getErrorMessage(error))
    }
  }

  watch(
    () => filter.companyName,
    (value) => {
      if (!value.trim()) companyNameLabelVisible.value = false
    },
  )

  return {
    list,
    salespeople,
    dialogVisible,
    isEdit,
    submitLoading,
    selectedIds,
    companyNameLabelVisible,
    filter,
    pagination,
    CUSTOMER_TABLE_FIELDS,
    CUSTOMER_FORM_FIELDS,
    productGroupTreeSelectData,
    form,
    formRules,
    load,
    loadOptions,
    debouncedSearch,
    onFilterChange,
    resetFilter,
    onSelectionChange,
    onSortChange,
    openCreate,
    openEdit,
    submit,
    batchDelete,
  }
}
