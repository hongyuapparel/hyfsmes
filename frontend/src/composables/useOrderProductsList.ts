import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { PRODUCT_FIELDS_SORTED } from '@/fields'
import {
  batchUpdateFieldOrder,
  getFieldDefinitions,
  updateFieldDefinition,
  type FieldDefinitionItem,
} from '@/api/field-definitions'
import {
  batchDeleteProducts,
  getProductGroupCounts,
  getProductGroups,
  getProducts,
  getProductSalespeople,
  type ProductItem,
} from '@/api/products'
import { getCustomers, type CustomerItem } from '@/api/customers'
import { getDictItems, getDictTree } from '@/api/dicts'
import type { SystemOptionItem, SystemOptionTreeNode } from '@/api/system-options'
import { getErrorMessage, isErrorHandled } from '@/api/request'
import {
  buildFormFields,
  buildGroupTreeWithCounts,
  buildTableFields,
  collectDefaultCollapsedPaths,
  flattenGroupNodes,
  getEffectiveProductFields,
  toProductGroupTreeSelect,
  type ProductFieldLike,
} from '@/utils/order-products'

interface UseOrderProductsListOptions {
  onListUpdated?: () => void
}

export function useOrderProductsList(options: UseOrderProductsListOptions = {}) {
  const list = ref<ProductItem[]>([])
  const productGroupOptions = ref<{ id: number; path: string }[]>([])
  const productGroupsTree = ref<SystemOptionTreeNode[]>([])
  const groupCountsMap = ref<Record<number, number>>({})
  const sidebarCollapsed = ref(false)
  const salespeople = ref<string[]>([])
  const customers = ref<{ id: number; companyName: string }[]>([])
  const applicablePeopleOptions = ref<SystemOptionItem[]>([])
  const selectedIds = ref<number[]>([])
  const fieldDefinitions = ref<FieldDefinitionItem[]>([])
  const columnConfigVisible = ref(false)
  const columnConfigList = ref<{ id: number; code: string; label: string; order: number; visible: boolean }[]>([])

  const companyNameLabelVisible = ref(false)
  const skuCodeLabelVisible = ref(false)
  const productNameLabelVisible = ref(false)

  const filter = reactive({
    productName: '',
    companyName: '',
    skuCode: '',
    productGroupId: null as number | null,
    applicablePeopleId: null as number | null,
    salesperson: '',
  })
  const pagination = reactive({ page: 1, pageSize: 20, total: 0 })
  const sort = reactive({ sortBy: 'createdAt', sortOrder: 'desc' as 'asc' | 'desc' })

  const collapsedGroupPaths = ref<string[]>([])
  const groupCollapseInitialized = ref(false)

  const localFields = PRODUCT_FIELDS_SORTED as unknown as ProductFieldLike[]
  const effectiveFields = computed(() => getEffectiveProductFields(fieldDefinitions.value, localFields))
  const tableFields = computed(() => buildTableFields(effectiveFields.value))
  const formFields = computed(() => buildFormFields(effectiveFields.value))

  const groupTreeWithCounts = computed(() => buildGroupTreeWithCounts(productGroupsTree.value, groupCountsMap.value))
  const flatGroupNodes = computed(() => flattenGroupNodes(groupTreeWithCounts.value, collapsedGroupPaths.value))
  const currentGroupId = computed(() => filter.productGroupId ?? 0)
  const productGroupTreeSelectData = computed(() => toProductGroupTreeSelect(productGroupsTree.value))

  let loadReqId = 0
  let listAbortController: AbortController | null = null
  let searchTimer: ReturnType<typeof setTimeout> | null = null

  async function loadFieldDefinitions() {
    try {
      const res = await getFieldDefinitions('products')
      fieldDefinitions.value = res.data ?? []
    } catch {
      fieldDefinitions.value = []
    }
  }

  async function load() {
    listAbortController?.abort()
    const controller = new AbortController()
    listAbortController = controller
    const currentReqId = ++loadReqId
    try {
      const res = await getProducts(
        {
          productName: filter.productName || undefined,
          companyName: filter.companyName || undefined,
          skuCode: filter.skuCode || undefined,
          productGroupId: filter.productGroupId ?? undefined,
          applicablePeopleId: filter.applicablePeopleId ?? undefined,
          salesperson: filter.salesperson || undefined,
          page: pagination.page,
          pageSize: pagination.pageSize,
          sortBy: sort.sortBy,
          sortOrder: sort.sortOrder,
        },
        { signal: controller.signal },
      )
      const data = res.data
      if (data && currentReqId === loadReqId) {
        list.value = data.list ?? []
        pagination.total = data.total ?? 0
        options.onListUpdated?.()
      }
    } catch (e: unknown) {
      if ((e as { code?: string; name?: string })?.code === 'ERR_CANCELED') return
      if ((e as { code?: string; name?: string })?.name === 'CanceledError') return
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  async function loadOptions() {
    try {
      const [ct, sp, custRes, treeRes, countsRes, apRes] = await Promise.all([
        getProductGroups(),
        getProductSalespeople(),
        getCustomers({ pageSize: 200 }),
        getDictTree('product_groups'),
        getProductGroupCounts(),
        getDictItems('applicable_people'),
      ])
      productGroupOptions.value = ct.data ?? []
      productGroupsTree.value = treeRes.data ?? []
      const countList: Array<{ productGroupId: number; count: number }> = countsRes.data ?? []
      groupCountsMap.value = countList.reduce<Record<number, number>>((acc, { productGroupId, count }) => {
        acc[productGroupId] = count
        return acc
      }, {})
      salespeople.value = sp.data ?? []
      const custList = (custRes.data?.list ?? []) as CustomerItem[]
      customers.value = custList.map((c) => ({ id: c.id, companyName: c.companyName }))
      applicablePeopleOptions.value = apRes.data ?? []
      if (!groupCollapseInitialized.value) {
        collapsedGroupPaths.value = collectDefaultCollapsedPaths(productGroupsTree.value)
        groupCollapseInitialized.value = true
      }
    } catch {
      productGroupOptions.value = []
      productGroupsTree.value = []
      groupCountsMap.value = {}
      salespeople.value = []
      customers.value = []
      applicablePeopleOptions.value = []
    }
  }

  function onMenuSelect(index: string) {
    if (index === '__all__' || index === '0') {
      filter.productGroupId = null
    } else {
      const id = parseInt(index, 10)
      filter.productGroupId = Number.isNaN(id) ? null : id
    }
    pagination.page = 1
    void load()
  }

  function toggleGroupCollapse(path: string) {
    const idx = collapsedGroupPaths.value.indexOf(path)
    if (idx >= 0) collapsedGroupPaths.value.splice(idx, 1)
    else collapsedGroupPaths.value.push(path)
  }

  function onFilterChange(byUser = false) {
    if (byUser) {
      if (filter.productName && String(filter.productName).trim()) productNameLabelVisible.value = true
      if (filter.companyName && String(filter.companyName).trim()) companyNameLabelVisible.value = true
      if (filter.skuCode && String(filter.skuCode).trim()) skuCodeLabelVisible.value = true
    }
    pagination.page = 1
    void load()
  }

  function debouncedSearch() {
    if (searchTimer) clearTimeout(searchTimer)
    searchTimer = setTimeout(() => {
      searchTimer = null
      onFilterChange(false)
    }, 400)
  }

  function resetFilter() {
    productNameLabelVisible.value = false
    companyNameLabelVisible.value = false
    skuCodeLabelVisible.value = false
    filter.productName = ''
    filter.companyName = ''
    filter.skuCode = ''
    filter.productGroupId = null
    filter.applicablePeopleId = null
    filter.salesperson = ''
    pagination.page = 1
    void load()
  }

  function onSelectionChange(rows: ProductItem[]) {
    selectedIds.value = rows.map((r) => r.id)
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

  function openColumnConfig() {
    const raw = fieldDefinitions.value.length
      ? fieldDefinitions.value.map((f) => ({
          id: f.id,
          code: f.code,
          label: f.label,
          order: f.order,
          visible: !!f.visible,
        }))
      : localFields.map((f, i) => ({
          id: 0,
          code: f.code,
          label: f.label,
          order: f.order ?? i,
          visible: true,
        }))
    columnConfigList.value = raw
    columnConfigVisible.value = true
  }

  async function onColumnVisibleChange(item: { id: number; visible: boolean }) {
    if (!item.id || !fieldDefinitions.value.length) return
    try {
      await updateFieldDefinition(item.id, { visible: item.visible })
      await loadFieldDefinitions()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  async function moveColumn(item: { id: number; order: number; code: string }, delta: number) {
    const listCopy = [...columnConfigList.value]
    const idx = listCopy.findIndex((x) => x.id === item.id && x.code === item.code)
    if (idx < 0 || (delta < 0 && idx === 0) || (delta > 0 && idx === listCopy.length - 1)) return
    const swapIdx = idx + delta
    ;[listCopy[idx].order, listCopy[swapIdx].order] = [listCopy[swapIdx].order, listCopy[idx].order]
    listCopy.sort((a, b) => a.order - b.order)
    columnConfigList.value = listCopy
    if (fieldDefinitions.value.length && listCopy.some((x) => x.id > 0)) {
      try {
        await batchUpdateFieldOrder(
          'products',
          listCopy.map((x, i) => ({ id: x.id, order: i })).filter((x) => x.id > 0),
        )
        await loadFieldDefinitions()
      } catch (e: unknown) {
        if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
      }
    }
  }

  async function batchDelete() {
    if (!selectedIds.value.length) return
    await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 个产品？`, '提示', {
      type: 'warning',
    }).catch(() => {})
    try {
      await batchDeleteProducts(selectedIds.value)
      ElMessage.success('已删除')
      await load()
    } catch (e: unknown) {
      if (!isErrorHandled(e)) ElMessage.error(getErrorMessage(e))
    }
  }

  function cleanup() {
    listAbortController?.abort()
    if (searchTimer) {
      clearTimeout(searchTimer)
      searchTimer = null
    }
  }

  watch(
    () => filter.productName,
    (v) => {
      if (!v || !String(v).trim()) productNameLabelVisible.value = false
    },
  )
  watch(
    () => filter.companyName,
    (v) => {
      if (!v || !String(v).trim()) companyNameLabelVisible.value = false
    },
  )
  watch(
    () => filter.skuCode,
    (v) => {
      if (!v || !String(v).trim()) skuCodeLabelVisible.value = false
    },
  )

  return {
    list,
    filter,
    pagination,
    tableFields,
    formFields,
    productGroupTreeSelectData,
    productGroupOptions,
    salespeople,
    customers,
    applicablePeopleOptions,
    fieldDefinitions,
    selectedIds,
    sidebarCollapsed,
    flatGroupNodes,
    currentGroupId,
    companyNameLabelVisible,
    skuCodeLabelVisible,
    productNameLabelVisible,
    columnConfigVisible,
    columnConfigList,
    load,
    loadFieldDefinitions,
    loadOptions,
    onMenuSelect,
    toggleGroupCollapse,
    onFilterChange,
    debouncedSearch,
    resetFilter,
    onSelectionChange,
    onSortChange,
    openColumnConfig,
    onColumnVisibleChange,
    moveColumn,
    batchDelete,
    cleanup,
  }
}
