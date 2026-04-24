import { computed, ref, type Ref } from 'vue'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import { getProductSkus, type ProductSkuOption } from '@/api/products'
import type { OrderFormPayload } from '@/api/orders'

export interface OrderSkuCustomer {
  id: number
  customerId: string
  country: string
  companyName: string
  contactPerson: string
  salesperson: string
}

function toLeafOptionLabel(value: string | null | undefined): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const parts = raw
    .split('>')
    .map((item) => item.trim())
    .filter(Boolean)
  return parts.length ? parts[parts.length - 1] : raw
}

export function useOrderSkuSelection(
  form: OrderFormPayload,
  selectedCustomer: Ref<OrderSkuCustomer | null>,
  ensureCustomerById: (customerId: number | null | undefined) => Promise<void> | void,
) {
  const skuDialogVisible = ref(false)
  const skuDialogLoading = ref(false)
  const skuKeyword = ref('')
  const skuProducts = ref<ProductSkuOption[]>([])
  const skuTotal = ref(0)
  const skuPage = ref(1)
  const skuPageSize = ref(20)
  const skuProductGroupName = ref('')
  const skuApplicablePeopleName = ref('')

  const selectedSkuMeta = computed(() => {
    const sku = String(form.skuCode ?? '').trim()
    if (!sku) {
      return {
        productGroupName: toLeafOptionLabel(skuProductGroupName.value),
        applicablePeopleName: skuApplicablePeopleName.value,
      }
    }
    const matched = skuProducts.value.find((item) => String(item.skuCode ?? '').trim() === sku)
    if (matched) {
      return {
        productGroupName: toLeafOptionLabel(matched.productGroup ?? ''),
        applicablePeopleName: matched.applicablePeople ?? '',
      }
    }
    return {
      productGroupName: toLeafOptionLabel(skuProductGroupName.value),
      applicablePeopleName: skuApplicablePeopleName.value,
    }
  })

  let skuSearchTimer: ReturnType<typeof setTimeout> | null = null

  async function searchSkus(keyword: string, page = skuPage.value, pageSize = skuPageSize.value) {
    skuDialogLoading.value = true
    try {
      const kw = keyword.trim()
      const res = await getProductSkus({
        keyword: kw || undefined,
        page,
        pageSize,
      })
      const data = res.data
      skuProducts.value = data?.list ?? []
      skuTotal.value = Number(data?.total ?? 0)
      skuPage.value = Number(data?.page ?? page)
      skuPageSize.value = Number(data?.pageSize ?? pageSize)
    } catch (e: unknown) {
      if (!isErrorHandled(e)) console.warn('Failed to load SKU options', getErrorMessage(e))
    } finally {
      skuDialogLoading.value = false
    }
  }

  function searchSkusDebounced(keyword: string) {
    if (skuSearchTimer) clearTimeout(skuSearchTimer)
    skuSearchTimer = setTimeout(() => {
      skuSearchTimer = null
      skuPage.value = 1
      void searchSkus(keyword, 1, skuPageSize.value)
    }, 300)
  }

  async function openSkuDialog() {
    skuDialogVisible.value = true
    skuPage.value = 1
    await searchSkus(skuKeyword.value, 1, skuPageSize.value)
  }

  function onSkuPageChange(page: number) {
    skuPage.value = page
    void searchSkus(skuKeyword.value, page, skuPageSize.value)
  }

  function onSkuPageSizeChange(size: number) {
    skuPageSize.value = size
    skuPage.value = 1
    void searchSkus(skuKeyword.value, 1, size)
  }

  function onSelectSku(row: ProductSkuOption) {
    form.skuCode = row.skuCode
    skuProductGroupName.value = row.productGroup ?? ''
    skuApplicablePeopleName.value = row.applicablePeople ?? ''
    if (row.imageUrl && !form.imageUrl) {
      form.imageUrl = row.imageUrl
    }
    if (row.customerId && row.customerName) {
      form.customerId = row.customerId
      form.customerName = row.customerName
      selectedCustomer.value = {
        id: row.customerId,
        customerId: '',
        country: '',
        companyName: row.customerName,
        contactPerson: '',
        salesperson: '',
      }
      void ensureCustomerById(row.customerId)
    }
    skuDialogVisible.value = false
  }

  function onSkuKeywordChange(val: string) {
    skuKeyword.value = val
    if (!skuDialogVisible.value) return
    searchSkusDebounced(String(val ?? ''))
  }

  return {
    skuDialogVisible,
    skuDialogLoading,
    skuKeyword,
    skuProducts,
    skuTotal,
    skuPage,
    skuPageSize,
    skuProductGroupName,
    skuApplicablePeopleName,
    selectedSkuMeta,
    searchSkus,
    searchSkusDebounced,
    openSkuDialog,
    onSkuPageChange,
    onSkuPageSizeChange,
    onSelectSku,
    onSkuKeywordChange,
  }
}
