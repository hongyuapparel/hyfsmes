import { computed, ref } from 'vue'
import request, { getErrorMessage, isErrorHandled } from '@/api/request'
import type { OrderFormPayload } from '@/api/orders'

export interface CustomerSelectItem {
  id: number
  customerId: string
  country: string
  companyName: string
  contactPerson: string
  salesperson: string
}

function normalizeCustomer(raw: Partial<CustomerSelectItem> & { id?: number }): CustomerSelectItem {
  return {
    id: Number(raw.id ?? 0),
    customerId: String(raw.customerId ?? '').trim(),
    country: String(raw.country ?? '').trim(),
    companyName: String(raw.companyName ?? '').trim(),
    contactPerson: String(raw.contactPerson ?? '').trim(),
    salesperson: String(raw.salesperson ?? '').trim(),
  }
}

export function useOrderCustomerSelection(form: OrderFormPayload) {
  const customerLoading = ref(false)
  const customerDialogVisible = ref(false)
  const customerDialogLoading = ref(false)
  const customerDialogList = ref<CustomerSelectItem[]>([])
  const customerKeyword = ref('')
  const selectedCustomer = ref<CustomerSelectItem | null>(null)
  const customerTotal = ref(0)
  const customerPage = ref(1)
  const customerPageSize = ref(20)

  const customerDisplayText = computed(() => String(form.customerName ?? '').trim())

  async function searchCustomersForDialog(
    keyword: string,
    page = customerPage.value,
    pageSize = customerPageSize.value,
  ) {
    const q = keyword?.trim() ?? ''
    customerDialogLoading.value = true
    customerLoading.value = true
    try {
      const res = await request.get('/customers', {
        params: { companyName: q || undefined, page, pageSize },
        skipGlobalErrorHandler: true,
      })
      const data = res.data as { list?: CustomerSelectItem[]; total?: number; page?: number; pageSize?: number }
      customerDialogList.value = (data.list ?? []).map((item) => normalizeCustomer(item))
      customerTotal.value = Number(data.total ?? 0)
      customerPage.value = Number(data.page ?? page)
      customerPageSize.value = Number(data.pageSize ?? pageSize)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('Failed to load customer dialog', getErrorMessage(e))
    } finally {
      customerDialogLoading.value = false
      customerLoading.value = false
    }
  }

  async function openCustomerDialog() {
    customerDialogVisible.value = true
    customerPage.value = 1
    await searchCustomersForDialog(customerKeyword.value, 1, customerPageSize.value)
  }

  function onSelectCustomer(row: CustomerSelectItem) {
    form.customerId = row.id
    form.customerName = row.companyName
    selectedCustomer.value = row
    customerDialogVisible.value = false
  }

  function clearSelectedCustomer() {
    form.customerId = null
    form.customerName = ''
    selectedCustomer.value = null
  }

  async function ensureCustomerById(customerId: number | null | undefined) {
    if (customerId == null || Number.isNaN(Number(customerId))) return
    if (selectedCustomer.value?.id === Number(customerId)) return
    try {
      const res = await request.get(`/customers/${customerId}`, { skipGlobalErrorHandler: true })
      const normalized = normalizeCustomer((res.data ?? {}) as CustomerSelectItem)
      if (Number.isFinite(normalized.id) && normalized.id > 0) {
        selectedCustomer.value = normalized
        if (!String(form.customerName ?? '').trim()) {
          form.customerName = normalized.companyName
        }
      }
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('Failed to complete customer information', getErrorMessage(e))
    }
  }

  let customerSearchTimer: ReturnType<typeof setTimeout> | null = null
  function searchCustomersDebounced(keyword: string) {
    if (customerSearchTimer) clearTimeout(customerSearchTimer)
    customerSearchTimer = setTimeout(() => {
      customerSearchTimer = null
      customerPage.value = 1
      void searchCustomersForDialog(keyword, 1, customerPageSize.value)
    }, 300)
  }

  function onCustomerPageChange(page: number) {
    customerPage.value = page
    void searchCustomersForDialog(customerKeyword.value, page, customerPageSize.value)
  }

  function onCustomerPageSizeChange(size: number) {
    customerPageSize.value = size
    customerPage.value = 1
    void searchCustomersForDialog(customerKeyword.value, 1, size)
  }

  function onCustomerKeywordChange(val: string) {
    customerKeyword.value = val
    if (!customerDialogVisible.value) return
    searchCustomersDebounced(String(val ?? ''))
  }

  return {
    customerLoading,
    customerDialogVisible,
    customerDialogLoading,
    customerDialogList,
    customerKeyword,
    selectedCustomer,
    customerTotal,
    customerPage,
    customerPageSize,
    customerDisplayText,
    searchCustomersForDialog,
    openCustomerDialog,
    onSelectCustomer,
    clearSelectedCustomer,
    ensureCustomerById,
    searchCustomersDebounced,
    onCustomerPageChange,
    onCustomerPageSizeChange,
    onCustomerKeywordChange,
  }
}
